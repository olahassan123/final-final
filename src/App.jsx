import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import TreatmentDetailsPage from "./pages/TreatmentDetailsPage";
import ChatWidget from "./components/ChatWidget";
import CategorySelectionPage from "./pages/CategorySelectionPage";
import SecretaryPage from "./pages/SecretaryPage";
import AdminDashboard from "./pages/AdminDashboard";
import ServiceCategoryPage from "./pages/ServiceCategoryPage";
import ServiceTreatmentDetailsPage from "./pages/ServiceTreatmentDetailsPage";
import ClientArea from "./pages/ClientArea";
import RecruitmentPage from "./pages/RecruitmentPage";
import LoginModal from "./components/LoginModal";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/useAuth";

function FloatingAuthButton({ onLoginClick }) {
  const { user, logout } = useAuth();

  return (
    <div className="fixed left-5 top-5 z-[80] flex items-center gap-2" dir="rtl">
      {user ? (
        <>
          <span className="rounded-full border border-white/15 bg-black/35 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur">
            {user.username} · {user.role}
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20"
          >
            יציאה
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onLoginClick}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-primary-dark"
        >
          כניסה
        </button>
      )}
    </div>
  );
}

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search]);

  return null;
}

function AppContent() {
  const location = useLocation();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const isInternal = location.pathname === "/secretary" || location.pathname === "/admin";

  return (
    <div dir="rtl" className="min-h-screen bg-secondary flex flex-col">
      <ScrollToTop />
      {!isInternal && <Navbar onLoginClick={() => setIsLoginOpen(true)} />}
      {isInternal && <FloatingAuthButton onLoginClick={() => setIsLoginOpen(true)} />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/categories" element={<CategorySelectionPage />} />
          <Route path="/categories/:categorySlug" element={<ServiceCategoryPage />} />
          <Route
            path="/categories/:categorySlug/:treatmentSlug"
            element={<ServiceTreatmentDetailsPage />}
          />
          <Route path="/treatments" element={<Navigate to="/categories/cosmetology" replace />} />
          <Route path="/treatments/:id" element={<TreatmentDetailsPage />} />
          <Route path="/recruitment" element={<RecruitmentPage />} />
          <Route
            path="/secretary"
            element={
              <ProtectedRoute allowedRoles={["admin", "employee"]}>
                <SecretaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client"
            element={
              <ProtectedRoute allowedRoles={["client"]}>
                <ClientArea />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      {!isInternal && <ChatWidget />}
      {!isInternal && <Footer />}
      {isLoginOpen ? <LoginModal onClose={() => setIsLoginOpen(false)} /> : null}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
