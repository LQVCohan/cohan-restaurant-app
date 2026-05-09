import React, { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import { resolveUserRoleName } from "@/utils/frontendRoleAccess";

const ORDER_ROLES = new Set(["server", "host", "cashier", "supervisor"]);
const KITCHEN_ROLES = new Set(["chef", "cook", "kitchen_helper"]);

const getDisplayName = (user) => {
  if (!user || typeof user !== "object") return null;
  return user.fullName || user.name || user.displayName || user.username || null;
};

const getRawRoleLabel = (user) => {
  if (!user || typeof user !== "object") return null;
  return user.roleName || user.roleSlug || user.role?.slug || user.role?.name || null;
};

const StaffDashboardPage = () => {
  const { user } = useContext(AuthContext);

  const normalizedRole = useMemo(() => resolveUserRoleName(user), [user]);
  const staffName = getDisplayName(user);
  const roleLabel = getRawRoleLabel(user) || normalizedRole;
  const staffRestaurant = user?.restaurantForStaff;

  const workArea = useMemo(() => {
    if (ORDER_ROLES.has(normalizedRole)) {
      return (
        <Link
          to="/staff/orders"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Đi tới khu vực xử lý order nội bộ
        </Link>
      );
    }

    if (KITCHEN_ROLES.has(normalizedRole)) {
      return <p className="text-sm text-gray-600">Khu vực bếp sẽ được bổ sung.</p>;
    }

    if (normalizedRole === "shipper") {
      return <p className="text-sm text-gray-600">Khu vực giao hàng sẽ được bổ sung.</p>;
    }

    if (normalizedRole === "storekeeper") {
      return <p className="text-sm text-gray-600">Khu vực kho sẽ được bổ sung.</p>;
    }

    return <p className="text-sm text-gray-600">Hiện chưa có khu vực chuyên môn riêng.</p>;
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
            {staffRestaurant?.name || staffRestaurant?.restaurantName || staffRestaurant?.id || "—"}
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
          <div className="mt-3">{workArea}</div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboardPage;
