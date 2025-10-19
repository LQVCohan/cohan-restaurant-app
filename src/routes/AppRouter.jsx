// src/AppRouter.jsx
import React, { useState, useEffect, useContext } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
// 🔹 Apollo Client Imports (the way you prefer)
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

// ==== Public Components ====
import Home from "../components/Customer/Homepage_Client/Home";
import Login from "../components/Login";
import VerifyEmailPending from "../pages/VerifyEmailPending";
import VerifyEmailConfirm from "../pages/VerifyEmailConfirm";
import ForbiddenPage from "../pages/ForbiddenPage";

// ==== Customer ====
import RestaurantsList from "../components/Customer/RestaurantList/RestaurantList";
import RestaurantDetail from "../components/Customer/RestaurantDetail/RestaurantDetail";

// ==== Manager/Admin ====
import Dashboard from "../components/Dashboard_Manager/Dashboard/Dashboard";
import StaffManagement from "../components/Dashboard_Manager/Staff/StaffManagement";
import MenuManagement from "../components/admin/MenuManagement";
import ManagerLayout from "../layouts/ManagerLayout";

// ==== Staff ====
import StaffOrder from "../components/StaffOrder";

import MainLayout from "../layouts/MainLayout";

import TableBooking from "../components/Customer/TableBooking/TableBooking";

// =========================
// 🔐 GraphQL Query: me
// =========================
const ME_QUERY = gql`
  query Me {
    me {
      id
      fullName
      email
      roleName
      emailVerified
    }
  }
`;

// =========================
// 🔒 Auth Hook (GraphQL version)
// =========================
const useAuth = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState(
    () => localStorage.getItem("token") || sessionStorage.getItem("token")
  );

  // Nếu chưa có token thì bỏ qua query me
  const { data, loading, error, refetch } = useQuery(ME_QUERY, {
    skip: !token,
    fetchPolicy: "network-only",
    onError: () => {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      setToken(null);
      navigate("/login");
    },
  });

  const role = data?.me?.roleName || null;

  useEffect(() => {
    const handleStorageChange = () => {
      const newToken =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      if (newToken !== token) {
        setToken(newToken);
        if (newToken) refetch?.();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [token, refetch]);

  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  return { token, role, loading, error };
};

// =========================
// 🔐 PrivateRoute
// =========================
const PrivateRoute = ({ children, allowedRoles }) => {
  const { token, role, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!token)
    return <Navigate to="/login" state={{ from: location }} replace />;
  if (allowedRoles && role && !allowedRoles.includes(role))
    return <Navigate to="/403" replace />;

  return children;
};

// =========================
// 🌐 App Router
// =========================
const AppRouter = () => {
  const { refRestaurant, restaurants } = useContext(AuthContext);
  console.log("refRestaurant, restaurants", refRestaurant, restaurants);
  return (
    <MainLayout>
      <Routes>
        {/* ===== PUBLIC ===== */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmailPending />} />
        <Route path="/verify-email/confirm" element={<VerifyEmailConfirm />} />
        <Route path="/403" element={<ForbiddenPage />} />

        {/* ===== CUSTOMER ===== */}
        <Route
          path="/restaurants"
          element={
            <PrivateRoute allowedRoles={["customer", "manager", "admin"]}>
              <RestaurantsList />
            </PrivateRoute>
          }
        />
        <Route
          path="/restaurant/:id"
          element={
            <PrivateRoute allowedRoles={["customer", "manager", "admin"]}>
              <RestaurantDetail />
            </PrivateRoute>
          }
        />
        <Route
          path="/restaurant/:id/table"
          element={
            <PrivateRoute allowedRoles={["customer", "manager", "admin"]}>
              <TableBooking />
            </PrivateRoute>
          }
        />

        {/* ===== STAFF ===== */}
        <Route
          path="/staff/orders"
          element={
            <PrivateRoute allowedRoles={["staff"]}>
              <StaffOrder />
            </PrivateRoute>
          }
        />

        {/* ===== MANAGER / ADMIN ===== */}
        <Route
          path="/manager"
          element={<Navigate to="/manager/dashboard" replace />}
        />
        <Route
          path="/manager/dashboard"
          element={
            <PrivateRoute allowedRoles={["manager", "admin", "customer"]}>
              <ManagerLayout>
                <Dashboard />
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
        <Route
          path="/menu"
          element={
            <PrivateRoute allowedRoles={["admin", "manager"]}>
              <ManagerLayout>
                <MenuManagement />
              </ManagerLayout>
            </PrivateRoute>
          }
        />

        {/* ===== ADMIN ===== */}
        <Route
          path="/admin/dashboard"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <Dashboard />
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
          path="/settings"
          element={
            <PrivateRoute allowedRoles={["admin"]}>
              <div>Cài Đặt Hệ Thống</div>
            </PrivateRoute>
          }
        />

        {/* ===== MANAGER EXTENDED ===== */}
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
          path="/analytics"
          element={
            <PrivateRoute allowedRoles={["admin", "manager"]}>
              <div>Phân Tích / Báo Cáo</div>
            </PrivateRoute>
          }
        />

        {/* ===== UNIVERSAL ===== */}
        <Route
          path="/profile"
          element={
            <PrivateRoute
              allowedRoles={["customer", "manager", "staff", "admin"]}
            >
              <div>Trang Thông Tin Cá Nhân</div>
            </PrivateRoute>
          }
        />

        {/* ===== MISC ===== */}
        <Route path="/logout" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
};

export default AppRouter;
