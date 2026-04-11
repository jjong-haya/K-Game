import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";

const NICKNAME_UNSAFE = /[<>"'`;\\]/g;
function sanitizeNickname(raw) {
  return raw.trim().replace(/\s+/g, " ").replace(NICKNAME_UNSAFE, "").slice(0, 40);
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

  const shortcutItems = useMemo(
    () =>
      [
        isAdmin
          ? {
              title: "관리자 도구",
              description: "대기 중인 제안을 검토하고 운영용 방으로 승인하거나 반려합니다.",
              to: "/admin",
              disabled: false,
              disabledText: "",
            }
          : null,
      ].filter(Boolean),
    [isAdmin],
  );

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
      setError(requestError.message || "소셜 계정 연동을 시작하지 못했습니다.");
      setLinkingProvider("");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("계정을 삭제하면 세션과 기록을 복구할 수 없습니다. 계속할까요?");
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

  const currentSocialLabel =
    socialProvider === "apple"
      ? "Apple 계정 연결 완료"
      : socialProvider === "google"
        ? "Google 계정 연결 완료"
        : isIdLogin
          ? "ID 계정으로 로그인"
          : "게스트로 플레이 중";

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
          {/* 닉네임 */}
          <form onSubmit={handleNicknameSave}>
            <div className="h-full rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-5 shadow-brutal-sm">
              <p className="text-lg font-black">닉네임</p>
              <p className="mt-2 text-sm font-medium leading-7">
                저장한 닉네임은 채팅 기록과 순위표에 표시됩니다.
              </p>
              <label className="mt-4 block space-y-2 text-sm font-bold">
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={18}
                  className="w-full rounded-[1rem] border-4 border-ink bg-white px-4 py-3 outline-none focus-visible:ring-4 focus-visible:ring-punch-cyan"
                  placeholder="예: 프롬프트 장인"
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

          {/* 계정 정보 */}
          <div className="rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-5 shadow-brutal-sm">
            <p className="text-lg font-black">계정 정보</p>
            <p className="mt-2 text-lg font-bold">{currentSocialLabel}</p>
            {session?.email ? (
              <p className="mt-1 text-sm font-medium">{session.email}</p>
            ) : null}
          </div>

          {/* 게스트: 소셜 연동 */}
          {isGuest ? (
            <div ref={socialLinkCardRef} className="rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-5 shadow-brutal-sm">
              <p className="text-lg font-black">소셜 연동</p>
              <p className="mt-2 text-sm font-medium leading-7">
                게스트 계정은 브라우저를 닫거나 로그아웃하면 세션이 사라질 수 있습니다. 기록을 이어가려면 소셜 계정으로 연동해 주세요.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleSocialLink("google")}
                  className="chunky-button w-full bg-white"
                  disabled={Boolean(linkingProvider) || isSyncing}
                >
                  {linkingProvider === "google" ? "Google 연동 준비 중..." : "Google로 연동하기"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLink("apple")}
                  className="chunky-button w-full bg-white"
                  disabled={Boolean(linkingProvider) || isSyncing}
                >
                  {linkingProvider === "apple" ? "Apple 연동 준비 중..." : "Apple로 연동하기"}
                </button>
              </div>
            </div>
          ) : null}

          {/* 관리자 도구 */}
          {shortcutItems.map((item) => (
            <div key={item.title} className="rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-5 shadow-brutal-sm">
              <p className="text-lg font-black">{item.title}</p>
              <p className="mt-2 text-sm font-medium leading-7">{item.description}</p>
              <Link to={item.to} className="chunky-button mt-4 bg-white">
                바로 가기
              </Link>
            </div>
          ))}

          {/* 계정 삭제 — 홀수개일 때 전체 너비 */}
          <div className="rounded-[1.2rem] border-4 border-ink bg-punch-pink/30 p-5 shadow-brutal-sm lg:col-span-2">
            <p className="text-lg font-black">계정 삭제</p>
            <p className="mt-2 text-sm font-medium leading-7">
              계정을 삭제하면 현재 세션과 연결된 기록을 복구할 수 없습니다.
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
