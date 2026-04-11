function registerAdminRoutes(app, deps) {
  const {
    buildTodayDateString,
    clamp,
    config,
    expandProposal,
    getPromptRoom,
    isDuplicateKeyError,
    pool,
    requireAdmin,
    safeJsonParse,
    withTransaction,
  } = deps;

  app.get("/api/admin/proposals", async (req, res) => {
    const auth = await requireAdmin(req, res);
    if (!auth) {
      return;
    }

    const [rows] = await pool.query(
      `
        SELECT
          proposals.*,
          categories.slug AS category_slug,
          categories.name AS category_name
        FROM prompt_room_proposals AS proposals
        INNER JOIN categories ON categories.id = proposals.category_id
        ORDER BY CASE proposals.status WHEN 'pending' THEN 0 ELSE 1 END, proposals.created_at DESC
      `,
    );

    res.json({
      player: auth.player,
      proposals: rows.map(expandProposal),
    });
  });

  app.post("/api/admin/proposals/:id/approve", async (req, res) => {
    const auth = await requireAdmin(req, res);
    if (!auth) {
      return;
    }

    const proposalId = Number(req.params.id);
    const reviewNote = (req.body?.reviewNote || "관리자 승인").toString().trim().slice(0, 500);

    try {
      const result = await withTransaction(async (connection) => {
        const [rows] = await connection.query(
          `
            SELECT
              proposals.*,
              categories.slug AS category_slug,
              categories.name AS category_name
            FROM prompt_room_proposals AS proposals
            INNER JOIN categories ON categories.id = proposals.category_id
            WHERE proposals.id = ?
            LIMIT 1
            FOR UPDATE
          `,
          [proposalId],
        );

        const row = rows[0];
        if (!row) {
          const error = new Error("승인할 제안을 찾지 못했습니다.");
          error.status = 404;
          throw error;
        }

        if (row.status === "approved" && row.approved_room_id) {
          return {
            roomId: Number(row.approved_room_id),
            created: false,
          };
        }

        if (row.status === "rejected") {
          const error = new Error("이미 반려된 제안입니다. 상태를 먼저 다시 확인해 주세요.");
          error.status = 409;
          throw error;
        }

        const aiReview = safeJsonParse(row.ai_review_json, {});
        const roomPayload = {
          openDate: (req.body?.openDate || buildTodayDateString(config.timezone)).toString().trim(),
          categoryId: Number(row.category_id),
          titleAsAnswer: (req.body?.titleAsAnswer || row.proposed_answer).toString().trim(),
          answerType: row.answer_type,
          maxInputChars: clamp(
            Number(req.body?.maxInputChars || aiReview.recommendedMaxInputChars || 120),
            40,
            240,
          ),
          thresholdScore: clamp(
            Number(req.body?.thresholdScore || aiReview.recommendedThresholdScore || 82),
            10,
            100,
          ),
          teaserText:
            (req.body?.teaserText || aiReview.teaserText || "답을 직접 말하게 만드는 방입니다.")
              .toString()
              .trim()
              .slice(0, 255),
          tone:
            (req.body?.tone || aiReview.tone || "친한 친구처럼 놀리다가도 흔들리는 캐릭터 톤")
              .toString()
              .trim()
              .slice(0, 255),
          status: (req.body?.status || "active").toString().trim(),
        };

        let roomId;
        try {
          const [insertResult] = await connection.query(
            `
              INSERT INTO prompt_rooms (
                open_date,
                category_id,
                title_as_answer,
                answer_type,
                max_input_chars,
                threshold_score,
                teaser_text,
                tone,
                ai_review_json,
                status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              roomPayload.openDate,
              roomPayload.categoryId,
              roomPayload.titleAsAnswer,
              roomPayload.answerType,
              roomPayload.maxInputChars,
              roomPayload.thresholdScore,
              roomPayload.teaserText,
              roomPayload.tone,
              JSON.stringify(aiReview),
              roomPayload.status,
            ],
          );
          roomId = Number(insertResult.insertId);
        } catch (error) {
          if (!isDuplicateKeyError(error)) {
            throw error;
          }

          const duplicateError = new Error("같은 날짜와 정답으로 열린 방이 이미 있습니다. 기존 방을 먼저 확인해 주세요.");
          duplicateError.status = 409;
          throw duplicateError;
        }

        await connection.query(
          `
            UPDATE prompt_room_proposals
            SET
              status = 'approved',
              approved_room_id = ?,
              review_note = ?,
              reviewed_by_user_id = ?,
              reviewed_at = UTC_TIMESTAMP()
            WHERE id = ?
          `,
          [roomId, reviewNote || null, auth.user.id, proposalId],
        );

        return {
          roomId,
          created: true,
        };
      });

      res.status(result.created ? 201 : 200).json({
        room: await getPromptRoom(result.roomId),
      });
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });

  app.post("/api/admin/proposals/:id/reject", async (req, res) => {
    const auth = await requireAdmin(req, res);
    if (!auth) {
      return;
    }

    const proposalId = Number(req.params.id);
    const reviewNote = (req.body?.reason || req.body?.reviewNote || "관리자 반려")
      .toString()
      .trim()
      .slice(0, 500);

    try {
      await withTransaction(async (connection) => {
        const [rows] = await connection.query(
          "SELECT id, status, approved_room_id FROM prompt_room_proposals WHERE id = ? LIMIT 1 FOR UPDATE",
          [proposalId],
        );

        const row = rows[0];
        if (!row) {
          const error = new Error("반려할 제안을 찾지 못했습니다.");
          error.status = 404;
          throw error;
        }

        if (row.status === "approved") {
          const error = new Error("이미 승인된 제안은 반려할 수 없습니다.");
          error.status = 409;
          throw error;
        }

        await connection.query(
          `
            UPDATE prompt_room_proposals
            SET
              status = 'rejected',
              review_note = ?,
              reviewed_by_user_id = ?,
              reviewed_at = UTC_TIMESTAMP()
            WHERE id = ?
          `,
          [reviewNote || null, auth.user.id, proposalId],
        );
      });

      res.json({ ok: true });
    } catch (error) {
      if (error?.status) {
        return res.status(error.status).json({ message: error.message });
      }
      throw error;
    }
  });
}

module.exports = {
  registerAdminRoutes,
};
