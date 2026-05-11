import React, { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import {
  resolveUserRoleName,
  STAFF_ORDER_ROLES,
  STAFF_KITCHEN_ROLES,
} from "@/utils/frontendRoleAccess";

const STAFF_ORDER_ROLE_SET = new Set(STAFF_ORDER_ROLES);
const STAFF_KITCHEN_ROLE_SET = new Set(STAFF_KITCHEN_ROLES);

const getDisplayName = (user) => {
  if (!user || typeof user !== "object") return null;
  return user.fullName || user.name || user.displayName || user.username || null;
};

const getRawRoleLabel = (user) => {
  if (!user || typeof user !== "object") return null;
  return user.roleName || user.roleSlug || user.role?.slug || user.role?.name || null;
};

const getRestaurantLabel = (restaurantForStaff) => {
  if (!restaurantForStaff) return "—";
  if (typeof restaurantForStaff === "string") return restaurantForStaff;
  if (typeof restaurantForStaff === "object") {
    return (
      restaurantForStaff.name ||
      restaurantForStaff.restaurantName ||
      restaurantForStaff.code ||
      restaurantForStaff.id ||
      restaurantForStaff._id ||
      "—"
    );
  }
  return "—";
};

const StaffDashboardPage = () => {
  const { user } = useContext(AuthContext);

  const normalizedRole = useMemo(() => resolveUserRoleName(user), [user]);
  const staffName = getDisplayName(user);
  const roleLabel = getRawRoleLabel(user) || normalizedRole;
  const staffRestaurantLabel = getRestaurantLabel(user?.restaurantForStaff);

  const workAreaActions = useMemo(() => {
    const actions = [];

    if (STAFF_ORDER_ROLE_SET.has(normalizedRole)) {
      actions.push({
        to: "/staff/orders",
        label: "Đi tới khu vực xử lý order nội bộ",
        description: "Xử lý bàn, order nội bộ và thanh toán theo quyền vai trò.",
      });
    }

    if (STAFF_KITCHEN_ROLE_SET.has(normalizedRole)) {
      actions.push({
        to: "/staff/kitchen",
        label: "Xem món cần chuẩn bị",
        description: "Theo dõi món chờ nhận, đang làm và sẵn sàng.",
      });
    }

    return actions;
  }, [normalizedRole]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-gray-900">Trang nhân viên</h1>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Thông tin cơ bản</h2>
        <div className="mt-3 space-y-1 text-sm text-gray-700">
          <p><span className="font-medium">Tên nhân viên:</span> {staffName || "—"}</p>
          <p><span className="font-medium">Vai trò:</span> {roleLabel || "—"}</p>
          <p>
            <span className="font-medium">Nhà hàng phụ trách:</span>{" "}
            {staffRestaurantLabel}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Lịch làm việc cá nhân</h3>
          <p className="mt-1 text-sm text-gray-600">Xem lịch làm việc của bạn theo ca và theo tuần.</p>
          <Link to="/staff/schedule" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">Mở lịch cá nhân</Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Hồ sơ cá nhân</h3>
          <p className="mt-1 text-sm text-gray-600">Cập nhật thông tin và theo dõi trạng thái tài khoản.</p>
          <Link to="/profile" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">Mở hồ sơ</Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Thông báo</h3>
          <p className="mt-1 text-sm text-gray-600">Theo dõi cập nhật mới từ hệ thống và nhà hàng.</p>
          <Link to="/notifications" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">Mở thông báo</Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Khu vực làm việc của bạn</h3>
          <div className="mt-3">
            {workAreaActions.length > 0 ? (
              <div className="grid gap-3">
                {workAreaActions.map((action) => (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="block rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 transition hover:border-blue-200 hover:bg-blue-100"
                  >
                    <div className="text-sm font-medium text-blue-700">{action.label}</div>
                    <div className="mt-1 text-sm text-gray-600">{action.description}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Hiện chưa có khu vực chuyên môn riêng. Bạn vẫn có thể xem lịch, hồ sơ và thông báo.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboardPage;
