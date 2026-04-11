function registerPromptRoutes(app, deps) {
  const {
    PROMPT_ATTEMPT_LIMIT,
    blendPromptScores,
    buildPromptInvalidMessage,
    buildPromptState,
    buildPromptSuccessMessage,
    ensureParticipant,
    evaluatePromptInput,
    getParticipant,
    getPromptHomeLeaderboards,
    getPromptLeaderboards,
    getPromptRoom,
    insertWin,
    isDuplicateKeyError,
    listPromptRooms,
    lockParticipantState,
    mapPromptCategory,
    pool,
    requestLambdaOperation,
    requireAuth,
    stripSpacingAndPunctuation,
    withTransaction,
  } = deps;

  app.get("/api/prompt-rooms/home-leaderboard", async (req, res) => {
    res.json({ leaderboards: await getPromptHomeLeaderboards() });
  });

  app.get("/api/prompt-rooms", async (req, res) => {
    const category = (req.query?.category || "").toString().trim();
    const status = (req.query?.status || "active").toString().trim();
    res.json({ rooms: await listPromptRooms(category, status) });
  });

  app.post("/api/prompt-rooms/:roomId/join", async (req, res) => {
    const room = await getPromptRoom(Number(req.params.roomId));
    const auth = await requireAuth(req, res);

    if (!room || room.status !== "active") {
      return res.status(404).json({ message: "그 방은 열려 있지 않아." });
    }
    if (!auth) {
      return;
    }

    const participant = await ensureParticipant(
      "prompt",
      room.id,
      auth.user.id,
      auth.token,
      auth.user.nickname,
    );
    return res.status(201).json({
      participant,
      snapshot: await buildPromptState(room, auth.user.id),
    });
  });

  app.get("/api/prompt-rooms/:roomId/state", async (req, res) => {
    const room = await getPromptRoom(Number(req.params.roomId));
    if (!room || room.status !== "active") {
      return res.status(404).json({ message: "그 방은 못 찾겠다." });
    }

    const auth = await requireAuth(req, res);
    if (!auth) {
      return;
    }

    res.json(await buildPromptState(room, auth.user.id));
  });

  app.post("/api/prompt-rooms/:roomId/attempts", async (req, res) => {
    const room = await getPromptRoom(Number(req.params.roomId));
    const auth = await requireAuth(req, res);
    const inputText = (req.body?.inputText || req.body?.input || "").toString().trim();

    if (!room || room.status !== "active") {
      return res.status(404).json({ message: "그 방은 열려 있지 않아." });
    }
    if (!auth) {
      return;
    }
    if (!inputText) {
      return res.status(400).json({ message: "프롬프트를 비워 두면 뭘 흔들겠어." });
    }
    if ([...inputText].length > room.maxInputChars) {
      return res.status(400).json({
        message: "이 방은 최대 " + room.maxInputChars + "자까지만 받는다. 그렇게 길게 쓰면 티 나.",
      });
    }

    const participant =
      (await getParticipant("prompt", room.id, { userId: auth.user.id })) ||
      (await ensureParticipant("prompt", room.id, auth.user.id, auth.token, auth.user.nickname));

    if (!participant) {
      return res.status(400).json({ message: "먼저 로그인하고 들어와." });
    }

    const evaluation = evaluatePromptInput(inputText, room);
    let reservedAttempt;

    try {
      reservedAttempt = await withTransaction(async (connection) => {
        const { attempts } = await lockParticipantState(connection, participant.id);

        if (attempts.some((attempt) => attempt.status === "pending")) {
          const error = new Error("AI가 아직 대답 중이야. 숨 좀 돌려.");
          error.status = 409;
          throw error;
        }
        if (attempts.some((attempt) => attempt.isSuccess)) {
          const error = new Error("이 방은 이미 네가 이겼다. 더는 못 친다.");
          error.status = 409;
          throw error;
        }
        if (attempts.length >= PROMPT_ATTEMPT_LIMIT) {
          const error = new Error("이 방 기회는 다 썼다. 다섯 번이면 충분했지?");
          error.status = 409;
          throw error;
        }

        const attemptIndex = attempts.length + 1;
        const [insertResult] = await connection.query(
          `
            INSERT INTO attempts (
              mode,
              target_id,
              participant_id,
              attempt_index,
              input_text,
              normalized_input,
              status
            )
            VALUES ('prompt', ?, ?, ?, ?, ?, 'pending')
          `,
          [room.id, participant.id, attemptIndex, inputText, stripSpacingAndPunctuation(inputText).slice(0, 255)],
        );

        return {
          attemptId: Number(insertResult.insertId),
          attemptIndex,
        };
      });
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ message: error.message });
      }
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ message: "같은 프롬프트 시도를 동시에 처리할 수 없어요. 잠깐 뒤에 다시 시도해 주세요." });
      }
      throw error;
    }

    const { attemptId, attemptIndex } = reservedAttempt;

    try {
      let finalScore = evaluation.heuristicScore;
      let mapped = mapPromptCategory(finalScore, room.thresholdScore);
      let aiMessage = evaluation.isBlocked ? buildPromptInvalidMessage(evaluation.invalidReason) : "";

      if (!evaluation.isBlocked) {
        const aiResult = await requestLambdaOperation("prompt_evaluate", {
          answer: room.titleAsAnswer,
          userInput: inputText,
          inputText,
          thresholdScore: room.thresholdScore,
          heuristicScore: evaluation.heuristicScore,
          serverBaseScore: evaluation.heuristicScore,
          dimensions: evaluation.dimensions,
          maxInputChars: room.maxInputChars,
          tone: room.tone,
        });
        finalScore = blendPromptScores(
          evaluation.heuristicScore,
          Number(aiResult.score || evaluation.heuristicScore),
        );
        mapped = mapPromptCategory(finalScore, room.thresholdScore);
        aiMessage = aiResult.message || "이걸 프롬프트라고 가져왔냐. 그래도 아주 버릴 정도는 아니네.";
      }

      const isSuccess = !evaluation.isBlocked && finalScore >= room.thresholdScore;
      if (isSuccess) {
        mapped = { category: "defeated_success", state: "defeated_success" };
        aiMessage = buildPromptSuccessMessage(room.titleAsAnswer);
      }

      await withTransaction(async (connection) => {
        const [updateResult] = await connection.query(
          `
            UPDATE attempts
            SET
              status = 'completed',
              primary_score = ?,
              final_score = ?,
              dimension_json = ?,
              reaction_category = ?,
              character_state = ?,
              ai_message = ?,
              invalid_reason = ?,
              is_success = ?,
              responded_at = NOW()
            WHERE id = ? AND status = 'pending'
          `,
          [
            evaluation.heuristicScore,
            finalScore,
            JSON.stringify(evaluation.dimensions),
            mapped.category,
            mapped.state,
            aiMessage,
            evaluation.invalidReason || null,
            isSuccess ? 1 : 0,
            attemptId,
          ],
        );

        if (!updateResult.affectedRows) {
          const error = new Error("이미 처리된 시도입니다. 새로고침 후 다시 확인해 주세요.");
          error.status = 409;
          throw error;
        }

        if (isSuccess) {
          try {
            await insertWin("prompt", room.id, participant.id, attemptId, connection);
          } catch (error) {
            if (!isDuplicateKeyError(error)) {
              throw error;
            }
          }
        }
      });

      return res.status(201).json({
        attempt: {
          id: attemptId,
          attemptIndex,
          inputText,
          finalScore,
          aiMessage,
          reactionCategory: mapped.category,
          characterState: mapped.state,
          isSuccess,
        },
        snapshot: await buildPromptState(room, auth.user.id),
      });
    } catch (error) {
      await pool.query(
        "UPDATE attempts SET status = 'error', invalid_reason = 'internal_error', responded_at = NOW() WHERE id = ?",
        [attemptId],
      );
      throw error;
    }
  });

  app.get("/api/prompt-rooms/:roomId/leaderboard", async (req, res) => {
    const room = await getPromptRoom(Number(req.params.roomId));
    if (!room) {
      return res.status(404).json({ message: "그 방이 없어." });
    }
    res.json({ leaderboards: await getPromptLeaderboards(room.id) });
  });
}

module.exports = {
  registerPromptRoutes,
};
