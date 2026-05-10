import React, { useContext, useMemo } from "react";
import { AuthContext } from "@/context/AuthContext";
import {
  resolveUserRoleName,
  STAFF_OPERATIONAL_ROLES,
} from "@/utils/frontendRoleAccess";
import StaffOrdering from "./StaffOrdering";

const extractRestaurantId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.id || value._id || null;
  }
  return null;
};

const resolveStaffOrderingRestaurantId = ({ user, restaurants, role }) => {
  const assignedRestaurantId = extractRestaurantId(user?.restaurantForStaff);

  if (STAFF_OPERATIONAL_ROLES.has(role)) {
    return assignedRestaurantId;
  }

  return assignedRestaurantId || extractRestaurantId(restaurants?.[0]);
};

const StaffOrderingEmptyState = ({ isStaffOperationalRole }) => (
  <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-sm">
      {isStaffOperationalRole ? (
        <>
          <h1 className="text-lg font-semibold">
            Tài khoản nhân viên chưa được gán nhà hàng.
          </h1>
          <p className="mt-1 text-sm">
            Vui lòng liên hệ quản lý để cập nhật nhà hàng làm việc.
          </p>
        </>
      ) : (
        <h1 className="text-lg font-semibold">
          Không tìm thấy nhà hàng để vận hành order.
        </h1>
      )}
    </div>
  </div>
);

const StaffOrderingScoped = () => {
  const authState = useContext(AuthContext) || {};
  const { user, restaurants } = authState;
  const role = resolveUserRoleName(user);
  const isStaffOperationalRole = STAFF_OPERATIONAL_ROLES.has(role);
  const restaurantId = resolveStaffOrderingRestaurantId({
    user,
    restaurants,
    role,
  });

  const scopedAuthState = useMemo(
    () => ({
      ...authState,
      user: user
        ? {
            ...user,
            restaurantForStaff: restaurantId,
          }
        : user,
      restaurants: isStaffOperationalRole
        ? []
        : restaurantId
          ? [{ ...(restaurants?.[0] || {}), id: restaurantId }]
          : restaurants,
    }),
    [authState, isStaffOperationalRole, restaurantId, restaurants, user],
  );

  if (!restaurantId) {
    return <StaffOrderingEmptyState isStaffOperationalRole={isStaffOperationalRole} />;
  }

  return (
    <AuthContext.Provider value={scopedAuthState}>
      <StaffOrdering />
    </AuthContext.Provider>
  );
};

export default StaffOrderingScoped;
