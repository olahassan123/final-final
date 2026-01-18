import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import TreatmentsListPage from "./pages/TreatmentsListPage";
import TreatmentDetailsPage from "./pages/TreatmentDetailsPage";
import ChatWidget from "./components/ChatWidget";
import CategorySelectionPage from "./pages/CategorySelectionPage"; // Import new page

function App() {
  return (
    <Router>
      <div dir="rtl" className="min-h-screen bg-white">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            {/* The new category selection page */}
            <Route path="/categories" element={<CategorySelectionPage />} /> 
            <Route path="/treatments" element={<TreatmentsListPage />} />
            <Route path="/treatments/:id" element={<TreatmentDetailsPage />} />
          </Routes>
        </main>
        <ChatWidget />
      </div>
    </Router>
  );
}

export default App;