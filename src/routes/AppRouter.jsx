// src/AppRouter.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Login from "../components/Login";
import TableLayout from "../components/TableLayout";
import StaffOrder from "../components/StaffOrder";
import Home from "../components/Homepage_Client/Home";
import RestaurantsList from "../components/RestaurantsList";
import RestaurantDetail from "../components/RestaurantDetail";
import Dashboard from "../components/admin/Dashboard";
import MenuManagement from "../components/admin/MenuManagement";
import ManagerDashboard from "../components/Dashboard_Manager/Dashboard/ManageTable";
import StaffManagement from "../components/Dashboard_Manager/Staff/StaffManagement";
import ManagerLayout from "../layouts/ManagerLayout";
import axios from "axios";

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
    loading,
    "Path:",
    location.pathname
  );

  if (loading) {
    console.log("Loading state is true - Dashboard not rendering yet");
    return null;
  }
  if (!token) {
    console.log("No token - Redirecting to /login");
    return <Navigate to="/login" state={{ from: location }} />;
  }
  if (allowedRoles && !allowedRoles.includes(role)) {
    console.log("Role not allowed:", role, "Redirecting to /login");
    return <Navigate to="/login" state={{ from: location }} />;
  }

  console.log("Rendering Dashboard");
  return children;
};

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/restaurants"
        element={
          <PrivateRoute allowedRoles={["customer"]}>
            <RestaurantsList />
          </PrivateRoute>
        }
      />
      <Route
        path="/restaurants/:id"
        element={
          <PrivateRoute allowedRoles={["customer"]}>
            <RestaurantDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/manager"
        element={<Navigate to="/manager/dashboard" replace />}
      />

      <Route
        path="/manager/dashboard"
        element={
          <PrivateRoute allowedRoles={["manager", "admin"]}>
            <ManagerLayout>
              <ManagerDashboard />
            </ManagerLayout>
          </PrivateRoute>
        }
      />
      <Route
        path="/manager/staff"
        element={
          <PrivateRoute allowedRoles={["manager", "admin"]}>
            <ManagerLayout>
              <StaffManagement />
            </ManagerLayout>
          </PrivateRoute>
        }
      />
      <Route path="/manager/staff/:tab" element={<StaffManagement />} />
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
          <PrivateRoute allowedRoles={["manager", "admin", "customer"]}>
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
        path="/menu"
        element={
          <PrivateRoute allowedRoles={["admin", "manager"]}>
            <MenuManagement />
          </PrivateRoute>
        }
      />
      {/* Additional sections */}
      <Route
        path="/employees"
        element={
          <PrivateRoute allowedRoles={["admin", "manager"]}>
            <div>Quản Lý Nhân Viên</div>
          </PrivateRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <PrivateRoute allowedRoles={["admin", "manager"]}>
            <div>Quản Lý Kho</div>
          </PrivateRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <PrivateRoute allowedRoles={["admin", "manager"]}>
            <div>Quản Lý Đơn Hàng</div>
          </PrivateRoute>
        }
      />
      <Route
        path="/reservations"
        element={
          <PrivateRoute allowedRoles={["admin", "manager"]}>
            <div>Quản Lý Đặt Bàn</div>
          </PrivateRoute>
        }
      />
      <Route
        path="/promotions"
        element={
          <PrivateRoute allowedRoles={["admin", "manager"]}>
            <div>Quản Lý Khuyến Mãi</div>
          </PrivateRoute>
        }
      />
      <Route
        path="/users"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <div>Quản Lý Người Dùng</div>
          </PrivateRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <PrivateRoute allowedRoles={["admin", "manager"]}>
            <div>Phân Tích/Báo Cáo</div>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <PrivateRoute allowedRoles={["admin"]}>
            <div>Cài Đặt</div>
          </PrivateRoute>
        }
      />
      <Route path="/logout" element={<Navigate to="/login" />} />
    </Routes>
  );
};

export default AppRouter;
