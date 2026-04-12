import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute";
import AdminPage from "../pages/AdminPage";
import AiLabPage from "../pages/AiLabPage";
import DailyWordPage from "../pages/DailyWordPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import ProfilePage from "../pages/ProfilePage";
import PromptRoomPage from "../pages/PromptRoomPage";
import PromptRoomsPage from "../pages/PromptRoomsPage";
import PrivacyPage from "../pages/PrivacyPage";
import ProposalPage from "../pages/ProposalPage";
import TermsPage from "../pages/TermsPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/ai-lab" element={<AiLabPage />} />
      <Route
        path="/word"
        element={
          <ProtectedRoute>
            <DailyWordPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rooms"
        element={
          <ProtectedRoute>
            <PromptRoomsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rooms/:roomId"
        element={
          <ProtectedRoute>
            <PromptRoomPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/new"
        element={
          <ProtectedRoute requireAuthType="social">
            <ProposalPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAuthType="social" requireAdmin>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="/play" element={<Navigate to="/word" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
