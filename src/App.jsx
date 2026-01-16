import { useState } from "react";
import TreatmentsListPage from "./pages/TreatmentsListPage";
import TreatmentDetailsPage from "./pages/TreatmentDetailsPage";
import ChatWidget from "./components/ChatWidget";
import { fetchTreatmentById } from "./api/medayApi";

function App() {
  const [selectedTreatment, setSelectedTreatment] = useState(null);

  async function openTreatmentById(id) {
    try {
      const t = await fetchTreatmentById(id);
      setSelectedTreatment(t);
    } catch (e) {
      alert(e?.message || "Failed to open treatment");
    }
  }

  return (
    <div style={{ padding: "30px", fontFamily: "Arial" }}>
      <h1>MeDay Smart Platform</h1>

      {!selectedTreatment ? (
        <TreatmentsListPage onOpen={(t) => setSelectedTreatment(t)} />
      ) : (
        <TreatmentDetailsPage
          treatment={selectedTreatment}
          onBack={() => setSelectedTreatment(null)}
        />
      )}

      <ChatWidget onOpenTreatment={openTreatmentById} />
    </div>
  );
}

export default App;
