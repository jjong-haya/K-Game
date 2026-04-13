function registerWordRoutes(app, deps) {
  const {
    WORD_AI_HINT_LIMIT,
    WORD_HINT_TYPES,
    buildStoredHintType,
    buildWordReactionMeta,
    buildWordSnapshot,
    buildWordSuccessMessage,
    ensureDailyWordChallengeAvailable,
    ensureParticipant,
    ensureWordInputValid,
    getDailySynonyms,
    getDailyWordChallenge,
    getParticipant,
    getSharedWordAiHints,
    getWordLeaderboards,
    insertWin,
    isDuplicateKeyError,
    isWordMatch,
    listCategories,
    lockParticipantState,
    requestLambdaOperation,
    requireAuth,
    withTransaction,
    wordTurnService,
  } = deps;

  app.get("/api/categories", async (req, res) => {
    res.json({ categories: await listCategories() });
  });

  app.get("/api/word/daily", async (req, res) => {
    const challenge = await getDailyWordChallenge();
    const auth = await requireAuth(req, res);
    if (!auth) {
      return;
    }
    if (!ensureDailyWordChallengeAvailable(res, challenge)) {
      return;
    }

    res.json(await buildWordSnapshot(auth.user.id));
  });

  app.post("/api/word/daily/join", async (req, res) => {
    const challenge = await getDailyWordChallenge();
    const auth = await requireAuth(req, res);
    if (!auth) {
      return;
    }
    if (!ensureDailyWordChallengeAvailable(res, challenge)) {
      return;
    }

    const participant = await ensureParticipant(
      "word",
      challenge.id,
      auth.user.id,
      auth.token,
      auth.user.nickname,
    );

    return res.status(201).json({
      participant,
      snapshot: await buildWordSnapshot(auth.user.id),
    });
  });

  app.post("/api/word/daily/attempts", async (req, res) => {
    const challenge = await getDailyWordChallenge();
    const auth = await requireAuth(req, res);
    const inputText = (req.body?.inputText || req.body?.input || "").toString().trim();
    const model = (req.body?.model || "nova").toString().trim().toLowerCase() === "gemini" ? "gemini" : "nova";

    if (!auth) {
      return;
    }
    if (!ensureDailyWordChallengeAvailable(res, challenge)) {
      return;
    }

    const validation = ensureWordInputValid(inputText);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.reason });
    }

    try {
      const result = await wordTurnService.submitAttempt({
        challenge,
        auth,
        inputText: validation.normalizedInput,
        model,
      });

      return res.status(result.transientFailure ? 200 : 201).json(result);
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ message: error.message });
      }
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ message: "같은 시도를 동시에 처리할 수 없어요. 잠깐 뒤에 다시 시도해 주세요." });
      }
      throw error;
    }
  });

  app.post("/api/word/daily/answer", async (req, res) => {
    const challenge = await getDailyWordChallenge();
    const auth = await requireAuth(req, res);
    const answerText = (req.body?.answer || "").toString().trim();

    if (!auth) {
      return;
    }
    if (!ensureDailyWordChallengeAvailable(res, challenge)) {
      return;
    }
    if (!answerText) {
      return res.status(400).json({ message: "정답을 입력해 주세요." });
    }

    const normalizedInput = answerText.replace(/\s+/g, "").toLowerCase();
    const normalizedAnswer = challenge.hiddenAnswerText.replace(/\s+/g, "").toLowerCase();
    const isCorrect = isWordMatch(answerText, challenge.hiddenAnswerText)
      || (normalizedAnswer.length >= 2 && normalizedInput.includes(normalizedAnswer));

    if (isCorrect) {
      const participant =
        (await getParticipant("word", challenge.id, { userId: auth.user.id })) ||
        (await ensureParticipant("word", challenge.id, auth.user.id, auth.token, auth.user.nickname));

      if (participant) {
        try {
          await withTransaction(async (connection) => {
            const { attempts } = await lockParticipantState(connection, participant.id);
            if (attempts.some((attempt) => attempt.isSuccess)) {
              return;
            }

            const attemptIndex = attempts.length + 1;
            const successReaction = buildWordReactionMeta({
              reactionState: "defeated_success",
              reactionLabel: "정답 인정",
              reactionEmoji: "🤯",
              reactionLine: "와, 그걸 진짜 맞혀버리네. 이번 판은 인정.",
              tag: "O",
              reasonType: "binary_judgment",
            });
            const [insertResult] = await connection.query(
              `INSERT INTO attempts (mode, target_id, participant_id, attempt_index, input_text, normalized_input, status, primary_score, final_score, dimension_json, reaction_category, character_state, ai_message, is_success, responded_at)
               VALUES ('word', ?, ?, ?, ?, ?, 'completed', 100, 100, ?, 'exact_match', 'defeated_success', ?, 1, NOW())`,
              [
                challenge.id,
                participant.id,
                attemptIndex,
                answerText,
                normalizedInput,
                JSON.stringify({ wordReaction: successReaction }),
                buildWordSuccessMessage(challenge.hiddenAnswerText),
              ],
            );
            await insertWin("word", challenge.id, participant.id, Number(insertResult.insertId), connection);
          });
        } catch (error) {
          if (!isDuplicateKeyError(error)) {
            throw error;
          }
        }
      }
    }

    const snapshot = await buildWordSnapshot(auth.user.id);
    return res.json({
      correct: isCorrect,
      answer: isCorrect ? challenge.hiddenAnswerText : null,
      message: isCorrect
        ? `🎉 정답! "${challenge.hiddenAnswerText}" 맞혔습니다!`
        : "❌ 틀렸습니다. 다시 도전해보세요!",
      snapshot,
    });
  });

  app.post("/api/word/daily/hints", async (req, res) => {
    const challenge = await getDailyWordChallenge();
    const auth = await requireAuth(req, res);
    const hintType = (req.body?.hintType || "").toString().trim();

    if (!auth) {
      return;
    }
    if (!ensureDailyWordChallengeAvailable(res, challenge)) {
      return;
    }

    if (!WORD_HINT_TYPES.includes(hintType)) {
      return res.status(400).json({ message: "그 힌트는 없어." });
    }

    const participant =
      (await getParticipant("word", challenge.id, { userId: auth.user.id })) ||
      (await ensureParticipant("word", challenge.id, auth.user.id, auth.token, auth.user.nickname));

    if (!participant) {
      return res.status(400).json({ message: "먼저 로그인하고 들어와." });
    }

    let revealedText = "";

    try {
      const result = await withTransaction(async (connection) => {
        const { hintUses } = await lockParticipantState(connection, participant.id);
        const aiHintUses = hintUses.filter((hint) => hint.hintType === "best_guess_ai");

        if (hintType !== "best_guess_ai" && hintUses.some((hint) => hint.hintType === hintType)) {
          const error = new Error("그 힌트는 이미 봤다.");
          error.status = 409;
          throw error;
        }

        if (hintType === "best_guess_ai" && aiHintUses.length >= WORD_AI_HINT_LIMIT) {
          const error = new Error("AI 힌트는 세 번 다 썼다.");
          error.status = 409;
          throw error;
        }

        const storedHintType = buildStoredHintType(hintType, hintUses);
        let nextRevealedText = challenge.fixedHintText;
        if (hintType === "category") {
          nextRevealedText = challenge.category.name;
        } else if (hintType === "best_guess_ai") {
          const nextHintIndex = aiHintUses.length + 1;

          await connection.query(
            "SELECT id FROM daily_word_challenges WHERE id = ? LIMIT 1 FOR UPDATE",
            [challenge.id],
          );

          const sharedAiHints = await getSharedWordAiHints(challenge.id, connection);
          const existingSharedHint = sharedAiHints.find((hint) => hint.hintIndex === nextHintIndex);

          if (existingSharedHint) {
            nextRevealedText = existingSharedHint.revealedText;
          } else {
            const aiResult = await requestLambdaOperation("ai_hint", {
              requestKind: "hint",
              hiddenAnswer: challenge.hiddenAnswerText,
              hiddenCategory: challenge.category.name,
              hintUsageState: { usedCount: nextHintIndex - 1 },
              previousHints: sharedAiHints.map((hint) => hint.revealedText),
            });

            if (aiResult?.error || !aiResult?.message) {
              const error = new Error(aiResult?.message || "AI 힌트 생성에 실패했습니다. 잠시 뒤 다시 시도해 주세요.");
              error.status = 503;
              throw error;
            }

            nextRevealedText = aiResult.message;

            await connection.query(
              `
                INSERT INTO daily_word_ai_hints (challenge_id, hint_index, revealed_text)
                VALUES (?, ?, ?)
              `,
              [challenge.id, nextHintIndex, nextRevealedText],
            );
          }
        }

        await connection.query(
          "INSERT INTO hint_uses (participant_id, hint_type, revealed_text) VALUES (?, ?, ?)",
          [participant.id, storedHintType, nextRevealedText],
        );

        return { revealedText: nextRevealedText };
      });

      revealedText = result.revealedText;
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ message: error.message });
      }
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ message: "그 힌트는 이미 봤다." });
      }
      throw error;
    }

    return res.status(201).json({
      hint: { hintType, revealedText },
      snapshot: await buildWordSnapshot(auth.user.id),
    });
  });

  app.get("/api/word/daily/leaderboard", async (req, res) => {
    const challenge = await getDailyWordChallenge();
    if (!ensureDailyWordChallengeAvailable(res, challenge)) {
      return;
    }
    res.json({ leaderboards: await getWordLeaderboards(challenge.id) });
  });
}

module.exports = {
  registerWordRoutes,
};
