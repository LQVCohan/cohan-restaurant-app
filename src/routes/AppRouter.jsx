// src/AppRouter.jsx
import React, { useEffect, useContext } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  Outlet, // ✅ Thêm Outlet
} from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

// ✅ Apollo Client

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
import CheckoutPage from "@/pages/CheckoutPage.jsx";
import {
  AdminRestaurantInfoManagement,
  ManagerRestaurantInfoManagement,
} from "@/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx";
// ==== Manager/Admin ====
import Dashboard from "../components/Dashboard_Manager/Dashboard/Dashboard";
import ManagerLayout from "../layouts/ManagerLayout";
import POSLayout from "@/components/Dashboard_Manager/POS/components/pos/POSLayout";
import FloorPlanDesigner from "@/components/Dashboard_Manager/Table/FloorPlanDesigner";
import ManagerPerformancePage from "@/components/Dashboard_Manager/Performance/ManagerPerformancePage";

// ==== Staff ====
import StaffOrdering from "../components/Staff/StaffOrdering";
import StaffPerformancePage from "@/components/Staff/StaffPerformance/StaffPerformancePage";
import StaffSchedulePage from "@/components/Staff/components/StaffSchedulePage";

// ==== Layouts ====
import MainLayout from "../layouts/MainLayout";
import { hasAllowedRole, resolveAccessRoleName } from "@/routes/routeGuard";
import { canAccessRoute, getDefaultPathForRole } from "@/utils/roleAccess";
import VoucherPage from "@/components/Customer/VoucherManagement/VoucherPage";
import FavoritePage from "@/components/Customer/FavoritePage/FavoritePage";
import AddressPage from "@/components/Customer/AddressPage/AddressPage";
import HelpPage from "@/components/Customer/HelpPage/HelpPage";
import VRViewer from "@/components/Customer/VRViewer/VRViewer";
import NotificationsPage from "@/components/Customer/NotifyModal/NotificationsPage";
import FoodDetail from "@/components/Customer/Food/FoodDetail";

// =========================
// 🔒 Auth Hook
// =========================
const useAuth = () => {
  const {
    token,
    user,
    loading,
    isAuthenticated,
    sessionState,
    sessionWarning,
  } = useContext(AuthContext);
  const role = resolveAccessRoleName(user);
  const emailVerified = user?.emailVerified ?? false;
  return {
    token,
    role,
    emailVerified,
    loading,
    sessionState,
    sessionWarning,
    isAuthenticated,
  };
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
  const fallbackAuthState = useAuth();
  const {
    token,
    role,
    emailVerified,
    loading,
    sessionState,
    sessionWarning,
    isAuthenticated,
  } =
    authState || fallbackAuthState;
  const location = useLocation();

  const isRestoringSession = token && sessionState === "restoring";
  const waitingForResolvedUser = Boolean(token) && (role == null || !isAuthenticated);

  if (loading || isRestoringSession || waitingForResolvedUser) return null;

  if (token && sessionState === "network_unstable") {
    return (
      <div className="min-h-[40vh] w-full flex flex-col items-center justify-center px-4 text-center">
        <p className="text-sm font-medium text-amber-700">
          {sessionWarning || "Mạng không ổn định. Đang chờ xác minh phiên đăng nhập..."}
        </p>
      </div>
    );
  }

  if (!isAuthenticated || !token)
    return <Navigate to="/login" state={{ from: location }} replace />;

  if (!hasAllowedRole(allowedRoles, role) || !canAccessRoute(role, location.pathname)) {
    return <Navigate to={getDefaultPathForRole(role)} replace />;
  }

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

const LogoutHandler = () => {
  const { logout } = useContext(AuthContext);

  useEffect(() => {
    logout?.();
  }, [logout]);

  return null;
};

// =========================
// 🌐 App Router
// =========================
const AppRouter = () => {
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
      <Route path="/logout" element={<LogoutHandler />} />

      <Route path="/preview/restaurant/:id" element={<RestaurantDetail />} />

      {/* =============================================
          GROUP 2: STAFF, MANAGER, ADMIN (Layout Riêng)
          =============================================
      */}

      {/* Staff Order */}
      <Route
        path="/staff/orders"
        element={
          <PrivateRoute
            allowedRoles={["staff", "manager", "admin"]}
            requireVerifiedEmail
          >
            <StaffOrdering />
          </PrivateRoute>
        }
      />

      <Route
        path="/staff/performance"
        element={
          <PrivateRoute
            allowedRoles={["staff", "manager", "admin", "hr"]}
            requireVerifiedEmail
          >
            <StaffPerformancePage />
          </PrivateRoute>
        }
      />


      <Route
        path="/staff/schedule"
        element={
          <PrivateRoute
            allowedRoles={["staff", "manager", "admin", "hr"]}
            requireVerifiedEmail
          >
            <StaffSchedulePage />
          </PrivateRoute>
        }
      />

      {/* Manager Dashboard (Đã có ManagerLayout bọc bên trong element) */}
      <Route
        path="/manager"
        element={
          <PrivateRoute
            allowedRoles={["manager", "admin", "hr", "accountant"]}
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
            allowedRoles={["manager", "admin", "accountant"]}
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
          <PrivateRoute allowedRoles={["manager", "admin", "accountant"]}>
            <FloorPlanDesigner />
          </PrivateRoute>
        }
      />

      <Route
        path="/manager/performance"
        element={
          <PrivateRoute
            allowedRoles={["manager", "admin", "hr", "accountant"]}
            requireVerifiedEmail
          >
            <ManagerLayout>
              <ManagerPerformancePage />
            </ManagerLayout>
          </PrivateRoute>
        }
      />

      <Route
        path="/manager/restaurants/categories"
        element={
          <PrivateRoute
            allowedRoles={["manager", "admin", "hr", "accountant"]}
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
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/food/:foodId" element={<FoodDetail />} />
        <Route path="/vouchers/:id" element={<VoucherPage />} />
        <Route path="/favorites/:id" element={<FavoritePage />} />
        <Route path="/address-book/:id" element={<AddressPage />} />
        <Route path="/help-center/:id" element={<HelpPage />} />
        <Route
          path="/notifications"
          element={
            <PrivateRoute
              allowedRoles={["customer", "manager", "staff", "admin"]}
              requireVerifiedEmail
            >
              <NotificationsPage />
            </PrivateRoute>
          }
        />
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
      <Route path="*" element={<Navigate to="/403" replace />} />
    </Routes>
  );
};

export default AppRouter;
