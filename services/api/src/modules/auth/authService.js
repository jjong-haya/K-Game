const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const { createRemoteJWKSet, jwtVerify } = require("jose");

const NICKNAME_MAX_LENGTH = 40;
const DEFAULT_SOCIAL_NICKNAME = "social_player";
const ALLOWED_SOCIAL_PROVIDERS = new Set(["google", "apple"]);

function createAuthService({ pool, config }) {
  const jwks = config.supabaseUrl
    ? createRemoteJWKSet(new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`))
    : null;

  function sanitizeNickname(rawNickname) {
    return (rawNickname || "")
      .toString()
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, NICKNAME_MAX_LENGTH);
  }

  function buildEmailNickname(email) {
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return DEFAULT_SOCIAL_NICKNAME;
    }

    return sanitizeNickname(email.split("@")[0]) || DEFAULT_SOCIAL_NICKNAME;
  }

  function normalizeSocialProvider(provider) {
    if (!ALLOWED_SOCIAL_PROVIDERS.has(provider)) {
      throw new Error("지원하지 않는 소셜 로그인 방식입니다.");
    }

    return provider;
  }

  function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  function createSessionToken() {
    return crypto.randomBytes(32).toString("base64url");
  }

  function buildExpiryDate({ kind = "app" } = {}) {
    const now = new Date();

    if (kind === "guest") {
      now.setHours(now.getHours() + config.auth.guestSessionHours);
      return now;
    }

    now.setDate(now.getDate() + config.auth.appSessionDays);
    return now;
  }

  function mapUser(row) {
    if (!row) {
      return null;
    }

    return {
      id: Number(row.user_id || row.id),
      authType: row.auth_type,
      supabaseUserId: row.supabase_user_id || null,
      email: row.email || null,
      nickname: row.nickname,
      isTemporary: Boolean(row.is_temporary),
      isActive: Boolean(row.is_active),
      createdAt: row.user_created_at || row.created_at,
      updatedAt: row.updated_at || null,
      deletedAt: row.deleted_at || null,
      lastLoginAt: row.last_login_at || null,
    };
  }

  function mapSession(row, plainToken = null) {
    if (!row) {
      return null;
    }

    return {
      id: Number(row.session_id || row.id),
      sessionKind: row.session_kind,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at || null,
      createdAt: row.session_created_at || row.created_at,
      lastUsedAt: row.last_used_at || null,
      token: plainToken,
      user: mapUser(row),
    };
  }

  async function createSessionRecord(connection, userId, kind = "app") {
    const sessionToken = createSessionToken();
    const sessionTokenHash = hashToken(sessionToken);
    const expiresAt = buildExpiryDate({ kind });

    const [result] = await connection.query(
      `
        INSERT INTO auth_sessions (
          user_id,
          session_token_hash,
          session_kind,
          expires_at
        )
        VALUES (?, ?, ?, ?)
      `,
      [userId, sessionTokenHash, kind, expiresAt],
    );

    return {
      id: Number(result.insertId),
      token: sessionToken,
      expiresAt,
      sessionKind: kind,
    };
  }

  async function findUserBySupabaseId(connection, supabaseUserId) {
    const [rows] = await connection.query(
      "SELECT * FROM users WHERE supabase_user_id = ? LIMIT 1",
      [supabaseUserId],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async function findSessionByToken(connection, sessionToken, options = {}) {
    const { touch = false, allowExpired = false } = options;
    if (!sessionToken) {
      return null;
    }

    const sessionTokenHash = hashToken(sessionToken);
    const [rows] = await connection.query(
      `
        SELECT
          auth_sessions.id AS session_id,
          auth_sessions.user_id,
          auth_sessions.session_kind,
          auth_sessions.expires_at,
          auth_sessions.revoked_at,
          auth_sessions.created_at AS session_created_at,
          auth_sessions.last_used_at,
          users.id AS user_id,
          users.auth_type,
          users.supabase_user_id,
          users.email,
          users.nickname,
          users.is_temporary,
          users.is_active,
          users.created_at AS user_created_at,
          users.updated_at,
          users.deleted_at,
          users.last_login_at
        FROM auth_sessions
        INNER JOIN users ON users.id = auth_sessions.user_id
        WHERE auth_sessions.session_token_hash = ?
          AND auth_sessions.revoked_at IS NULL
          AND users.is_active = 1
          AND (? = 1 OR auth_sessions.expires_at > UTC_TIMESTAMP())
        LIMIT 1
      `,
      [sessionTokenHash, allowExpired ? 1 : 0],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    if (touch) {
      await connection.query(
        "UPDATE auth_sessions SET last_used_at = UTC_TIMESTAMP() WHERE id = ?",
        [row.session_id],
      );
      row.last_used_at = new Date();
    }

    return mapSession(row, sessionToken);
  }

  async function resolveSession(sessionToken, options = {}) {
    const connection = await pool.getConnection();
    try {
      return await findSessionByToken(connection, sessionToken, options);
    } finally {
      connection.release();
    }
  }

  async function createGuestSession(rawNickname) {
    const nickname = sanitizeNickname(rawNickname);
    if (!nickname) {
      throw new Error("게스트 닉네임이 필요합니다.");
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [userResult] = await connection.query(
        `
          INSERT INTO users (
            auth_type,
            nickname,
            is_temporary,
            is_active,
            created_at,
            updated_at,
            last_login_at
          )
          VALUES ('guest', ?, 1, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())
        `,
        [nickname],
      );

      const session = await createSessionRecord(connection, Number(userResult.insertId), "guest");

      await connection.commit();

      return {
        sessionToken: session.token,
        expiresAt: session.expiresAt,
        player: {
          id: Number(userResult.insertId),
          authType: "guest",
          nickname,
          email: null,
          isTemporary: true,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function verifySupabaseAccessToken(accessToken) {
    if (!config.supabaseUrl || !jwks) {
      throw new Error("Supabase Google 로그인이 아직 설정되지 않았습니다.");
    }

    if (!accessToken) {
      throw new Error("Supabase access token이 필요합니다.");
    }

    const { payload } = await jwtVerify(accessToken, jwks, {
      issuer: `${config.supabaseUrl}/auth/v1`,
      audience: "authenticated",
    });

    return payload;
  }

  async function reindexAttempts(connection, participantId) {
    const [attemptRows] = await connection.query(
      `
        SELECT id
        FROM attempts
        WHERE participant_id = ?
        ORDER BY created_at ASC, id ASC
      `,
      [participantId],
    );

    for (let index = 0; index < attemptRows.length; index += 1) {
      await connection.query(
        "UPDATE attempts SET attempt_index = ? WHERE id = ?",
        [index + 1, attemptRows[index].id],
      );
    }
  }

  async function mergeParticipantRows(connection, guestParticipant, googleParticipant, finalNickname) {
    await connection.query(
      `
        UPDATE attempts
        SET participant_id = ?
        WHERE participant_id = ?
      `,
      [googleParticipant.id, guestParticipant.id],
    );

    await reindexAttempts(connection, googleParticipant.id);

    const [guestHintRows] = await connection.query(
      "SELECT id, hint_type FROM hint_uses WHERE participant_id = ? ORDER BY used_at ASC, id ASC",
      [guestParticipant.id],
    );
    const [googleHintRows] = await connection.query(
      "SELECT id, hint_type FROM hint_uses WHERE participant_id = ?",
      [googleParticipant.id],
    );
    const googleHintTypes = new Set(googleHintRows.map((row) => row.hint_type));

    for (const hintRow of guestHintRows) {
      if (googleHintTypes.has(hintRow.hint_type)) {
        await connection.query("DELETE FROM hint_uses WHERE id = ?", [hintRow.id]);
      } else {
        await connection.query(
          "UPDATE hint_uses SET participant_id = ? WHERE id = ?",
          [googleParticipant.id, hintRow.id],
        );
        googleHintTypes.add(hintRow.hint_type);
      }
    }

    const [guestWinRows] = await connection.query(
      "SELECT * FROM wins WHERE participant_id = ? ORDER BY created_at ASC, id ASC",
      [guestParticipant.id],
    );
    const [googleWinRows] = await connection.query(
      "SELECT * FROM wins WHERE participant_id = ? ORDER BY created_at ASC, id ASC",
      [googleParticipant.id],
    );

    const guestWin = guestWinRows[0] || null;
    const googleWin = googleWinRows[0] || null;

    if (guestWin && googleWin) {
      const guestEarlier = new Date(guestWin.created_at).getTime() < new Date(googleWin.created_at).getTime();
      if (guestEarlier) {
        await connection.query("DELETE FROM wins WHERE id = ?", [googleWin.id]);
        await connection.query(
          "UPDATE wins SET participant_id = ? WHERE id = ?",
          [googleParticipant.id, guestWin.id],
        );
      } else {
        await connection.query("DELETE FROM wins WHERE id = ?", [guestWin.id]);
      }
    } else if (guestWin && !googleWin) {
      await connection.query(
        "UPDATE wins SET participant_id = ? WHERE id = ?",
        [googleParticipant.id, guestWin.id],
      );
    }

    await connection.query(
      `
        UPDATE participants
        SET nickname = ?, updated_at = UTC_TIMESTAMP()
        WHERE id = ?
      `,
      [finalNickname, googleParticipant.id],
    );

    await connection.query("DELETE FROM participants WHERE id = ?", [guestParticipant.id]);
  }

  async function moveGuestParticipantToGoogle(connection, guestParticipant, googleUserId, finalNickname) {
    await connection.query(
      `
        UPDATE participants
        SET user_id = ?, nickname = ?, updated_at = UTC_TIMESTAMP()
        WHERE id = ?
      `,
      [googleUserId, finalNickname, guestParticipant.id],
    );
  }

  async function mergeGuestIntoGoogle(connection, guestUser, googleUser, finalNickname) {
    const [guestParticipantRows] = await connection.query(
      "SELECT id, mode, target_id, user_id, nickname FROM participants WHERE user_id = ? ORDER BY joined_at ASC, id ASC",
      [guestUser.id],
    );

    const [googleParticipantRows] = await connection.query(
      "SELECT id, mode, target_id, user_id, nickname FROM participants WHERE user_id = ? ORDER BY joined_at ASC, id ASC",
      [googleUser.id],
    );

    const googleMap = new Map(
      googleParticipantRows.map((row) => [`${row.mode}:${Number(row.target_id)}`, {
        id: Number(row.id),
        mode: row.mode,
        targetId: Number(row.target_id),
        userId: Number(row.user_id),
        nickname: row.nickname,
      }]),
    );

    for (const row of guestParticipantRows) {
      const guestParticipant = {
        id: Number(row.id),
        mode: row.mode,
        targetId: Number(row.target_id),
        userId: Number(row.user_id),
        nickname: row.nickname,
      };
      const key = `${guestParticipant.mode}:${guestParticipant.targetId}`;
      const canonical = googleMap.get(key) || null;

      if (!canonical) {
        await moveGuestParticipantToGoogle(connection, guestParticipant, googleUser.id, finalNickname);
        googleMap.set(key, {
          ...guestParticipant,
          userId: googleUser.id,
          nickname: finalNickname,
        });
      } else {
        await mergeParticipantRows(connection, guestParticipant, canonical, finalNickname);
        googleMap.set(key, {
          ...canonical,
          nickname: finalNickname,
        });
      }
    }

    await connection.query(
      `
        UPDATE auth_sessions
        SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP())
        WHERE user_id = ? AND revoked_at IS NULL
      `,
      [guestUser.id],
    );

    await connection.query(
      `
        UPDATE users
        SET
          is_active = 0,
          deleted_at = COALESCE(deleted_at, UTC_TIMESTAMP()),
          updated_at = UTC_TIMESTAMP()
        WHERE id = ?
      `,
      [guestUser.id],
    );
  }

  async function exchangeSocialSession({
    provider = "google",
    supabaseAccessToken,
    nickname,
    currentGuestSessionToken,
  }) {
    const socialProvider = normalizeSocialProvider(provider);
    const payload = await verifySupabaseAccessToken(supabaseAccessToken);
    const supabaseUserId = payload.sub;
    const email = typeof payload.email === "string" ? payload.email : null;
    const providedNickname = sanitizeNickname(nickname);
    const tokenProvider = payload?.app_metadata?.provider || payload?.user_metadata?.provider || null;

    if (tokenProvider && tokenProvider !== socialProvider) {
      throw new Error("선택한 로그인 방식과 토큰 공급자가 일치하지 않습니다.");
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let googleUser = await findUserBySupabaseId(connection, supabaseUserId);
      const finalNickname = providedNickname || googleUser?.nickname || buildEmailNickname(email);

      if (!googleUser) {
        const [result] = await connection.query(
          `
            INSERT INTO users (
              auth_type,
              supabase_user_id,
              email,
              nickname,
              is_temporary,
            is_active,
            created_at,
            updated_at,
            last_login_at
          )
            VALUES (?, ?, ?, ?, 0, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP(), UTC_TIMESTAMP())
          `,
          [socialProvider, supabaseUserId, email, finalNickname],
        );

        googleUser = {
          id: Number(result.insertId),
          authType: socialProvider,
          supabaseUserId,
          email,
          nickname: finalNickname,
          isTemporary: false,
          isActive: true,
        };
      } else {
        if (googleUser.deletedAt) {
          throw new Error("삭제된 계정입니다. 새 계정으로 다시 가입해 주세요.");
        }
        const nextNickname = finalNickname || googleUser.nickname || DEFAULT_SOCIAL_NICKNAME;
        await connection.query(
          `
            UPDATE users
            SET
              auth_type = ?,
              email = ?,
              nickname = ?,
              updated_at = UTC_TIMESTAMP(),
              last_login_at = UTC_TIMESTAMP()
            WHERE id = ?
          `,
          [socialProvider, email, nextNickname, googleUser.id],
        );
        googleUser = {
          ...googleUser,
          authType: socialProvider,
          email,
          nickname: nextNickname,
        };
      }

      let mergedGuest = false;
      if (currentGuestSessionToken) {
        const guestSession = await findSessionByToken(connection, currentGuestSessionToken, { touch: false });
        if (guestSession?.user?.authType === "guest" && guestSession.user.id !== googleUser.id) {
          await mergeGuestIntoGoogle(connection, guestSession.user, googleUser, googleUser.nickname);
          mergedGuest = true;
        }
      }

      const appSession = await createSessionRecord(connection, googleUser.id, "app");
      await connection.commit();

      return {
        sessionToken: appSession.token,
        expiresAt: appSession.expiresAt,
        mergedGuest,
        player: {
          id: googleUser.id,
          authType: socialProvider,
          nickname: googleUser.nickname,
          email: googleUser.email,
          isTemporary: false,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function exchangeGoogleSession(options = {}) {
    return exchangeSocialSession({
      provider: "google",
      ...options,
    });
  }

  async function logoutSession(sessionToken) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const session = await findSessionByToken(connection, sessionToken, { touch: false, allowExpired: true });

      if (!session) {
        await connection.commit();
        return { success: true, player: null };
      }

      await connection.query(
        `
          UPDATE auth_sessions
          SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP())
          WHERE id = ?
        `,
        [session.id],
      );

      if (session.user.authType === "guest") {
        await connection.query(
          `
            UPDATE auth_sessions
            SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP())
            WHERE user_id = ? AND revoked_at IS NULL
          `,
          [session.user.id],
        );
        await connection.query(
          `
            UPDATE users
            SET
              is_active = 0,
              deleted_at = COALESCE(deleted_at, UTC_TIMESTAMP()),
              updated_at = UTC_TIMESTAMP()
            WHERE id = ?
          `,
          [session.user.id],
        );
      }

      await connection.commit();
      return {
        success: true,
        player: {
          id: session.user.id,
          authType: session.user.authType,
          nickname: session.user.nickname,
          email: session.user.email,
          isTemporary: session.user.isTemporary,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function updateProfile(sessionToken, rawNickname) {
    const nickname = sanitizeNickname(rawNickname);
    if (!nickname) {
      throw new Error("닉네임이 필요합니다.");
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const session = await findSessionByToken(connection, sessionToken, { touch: false });
      if (!session) {
        throw new Error("세션이 만료되었거나 로그인이 필요합니다.");
      }

      await connection.query(
        `
          UPDATE users
          SET nickname = ?, updated_at = UTC_TIMESTAMP()
          WHERE id = ?
        `,
        [nickname, session.user.id],
      );

      await connection.commit();

      return {
        player: {
          id: session.user.id,
          authType: session.user.authType,
          nickname,
          email: session.user.email,
          isTemporary: session.user.isTemporary,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function deleteAccount(sessionToken) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const session = await findSessionByToken(connection, sessionToken, { touch: false });
      if (!session) {
        throw new Error("세션이 만료되었거나 로그인이 필요합니다.");
      }

      const userId = session.user.id;

      await connection.query(
        "UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, UTC_TIMESTAMP()) WHERE user_id = ? AND revoked_at IS NULL",
        [userId],
      );

      await connection.query(
        `
          UPDATE users
          SET
            is_active = 0,
            nickname = CONCAT('탈퇴회원_', id),
            username = NULL,
            password_hash = NULL,
            email = NULL,
            supabase_user_id = NULL,
            deleted_at = COALESCE(deleted_at, UTC_TIMESTAMP()),
            updated_at = UTC_TIMESTAMP()
          WHERE id = ?
        `,
        [userId],
      );

      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function loginWithCredentials(username, password) {
    if (!username || !password) {
      throw new Error("아이디와 비밀번호를 입력해 주세요.");
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        "SELECT * FROM users WHERE username = ? AND is_active = 1 LIMIT 1",
        [username]
      );

      const user = rows[0];
      if (!user || !user.password_hash) {
        throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
      }

      await connection.query(
        "UPDATE users SET last_login_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?",
        [user.id]
      );

      const session = await createSessionRecord(connection, Number(user.id), "app");
      await connection.commit();

      return {
        sessionToken: session.token,
        expiresAt: session.expiresAt,
        player: {
          id: Number(user.id),
          authType: "id",
          nickname: user.nickname,
          email: user.email || null,
          isTemporary: false,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return {
    sanitizeNickname,
    resolveSession,
    createGuestSession,
    exchangeSocialSession,
    exchangeGoogleSession,
    loginWithCredentials,
    logoutSession,
    updateProfile,
    deleteAccount,
  };
}

module.exports = {
  createAuthService,
};
