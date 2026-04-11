import { COOKIE_SESSION_SENTINEL } from "../auth/authStorage";

const LOCAL_API_BASES = ["http://127.0.0.1:4000", "http://localhost:4000"];
const API_REQUEST_TIMEOUT_MS = 12000;

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function getApiBaseCandidates() {
  const configured = (process.env.REACT_APP_API_BASE_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.length) {
    return unique(configured);
  }

  return LOCAL_API_BASES;
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function getPublicErrorMessage(status, fallbackMessage = "") {
  if (status === 400) {
    return fallbackMessage || "요청 형식이 올바르지 않습니다. 입력값을 다시 확인해 주세요.";
  }

  if (status === 401) {
    return "로그인이 필요하거나 세션이 만료되었습니다. 다시 로그인해 주세요.";
  }

  if (status === 403) {
    return "이 작업을 수행할 권한이 없습니다.";
  }

  if (status === 404) {
    return "요청한 정보를 찾지 못했습니다.";
  }

  if (status === 409) {
    return "지금은 이 요청을 처리할 수 없습니다. 잠시 뒤 다시 시도해 주세요.";
  }

  if (status === 422) {
    return "입력값을 다시 확인해 주세요.";
  }

  if (status === 429) {
    return "요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.";
  }

  if (status >= 500) {
    return "서버에서 요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
  }

  return fallbackMessage || "요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
}

async function request(path, options = {}, headers = {}) {
  const bases = getApiBaseCandidates();
  let response;
  let lastNetworkError = null;

  for (const base of bases) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

    try {
      response = await fetch(`${base}${path}`, {
        ...options,
        signal: controller.signal,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...headers,
          ...(options.headers || {}),
        },
      });

      if ([502, 503, 504].includes(response.status)) {
        lastNetworkError = new ApiError(
          "서버에 일시적으로 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
          response.status,
          {
            base,
            reason: `upstream_${response.status}`,
          },
        );
        continue;
      }

      break;
    } catch (error) {
      const isAbortError = error?.name === "AbortError";
      lastNetworkError = new ApiError(
        isAbortError
          ? "서버 응답 시간이 너무 오래 걸렸습니다. 잠시 뒤 다시 시도해 주세요."
          : "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
        0,
        {
          base,
          reason: isAbortError ? "timeout" : error?.message || "network_error",
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (!response) {
    throw lastNetworkError || new ApiError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.", 0, {
      reason: "network_error",
    });
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(getPublicErrorMessage(response.status, data.message), response.status, data);
  }

  return data;
}

function normalizeSessionLike(session = {}) {
  if (!session) {
    return {};
  }

  if (session.appSession) {
    return normalizeSessionLike(session.appSession);
  }

  if (session.session) {
    return normalizeSessionLike(session.session);
  }

  if (session.player) {
    return normalizeSessionLike(session.player);
  }

  return {
    token: session.token || session.sessionToken || session.accessToken || "",
    nickname: session.nickname || session.displayNickname || "",
    authType: session.authType || session.kind || "",
    email: session.email || "",
    supabaseUserId: session.supabaseUserId || "",
    userId: session.userId || session.id || "",
    isAdmin: Boolean(session.isAdmin),
  };
}

function withSessionHeaders(session = {}) {
  const normalized = normalizeSessionLike(session);
  const headers = {};

  if (normalized.token && normalized.token !== COOKIE_SESSION_SENTINEL) {
    headers.Authorization = `Bearer ${normalized.token}`;
  }

  return headers;
}

export function fetchCategories() {
  return request("/api/categories");
}

export function createGuestAuthSession(payload) {
  return request("/api/auth/guest", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginWithCredentials(payload) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function exchangeSocialAuthSession(payload, extraHeaders = {}) {
  const headers = {};
  if (
    extraHeaders.currentGuestSessionToken &&
    extraHeaders.currentGuestSessionToken !== COOKIE_SESSION_SENTINEL
  ) {
    headers["x-current-guest-token"] = extraHeaders.currentGuestSessionToken;
  }

  return request(
    "/api/auth/social/exchange",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    headers,
  );
}

export function exchangeGoogleAuthSession(payload, extraHeaders = {}) {
  return exchangeSocialAuthSession(
    {
      provider: "google",
      ...payload,
    },
    extraHeaders,
  );
}

export function fetchAuthSession(session) {
  return request("/api/auth/session", {}, withSessionHeaders(session));
}

export function logoutAuth(session) {
  return request(
    "/api/auth/logout",
    {
      method: "POST",
    },
    withSessionHeaders(session),
  );
}

export function updateAuthProfile(session, payload) {
  return request(
    "/api/auth/profile",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    withSessionHeaders(session),
  );
}

export function deleteAuthAccount(session) {
  return request(
    "/api/auth/account",
    {
      method: "DELETE",
    },
    withSessionHeaders(session),
  );
}

export function fetchDailyWord(session) {
  return request("/api/word/daily", {}, withSessionHeaders(session));
}

export function joinDailyWord(session) {
  return request("/api/word/daily/join", { method: "POST" }, withSessionHeaders(session));
}

export function submitDailyWordAnswer(session, answer) {
  return request(
    "/api/word/daily/answer",
    {
      method: "POST",
      body: JSON.stringify({ answer }),
    },
    withSessionHeaders(session),
  );
}

export function submitDailyWordAttempt(session, inputText, model = "nova") {
  return request(
    "/api/word/daily/attempts",
    {
      method: "POST",
      body: JSON.stringify({ inputText, model }),
    },
    withSessionHeaders(session),
  );
}

export function requestDailyHint(session, hintType) {
  return request(
    "/api/word/daily/hints",
    {
      method: "POST",
      body: JSON.stringify({ hintType }),
    },
    withSessionHeaders(session),
  );
}

export function fetchDailyWordLeaderboard(session) {
  return request("/api/word/daily/leaderboard", {}, withSessionHeaders(session));
}

export function fetchPromptModeLeaderboard(session) {
  return request("/api/prompt-rooms/home-leaderboard", {}, withSessionHeaders(session));
}

export function fetchPromptRooms(params = {}) {
  const search = new URLSearchParams();

  if (params.category && params.category !== "all") {
    search.set("category", params.category);
  }

  if (params.status) {
    search.set("status", params.status);
  }

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return request(`/api/prompt-rooms${suffix}`);
}

export function fetchPromptRoomState(session, roomId) {
  return request(`/api/prompt-rooms/${roomId}/state`, {}, withSessionHeaders(session));
}

export function joinPromptRoom(session, roomId) {
  return request(`/api/prompt-rooms/${roomId}/join`, { method: "POST" }, withSessionHeaders(session));
}

export function submitPromptRoomAttempt(session, roomId, inputText) {
  return request(
    `/api/prompt-rooms/${roomId}/attempts`,
    {
      method: "POST",
      body: JSON.stringify({ inputText }),
    },
    withSessionHeaders(session),
  );
}

export function fetchPromptRoomLeaderboard(session, roomId) {
  return request(`/api/prompt-rooms/${roomId}/leaderboard`, {}, withSessionHeaders(session));
}

export function submitProposal(session, payload) {
  return request(
    "/api/proposals",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    withSessionHeaders(session),
  );
}

export function fetchAdminProposals(session) {
  return request("/api/admin/proposals", {}, withSessionHeaders(session));
}

export function fetchAdminDailyWord(session, date) {
  const search = new URLSearchParams();

  if (date) {
    search.set("date", date);
  }

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return request(`/api/admin/daily-word${suffix}`, {}, withSessionHeaders(session));
}

export function updateAdminDailyWord(session, payload) {
  return request(
    "/api/admin/daily-word",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    withSessionHeaders(session),
  );
}

export function generateAdminDailyWord(session, payload = {}) {
  return request(
    "/api/admin/daily-word/generate",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    withSessionHeaders(session),
  );
}

export function approveProposal(session, proposalId, payload = {}) {
  return request(
    `/api/admin/proposals/${proposalId}/approve`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    withSessionHeaders(session),
  );
}

export function rejectProposal(session, proposalId, payload = {}) {
  return request(
    `/api/admin/proposals/${proposalId}/reject`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    withSessionHeaders(session),
  );
}
