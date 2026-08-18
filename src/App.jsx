import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import AboutPage from "./pages/AboutPage";
import ProfessionalTeamPage from "./pages/ProfessionalTeamPage";
import TreatmentDetailsPage from "./pages/TreatmentDetailsPage";
import ChatWidget from "./components/ChatWidget";
import CategorySelectionPage from "./pages/CategorySelectionPage";
import SecretaryPage from "./pages/SecretaryPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminStaffManagement from "./pages/AdminStaffManagement";
import AdminCustomerManagement from "./pages/AdminCustomerManagement";
import AdminAuditLog from "./pages/AdminAuditLog";
import AdminEmployeeShifts from "./pages/AdminEmployeeShifts";
import AdminEmployees from "./pages/AdminEmployees";
import AccountSettings from "./pages/AccountSettings";
import StaffLogin from "./pages/StaffLogin";
import ServiceCategoryPage from "./pages/ServiceCategoryPage";
import ServiceTreatmentDetailsPage from "./pages/ServiceTreatmentDetailsPage";
import ClientArea from "./pages/ClientArea";
import RecruitmentPage from "./pages/RecruitmentPage";
import GalleryPage from "./pages/GalleryPage";
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
          <Link
            to="/account-settings"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-white/20"
          >
            Settings
          </Link>
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
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const targetId = decodeURIComponent(hash.slice(1));
      let firstFrame;
      let secondFrame;
      let timeoutId;

      const scrollToTarget = () => {
        const target = document.getElementById(targetId);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      };

      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(scrollToTarget);
      });
      timeoutId = window.setTimeout(scrollToTarget, 180);

      return () => {
        cancelAnimationFrame(firstFrame);
        cancelAnimationFrame(secondFrame);
        window.clearTimeout(timeoutId);
      };
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search, hash]);

  return null;
}

function AppContent() {
  const location = useLocation();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const isStaffLogin = location.pathname === "/staff-login" || location.pathname === "/admin-login";
  const isInternal =
    isStaffLogin ||
    location.pathname === "/secretary" ||
    location.pathname === "/account-settings" ||
    location.pathname === "/admin" ||
    location.pathname.startsWith("/admin/");
  const hasCustomFooter = location.pathname === "/professional-team";

  return (
    <div dir="rtl" className="min-h-screen bg-secondary flex flex-col">
      <ScrollToTop />
      {!isInternal && <Navbar onLoginClick={() => setIsLoginOpen(true)} />}
      {isInternal && !isStaffLogin && <FloatingAuthButton onLoginClick={() => setIsLoginOpen(true)} />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/professional-team" element={<ProfessionalTeamPage />} />
          <Route path="/categories" element={<CategorySelectionPage />} />
          <Route path="/categories/:categorySlug" element={<ServiceCategoryPage />} />
          <Route
            path="/categories/:categorySlug/:treatmentSlug"
            element={<ServiceTreatmentDetailsPage />}
          />
          <Route path="/treatments" element={<Navigate to="/categories/cosmetology" replace />} />
          <Route path="/treatments/:id" element={<TreatmentDetailsPage />} />
          <Route path="/recruitment" element={<RecruitmentPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/staff-login" element={<StaffLogin />} />
          <Route path="/admin-login" element={<Navigate to="/staff-login" replace />} />
          <Route
            path="/account-settings"
            element={
              <ProtectedRoute allowedRoles={["admin", "secretary", "customer"]} redirectTo="/staff-login">
                <AccountSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/secretary"
            element={
              <ProtectedRoute allowedRoles={["admin", "secretary"]} redirectTo="/staff-login">
                <SecretaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]} redirectTo="/staff-login">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/staff-management"
            element={
              <ProtectedRoute allowedRoles={["admin"]} redirectTo="/staff-login">
                <AdminStaffManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/customers"
            element={
              <ProtectedRoute allowedRoles={["admin"]} redirectTo="/staff-login">
                <AdminCustomerManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-log"
            element={
              <ProtectedRoute allowedRoles={["admin"]} redirectTo="/staff-login">
                <AdminAuditLog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employee-shifts"
            element={
              <ProtectedRoute allowedRoles={["admin"]} redirectTo="/staff-login">
                <AdminEmployeeShifts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <ProtectedRoute allowedRoles={["admin"]} redirectTo="/staff-login">
                <AdminEmployees />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <ClientArea />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      {!isInternal && <ChatWidget />}
      {!isInternal && !hasCustomFooter && <Footer />}
      {isLoginOpen ? <LoginModal onClose={() => setIsLoginOpen(false)} /> : null}
    </div>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
