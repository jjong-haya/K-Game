import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import {
  clearAppSession,
  clearPendingSocialFlow,
  clearSupabaseSession,
  getPendingSocialFlow,
  getStoredAppSession,
  getSupabaseSession,
  normalizePlayerSession,
  saveAppSession,
  savePendingSocialFlow,
  saveSupabaseSession,
} from "./authStorage";
import { canUseSupabaseAuth, exchangeSupabaseCode, prepareSocialLoginFlow } from "./supabaseOAuth";
import {
  createGuestAuthSession,
  deleteAuthAccount,
  exchangeSocialAuthSession,
  fetchAuthSession,
  loginWithCredentials,
  logoutAuth,
  updateAuthProfile,
} from "../../lib/api";

export const AuthContext = createContext(null);

function normalizeProvider(provider = "") {
  return provider === "apple" ? "apple" : "google";
}

function getAuthErrorMessage(
  error,
  fallback = "요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
) {
  const message = (error?.message || "").toString().toLowerCase();

  if (error?.status === 401) {
    return "로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해 주세요.";
  }

  if (error?.status === 403) {
    return "이 작업을 수행할 권한이 없습니다.";
  }

  if (error?.status === 404) {
    return "요청한 정보를 찾지 못했습니다.";
  }

  if (error?.status >= 500) {
    return "서버 연결이 불안정합니다. 잠시 뒤 다시 시도해 주세요.";
  }

  if (message.includes("supabase")) {
    return "Supabase 설정이 아직 완료되지 않았습니다.";
  }

  if (message.includes("nickname") || message.includes("닉네임")) {
    return "닉네임을 다시 확인해 주세요.";
  }

  if (message.includes("network") || message.includes("fetch")) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  }

  return fallback;
}

function normalizeBackendResponse(payload, fallbackAuthType = "guest") {
  const normalized = normalizePlayerSession(payload, fallbackAuthType);
  if (normalized) {
    return normalized;
  }

  const player = payload?.player || payload?.user || {};
  const token = payload?.sessionToken || payload?.token || payload?.accessToken || "";

  if (!token) {
    return null;
  }

  const authType = player.authType || payload?.authType || fallbackAuthType;

  return {
    token,
    nickname: player.nickname || payload?.nickname || "",
    authType,
    email: player.email || payload?.email || "",
    supabaseUserId: player.supabaseUserId || payload?.supabaseUserId || "",
    userId: player.id || payload?.userId || payload?.id || "",
    isTemporary: Boolean(player.isTemporary ?? payload?.isTemporary ?? authType === "guest"),
    isAdmin: Boolean(player.isAdmin ?? payload?.isAdmin),
    source: "api",
    storageKind: authType === "guest" ? "session" : "local",
  };
}

function isRecoverableAuthError(error) {
  return Boolean(error && [401, 404, 503].includes(error.status));
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState("loading");
  const [appSession, setAppSession] = useState(() => getStoredAppSession());
  const [supabaseSession, setSupabaseSession] = useState(() => getSupabaseSession());
  const [pendingSocialFlow, setPendingSocialFlow] = useState(() => getPendingSocialFlow());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const syncFromStorage = useCallback(() => {
    setAppSession(getStoredAppSession());
    setSupabaseSession(getSupabaseSession());
    setPendingSocialFlow(getPendingSocialFlow());
    setStatus("ready");
  }, []);

  const validateAppSession = useCallback(async (session) => {
    if (!session?.token) {
      return session;
    }

    try {
      const response = await fetchAuthSession({ token: session.token });
      const backendSession = normalizeBackendResponse(response, session.authType);
      if (backendSession) {
        const storedSession = saveAppSession(backendSession);
        setAppSession(storedSession);
        return storedSession;
      }
    } catch (requestError) {
      if (requestError?.status === 401 || requestError?.status === 404) {
        clearAppSession();
        setAppSession(null);
        return null;
      }

      if (!isRecoverableAuthError(requestError)) {
        setNotice(getAuthErrorMessage(requestError, ""));
      }
    }

    return session;
  }, []);

  const exchangeSocialSession = useCallback(
    async ({ supabaseAccessToken, provider, nickname = "", currentGuestSessionToken = "" }) => {
      const response = await exchangeSocialAuthSession(
        {
          provider: normalizeProvider(provider),
          supabaseAccessToken,
          nickname: nickname?.trim() || "",
        },
        {
          currentGuestSessionToken: currentGuestSessionToken || "",
        },
      );

      const backendSession = normalizeBackendResponse(response, normalizeProvider(provider));
      if (!backendSession) {
        throw new Error("소셜 로그인 세션을 만들지 못했습니다.");
      }

      const storedSession = saveAppSession({
        ...backendSession,
        authType: normalizeProvider(provider),
        storageKind: "local",
      });
      setAppSession(storedSession);
      clearPendingSocialFlow();
      setPendingSocialFlow(null);

      return {
        session: storedSession,
        mergedGuest: Boolean(response?.mergedGuest),
      };
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        setStatus("loading");
        const storedAppSession = getStoredAppSession();
        const storedSupabaseSession = getSupabaseSession();
        let storedPendingFlow = getPendingSocialFlow();

        if (cancelled) {
          return;
        }

        if (storedPendingFlow?.createdAt && Date.now() - storedPendingFlow.createdAt > 15 * 60 * 1000) {
          clearPendingSocialFlow();
          storedPendingFlow = null;
        }

        setAppSession(storedAppSession);
        setSupabaseSession(storedSupabaseSession);
        setPendingSocialFlow(storedPendingFlow);

        if (storedAppSession) {
          const validatedSession = await validateAppSession(storedAppSession);
          if (validatedSession) {
            if (!cancelled) {
              setStatus("ready");
            }
            return;
          }
        }

        if (storedSupabaseSession?.access_token) {
          try {
            setStatus("syncing");
            const provider = normalizeProvider(
              storedPendingFlow?.provider || storedSupabaseSession.provider || "google",
            );
            await exchangeSocialSession({
              provider,
              supabaseAccessToken: storedSupabaseSession.access_token,
              nickname: storedPendingFlow?.nickname || "",
              currentGuestSessionToken: storedPendingFlow?.currentGuestSessionToken || "",
            });
          } catch (exchangeError) {
            if (!isRecoverableAuthError(exchangeError) && !cancelled) {
              clearSupabaseSession();
              setSupabaseSession(null);
              setError(getAuthErrorMessage(exchangeError, "소셜 로그인 연결을 완료하지 못했습니다."));
            }
          }
        }
      } catch (hydrateError) {
        if (!cancelled) {
          setError(getAuthErrorMessage(hydrateError, "로그인 상태를 확인하지 못했습니다."));
        }
      } finally {
        if (!cancelled) {
          setStatus("ready");
        }
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [exchangeSocialSession, validateAppSession]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleStorage = () => {
      syncFromStorage();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [syncFromStorage]);

  const loginAsGuest = useCallback(async ({ nickname }) => {
    const trimmed = nickname?.trim();
    if (!trimmed) {
      throw new Error("게스트 닉네임이 필요합니다.");
    }

    setStatus("syncing");
    setError("");
    setNotice("");

    try {
      const response = await createGuestAuthSession({ nickname: trimmed });
      const nextSession = normalizeBackendResponse(response, "guest");
      if (!nextSession) {
        throw new Error("게스트 세션을 만들지 못했습니다.");
      }

      const storedSession = saveAppSession({
        ...nextSession,
        authType: "guest",
        nickname: trimmed,
        storageKind: "session",
      });

      clearPendingSocialFlow();
      setPendingSocialFlow(null);
      clearSupabaseSession();
      setSupabaseSession(null);
      setAppSession(storedSession);

      return storedSession;
    } finally {
      setStatus("ready");
    }
  }, []);

  const loginWithId = useCallback(async ({ username, password }) => {
    if (!username?.trim() || !password) {
      throw new Error("아이디와 비밀번호를 입력해 주세요.");
    }

    setStatus("syncing");
    setError("");
    setNotice("");

    try {
      const response = await loginWithCredentials({ username: username.trim(), password });
      const nextSession = normalizeBackendResponse(response, "id");
      if (!nextSession) {
        throw new Error("로그인에 실패했습니다.");
      }

      const storedSession = saveAppSession({
        ...nextSession,
        authType: "id",
        storageKind: "local",
      });

      clearPendingSocialFlow();
      setPendingSocialFlow(null);
      clearSupabaseSession();
      setSupabaseSession(null);
      setAppSession(storedSession);

      return storedSession;
    } finally {
      setStatus("ready");
    }
  }, []);

  const startSocialLogin = useCallback(
    async ({ provider = "google", nickname = "", returnTo = "/" } = {}) => {
      const socialProvider = normalizeProvider(provider);

      setStatus("syncing");
      setError("");
      setNotice("");

      try {
        if (!canUseSupabaseAuth()) {
          throw new Error("supabase config missing");
        }

        const pendingFlow = {
          provider: socialProvider,
          nickname: nickname?.trim() || "",
          returnTo: returnTo || "/",
          currentGuestSessionToken: appSession?.authType === "guest" ? appSession.token : "",
          createdAt: Date.now(),
        };

        const { authorizeUrl, pendingFlow: flow } = await prepareSocialLoginFlow(pendingFlow);
        savePendingSocialFlow(flow);
        setPendingSocialFlow(flow);

        if (typeof window !== "undefined") {
          window.location.assign(authorizeUrl);
        }
      } finally {
        setStatus("ready");
      }
    },
    [appSession],
  );

  const completeSocialCallback = useCallback(
    async ({ code, provider = "google", nickname = "", returnTo = "/" } = {}) => {
      if (!code) {
        throw new Error("소셜 로그인 코드가 없습니다.");
      }

      const socialProvider = normalizeProvider(provider);
      setStatus("syncing");
      setError("");
      setNotice("");

      const supabaseToken = await exchangeSupabaseCode({
        code,
        provider: socialProvider,
      });

      const supabaseSessionPayload = {
        ...supabaseToken,
        provider: socialProvider,
        access_token: supabaseToken.access_token || supabaseToken.accessToken,
      };

      saveSupabaseSession(supabaseSessionPayload);
      setSupabaseSession(supabaseSessionPayload);

      const flow = getPendingSocialFlow() || pendingSocialFlow || {};
      const desiredNickname = nickname?.trim() || flow.nickname || "";
      const currentGuestSessionToken =
        flow.currentGuestSessionToken || (appSession?.authType === "guest" ? appSession.token : "");

      try {
        const result = await exchangeSocialSession({
          provider: socialProvider,
          supabaseAccessToken: supabaseSessionPayload.access_token,
          nickname: desiredNickname,
          currentGuestSessionToken,
        });

        return {
          session: result.session,
          returnTo,
          mergedGuest: result.mergedGuest,
          needsNickname: false,
        };
      } catch (exchangeError) {
        const message = (exchangeError?.message || "").toLowerCase();
        if (message.includes("nickname") || message.includes("닉네임")) {
          const nextPendingFlow = {
            provider: socialProvider,
            supabaseSession: supabaseSessionPayload,
            currentGuestSessionToken,
            returnTo,
            nickname: desiredNickname,
            createdAt: Date.now(),
          };
          savePendingSocialFlow(nextPendingFlow);
          setPendingSocialFlow(nextPendingFlow);

          return {
            needsNickname: true,
            pending: nextPendingFlow,
          };
        }

        setError(getAuthErrorMessage(exchangeError, "소셜 로그인을 마무리하지 못했습니다."));
        throw exchangeError;
      } finally {
        setStatus("ready");
      }
    },
    [appSession, exchangeSocialSession, pendingSocialFlow],
  );

  const finishPendingSocialLogin = useCallback(
    async ({ nickname, returnTo = "/" } = {}) => {
      const flow = getPendingSocialFlow() || pendingSocialFlow;
      if (flow?.createdAt && Date.now() - flow.createdAt > 15 * 60 * 1000) {
        clearPendingSocialFlow();
        setPendingSocialFlow(null);
        throw new Error("소셜 로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
      }
      const supabaseSessionPayload = flow?.supabaseSession || supabaseSession;
      if (!supabaseSessionPayload?.access_token) {
        throw new Error("소셜 로그인 세션이 만료되었습니다.");
      }

      setStatus("syncing");
      setError("");
      setNotice("");

      try {
        const provider = normalizeProvider(flow?.provider || supabaseSessionPayload.provider || "google");
        const result = await exchangeSocialSession({
          provider,
          supabaseAccessToken: supabaseSessionPayload.access_token,
          nickname: nickname?.trim() || flow?.nickname || "",
          currentGuestSessionToken:
            flow?.currentGuestSessionToken || (appSession?.authType === "guest" ? appSession.token : ""),
        });

        return {
          session: result.session,
          returnTo,
          mergedGuest: result.mergedGuest,
        };
      } finally {
        setStatus("ready");
      }
    },
    [appSession, exchangeSocialSession, pendingSocialFlow, supabaseSession],
  );

  const updateNickname = useCallback(
    async (nickname) => {
      const trimmed = nickname?.trim();
      if (!trimmed) {
        throw new Error("닉네임이 필요합니다.");
      }

      if (!appSession?.token) {
        throw new Error("유효한 세션이 없습니다.");
      }

      setStatus("syncing");
      setError("");

      try {
        const response = await updateAuthProfile({ token: appSession.token }, { nickname: trimmed });
        const nextSession = normalizeBackendResponse(response, appSession.authType || "guest") || {
          ...appSession,
          nickname: trimmed,
        };

        const storedSession = saveAppSession(nextSession);
        setAppSession(storedSession);
        return storedSession;
      } finally {
        setStatus("ready");
      }
    },
    [appSession],
  );

  const logout = useCallback(async () => {
    setStatus("syncing");
    setError("");

    try {
      if (appSession?.token) {
        await logoutAuth({ token: appSession.token }).catch(() => null);
      }
    } finally {
      clearAppSession();
      clearSupabaseSession();
      clearPendingSocialFlow();
      setAppSession(null);
      setSupabaseSession(null);
      setPendingSocialFlow(null);
      setStatus("ready");
    }
  }, [appSession]);

  const deleteAccount = useCallback(async () => {
    if (!appSession?.token) {
      throw new Error("로그인 상태가 아닙니다.");
    }
    const token = appSession.token;
    // Clear storage first (optimistic)
    clearAppSession();
    clearSupabaseSession();
    clearPendingSocialFlow();
    setAppSession(null);
    setSupabaseSession(null);
    setPendingSocialFlow(null);
    setStatus("ready");
    // Then call server
    await deleteAuthAccount({ token }).catch(() => null);
  }, [appSession]);

  const refresh = useCallback(async () => {
    const currentSession = getStoredAppSession();
    setAppSession(currentSession);
    if (currentSession) {
      await validateAppSession(currentSession);
    }
  }, [validateAppSession]);

  const clearError = useCallback(() => setError(""), []);
  const clearNotice = useCallback(() => setNotice(""), []);
  const resetPendingSocialFlow = useCallback(() => {
    clearPendingSocialFlow();
    setPendingSocialFlow(null);
  }, []);

  const socialProvider = useMemo(() => {
    return appSession?.authType && appSession.authType !== "guest" ? appSession.authType : "";
  }, [appSession?.authType]);

  const value = useMemo(
    () => ({
      status,
      isReady: status === "ready",
      isSyncing: status === "syncing",
      session: appSession,
      appSession,
      supabaseSession,
      pendingSocialFlow,
      isAuthenticated: Boolean(appSession?.token),
      isGuest: appSession?.authType === "guest",
      isSocial: ["google", "apple"].includes(appSession?.authType || ""),
      isAdmin: Boolean(appSession?.isAdmin),
      isIdLogin: appSession?.authType === "id",
      isGoogle: appSession?.authType === "google",
      isApple: appSession?.authType === "apple",
      socialProvider,
      nickname: appSession?.nickname || "",
      email: appSession?.email || "",
      error,
      notice,
      loginAsGuest,
      loginWithId,
      startSocialLogin,
      startGoogleLogin: (options = {}) => startSocialLogin({ ...options, provider: "google" }),
      startAppleLogin: (options = {}) => startSocialLogin({ ...options, provider: "apple" }),
      completeSocialCallback,
      completeGoogleCallback: (options = {}) => completeSocialCallback({ ...options, provider: "google" }),
      finishPendingSocialLogin,
      finishPendingGoogleLogin: finishPendingSocialLogin,
      updateNickname,
      logout,
      deleteAccount,
      refresh,
      clearError,
      clearNotice,
      resetPendingSocialFlow,
    }),
    [
      appSession,
      clearError,
      clearNotice,
      completeSocialCallback,
      deleteAccount,
      error,
      finishPendingSocialLogin,
      loginAsGuest,
      loginWithId,
      logout,
      notice,
      pendingSocialFlow,
      refresh,
      resetPendingSocialFlow,
      socialProvider,
      startSocialLogin,
      status,
      supabaseSession,
      updateNickname,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
