import {
  clearSocialPkceVerifier,
  getSocialPkceVerifier,
  hasSupabaseSupport,
  saveSocialPkceVerifier,
} from "./authStorage";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
const SUPABASE_REDIRECT_URL = process.env.REACT_APP_SUPABASE_REDIRECT_URL || "";

const SOCIAL_SCOPES = {
  google: "email profile",
  apple: "name email",
};

function normalizeProvider(provider = "") {
  return provider === "apple" ? "apple" : "google";
}

function getBaseUrl(returnTo = "/", provider = "google") {
  const fallbackBase = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  const baseUrl = SUPABASE_REDIRECT_URL || fallbackBase;

  if (typeof window === "undefined") {
    return baseUrl;
  }

  const url = new URL(baseUrl, window.location.origin);
  if (returnTo) {
    url.searchParams.set("returnTo", returnTo);
  }
  url.searchParams.set("provider", normalizeProvider(provider));
  return url.toString();
}

function base64UrlEncode(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomVerifier() {
  const bytes = new Uint8Array(64);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function createCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

export async function createPkcePair() {
  const verifier = randomVerifier();
  const challenge = await createCodeChallenge(verifier);
  return { verifier, challenge };
}

export function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    redirectUrl: getBaseUrl(),
  };
}

export function canUseSupabaseAuth() {
  return hasSupabaseSupport();
}

export async function prepareSocialLoginFlow({
  provider = "google",
  nickname = "",
  returnTo = "/",
  currentGuestSessionToken = "",
} = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase 설정이 필요합니다.");
  }

  const socialProvider = normalizeProvider(provider);
  const { verifier, challenge } = await createPkcePair();
  saveSocialPkceVerifier(verifier);

  const pendingFlow = {
    provider: socialProvider,
    nickname: nickname?.trim() || "",
    returnTo: returnTo || "/",
    currentGuestSessionToken: currentGuestSessionToken || "",
    createdAt: Date.now(),
  };

  const redirectUrl = getBaseUrl(pendingFlow.returnTo, socialProvider);
  const params = new URLSearchParams({
    provider: socialProvider,
    redirect_to: redirectUrl,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "s256",
    scope: SOCIAL_SCOPES[socialProvider],
  });

  return {
    authorizeUrl: `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`,
    pendingFlow,
  };
}

export async function exchangeSupabaseCode({ code, provider = "google" } = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase 설정이 필요합니다.");
  }

  const verifier = getSocialPkceVerifier();
  if (!verifier) {
    throw new Error("소셜 로그인 검증 정보가 만료되었습니다. 다시 시도해 주세요.");
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_code: code,
      code_verifier: verifier,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.msg || data.message || "소셜 로그인을 완료하지 못했습니다.");
  }

  clearSocialPkceVerifier();
  return {
    ...data,
    provider: normalizeProvider(provider),
  };
}

export async function prepareGoogleLoginFlow(options = {}) {
  return prepareSocialLoginFlow({ ...options, provider: "google" });
}
