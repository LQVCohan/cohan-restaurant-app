import React, { useContext, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import {
  resolveUserRoleName,
  STAFF_KITCHEN_ROLES,
  STAFF_ORDER_ROLES,
} from "@/utils/frontendRoleAccess";

const getDisplayName = (user) => {
  if (!user || typeof user !== "object") return null;
  return user.fullName || user.name || user.displayName || user.username || null;
};

const getRoleLabel = (user, normalizedRole) => {
  if (!user || typeof user !== "object") return normalizedRole;
  return user.roleName || user.roleSlug || user.role?.slug || user.role?.name || normalizedRole;
};

const isActivePath = (pathname, target) =>
  pathname === target || (target !== "/staff/dashboard" && pathname.startsWith(target + "/"));

const StaffLayout = ({ children }) => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const normalizedRole = useMemo(() => resolveUserRoleName(user), [user]);
  const displayName = getDisplayName(user);
  const roleLabel = getRoleLabel(user, normalizedRole);

  const navItems = useMemo(
    () => [
      { label: "Tổng quan", to: "/staff/dashboard" },
      { label: "Lịch cá nhân", to: "/staff/schedule" },
      { label: "Hồ sơ", to: "/profile" },
      { label: "Thông báo", to: "/notifications" },
      { label: "Handoff AI", to: "/staff/ai-handoff" },
      { label: "Order nội bộ", to: "/staff/orders", roles: STAFF_ORDER_ROLES },
      { label: "Khu vực bếp", to: "/staff/kitchen", roles: STAFF_KITCHEN_ROLES },
    ],
    [],
  );

  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (!Array.isArray(item.roles)) return true;
        return item.roles.includes(normalizedRole);
      }),
    [navItems, normalizedRole],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Khu vực nhân viên</p>
              <h1 className="text-xl font-semibold text-slate-950">Vận hành nội bộ</h1>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <div className="font-medium text-slate-900">{displayName || "Nhân viên"}</div>
              <div className="text-xs uppercase tracking-wide text-slate-500">{roleLabel || "Chưa xác định vai trò"}</div>
            </div>
          </div>

          <nav aria-label="Điều hướng nhân viên" className="flex flex-wrap gap-2">
            {visibleNavItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              const activeClass = "border-blue-600 bg-blue-600 text-white shadow-sm";
              const inactiveClass = "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700";
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={"rounded-full border px-3 py-2 text-sm font-medium transition " + (active ? activeClass : inactiveClass)}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
};

export default StaffLayout;
