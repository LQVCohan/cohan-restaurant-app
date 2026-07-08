import React, { useContext } from "react";
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

const StaffOrderingEmptyState = ({ isStaffOperationalRole }) => (
  <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="rounded-xl border border-[#DCE8DF] bg-[#F5FBF7] p-4 text-[#1F2A24] shadow-sm">
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
          Chưa có cơ sở để xử lý đơn.
        </h1>
      )}
    </div>
  </div>
);

const StaffOrderingScoped = () => {
  const { user, activeRestaurantId, activeRestaurant, restaurants } =
    useContext(AuthContext) || {};
  const role = resolveUserRoleName(user);
  const isStaffOperationalRole = STAFF_OPERATIONAL_ROLES.has(role);
  const restaurantId =
    activeRestaurantId ||
    extractRestaurantId(activeRestaurant) ||
    extractRestaurantId(restaurants?.[0]);

  if (!restaurantId) {
    return <StaffOrderingEmptyState isStaffOperationalRole={isStaffOperationalRole} />;
  }

  return <StaffOrdering />;
};

export default StaffOrderingScoped;
