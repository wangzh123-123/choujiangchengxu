import { Navigate, Route, Routes } from "react-router-dom";
import { PublicStage } from "./screens/PublicStage";
import "./styles/stage.css";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicStage />} />
      <Route path="/admin" element={<div className="admin-placeholder">Admin 将在 Wave 4 完善，请先用 API / 后续页面配置</div>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
