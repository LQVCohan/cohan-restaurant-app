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

// ✅ Apollo Client (gọn, đúng package)
import { gql, useQuery } from "@apollo/client";

// ==== Public Components ====
import Home from "../components/Customer/Homepage_Client/Home";
import Login from "../components/Login";
import VerifyEmailPending from "../pages/VerifyEmailPending";
import VerifyEmailConfirm from "../pages/VerifyEmailConfirm";
import ForbiddenPage from "../pages/ForbiddenPage";

// ==== Customer ====
import RestaurantsList from "../components/Customer/RestaurantList/RestaurantList";
import RestaurantDetail from "../components/Customer/RestaurantDetail/RestaurantDetail";
import TableBooking from "../components/Customer/TableBooking/TableBooking";
import OrdersPage from "../components/Customer/OrdersManagement/OrdersPage";
// ✅ Profile Page (vừa tạo)
import ProfilePage from "../components/Customer/Profile/ProfilePage";

// ==== Manager/Admin ====
import Dashboard from "../components/Dashboard_Manager/Dashboard/Dashboard";
import StaffManagement from "../components/Dashboard_Manager/Staff/StaffManagement";
import MenuManagement from "../components/admin/MenuManagement";
import ManagerLayout from "../layouts/ManagerLayout";

// ==== Staff ====
import StaffOrder from "../components/StaffOrder";

import MainLayout from "../layouts/MainLayout";
import POSLayout from "@/components/Dashboard_Manager/POS/components/pos/POSLayout";
import { useNotification } from "@/hooks/useNotification";
// =========================
// 🔐 GraphQL Query: me
// =========================
const ME_QUERY = gql`
  query Me {
    me {
      id
      fullName
      email
      role {
        id
        name
        slug
        description
        parent
        isSystem
        permissions {
          id
          name
        }

        createdAt
        updatedAt
      }
      emailVerified
    }
  }
`;

// =========================
// 🔒 Auth Hook (GraphQL version)
// =========================
const useAuth = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [token, setToken] = useState(
    () => localStorage.getItem("token") || sessionStorage.getItem("token")
  );

  const { data, loading, error, refetch } = useQuery(ME_QUERY, {
    skip: !token,
    fetchPolicy: "network-only",
  });
  useEffect(() => {
    if (error) {
      showNotification(error.message, "error");
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      setToken(null);
      navigate("/login");
    }
  }, [error, navigate, showNotification]);
  const role = data?.me?.roleName || null;
  const emailVerified = data?.me?.emailVerified ?? false;

  // Đồng bộ token khi tab khác thay đổi
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

  // Nếu mất token -> về login
  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  return { token, role, emailVerified, loading, error };
};

// =========================
// 🔐 PrivateRoute ( kiểm tra emailVerified tuỳ ý)
// =========================
const PrivateRoute = ({
  children,
  allowedRoles,
  requireVerifiedEmail = false,
}) => {
  const { token, role, emailVerified, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!token)
    return <Navigate to="/login" state={{ from: location }} replace />;

  if (allowedRoles && role && !allowedRoles.includes(role))
    return <Navigate to="/403" replace />;

  if (requireVerifiedEmail && !emailVerified)
    return <Navigate to="/verify-email" replace />;

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
          path="/orders"
          element={
            <PrivateRoute
              allowedRoles={["customer", "manager", "admin"]}
              requireVerifiedEmail
            >
              <OrdersPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/restaurants"
          element={
            <PrivateRoute
              allowedRoles={["customer", "manager", "admin"]}
              requireVerifiedEmail
            >
              <RestaurantsList />
            </PrivateRoute>
          }
        />
        <Route
          path="/restaurant/:id"
          element={
            <PrivateRoute
              allowedRoles={["customer", "manager", "admin"]}
              requireVerifiedEmail
            >
              <RestaurantDetail />
            </PrivateRoute>
          }
        />
        <Route
          path="/restaurant/:id/table"
          element={
            <PrivateRoute
              allowedRoles={["customer", "manager", "admin"]}
              requireVerifiedEmail
            >
              <TableBooking />
            </PrivateRoute>
          }
        />

        {/* ===== STAFF ===== */}
        <Route
          path="/staff/orders"
          element={
            <PrivateRoute allowedRoles={["staff"]} requireVerifiedEmail>
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
            <PrivateRoute
              allowedRoles={["manager", "admin"]}
              requireVerifiedEmail
            >
              <ManagerLayout>
                <Dashboard />
              </ManagerLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/manager/dashboard/POS"
          element={
            <PrivateRoute
              allowedRoles={["manager", "admin"]}
              requireVerifiedEmail
            >
              <POSLayout />
            </PrivateRoute>
          }
        />
        <Route
          path="/manager/staff"
          element={
            <PrivateRoute
              allowedRoles={["manager", "admin"]}
              requireVerifiedEmail
            >
              <ManagerLayout>
                <StaffManagement />
              </ManagerLayout>
            </PrivateRoute>
          }
        />
        <Route
          path="/menu"
          element={
            <PrivateRoute
              allowedRoles={["admin", "manager"]}
              requireVerifiedEmail
            >
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
            <PrivateRoute allowedRoles={["admin"]} requireVerifiedEmail>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/users"
          element={
            <PrivateRoute allowedRoles={["admin"]} requireVerifiedEmail>
              <div>Quản Lý Người Dùng</div>
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute allowedRoles={["admin"]} requireVerifiedEmail>
              <div>Cài Đặt Hệ Thống</div>
            </PrivateRoute>
          }
        />

        {/* ===== MANAGER EXTENDED ===== */}
        <Route
          path="/employees"
          element={
            <PrivateRoute
              allowedRoles={["admin", "manager"]}
              requireVerifiedEmail
            >
              <div>Quản Lý Nhân Viên</div>
            </PrivateRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <PrivateRoute
              allowedRoles={["admin", "manager"]}
              requireVerifiedEmail
            >
              <div>Quản Lý Kho</div>
            </PrivateRoute>
          }
        />

        <Route
          path="/reservations"
          element={
            <PrivateRoute
              allowedRoles={["admin", "manager"]}
              requireVerifiedEmail
            >
              <div>Quản Lý Đặt Bàn</div>
            </PrivateRoute>
          }
        />
        <Route
          path="/promotions"
          element={
            <PrivateRoute
              allowedRoles={["admin", "manager"]}
              requireVerifiedEmail
            >
              <div>Quản Lý Khuyến Mãi</div>
            </PrivateRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <PrivateRoute
              allowedRoles={["admin", "manager"]}
              requireVerifiedEmail
            >
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
              requireVerifiedEmail
            >
              <ProfilePage />
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
