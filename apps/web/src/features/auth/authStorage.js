const APP_GUEST_SESSION_KEY = "prompt-duel-app-session-guest-v1";
const APP_SOCIAL_SESSION_KEY = "prompt-duel-app-session-social-v1";
const SUPABASE_SESSION_KEY = "prompt-duel-supabase-session-v1";
const PENDING_SOCIAL_FLOW_KEY = "prompt-duel-pending-social-flow-v1";
const SOCIAL_PKCE_VERIFIER_KEY = "prompt-duel-social-pkce-verifier-v1";
export const COOKIE_SESSION_SENTINEL = "__cookie_session__";

function isBrowser() {
  return typeof window !== "undefined";
}

function readJson(storage, key) {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  if (!isBrowser()) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

function removeItem(storage, key) {
  if (!isBrowser()) {
    return;
  }

  storage.removeItem(key);
}

function createToken(prefix = "app") {
  const suffix =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}_${suffix}`;
}

function normalizeAuthType(authType = "") {
  if (authType === "guest") {
    return "guest";
  }

  if (["google", "apple", "id"].includes(authType)) {
    return authType;
  }

  return "guest";
}

export function createTransientPlayerSession(nickname = "") {
  return {
    token: createToken("guest"),
    nickname: nickname?.trim() || "",
    authType: "guest",
    isTemporary: true,
    isAdmin: false,
    storageKind: "session",
    source: "local-fallback",
  };
}

export function normalizePlayerSession(payload, fallbackAuthType = "guest") {
  if (!payload) {
    return null;
  }

  const player = payload.player || payload.user || payload.account || {};
  const token =
    payload.sessionToken ||
    payload.accessToken ||
    payload.token ||
    player.sessionToken ||
    player.token ||
    payload.appSessionToken ||
    "";
  const authType = normalizeAuthType(player.authType || payload.authType || fallbackAuthType);

  const hasPlayerIdentity =
    Boolean(player.id || payload.userId || payload.id) ||
    Boolean(player.nickname || payload.nickname) ||
    Boolean(player.authType || payload.authType || fallbackAuthType);

  if (!token && !hasPlayerIdentity) {
    return null;
  }

  return {
    token: token || COOKIE_SESSION_SENTINEL,
    nickname:
      player.nickname ||
      payload.nickname ||
      payload.displayNickname ||
      payload.userNickname ||
      "",
    authType,
    email: player.email || payload.email || "",
    supabaseUserId: player.supabaseUserId || payload.supabaseUserId || "",
    userId: player.id || payload.userId || payload.id || "",
    isTemporary: Boolean(player.isTemporary ?? payload.isTemporary ?? authType === "guest"),
    isAdmin: Boolean(player.isAdmin ?? payload.isAdmin),
    source: "api",
    storageKind: authType !== "guest" ? "local" : "session",
  };
}

function selectAppSession() {
  if (!isBrowser()) {
    return null;
  }

  const guestSession = readJson(window.sessionStorage, APP_GUEST_SESSION_KEY);
  if (guestSession?.nickname || guestSession?.userId || guestSession?.token) {
    return {
      ...guestSession,
      authType: normalizeAuthType(guestSession.authType || "guest"),
      storageKind: "session",
    };
  }

  const socialSession = readJson(window.localStorage, APP_SOCIAL_SESSION_KEY);
  if (socialSession?.nickname || socialSession?.userId || socialSession?.token) {
    return {
      ...socialSession,
      authType: normalizeAuthType(socialSession.authType),
      storageKind: "local",
    };
  }

  return null;
}

export function getStoredAppSession() {
  return selectAppSession();
}

export function saveAppSession(session) {
  if (!isBrowser() || !session) {
    return session || null;
  }

  const authType = normalizeAuthType(session.authType);
  const isPersistent = authType !== "guest";
  const normalized = {
    ...session,
    token: session.token || COOKIE_SESSION_SENTINEL,
    nickname: session.nickname?.trim() || "",
    authType,
    isAdmin: Boolean(session.isAdmin),
    storageKind: isPersistent ? "local" : "session",
  };

  if (!isPersistent) {
    removeItem(window.localStorage, APP_SOCIAL_SESSION_KEY);
    writeJson(window.sessionStorage, APP_GUEST_SESSION_KEY, normalized);
  } else {
    removeItem(window.sessionStorage, APP_GUEST_SESSION_KEY);
    writeJson(window.localStorage, APP_SOCIAL_SESSION_KEY, normalized);
  }

  return normalized;
}

export function clearAppSession() {
  if (!isBrowser()) {
    return;
  }

  removeItem(window.sessionStorage, APP_GUEST_SESSION_KEY);
  removeItem(window.localStorage, APP_SOCIAL_SESSION_KEY);
}

export function getSupabaseSession() {
  return isBrowser() ? readJson(window.localStorage, SUPABASE_SESSION_KEY) : null;
}

export function saveSupabaseSession(session) {
  if (!isBrowser()) {
    return session || null;
  }

  if (!session) {
    removeItem(window.localStorage, SUPABASE_SESSION_KEY);
    return null;
  }

  writeJson(window.localStorage, SUPABASE_SESSION_KEY, session);
  return session;
}

export function clearSupabaseSession() {
  if (!isBrowser()) {
    return;
  }

  removeItem(window.localStorage, SUPABASE_SESSION_KEY);
}

export function getPendingSocialFlow() {
  return isBrowser() ? readJson(window.sessionStorage, PENDING_SOCIAL_FLOW_KEY) : null;
}

export function savePendingSocialFlow(flow) {
  if (!isBrowser()) {
    return flow || null;
  }

  if (!flow) {
    removeItem(window.sessionStorage, PENDING_SOCIAL_FLOW_KEY);
    return null;
  }

  writeJson(window.sessionStorage, PENDING_SOCIAL_FLOW_KEY, flow);
  return flow;
}

export function clearPendingSocialFlow() {
  if (!isBrowser()) {
    return;
  }

  removeItem(window.sessionStorage, PENDING_SOCIAL_FLOW_KEY);
}

export function getSocialPkceVerifier() {
  return isBrowser() ? window.sessionStorage.getItem(SOCIAL_PKCE_VERIFIER_KEY) || "" : "";
}

export function saveSocialPkceVerifier(verifier) {
  if (!isBrowser()) {
    return verifier || "";
  }

  if (!verifier) {
    removeItem(window.sessionStorage, SOCIAL_PKCE_VERIFIER_KEY);
    return "";
  }

  window.sessionStorage.setItem(SOCIAL_PKCE_VERIFIER_KEY, verifier);
  return verifier;
}

export function clearSocialPkceVerifier() {
  if (!isBrowser()) {
    return;
  }

  removeItem(window.sessionStorage, SOCIAL_PKCE_VERIFIER_KEY);
}

export function hasSupabaseSupport() {
  return Boolean(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY);
}

export function buildGuestFallbackSession(nickname = "") {
  return createTransientPlayerSession(nickname);
}

// Backward-compatible aliases
export const getPendingGoogleFlow = getPendingSocialFlow;
export const savePendingGoogleFlow = savePendingSocialFlow;
export const clearPendingGoogleFlow = clearPendingSocialFlow;
export const getGooglePkceVerifier = getSocialPkceVerifier;
export const saveGooglePkceVerifier = saveSocialPkceVerifier;
export const clearGooglePkceVerifier = clearSocialPkceVerifier;
