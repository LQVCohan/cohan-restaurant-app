// src/AppRouter.jsx
import React, { useState, useEffect, useContext } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  Outlet, // ✅ Thêm Outlet
} from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

// ✅ Apollo Client
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
import ProfilePage from "../components/Customer/Profile/ProfilePage";
import OrderTrackingPage from "../components/Customer/OrderTracking/OrderTrackingPage";
import RestaurantMenu from "@/components/Customer/RestaurantMenu/RestaurantMenu";
import OwnerProfilePage from "../components/Customer/OwnerProfilePage/OwnerProfilePage.jsx";
import ForYou from "@/components/Customer/ForYou/ForYou";
import SearchPage from "../pages/SearchPage.jsx";
import ContactPage from "@/pages/ContactPage.jsx";
import {
  AdminRestaurantInfoManagement,
  ManagerRestaurantInfoManagement,
} from "@/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx";
// ==== Manager/Admin ====
import Dashboard from "../components/Dashboard_Manager/Dashboard/Dashboard";
import ManagerLayout from "../layouts/ManagerLayout";
import POSLayout from "@/components/Dashboard_Manager/POS/components/pos/POSLayout";
import FloorPlanDesigner from "@/components/Dashboard_Manager/Table/FloorPlanDesigner";

// ==== Staff ====
import StaffOrder from "../components/StaffOrder";

// ==== Layouts ====
import MainLayout from "../layouts/MainLayout";
import { useNotification } from "@/hooks/useNotification";
import VoucherPage from "@/components/Customer/VoucherManagement/VoucherPage";
import FavoritePage from "@/components/Customer/FavoritePage/FavoritePage";
import AddressPage from "@/components/Customer/AddressPage/AddressPage";
import HelpPage from "@/components/Customer/HelpPage/HelpPage";
import VRViewer from "@/components/Customer/VRViewer/VRViewer";

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
        parentRole {
          id
        }
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
// 🔒 Auth Hook
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
      const isNetworkError = Boolean(error.networkError);
      const isUnauthenticated = (error.graphQLErrors || []).some(
        (errItem) => errItem?.extensions?.code === "UNAUTHENTICATED"
      );

      if (isNetworkError && !isUnauthenticated) {
        showNotification(
          "Mất kết nối mạng. Bạn vẫn được giữ đăng nhập để tiếp tục khi có mạng.",
          "warning"
        );
        return;
      }

      showNotification(error.message, "error");
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      setToken(null);
      navigate("/login");
    }
  }, [error, navigate, showNotification]);

  const role = data?.me?.roleName || null;
  const emailVerified = data?.me?.emailVerified ?? false;

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

  return { token, role, emailVerified, loading, error };
};

// =========================
// 🔐 PrivateRoute
// =========================
export const PrivateRoute = ({
  children,
  allowedRoles,
  requireVerifiedEmail = false,
  authState,
}) => {
  const { token, role, emailVerified, loading } = authState || useAuth();
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
// 🖼️ Wrapper Layout cho Khách Hàng
// =========================
const CustomerLayout = () => {
  return (
    <MainLayout>
      <Outlet /> {/* Nơi các component con sẽ hiển thị */}
    </MainLayout>
  );
};

// =========================
// 🌐 App Router
// =========================
const AppRouter = () => {
  const { refRestaurant, restaurants } = useContext(AuthContext);
  console.log("refRestaurant, restaurants", refRestaurant, restaurants);

  return (
    <Routes>
      {/* =============================================
          GROUP 1: PUBLIC & AUTH PAGES (KHÔNG Layout) 
          =============================================
      */}
      <Route path="/login" element={<Login />} />
      <Route path="/verify-email" element={<VerifyEmailPending />} />
      <Route path="/verify-email/confirm" element={<VerifyEmailConfirm />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/logout" element={<Navigate to="/login" replace />} />

      <Route
        path="/preview/restaurant/:id"
        element={<RestaurantDetail />}
      />

      {/* =============================================
          GROUP 2: STAFF, MANAGER, ADMIN (Layout Riêng)
          =============================================
      */}

      {/* Staff Order */}
      <Route
        path="/staff/orders"
        element={
          <PrivateRoute allowedRoles={["staff"]} requireVerifiedEmail>
            <StaffOrder />
          </PrivateRoute>
        }
      />

      {/* Manager Dashboard (Đã có ManagerLayout bọc bên trong element) */}
      <Route
        path="/manager"
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

      {/* POS Layout */}
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

      {/* Floor Plan */}
      <Route
        path="/manager/floor-map/:restaurantId"
        element={
          <PrivateRoute allowedRoles={["manager", "admin"]}>
            <FloorPlanDesigner />
          </PrivateRoute>
        }
      />


      <Route
        path="/manager/restaurants/categories"
        element={
          <PrivateRoute
            allowedRoles={["manager", "admin"]}
            requireVerifiedEmail
          >
            <ManagerRestaurantInfoManagement />
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/restaurants/categories"
        element={
          <PrivateRoute allowedRoles={["admin"]} requireVerifiedEmail>
            <AdminRestaurantInfoManagement />
          </PrivateRoute>
        }
      />

      {/* Admin Dashboard */}
      <Route
        path="/admin/dashboard"
        element={
          <PrivateRoute allowedRoles={["admin"]} requireVerifiedEmail>
            <Dashboard />
          </PrivateRoute>
        }
      />

      {/* Admin/Manager Shared Routes (Giữ nguyên không bọc MainLayout nếu chúng thuộc Dashboard) */}
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

      {/* =============================================
          GROUP 3: CUSTOMER ROUTES (Được bọc bởi MainLayout)
          =============================================
      */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/contact" element={<ContactPage />} />
        {/* Search */}
        <Route
          path="/search"
          element={
            <PrivateRoute
              allowedRoles={["customer", "manager", "staff", "admin"]}
              requireVerifiedEmail
            >
              <SearchPage />
            </PrivateRoute>
          }
        />

        {/* Owner Profile */}
        <Route
          path="/owner/:id"
          element={
            <PrivateRoute
              allowedRoles={["manager", "admin"]}
              requireVerifiedEmail
            >
              <OwnerProfilePage />
            </PrivateRoute>
          }
        />

        {/* For You */}
        <Route path="/for-you" element={<ForYou />} />

        {/* Orders */}
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
        <Route path="/track-order/:orderId" element={<OrderTrackingPage />} />

        {/* Restaurants */}
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
        <Route path="/restaurant/:id/layout" element={<TableBooking />} />
        <Route path="/vr/table/:tableId" element={<VRViewer />} />
        <Route path="/cus-menu" element={<RestaurantMenu />} />
        <Route path="/vouchers/:id" element={<VoucherPage />} />
        <Route path="/favorites/:id" element={<FavoritePage />} />
        <Route path="/address-book/:id" element={<AddressPage />} />
        <Route path="/help-center/:id" element={<HelpPage />} />
        {/* Profile */}
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
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
