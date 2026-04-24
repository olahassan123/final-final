import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
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

function AppContent() {
  const location = useLocation();
  const isInternal = location.pathname === "/secretary" || location.pathname === "/admin";

  return (
    <div dir="rtl" className="min-h-screen bg-secondary flex flex-col">
      {!isInternal && <Navbar />}
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
          <Route path="/secretary" element={<SecretaryPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
      {!isInternal && <ChatWidget />}
      {!isInternal && <Footer />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
