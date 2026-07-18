import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./admin/AdminPage";
import { PublicStage } from "./screens/PublicStage";
import "./styles/stage.css";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicStage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
