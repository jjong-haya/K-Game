import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";
import { fetchAdminDailyWord } from "../lib/api";

const NICKNAME_UNSAFE = /[<>"'`;\\]/g;

function sanitizeNickname(raw) {
  return raw.trim().replace(/\s+/g, " ").replace(NICKNAME_UNSAFE, "").slice(0, 40);
}

function toLocalDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function ProfilePage() {
  const {
    session,
    isGuest,
    isAdmin,
    isIdLogin,
    socialProvider,
    updateNickname,
    startSocialLogin,
    deleteAccount,
    isSyncing,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [nickname, setNickname] = useState(session?.nickname || "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [linkingProvider, setLinkingProvider] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [dailyWord, setDailyWord] = useState(null);
  const [dailyWordLoading, setDailyWordLoading] = useState(false);
  const [dailyWordError, setDailyWordError] = useState("");
  const socialLinkCardRef = useRef(null);

  useEffect(() => {
    setNickname(session?.nickname || "");
  }, [session?.nickname]);

  useEffect(() => {
    if (searchParams.get("focus") === "social-link" && socialLinkCardRef.current) {
      socialLinkCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("forbidden") === "admin") {
      setError("관리자 권한이 없는 계정입니다.");
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    async function loadDailyWord() {
      if (!isAdmin || !session?.token) {
        setDailyWord(null);
        setDailyWordError("");
        setDailyWordLoading(false);
        return;
      }

      try {
        setDailyWordLoading(true);
        const data = await fetchAdminDailyWord(session);
        if (!active) {
          return;
        }

        setDailyWord(data?.challenge || null);
        setDailyWordError("");
      } catch (requestError) {
        if (!active) {
          return;
        }

        setDailyWord(null);
        setDailyWordError(requestError.message || "오늘의 단어 정보를 불러오지 못했습니다.");
      } finally {
        if (active) {
          setDailyWordLoading(false);
        }
      }
    }

    loadDailyWord();

    return () => {
      active = false;
    };
  }, [isAdmin, session]);

  const currentSocialLabel = useMemo(() => {
    if (socialProvider === "apple") {
      return "Apple 계정 연결 완료";
    }

    if (socialProvider === "google") {
      return "Google 계정 연결 완료";
    }

    if (isIdLogin) {
      return "ID 계정으로 로그인";
    }

    return "게스트로 플레이 중";
  }, [isIdLogin, socialProvider]);

  const adminDailyWordSummary = useMemo(() => {
    if (!dailyWord) {
      return "";
    }

    const categoryName = dailyWord.category?.name || dailyWord.category?.slug || "카테고리 없음";
    return `${dailyWord.challengeDate || toLocalDateInputValue()} · ${dailyWord.publicTitle || "제목 없음"} · 정답 ${dailyWord.hiddenAnswerText || "-"} · ${categoryName}`;
  }, [dailyWord]);

  const adminDailyWordStats = useMemo(() => {
    const stats = dailyWord?.stats || {};
    return [
      { label: "참여자", value: stats.participantCount ?? 0 },
      { label: "시도", value: stats.attemptCount ?? 0 },
      { label: "정답자", value: stats.winCount ?? 0 },
    ];
  }, [dailyWord]);

  const shortcutItems = [];

  const handleNicknameSave = async (event) => {
    event.preventDefault();
    const trimmed = sanitizeNickname(nickname);
    if (!trimmed) {
      setError("닉네임을 먼저 입력해 주세요.");
      return;
    }

    try {
      setSavingNickname(true);
      setError("");
      setMessage("");
      await updateNickname(trimmed);
      setMessage("닉네임을 저장했습니다.");
    } catch (requestError) {
      setError(requestError.message || "닉네임을 저장하지 못했습니다.");
    } finally {
      setSavingNickname(false);
    }
  };

  const handleSocialLink = async (provider) => {
    try {
      setLinkingProvider(provider);
      setError("");
      setMessage("");
      await startSocialLogin({
        provider,
        nickname: nickname.trim() || session?.nickname || "",
        returnTo: "/profile",
      });
    } catch (requestError) {
      setError(requestError.message || "소셜 계정 연결을 시작하지 못했습니다.");
      setLinkingProvider("");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "계정을 삭제하면 세션과 기록을 복구할 수 없습니다. 정말 계속할까요?",
    );
    if (!confirmed) {
      return;
    }

    try {
      setDeletingAccount(true);
      setError("");
      await deleteAccount();
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "계정을 삭제하지 못했습니다.");
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <AppShell maxWidth="max-w-5xl">
      <section className="brutal-panel bg-white">
        <span className="section-label bg-punch-yellow">PROFILE</span>
        <h1 className="mt-4 text-4xl font-bold leading-[0.94] md:text-6xl">프로필</h1>

        {error ? (
          <div className="mt-6 rounded-[1.2rem] border-4 border-ink bg-punch-pink px-4 py-4 shadow-brutal-sm">
            <p className="text-sm font-bold">{error}</p>
          </div>
        ) : null}

        {message ? (
          <div className="mt-6 rounded-[1.2rem] border-4 border-ink bg-punch-mint px-4 py-4 shadow-brutal-sm">
            <p className="text-sm font-bold">{message}</p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleNicknameSave}>
            <div className="h-full rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-5 shadow-brutal-sm">
              <p className="text-lg font-black">닉네임</p>
              <p className="mt-2 text-sm font-medium leading-7">
                원하는 닉네임은 채팅 기록과 순위표 상단에 표시됩니다.
              </p>
              <label className="mt-4 block space-y-2 text-sm font-bold">
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={18}
                  className="w-full rounded-[1rem] border-4 border-ink bg-white px-4 py-3 outline-none focus-visible:ring-4 focus-visible:ring-punch-cyan"
                  placeholder="예: 노련한 탐험가"
                />
              </label>
              <button
                type="submit"
                className="chunky-button mt-4 bg-punch-yellow"
                disabled={savingNickname || isSyncing}
              >
                {savingNickname ? "저장 중..." : "닉네임 저장"}
              </button>
            </div>
          </form>

          <div className="rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-5 shadow-brutal-sm">
            <p className="text-lg font-black">계정 정보</p>
            <p className="mt-2 text-lg font-bold">{currentSocialLabel}</p>
            {session?.email ? <p className="mt-1 text-sm font-medium">{session.email}</p> : null}
          </div>

          {isAdmin ? (
            <div className="rounded-[1.2rem] border-4 border-ink bg-punch-mint/25 p-5 shadow-brutal-sm lg:col-span-2">
              <p className="text-lg font-black">오늘의 단어 요약</p>
              {dailyWordLoading ? (
                <p className="mt-3 text-sm font-medium leading-7">오늘의 단어를 불러오는 중입니다.</p>
              ) : dailyWordError ? (
                <p className="mt-3 text-sm font-medium leading-7">{dailyWordError}</p>
              ) : dailyWord ? (
                <>
                  <p className="mt-3 text-sm font-medium leading-7">{adminDailyWordSummary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {adminDailyWordStats.map((stat) => (
                      <span
                        key={stat.label}
                        className="rounded-full border-4 border-ink bg-white px-3 py-1 text-xs font-bold shadow-brutal-sm"
                      >
                        {stat.label} {stat.value}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm font-medium leading-7">
                  오늘의 단어 정보를 아직 불러오지 못했습니다.
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link to="/admin" className="chunky-button bg-punch-yellow">
                  관리자 페이지 열기
                </Link>
                <span className="text-sm font-medium text-ink/70">
                  오늘의 단어 수정, 자동 생성, 다시 생성은 관리자 페이지에서 할 수 있습니다.
                </span>
              </div>
            </div>
          ) : null}

          {isGuest ? (
            <div
              ref={socialLinkCardRef}
              className="rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-5 shadow-brutal-sm"
            >
              <p className="text-lg font-black">소셜 계정 연결</p>
              <p className="mt-2 text-sm font-medium leading-7">
                게스트 계정은 브라우저를 닫으면 기록이 사라질 수 있습니다. 오래 보관하려면 소셜 계정으로
                연결해 주세요.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleSocialLink("google")}
                  className="chunky-button w-full bg-white"
                  disabled={Boolean(linkingProvider) || isSyncing}
                >
                  {linkingProvider === "google" ? "Google 연결 중..." : "Google로 연결하기"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLink("apple")}
                  className="chunky-button w-full bg-white"
                  disabled={Boolean(linkingProvider) || isSyncing}
                >
                  {linkingProvider === "apple" ? "Apple 연결 중..." : "Apple로 연결하기"}
                </button>
              </div>
            </div>
          ) : null}

          {shortcutItems.map((item) => (
            <div
              key={item.title}
              className="rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-5 shadow-brutal-sm"
            >
              <p className="text-lg font-black">{item.title}</p>
              <p className="mt-2 text-sm font-medium leading-7">{item.description}</p>
              <Link to={item.to} className="chunky-button mt-4 bg-white">
                바로 가기
              </Link>
            </div>
          ))}

          <div className="rounded-[1.2rem] border-4 border-ink bg-punch-pink/30 p-5 shadow-brutal-sm lg:col-span-2">
            <p className="text-lg font-black">계정 삭제</p>
            <p className="mt-2 text-sm font-medium leading-7">
              계정을 삭제하면 현재 세션과 기록을 복구할 수 없습니다.
            </p>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deletingAccount || isSyncing}
              className="chunky-button mt-4 bg-punch-pink"
            >
              {deletingAccount ? "삭제 중..." : "계정 삭제"}
            </button>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

export default ProfilePage;
