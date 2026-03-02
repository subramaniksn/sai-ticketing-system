import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import DispatcherDashboard from "./pages/DispatcherDashboard";
import EngineerDashboard from "./pages/EngineerDashboard";
import ManagerDashboard from "./pages/ManagerDashboard"; // ✅ ADD THIS LINE

import axios from 'axios';

// ✅ Set token on every app load (PERFECT - keep this!)
const token = localStorage.getItem('token');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dispatcher" element={<DispatcherDashboard />} />
        <Route path="/engineer" element={<EngineerDashboard />} />
        <Route path="/manager" element={<ManagerDashboard />} /> {/* ✅ ADD THIS LINE */}
        <Route path="/login" element={<Login />} /> {/* ✅ Fallback */}
      </Routes>
    </BrowserRouter>
  );
}
