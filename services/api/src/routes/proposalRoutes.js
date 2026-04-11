function registerProposalRoutes(app, deps) {
  const {
    expandProposal,
    listCategories,
    pool,
    requestLambdaOperation,
    requireAuth,
  } = deps;

  app.post("/api/proposals", async (req, res) => {
    const auth = await requireAuth(req, res, { allowGuest: false });
    const proposedAnswer = (req.body?.proposedAnswer || "").toString().trim();
    const answerType = (req.body?.answerType || "word").toString().trim();
    const proposalNote = (req.body?.proposalNote || "").toString().trim();
    const categoryId = Number(req.body?.categoryId || 0);
    const categorySlug = (req.body?.categorySlug || "").toString().trim();

    if (!auth) {
      return;
    }
    if (!proposedAnswer) {
      return res.status(400).json({ message: "문제 후보를 비워 두지 마." });
    }

    const categories = await listCategories();
    const category = categories.find(
      (item) => item.id === categoryId || (categorySlug && item.slug === categorySlug),
    );
    if (!category) {
      return res.status(400).json({ message: "카테고리를 제대로 골라." });
    }

    const aiReview = await requestLambdaOperation("proposal_review", {
      proposedAnswer,
      answerType,
      categoryName: category.name,
      proposalNote,
      categorySlug: category.slug,
    });

    const [result] = await pool.query(
      `
        INSERT INTO prompt_room_proposals (
          proposer_user_id,
          proposer_session_id,
          proposer_nickname,
          category_id,
          proposed_answer,
          answer_type,
          proposal_note,
          ai_review_json,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
      [
        auth.user.id,
        auth.token,
        auth.user.nickname,
        category.id,
        proposedAnswer,
        answerType,
        proposalNote,
        JSON.stringify(aiReview),
      ],
    );

    const [rows] = await pool.query(
      `
        SELECT
          proposals.*,
          categories.slug AS category_slug,
          categories.name AS category_name
        FROM prompt_room_proposals AS proposals
        INNER JOIN categories ON categories.id = proposals.category_id
        WHERE proposals.id = ?
        LIMIT 1
      `,
      [result.insertId],
    );

    return res.status(201).json({
      proposal: expandProposal(rows[0]),
    });
  });
}

module.exports = {
  registerProposalRoutes,
};
