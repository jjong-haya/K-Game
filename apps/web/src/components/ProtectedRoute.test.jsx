import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "../auth/useAuth";

vi.mock("../auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

function renderRoute(routeElement, initialEntries = ["/admin"]) {
  return render(
    <MemoryRouter
      initialEntries={initialEntries}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/admin" element={routeElement} />
        <Route path="/login" element={<div>login-page</div>} />
        <Route path="/profile" element={<div>profile-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects unauthenticated users to login", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isAuthenticated: false,
      session: null,
    });

    renderRoute(
      <ProtectedRoute requireAuthType="social" requireAdmin>
        <div>admin-page</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("login-page")).toBeInTheDocument();
  });

  it("redirects non-admin users away from admin routes", () => {
    useAuth.mockReturnValue({
      isReady: true,
      isAuthenticated: true,
      session: {
        authType: "google",
        isAdmin: false,
      },
    });

    renderRoute(
      <ProtectedRoute requireAuthType="social" requireAdmin>
        <div>admin-page</div>
      </ProtectedRoute>,
    );

    expect(screen.getByText("profile-page")).toBeInTheDocument();
  });
});
