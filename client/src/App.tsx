import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./admin/AdminPage";
import { SetupPrizesPage } from "./admin/SetupPrizesPage";
import { PublicStage } from "./screens/PublicStage";
import "./styles/stage.css";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicStage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/setup/prizes" element={<SetupPrizesPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
