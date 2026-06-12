import React, { useContext, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import "./StaffLayout.scss";
import "./StaffWorkspaceOverrides.scss";
import {
  resolveUserRoleName,
  STAFF_KITCHEN_ROLES,
  STAFF_ORDER_ROLES,
} from "@/utils/frontendRoleAccess";
import { getStaffRoleDisplayLabel } from "@/utils/staffRoleOptions";

const getDisplayName = (user) => {
  if (!user || typeof user !== "object") return null;
  return user.fullName || user.name || user.displayName || user.username || null;
};

const getRoleLabel = (user, normalizedRole) => {
  if (!user || typeof user !== "object") return normalizedRole;
  return getStaffRoleDisplayLabel(user.role || user.roleName || user.roleSlug || normalizedRole) || normalizedRole;
};

const isActivePath = (location, target) => {
  return location.pathname === target || (target !== "/staff/dashboard" && location.pathname.startsWith(target + "/"));
};

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
      { label: "Hồ sơ", to: "/staff/profile" },
      { label: "Thông báo", to: "/staff/notifications" },
      { label: "Handoff AI", to: "/staff/ai-handoff" },
      { label: "Phiếu lương", to: "/staff/payslips" },
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
    <div className="staff-shell">
      <header className="staff-shell__header">
        <div className="staff-shell__inner">
          <div className="staff-shell__topbar">
            <div>
              <p className="staff-shell__eyebrow">Khu vực nhân viên</p>
              <div className="staff-shell__title">Vận hành ca làm</div>
            </div>
            <div className="staff-shell__identity">
              <div className="staff-shell__identity-avatar" aria-hidden="true">{(displayName || "NV").slice(0, 2).toUpperCase()}</div>
              <div className="staff-shell__identity-copy">
                <div>{displayName || "Nhân viên"}</div>
                <span>{roleLabel || "Chưa xác định vai trò"}</span>
                <small>Sẵn sàng / Theo lịch</small>
              </div>
            </div>
          </div>

          <nav aria-label="Điều hướng nhân viên" className="staff-shell__nav">
            {visibleNavItems.map((item) => {
              const active = isActivePath(location, item.to);
              const activeClass = "staff-shell__nav-link--active";
              const inactiveClass = "staff-shell__nav-link--idle";
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={"staff-shell__nav-link " + (active ? activeClass : inactiveClass)}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main id="staff-main-content" className="staff-shell__main">{children}</main>
    </div>
  );
};

export default StaffLayout;
