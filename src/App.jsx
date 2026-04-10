import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import TreatmentsListPage from "./pages/TreatmentsListPage";
import TreatmentDetailsPage from "./pages/TreatmentDetailsPage";
import ChatWidget from "./components/ChatWidget";
import CategorySelectionPage from "./pages/CategorySelectionPage";
import SecretaryPage from "./pages/SecretaryPage";
import AdminDashboard from "./pages/AdminDashboard";

function AppContent() {
  const location = useLocation();
  const isInternal = location.pathname === "/secretary" || location.pathname === "/admin";

  return (
    <div dir="rtl" className="min-h-screen bg-white">
      {!isInternal && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/categories" element={<CategorySelectionPage />} />
          <Route path="/treatments" element={<TreatmentsListPage />} />
          <Route path="/treatments/:id" element={<TreatmentDetailsPage />} />
          <Route path="/secretary" element={<SecretaryPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
      {!isInternal && <ChatWidget />}
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
