import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "./useAuth";
import AppShell from "../../components/AppShell";

const TERMS_URL = process.env.REACT_APP_TERMS_URL || "/terms";
const PRIVACY_URL = process.env.REACT_APP_PRIVACY_POLICY_URL || "/privacy";

const COPY = {
  intro: "어떻게 들어올래?",
  login: "로그인",
  home: "홈으로",
  guestTitle: "게스트",
  googleTitle: "구글",
  appleTitle: "애플",
  nickname: "닉네임",
  nicknamePlaceholder: "닉네임을 입력해 주세요",
  guestAction: "게스트로 시작",
  guestLoading: "세션 만드는 중...",
  guestDetail: "기록은 남지만 로그아웃 혹은 페이지를 닫을 경우 전부 사라지게 됩니다.",
  socialAction: {
    google: "Google로 계속하기",
    apple: "Apple로 계속하기",
  },
  socialLoading: {
    google: "Google 연결 중...",
    apple: "Apple 연결 중...",
  },
  socialNicknameTitle: "게임 닉네임 정하기",
  socialNicknameDetail: "처음 들어오는 계정이면 돌아온 뒤 게임 닉네임을 한 번 더 정합니다.",
  socialNicknameIntro: "어서와, 이름이 뭐야?",
  socialNicknameAction: "이 닉네임으로 시작",
  socialNicknameLoading: "닉네임 저장 중...",
  errorGuestNickname: "닉네임을 먼저 입력해 주세요.",
  errorGuestCreate: "게스트 세션을 만들지 못했습니다.",
  errorSocialStart: "소셜 로그인을 시작하지 못했습니다.",
  errorSocialFinish: "소셜 로그인을 마무리하지 못했습니다.",
  errorSocialNickname: "게임에서 쓸 닉네임을 입력해 주세요.",
  errorSocialNicknameSave: "소셜 닉네임 저장에 실패했습니다.",
};

const NICKNAME_UNSAFE = /[<>"'`;\\]/g;

function sanitizeNickname(raw) {
  return raw.trim().replace(/\s+/g, " ").replace(NICKNAME_UNSAFE, "").slice(0, 40);
}

function normalizeProvider(provider = "") {
  return provider === "apple" ? "apple" : "google";
}

function TypeCaret({ show }) {
  return show ? <span className="type-caret">|</span> : null;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#EA4335" d="M12.2 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6.1-2.8-6.1-6.2s2.7-6.2 6.1-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C17 3 14.8 2 12.2 2 6.9 2 2.7 6.4 2.7 11.8s4.2 9.8 9.5 9.8c5.5 0 9.1-3.9 9.1-9.4 0-.6-.1-1.1-.2-1.6z" />
      <path fill="#FBBC05" d="M3.8 7.3l3.2 2.3c.9-2 2.8-3.4 5.2-3.4 1.9 0 3.1.8 3.8 1.5l2.6-2.5C17 3 14.8 2 12.2 2 8.5 2 5.3 4.1 3.8 7.3z" />
      <path fill="#34A853" d="M12.2 21.6c2.5 0 4.6-.8 6.1-2.3l-2.8-2.3c-.8.6-1.9 1.1-3.3 1.1-3.1 0-5.6-2.1-6.5-4.9l-3.3 2.5c1.6 3.3 5 5.9 9.8 5.9z" />
      <path fill="#4285F4" d="M21.3 12.2c0-.7-.1-1.2-.2-1.8h-8.9v3.9h5.1c-.2 1.1-.9 2.5-2 3.3l3 2.4c1.8-1.7 3-4.1 3-7.8z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M16.7 12.7c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.6.9-.7 0-1.8-.9-3-.9-1.5 0-3 .9-3.8 2.3-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.2 2.8 2.1 1.1 0 1.6-.7 3-.7 1.4 0 1.8.7 3 .7 1.2 0 2-1.1 2.7-2.2.9-1.2 1.2-2.4 1.2-2.4-.1 0-3-.9-3-3.2zm-2.4-7.1c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1 0 2.1-.5 2.8-1.3z" />
    </svg>
  );
}

function GuestIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M5 19.5c1.6-2.6 4-4 7-4s5.4 1.4 7 4" />
    </svg>
  );
}

function ChevronDownIcon({ isOpen }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-5 w-5 transition duration-200 ${isOpen ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

// eslint-disable-next-line no-unused-vars
function LegalNotice() {
  const renderLegalLink = (href, label) => {
    const isExternal = /^https?:\/\//i.test(href);
    if (isExternal) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className="underline decoration-[2px] underline-offset-4">
          {label}
        </a>
      );
    }

    return (
      <Link to={href} className="underline decoration-[2px] underline-offset-4">
        {label}
      </Link>
    );
  };

  return (
    <p className="text-[12px] font-bold leading-6 text-ink/70">
      {renderLegalLink(TERMS_URL, "이용약관")}
      {" / "}
      {renderLegalLink(PRIVACY_URL, "개인정보처리방침")}
    </p>
  );
}

function SocialActionButton({ provider, onClick, disabled, busy }) {
  const isApple = provider === "apple";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[5.25rem] w-full items-center justify-center gap-3 rounded-[1.55rem] border-4 border-ink px-6 py-5 text-[1.16rem] font-black shadow-brutal transition duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_0_#111111] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:pointer-events-none disabled:opacity-60 ${
        isApple ? "bg-ink text-white" : "bg-white text-ink"
      }`}
    >
      {isApple ? <AppleIcon /> : <GoogleIcon />}
      <span>{busy ? COPY.socialLoading[provider] : COPY.socialAction[provider]}</span>
    </button>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";
  const code = searchParams.get("code");
  const providerFromQuery = normalizeProvider(searchParams.get("provider") || "");

  const {
    isReady,
    isAuthenticated,
    isGuest,
    isGoogle,
    isApple,
    session,
    pendingSocialFlow,
    loginAsGuest,
    loginWithId,
    startSocialLogin,
    completeSocialCallback,
    finishPendingSocialLogin,
    logout,
    resetPendingSocialFlow,
    error,
    notice,
    clearError,
    clearNotice,
  } = useAuth();

  const [nickname, setNickname] = useState("");
  const [guestExpanded, setGuestExpanded] = useState(false);
  const [idExpanded, setIdExpanded] = useState(false);
  const [idUsername, setIdUsername] = useState("");
  const [idPassword, setIdPassword] = useState("");
  const [idBusy, setIdBusy] = useState(false);
  const [showId, setShowId] = useState(false);
  const [socialNicknameRequired, setSocialNicknameRequired] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState("");
  const [socialNicknameBusy, setSocialNicknameBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [introDisplay, setIntroDisplay] = useState("");
  const [introRaised, setIntroRaised] = useState(false);
  const [showGuest, setShowGuest] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);
  const [showApple, setShowApple] = useState(false);
  const [nicknameIntroDisplay, setNicknameIntroDisplay] = useState("");
  const [nicknameIntroRaised, setNicknameIntroRaised] = useState(false);
  const [showNicknameForm, setShowNicknameForm] = useState(false);
  const handledCodeRef = useRef("");

  useEffect(() => {
    if (!code && pendingSocialFlow?.supabaseSession) {
      resetPendingSocialFlow();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showSocialNickname = useMemo(
    () => socialNicknameRequired || (Boolean(code) && Boolean(pendingSocialFlow?.supabaseSession)),
    [code, pendingSocialFlow?.supabaseSession, socialNicknameRequired],
  );

  useEffect(() => {
    if (error) {
      setPageError(error);
      clearError();
    }
  }, [clearError, error]);

  useEffect(() => {
    if (notice) {
      setPageMessage(notice);
      clearNotice();
    }
  }, [clearNotice, notice]);

  useEffect(() => {
    const run = async () => {
      if (!code || !isReady || handledCodeRef.current === code) {
        return;
      }

      handledCodeRef.current = code;
      const callbackProvider = providerFromQuery || normalizeProvider(pendingSocialFlow?.provider);

      try {
        setSocialBusy(callbackProvider);
        const result = await completeSocialCallback({
          code,
          provider: callbackProvider,
          nickname: nickname.trim(),
          returnTo,
        });

        if (result?.needsNickname) {
          setSocialNicknameRequired(true);
          return;
        }

        navigate(result?.returnTo || returnTo, { replace: true });
      } catch (requestError) {
        setPageError(requestError.message || COPY.errorSocialFinish);
      } finally {
        setSocialBusy("");
      }
    };

    run();
  }, [code, completeSocialCallback, isReady, navigate, nickname, pendingSocialFlow?.provider, providerFromQuery, returnTo]);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const skipIntro = reduceMotion || Boolean(code) || Boolean(pendingSocialFlow?.supabaseSession);

    if (skipIntro) {
      setIntroDisplay(COPY.intro);
      setIntroRaised(true);
      setShowGuest(true);
      setShowId(true);
      setShowGoogle(true);
      setShowApple(true);
      return undefined;
    }

    let typingInterval;
    const timers = [];

    timers.push(
      setTimeout(() => {
        let index = 0;
        typingInterval = setInterval(() => {
          index += 1;
          setIntroDisplay(COPY.intro.slice(0, index));
          if (index >= COPY.intro.length) {
            clearInterval(typingInterval);
            timers.push(setTimeout(() => setIntroRaised(true), 220));
            timers.push(setTimeout(() => setShowGuest(true), 500));
            timers.push(setTimeout(() => setShowId(true), 630));
            timers.push(setTimeout(() => setShowGoogle(true), 760));
            timers.push(setTimeout(() => setShowApple(true), 1020));
          }
        }, 92);
      }, 180),
    );

    return () => {
      clearInterval(typingInterval);
      timers.forEach((timerId) => clearTimeout(timerId));
    };
  }, [code, pendingSocialFlow?.supabaseSession]);

  useEffect(() => {
    if (!showSocialNickname) {
      return undefined;
    }

    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      setNicknameIntroDisplay(COPY.socialNicknameIntro);
      setNicknameIntroRaised(true);
      setShowNicknameForm(true);
      return undefined;
    }

    let typingInterval;
    const timers = [];

    timers.push(
      setTimeout(() => {
        let index = 0;
        typingInterval = setInterval(() => {
          index += 1;
          setNicknameIntroDisplay(COPY.socialNicknameIntro.slice(0, index));
          if (index >= COPY.socialNicknameIntro.length) {
            clearInterval(typingInterval);
            timers.push(setTimeout(() => setNicknameIntroRaised(true), 220));
            timers.push(setTimeout(() => setShowNicknameForm(true), 500));
          }
        }, 92);
      }, 300),
    );

    return () => {
      clearInterval(typingInterval);
      timers.forEach((timerId) => clearTimeout(timerId));
    };
  }, [showSocialNickname]);

  useEffect(() => {
    if (isGuest) {
      setGuestExpanded(true);
    }
  }, [isGuest]);

  const handleGuestSubmit = async (event) => {
    event.preventDefault();
    const trimmed = sanitizeNickname(nickname);
    if (!trimmed) {
      setPageError(COPY.errorGuestNickname);
      return;
    }

    try {
      setGuestBusy(true);
      setPageError("");
      setPageMessage("");
      await loginAsGuest({ nickname: trimmed });
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setPageError(requestError.message || COPY.errorGuestCreate);
    } finally {
      setGuestBusy(false);
    }
  };

  const handleIdSubmit = async (event) => {
    event.preventDefault();
    if (!idUsername.trim() || !idPassword) {
      setPageError("아이디와 비밀번호를 입력해 주세요.");
      return;
    }
    try {
      setIdBusy(true);
      setPageError("");
      setPageMessage("");
      await loginWithId({ username: idUsername.trim(), password: idPassword });
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setPageError(requestError.message || "로그인에 실패했습니다.");
    } finally {
      setIdBusy(false);
    }
  };

  const handleSocialStart = async (provider) => {
    try {
      setSocialBusy(provider);
      setPageError("");
      setPageMessage("");
      await startSocialLogin({
        provider,
        nickname: sanitizeNickname(nickname),
        returnTo,
      });
    } catch (requestError) {
      setPageError(requestError.message || COPY.errorSocialStart);
      setSocialBusy("");
    }
  };

  const handleSocialNicknameSubmit = async (event) => {
    event.preventDefault();
    const trimmed = sanitizeNickname(nickname);
    if (!trimmed) {
      setPageError(COPY.errorSocialNickname);
      return;
    }

    try {
      setSocialNicknameBusy(true);
      setPageError("");
      const result = await finishPendingSocialLogin({
        nickname: trimmed,
        returnTo,
      });
      navigate(result?.returnTo || returnTo, { replace: true });
    } catch (requestError) {
      setPageError(requestError.message || COPY.errorSocialNicknameSave);
    } finally {
      setSocialNicknameBusy(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setNickname("");
    setGuestExpanded(false);
    setSocialNicknameRequired(false);
    navigate("/login", { replace: true });
  };

  const renderSocialNicknameScreen = () => (
    <>
      <div className={`mx-auto flex min-h-[8.5rem] w-full max-w-[34rem] items-center justify-center text-center transition-all duration-500 ${nicknameIntroRaised ? "translate-y-[-1rem] md:translate-y-[-1.35rem]" : ""}`}>
        <p className="text-[2.35rem] font-black leading-[0.95] whitespace-nowrap md:text-[4.75rem]">
          {nicknameIntroDisplay}
          <TypeCaret show={nicknameIntroDisplay.length < COPY.socialNicknameIntro.length} />
        </p>
      </div>

      <div className={`mx-auto mt-8 w-full max-w-[34rem] transition-all duration-500 ${nicknameIntroRaised ? "translate-y-[-0.65rem]" : ""}`}>
        <div className={`transition-all duration-300 ease-out ${showNicknameForm ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 pointer-events-none"}`}>
          <form onSubmit={handleSocialNicknameSubmit} className="rounded-[1.6rem] border-4 border-ink bg-white p-5 shadow-brutal md:p-6">
            <div className="space-y-5">
              <label className="block space-y-2 text-sm font-bold">
                <span className="block text-xs uppercase tracking-[0.16em]">{COPY.nickname}</span>
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  className="w-full rounded-[1rem] border-4 border-ink bg-[#fff9ec] px-4 py-3 text-base font-bold outline-none"
                  maxLength={18}
                  placeholder={COPY.nicknamePlaceholder}
                  autoFocus
                />
              </label>

              <button type="submit" className="chunky-button w-full bg-punch-pink" disabled={socialNicknameBusy}>
                {socialNicknameBusy ? COPY.socialNicknameLoading : COPY.socialNicknameAction}
              </button>
            </div>
          </form>
        </div>

        {pageError ? (
          <div className="mt-5 rounded-[1.2rem] border-4 border-ink bg-punch-pink px-4 py-4 shadow-brutal-sm">
            <p className="text-sm font-bold">{pageError}</p>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <AppShell navMode="minimal" maxWidth="max-w-5xl">
      <section className="mx-auto">
        <div className="brutal-panel flex min-h-[36rem] flex-col bg-punch-yellow">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-ink/65">{COPY.login}</p>
              {isAuthenticated ? (
                <div className="mt-5 rounded-[1.1rem] border-4 border-ink bg-white px-4 py-3 shadow-brutal-sm">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em]">현재 세션</p>
                  <p className="mt-2 text-base font-bold">
                    {session?.nickname || "플레이어"} /{" "}
                    {isApple ? "Apple" : isGoogle ? "Google" : isGuest ? "Guest" : session?.authType || "session"}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-[0.95rem] border-4 border-ink bg-white px-3 py-2 text-xs font-black tracking-[0.04em] text-ink shadow-none sm:px-4 sm:py-2.5 sm:text-sm"
              >
                {COPY.home}
              </Link>
              {isAuthenticated ? (
                <button type="button" onClick={handleLogout} className="chunky-button bg-punch-pink">
                  로그아웃
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center">
            {showSocialNickname ? (
              renderSocialNicknameScreen()
            ) : (
              <>
                <div className={`mx-auto flex min-h-[8.5rem] w-full max-w-[34rem] items-center justify-center text-center transition-all duration-500 ${introRaised ? "translate-y-[-1rem] md:translate-y-[-1.35rem]" : ""}`}>
                  <p className="text-[2.35rem] font-black leading-[0.95] whitespace-nowrap md:text-[4.75rem]">
                    {introDisplay}
                    <TypeCaret show={introDisplay.length < COPY.intro.length} />
                  </p>
                </div>

                <div className={`mx-auto mt-8 w-full max-w-[34rem] transition-all duration-500 ${introRaised ? "translate-y-[-0.65rem]" : ""}`}>
                <div className="space-y-4">
                  <div className={`transition-all duration-300 ease-out ${showGuest ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
                    <section className="rounded-[1.6rem] border-4 border-ink bg-white shadow-brutal overflow-hidden">
                      <button
                        type="button"
                        onClick={() => { setGuestExpanded((value) => !value); setIdExpanded(false); }}
                        className="flex min-h-[5.25rem] w-full items-center justify-between gap-3 px-6 py-5 text-left"
                        aria-expanded={guestExpanded}
                      >
                        <div className="flex items-center gap-3">
                          <GuestIcon />
                          <p className="text-[1.95rem] font-black leading-none">{COPY.guestTitle}</p>
                        </div>
                        <span className="text-ink/70">
                          <ChevronDownIcon isOpen={guestExpanded} />
                        </span>
                      </button>

                      <div className={`collapse-fold ${guestExpanded ? "collapse-fold-open" : ""}`}>
                        <div>
                          <form onSubmit={handleGuestSubmit} className="space-y-5 border-t-4 border-ink px-6 py-5">
                            <p className="text-sm font-bold leading-7 text-ink/80">{COPY.guestDetail}</p>

                            <label className="block space-y-2 text-sm font-bold">
                              <span className="block text-xs uppercase tracking-[0.16em]">{COPY.nickname}</span>
                              <input
                                value={nickname}
                                onChange={(event) => setNickname(event.target.value)}
                                className="w-full rounded-[1rem] border-4 border-ink bg-[#fff9ec] px-4 py-3 text-base font-bold outline-none"
                                maxLength={18}
                                placeholder={COPY.nicknamePlaceholder}
                              />
                            </label>

                            <button type="submit" className="chunky-button w-full bg-punch-yellow" disabled={guestBusy}>
                              {guestBusy ? COPY.guestLoading : COPY.guestAction}
                            </button>
                          </form>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className={`transition-all duration-300 ease-out ${showId ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>
                    <section className="rounded-[1.6rem] border-4 border-ink bg-white shadow-brutal overflow-hidden">
                      <button
                        type="button"
                        onClick={() => { setIdExpanded((v) => !v); setGuestExpanded(false); }}
                        className="flex min-h-[5.25rem] w-full items-center justify-between gap-3 px-6 py-5 text-left"
                        aria-expanded={idExpanded}
                      >
                        <div className="flex items-center gap-3">
                          <KeyIcon />
                          <p className="text-[1.95rem] font-black leading-none">ID 로그인</p>
                        </div>
                        <span className="text-ink/70">
                          <ChevronDownIcon isOpen={idExpanded} />
                        </span>
                      </button>

                      <div className={`collapse-fold ${idExpanded ? "collapse-fold-open" : ""}`}>
                        <div>
                          <form onSubmit={handleIdSubmit} className="space-y-4 border-t-4 border-ink px-6 py-5">
                            <label className="block space-y-2 text-sm font-bold">
                              <span className="block text-xs uppercase tracking-[0.16em]">아이디</span>
                              <input
                                value={idUsername}
                                onChange={(e) => setIdUsername(e.target.value)}
                                className="w-full rounded-[1rem] border-4 border-ink bg-[#fff9ec] px-4 py-3 text-base font-bold outline-none"
                                maxLength={50}
                                placeholder="아이디를 입력해 주세요"
                                autoComplete="username"
                              />
                            </label>
                            <label className="block space-y-2 text-sm font-bold">
                              <span className="block text-xs uppercase tracking-[0.16em]">비밀번호</span>
                              <input
                                type="password"
                                value={idPassword}
                                onChange={(e) => setIdPassword(e.target.value)}
                                className="w-full rounded-[1rem] border-4 border-ink bg-[#fff9ec] px-4 py-3 text-base font-bold outline-none"
                                maxLength={100}
                                placeholder="비밀번호를 입력해 주세요"
                                autoComplete="current-password"
                              />
                            </label>
                            <button type="submit" className="chunky-button w-full bg-punch-cyan" disabled={idBusy}>
                              {idBusy ? "로그인 중..." : "로그인"}
                            </button>
                          </form>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className={`transition-all duration-300 ease-out ${(guestExpanded || idExpanded) ? "max-h-0 overflow-hidden translate-y-[-10px] opacity-0 pointer-events-none" : showGoogle ? "max-h-32 translate-y-0 opacity-100" : "max-h-0 overflow-hidden translate-y-3 opacity-0"}`}>
                    <SocialActionButton
                      provider="google"
                      onClick={() => handleSocialStart("google")}
                      busy={socialBusy === "google"}
                      disabled={Boolean(socialBusy)}
                    />
                  </div>

                  <div className={`transition-all duration-300 ease-out ${(guestExpanded || idExpanded) ? "max-h-0 overflow-hidden translate-y-[-10px] opacity-0 pointer-events-none" : showApple ? "max-h-32 translate-y-0 opacity-100" : "max-h-0 overflow-hidden translate-y-3 opacity-0"}`}>
                    <SocialActionButton
                      provider="apple"
                      onClick={() => handleSocialStart("apple")}
                      busy={socialBusy === "apple"}
                      disabled={Boolean(socialBusy)}
                    />
                  </div>

                  <div className={`transition-all duration-300 ease-out ${(guestExpanded || idExpanded) ? "max-h-0 overflow-hidden translate-y-[-10px] opacity-0 pointer-events-none" : showApple ? "max-h-16 translate-y-0 opacity-100" : "max-h-0 overflow-hidden translate-y-3 opacity-0"}`}>
                    <p className="text-[12px] font-bold leading-6 text-ink/70">
                      {"계속하면 "}
                      <Link to="/terms" className="underline decoration-[2px] underline-offset-4">이용약관</Link>
                      {" 및 "}
                      <Link to="/privacy" className="underline decoration-[2px] underline-offset-4">개인정보처리방침</Link>
                      {"에 동의하는 것으로 간주합니다."}
                    </p>
                  </div>
                </div>

              {pageError ? (
                <div className="mt-5 rounded-[1.2rem] border-4 border-ink bg-punch-pink px-4 py-4 shadow-brutal-sm">
                  <p className="text-sm font-bold">{pageError}</p>
                </div>
              ) : null}

              {pageMessage ? (
                <div className="mt-5 rounded-[1.2rem] border-4 border-ink bg-white px-4 py-4 shadow-brutal-sm">
                  <p className="text-sm font-bold leading-7">{pageMessage}</p>
                </div>
              ) : null}
            </div>
              </>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

export default LoginPage;
