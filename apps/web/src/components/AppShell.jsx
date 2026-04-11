import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";

const NAV_ITEMS = [
  { to: "/", label: "홈" },
  { to: "/word", label: "오늘의 단어" },
  { to: "/rooms", label: "출시 예정" },
];

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

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function BrandMark() {
  return (
    <Link to="/" className="brand-mark inline-flex items-center px-1 py-0 select-none">
      <span className="brand-mark-text text-[3.2rem] font-black uppercase leading-[0.92] tracking-[0.08em] text-ink md:text-[4rem]">
        K-Game
      </span>
    </Link>
  );
}

function isActive(pathname, target) {
  if (target === "/") {
    return pathname === "/";
  }

  return pathname === target || pathname.startsWith(`${target}/`);
}

function getAuthLabel(authType) {
  if (authType === "google") return "Google 로그인";
  if (authType === "apple") return "Apple 로그인";
  if (authType === "guest") return "게스트 로그인";
  if (authType === "id") return "ID 로그인";
  return "로그인됨";
}

function AccountCluster({ session, onLogout }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const authLabel = useMemo(() => getAuthLabel(session?.authType), [session?.authType]);

  useEffect(() => {
    setIsExpanded(false);
  }, [session?.nickname, session?.authType]);

  return (
    <div className="relative w-[18rem] sm:w-[19.5rem]">
      <div className="flex items-center gap-3 rounded-[1.25rem] border-4 border-ink bg-white px-4 py-3 shadow-brutal-sm">
        <Link to="/profile" className="min-w-0 flex-1">
          <p className="truncate text-[1rem] font-black leading-6">{session?.nickname || "플레이어"}</p>
          <p className="mt-1 text-[11px] font-bold text-ink/65">{authLabel}</p>
        </Link>

        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          aria-expanded={isExpanded}
          aria-label="계정 메뉴 열기"
          className="inline-flex items-center justify-center p-0 text-ink/55 transition duration-150 hover:text-ink"
        >
          <ChevronDownIcon isOpen={isExpanded} />
        </button>
      </div>

      <div className={`account-menu ${isExpanded ? "account-menu-open" : ""}`}>
        <Link to="/profile" className="chunky-button w-full bg-white px-3 py-2 text-xs">
          프로필
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="chunky-button mt-2 w-full bg-white px-3 py-2 text-xs"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}

function GuestLogoutDialog({ onCancel, onConfirm, onLinkSocial }) {
  const dialogRef = useRef(null);
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const elements = Array.from(focusable).filter((element) => !element.hasAttribute("disabled"));
      if (!elements.length) {
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-logout-title"
        aria-describedby="guest-logout-description"
        className="w-full max-w-xl rounded-[1.6rem] border-4 border-ink bg-white p-6 shadow-brutal md:p-7"
      >
        <span className="section-label bg-punch-pink">게스트 경고</span>
        <h2 id="guest-logout-title" className="mt-4 text-3xl font-bold md:text-4xl">
          정말 로그아웃할까요?
        </h2>
        <p id="guest-logout-description" className="mt-4 text-sm font-medium leading-7 md:text-base">
          게스트 세션은 로그아웃하거나 브라우저를 닫으면 사라질 수 있습니다. 기록을 계속 유지하려면 먼저
          소셜 계정으로 연동하는 편이 안전합니다.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className="chunky-button bg-punch-pink"
          >
            그래도 로그아웃
          </button>
          <button type="button" onClick={onCancel} className="chunky-button bg-white">
            취소
          </button>
        </div>

        <button
          type="button"
          onClick={onLinkSocial}
          className="mt-6 inline-flex items-center gap-3 text-left text-sm font-bold"
        >
          <span>기록을 유지하려면 소셜 계정을 연결해 주세요</span>
          <span className="guest-warning-arrow inline-flex items-center">
            <ArrowRightIcon />
          </span>
        </button>
      </div>
    </div>
  );
}

function AppShell({ children, action = null, maxWidth = "max-w-7xl", navMode = "full" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isReady, isAuthenticated, isGuest, session, logout } = useAuth();
  const navItems = navMode === "minimal" ? [] : NAV_ITEMS;
  const [showGuestLogoutDialog, setShowGuestLogoutDialog] = useState(false);

  const performLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const handleLogout = async () => {
    if (isGuest) {
      setShowGuestLogoutDialog(true);
      return;
    }

    await performLogout();
  };

  const handleGuestSocialLink = () => {
    setShowGuestLogoutDialog(false);
    navigate("/profile?focus=social-link");
  };

  return (
    <div className="min-h-screen pb-14">
      <header
        role="banner"
        className={`mx-auto flex ${maxWidth} flex-wrap items-center justify-between gap-4 px-4 py-5 md:px-6`}
      >
        <div className="flex flex-wrap items-center gap-4">
          <BrandMark />

          {navItems.length ? (
            <nav aria-label="메인 내비게이션" className="flex flex-wrap items-center gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`nav-rect-button ${isActive(location.pathname, item.to) ? "bg-punch-yellow" : "bg-white"}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {action}

          {isReady ? (
            isAuthenticated ? (
              <AccountCluster session={session} onLogout={handleLogout} />
            ) : location.pathname === "/login" ? null : (
              <Link
                to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
                className="chunky-button bg-white"
              >
                로그인
              </Link>
            )
          ) : (
            <span className="rounded-[0.95rem] border-4 border-ink bg-white px-4 py-2 text-xs font-bold shadow-brutal-sm">
              세션 확인 중
            </span>
          )}
        </div>
      </header>

      <main role="main" className={`mx-auto ${maxWidth} px-4 md:px-6`}>{children}</main>

      <footer role="contentinfo" className={`mx-auto mt-8 ${maxWidth} px-4 pb-6 md:px-6`}>
        <div className="flex flex-col gap-4 rounded-[1.35rem] border-4 border-ink bg-white/90 px-5 py-4 shadow-brutal-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/55">Legal</p>
            <p className="mt-1 text-sm font-bold leading-6 md:text-base">
              K-Game 이용약관과 개인정보 안내
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/privacy" className="home-rank-badge bg-[#eefcff]">
              개인정보처리방침
            </Link>
            <Link to="/terms" className="home-rank-badge bg-[#fff7d6]">
              이용약관
            </Link>
          </div>
        </div>
      </footer>

      {showGuestLogoutDialog ? (
        <GuestLogoutDialog
          onCancel={() => setShowGuestLogoutDialog(false)}
          onConfirm={performLogout}
          onLinkSocial={handleGuestSocialLink}
        />
      ) : null}
    </div>
  );
}

export default AppShell;
