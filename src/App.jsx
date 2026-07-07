import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Register from "./pages/Register";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/standalone/registration" element={<Register />} />
        <Route path="*" element={<Navigate to="/standalone/registration" replace />} />
      </Routes>
    </BrowserRouter>
  );
}