function registerAuthRoutes(app, deps) {
  const {
    authService,
    buildPlayerPayload,
    clearSessionCookie,
    getNickname,
    getPlayerToken,
    requireAuth,
    respondAuthError,
    setSessionCookie,
  } = deps;

  const handleSocialExchange = async (req, res, forcedProvider = "") => {
    const supabaseAccessToken = (req.body?.supabaseAccessToken || "").toString().trim();
    const provider = (forcedProvider || req.body?.provider || "google").toString().trim().toLowerCase();
    const nickname = getNickname(req);
    const currentGuestSessionToken = (req.header("x-current-guest-token") || getPlayerToken(req) || "")
      .toString()
      .trim();

    if (!supabaseAccessToken) {
      return res.status(400).json({ message: "Supabase access token이 비어 있습니다." });
    }

    try {
      const authPayload = await authService.exchangeSocialSession({
        provider,
        supabaseAccessToken,
        nickname,
        currentGuestSessionToken,
      });

      setSessionCookie(res, authPayload.sessionToken, authPayload.expiresAt);
      res.status(201).json({
        sessionToken: authPayload.sessionToken,
        expiresAt: authPayload.expiresAt,
        player: buildPlayerPayload(authPayload.player),
      });
    } catch (error) {
      respondAuthError(res, error);
    }
  };

  app.post("/api/auth/guest", async (req, res) => {
    const nickname = getNickname(req);
    if (!nickname) {
      return res.status(400).json({ message: "게스트 닉네임을 먼저 정해 주세요." });
    }

    try {
      const authPayload = await authService.createGuestSession(nickname);
      setSessionCookie(res, authPayload.sessionToken, authPayload.expiresAt);
      res.status(201).json({
        sessionToken: authPayload.sessionToken,
        expiresAt: authPayload.expiresAt,
        player: buildPlayerPayload(authPayload.player),
      });
    } catch (error) {
      respondAuthError(res, error);
    }
  });

  app.post("/api/auth/social/exchange", async (req, res) => handleSocialExchange(req, res));
  app.post("/api/auth/google/exchange", async (req, res) => handleSocialExchange(req, res, "google"));
  app.post("/api/auth/apple/exchange", async (req, res) => handleSocialExchange(req, res, "apple"));

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await authService.loginWithCredentials(username, password);
      setSessionCookie(res, result.sessionToken, result.expiresAt);
      res.json({
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
        player: buildPlayerPayload({
          ...result.player,
          id: result.player.id,
          authType: "id",
          nickname: result.player.nickname,
          email: result.player.email,
          isTemporary: false,
        }),
      });
    } catch (error) {
      respondAuthError(res, error);
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    const token = getPlayerToken(req);
    const auth = await requireAuth(req, res);
    if (!auth) {
      return;
    }

    res.json({
      sessionToken: token,
      expiresAt: auth.session.expiresAt,
      player: auth.player,
    });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = getPlayerToken(req);
    clearSessionCookie(res);
    if (!token) {
      return res.json({ ok: true });
    }

    try {
      const result = await authService.logoutSession(token);
      res.json({ ok: true, ...result });
    } catch (error) {
      respondAuthError(res, error, 500);
    }
  });

  app.delete("/api/auth/account", async (req, res) => {
    const auth = await requireAuth(req, res);
    if (!auth) {
      return;
    }

    try {
      const result = await authService.deleteAccount(auth.session.token);
      clearSessionCookie(res);
      res.json({ ok: true, ...result });
    } catch (error) {
      respondAuthError(res, error, 500);
    }
  });

  app.patch("/api/auth/profile", async (req, res) => {
    const auth = await requireAuth(req, res);
    if (!auth) {
      return;
    }

    const nickname = getNickname(req);
    if (!nickname) {
      return res.status(400).json({ message: "변경할 닉네임을 입력해 주세요." });
    }

    try {
      const result = await authService.updateProfile(auth.token, nickname);
      res.json({
        ...result,
        player: buildPlayerPayload(result.player),
      });
    } catch (error) {
      respondAuthError(res, error);
    }
  });
}

module.exports = {
  registerAuthRoutes,
};
