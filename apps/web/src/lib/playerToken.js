import {
  buildGuestFallbackSession,
  COOKIE_SESSION_SENTINEL,
  clearAppSession,
  getStoredAppSession,
  saveAppSession,
} from "../auth/authStorage";

export function getPlayerSession() {
  return getStoredAppSession();
}

export function getOrCreatePlayerSession() {
  return getStoredAppSession() || buildGuestFallbackSession();
}

export function updatePlayerNickname(nickname) {
  const current = getStoredAppSession() || buildGuestFallbackSession(nickname);
  const next = {
    ...current,
    nickname: nickname?.trim() || current.nickname || "",
  };

  return saveAppSession(next);
}

export function hasPlayerNickname() {
  return Boolean(getStoredAppSession()?.nickname?.trim());
}

export function getPlayerToken() {
  return getStoredAppSession()?.token || "";
}

export function getPlayerNickname() {
  return getStoredAppSession()?.nickname || "";
}

export function getSessionHeaders() {
  const session = getStoredAppSession();
  return session?.token && session.token !== COOKIE_SESSION_SENTINEL
    ? {
        "x-player-token": session.token,
      }
    : {};
}

export function clearPlayerSession() {
  clearAppSession();
}
