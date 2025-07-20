// src/App.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Login from "./components/Login";
import TableLayout from "./components/TableLayout";
import StaffOrder from "./components/StaffOrder";
import Home from "./components/Home";
import axios from "axios";
import { AuthProvider } from "./context/AuthContext";
import RestaurantsList from "./components/RestaurantsList";
import Navbar from "./components/Navbar";
const useAuth = () => {
  const [token, setToken] = useState(
    () => localStorage.getItem("token") || sessionStorage.getItem("token")
  );
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const verifyToken = useCallback(async () => {
    const storedToken =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    console.log("Verifying token:", storedToken);
    if (storedToken) {
      try {
        const response = await axios.post(
          "/api/auth/verify",
          {},
          { headers: { Authorization: `Bearer ${storedToken}` } }
        );
        console.log("Verify response:", response.data);
        setRole(response.data.role);
      } catch (error) {
        console.error("Verify error:", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          url: error.config?.url,
        });
        setToken(null);
        setRole(null);
        navigate("/login");
      }
    } else {
      navigate("/login");
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    verifyToken();
  }, [verifyToken, token]);

  useEffect(() => {
    const handleStorageChange = () => {
      const newToken =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      if (newToken !== token) {
        setToken(newToken);
        console.log("Token updated from storage:", newToken);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [token]);

  return { token, role, loading };
};

const PrivateRoute = ({ children, allowedRoles }) => {
  const { token, role, loading } = useAuth();
  const location = useLocation();

  console.log(
    "PrivateRoute - Token:",
    token,
    "Role:",
    role,
    "Loading:",
    loading
  );

  if (loading) return null;
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} />;
  }
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/login" state={{ from: location }} />;
  }

  return children;
};

// New component to handle conditional Navbar rendering
const AppContent = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isLogin = location.pathname === "/login";

  return (
    <>
      {!isHome && !isLogin && <Navbar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin/dashboard"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <div>Admin Dashboard</div>
            </PrivateRoute>
          }
        />
        <Route
          path="/staff/orders"
          element={
            <PrivateRoute allowedRoles={["staff"]}>
              <StaffOrder />
            </PrivateRoute>
          }
        />
        <Route
          path="/restaurants/:id/layout"
          element={
            <PrivateRoute allowedRoles={["manager", "admin"]}>
              <TableLayout />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute
              allowedRoles={["customer", "manager", "staff", "admin"]}
            >
              <div>Thông tin cá nhân</div>
            </PrivateRoute>
          }
        />
        <Route
          path="/reserved-tables"
          element={
            <PrivateRoute allowedRoles={["customer"]}>
              <div>Bàn đã đặt</div>
            </PrivateRoute>
          }
        />
        <Route
          path="/order-history"
          element={
            <PrivateRoute allowedRoles={["customer"]}>
              <div>Lịch sử đặt bàn</div>
            </PrivateRoute>
          }
        />
        <Route
          path="/vouchers"
          element={
            <PrivateRoute allowedRoles={["customer"]}>
              <div>Voucher</div>
            </PrivateRoute>
          }
        />
        <Route
          path="/restaurants"
          element={
            <PrivateRoute allowedRoles={["customer"]}>
              <RestaurantsList />
            </PrivateRoute>
          }
        />
      </Routes>
    </>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
