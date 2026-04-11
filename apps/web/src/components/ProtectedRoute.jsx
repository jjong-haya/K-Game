import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/useAuth";

function ProtectedRoute({ children, requireAuthType = "any", requireAdmin = false }) {
  const location = useLocation();
  const { isReady, session, isAuthenticated } = useAuth();

  if (!isReady) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-6">
        <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
          <div className="w-full brutal-panel bg-punch-yellow text-center md:max-w-3xl">
            <p className="text-4xl font-bold">로그인 상태 확인 중</p>
            <p className="mt-3 text-sm font-medium leading-7">
              세션이 유효한지 확인하고 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  if (!isAuthenticated) {
    const search = new URLSearchParams({ returnTo });

    if (requireAuthType === "social" || requireAdmin) {
      search.set("scope", "social");
    }

    return <Navigate to={`/login?${search.toString()}`} replace />;
  }

  if ((requireAuthType === "social" || requireAdmin) && session?.authType === "guest") {
    const search = new URLSearchParams({ returnTo, scope: "social" });
    return <Navigate to={`/login?${search.toString()}`} replace />;
  }

  if (requireAdmin && !session?.isAdmin) {
    return <Navigate to="/profile?forbidden=admin" replace />;
  }

  return children;
}

export default ProtectedRoute;
