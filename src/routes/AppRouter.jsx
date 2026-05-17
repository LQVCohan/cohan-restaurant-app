import React, { useEffect, useContext } from "react";
import { Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

import Home from "../components/Customer/Homepage_Client/Home";
import Login from "../components/Login";
import VerifyEmailPending from "../pages/VerifyEmailPending";
import VerifyEmailConfirm from "../pages/VerifyEmailConfirm";
import ForbiddenPage from "../pages/ForbiddenPage";

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
import TableCurrentSessionPage from "@/components/Customer/TableCurrentSession/TableCurrentSessionPage";
import {
  AdminRestaurantInfoManagement,
  ManagerRestaurantInfoManagement,
} from "@/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx";

import Dashboard from "../components/Dashboard_Manager/Dashboard/Dashboard";
import ManagerLayout from "../layouts/ManagerLayout";
import StaffLayout from "../layouts/StaffLayout";
import POSLayout from "@/components/Dashboard_Manager/POS/components/pos/POSLayout";
import FloorPlanDesigner from "@/components/Dashboard_Manager/Table/FloorPlanDesigner";
import ManagerPerformancePage from "@/components/Dashboard_Manager/Performance/ManagerPerformancePage";

import StaffOrdering from "../components/Staff/StaffOrderingScoped";
import StaffKitchenPage from "@/components/Staff/StaffKitchenPage";
import StaffPerformancePage from "@/components/Staff/StaffPerformance/StaffPerformancePage";
import StaffSchedulePage from "@/components/Staff/components/StaffSchedulePage";
import StaffDashboardPage from "@/components/Staff/StaffDashboardPage";

import MainLayout from "../layouts/MainLayout";
import { hasAllowedRole, resolveRoleName } from "@/routes/routeGuard";
import {
  canAccessRoute,
  getDefaultPathForRole,
  STAFF_KITCHEN_ROLES,
  STAFF_OPERATIONAL_ROLES,
  STAFF_ORDER_ROLES,
  STAFF_SHARED_ROLES,
} from "@/utils/frontendRoleAccess";

import CouponPage from "@/components/Customer/CouponManagement/CouponPage";
import FavoritePage from "@/components/Customer/FavoritePage/FavoritePage";
import AddressPage from "@/components/Customer/AddressPage/AddressPage";
import HelpPage from "@/components/Customer/HelpPage/HelpPage";
import VRViewer from "@/components/Customer/VRViewer/VRViewer";
import NotificationsPage from "@/components/Customer/NotifyModal/NotificationsPage";
import FoodDetail from "@/components/Customer/Food/FoodDetail";

const useAuth = () => {
  const { token, user, loading, isAuthenticated, sessionState, sessionWarning } = useContext(AuthContext);
  const role = resolveRoleName(user);
  const emailVerified = user?.emailVerified ?? false;
  return { token, role, emailVerified, loading, sessionState, sessionWarning, isAuthenticated };
};

export const PrivateRoute = ({ children, allowedRoles, requireVerifiedEmail = false, authState }) => {
  const fallbackAuthState = useAuth();
  const { token, role, emailVerified, loading, sessionState, sessionWarning, isAuthenticated } = authState || fallbackAuthState;
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

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasAllowedRole(allowedRoles, role) || !canAccessRoute(role, location.pathname)) {
    return <Navigate to={getDefaultPathForRole(role)} replace />;
  }

  if (requireVerifiedEmail && !emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return children;
};

const CustomerLayout = () => (
  <MainLayout>
    <Outlet />
  </MainLayout>
);

const LogoutHandler = () => {
  const { logout } = useContext(AuthContext);
  useEffect(() => {
    logout?.();
  }, [logout]);
  return null;
};

const withPrivateRoute = (children, allowedRoles, requireVerifiedEmail = true) => (
  <PrivateRoute allowedRoles={allowedRoles} requireVerifiedEmail={requireVerifiedEmail}>
    {children}
  </PrivateRoute>
);

const withStaffLayout = (children) => <StaffLayout>{children}</StaffLayout>;

const AppRouter = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/verify-email" element={<VerifyEmailPending />} />
    <Route path="/verify-email/confirm" element={<VerifyEmailConfirm />} />
    <Route path="/403" element={<ForbiddenPage />} />
    <Route path="/logout" element={<LogoutHandler />} />
    <Route path="/preview/restaurant/:id" element={<RestaurantDetail />} />

    <Route path="/staff" element={withPrivateRoute(<Navigate to="/staff/dashboard" replace />, STAFF_SHARED_ROLES)} />
    <Route path="/staff/dashboard" element={withPrivateRoute(withStaffLayout(<StaffDashboardPage />), STAFF_SHARED_ROLES)} />
    <Route path="/staff/orders" element={withPrivateRoute(withStaffLayout(<StaffOrdering />), STAFF_ORDER_ROLES)} />
    <Route path="/staff/kitchen" element={withPrivateRoute(withStaffLayout(<StaffKitchenPage />), STAFF_KITCHEN_ROLES)} />
    <Route path="/staff/performance" element={withPrivateRoute(withStaffLayout(<StaffPerformancePage />), STAFF_SHARED_ROLES)} />
    <Route path="/staff/schedule" element={withPrivateRoute(withStaffLayout(<StaffSchedulePage />), STAFF_SHARED_ROLES)} />

    <Route path="/manager" element={withPrivateRoute(<ManagerLayout><Dashboard /></ManagerLayout>, ["manager", "admin", "hr", "accountant"])} />
    <Route path="/manager/dashboard/POS" element={withPrivateRoute(<POSLayout />, ["manager", "admin"])} />
    <Route path="/manager/floor-map/:restaurantId" element={withPrivateRoute(<FloorPlanDesigner />, ["manager", "admin"], false)} />
    <Route path="/manager/performance" element={withPrivateRoute(<ManagerLayout><ManagerPerformancePage /></ManagerLayout>, ["manager", "admin"])} />
    <Route path="/manager/restaurants/categories" element={withPrivateRoute(<ManagerRestaurantInfoManagement />, ["manager", "admin"])} />
    <Route path="/admin/restaurants/categories" element={withPrivateRoute(<AdminRestaurantInfoManagement />, ["admin"])} />
    <Route path="/admin/dashboard" element={withPrivateRoute(<Dashboard />, ["admin"])} />

    <Route path="/users" element={withPrivateRoute(<div>Quản Lý Người Dùng</div>, ["admin"])} />
    <Route path="/settings" element={withPrivateRoute(<div>Cài Đặt Hệ Thống</div>, ["admin"])} />
    <Route path="/employees" element={withPrivateRoute(<div>Quản Lý Nhân Viên</div>, ["admin", "manager"])} />
    <Route path="/inventory" element={withPrivateRoute(<div>Quản Lý Kho</div>, ["admin", "manager"])} />
    <Route path="/reservations" element={withPrivateRoute(<div>Quản Lý Đặt Bàn</div>, ["admin", "manager"])} />
    <Route path="/promotions" element={withPrivateRoute(<div>Quản Lý Khuyến Mãi</div>, ["admin", "manager"])} />
    <Route path="/analytics" element={withPrivateRoute(<div>Phân Tích / Báo Cáo</div>, ["admin", "manager"])} />

    <Route element={<CustomerLayout />}>
      <Route path="/" element={<Home />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/owner/:id" element={withPrivateRoute(<OwnerProfilePage />, ["manager", "admin"])} />
      <Route path="/for-you" element={<ForYou />} />
      <Route path="/orders" element={withPrivateRoute(<OrdersPage />, ["customer", "manager", "admin"])} />
      <Route path="/track-order/:orderId" element={withPrivateRoute(<OrderTrackingPage />, ["customer", "manager", "admin"])} />
      <Route path="/restaurants" element={<RestaurantsList />} />
      <Route path="/restaurant/:id" element={<RestaurantDetail />} />
      <Route path="/restaurant/:id/layout" element={<TableBooking />} />
      <Route path="/table/:restaurantId/:tableId" element={<TableCurrentSessionPage />} />
      <Route path="/vr/table/:tableId" element={<VRViewer />} />
      <Route path="/cus-menu" element={<RestaurantMenu />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/food/:foodId" element={<FoodDetail />} />
      <Route path="/vouchers/:id" element={<Navigate to="/restaurants" replace />} />
      <Route path="/coupons/:restaurantId" element={<CouponPage />} />
      <Route path="/favorites/:id" element={withPrivateRoute(<FavoritePage />, ["customer", "manager", "admin"])} />
      <Route path="/address-book/:id" element={withPrivateRoute(<AddressPage />, ["customer", "manager", "admin"])} />
      <Route path="/help-center/:id" element={<HelpPage />} />
      <Route path="/notifications" element={withPrivateRoute(<NotificationsPage />, ["customer", "admin", "manager", ...STAFF_OPERATIONAL_ROLES])} />
      <Route path="/profile" element={withPrivateRoute(<ProfilePage />, ["customer", "admin", "manager", ...STAFF_OPERATIONAL_ROLES])} />
    </Route>

    <Route path="*" element={<Navigate to="/403" replace />} />
  </Routes>
);

export default AppRouter;
