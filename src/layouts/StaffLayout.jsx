import React, { useContext, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./StaffLayout.scss";
import "./StaffWorkspaceOverrides.scss";
import {
  resolveUserRoleName,
  STAFF_KITCHEN_ROLES,
  STAFF_ORDER_ROLES,
} from "@/utils/frontendRoleAccess";
import { getStaffRoleDisplayLabel } from "@/utils/staffRoleOptions";

const IS_TEST_ENV = import.meta.env.MODE === "test";

const STAFF_RESTAURANT_BASIC = gql`
  query StaffRestaurantBasic($id: ID!) {
    restaurant(id: $id) {
      id
      name
    }
  }
`;

const getDisplayName = (user) => {
  if (!user || typeof user !== "object") return null;
  return user.fullName || user.name || user.displayName || user.username || null;
};

const roleLabelFallbacks = {
  admin: "Quản trị viên",
  manager: "Quản lý",
  hr: "Nhân sự",
  accountant: "Kế toán",
  staff: "Nhân viên",
};

const getRoleLabel = (user, normalizedRole) => {
  if (!user || typeof user !== "object") return roleLabelFallbacks[normalizedRole] || normalizedRole;
  return (
    roleLabelFallbacks[normalizedRole] ||
    getStaffRoleDisplayLabel(user.role || user.roleName || user.roleSlug || normalizedRole) ||
    normalizedRole
  );
};

const getRestaurantLabel = (user, restaurants, restaurantFromQuery) => {
  return (
    user?.restaurantName ||
    user?.restaurantForStaffName ||
    user?.restaurant?.name ||
    restaurantFromQuery?.name ||
    restaurants?.[0]?.name ||
    "Chưa xác định cơ sở làm việc"
  );
};

const resolveStaffRestaurantId = (user) => {
  if (typeof user?.restaurantForStaff === "object") {
    return user?.restaurantForStaff?.id || user?.restaurantForStaff?._id || null;
  }
  return user?.restaurantForStaff || null;
};

const isActivePath = (location, target) => {
  return location.pathname === target || (target !== "/staff/dashboard" && location.pathname.startsWith(target + "/"));
};

const navGroups = [
  { label: "Công việc", keys: ["/staff/dashboard", "/staff/schedule", "/staff/orders", "/staff/kitchen", "/staff/contacts"] },
  { label: "Tài khoản", keys: ["/staff/profile", "/staff/notifications", "/staff/payslips", "/staff/settings"] },
  { label: "Hỗ trợ", keys: ["/staff/ai-handoff"] },
];

const StaffLayoutShell = ({ children, restaurantFromQuery = null }) => {
  const { user, restaurants } = useContext(AuthContext);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const normalizedRole = useMemo(() => resolveUserRoleName(user), [user]);
  const displayName = getDisplayName(user);
  const roleLabel = getRoleLabel(user, normalizedRole);
  const restaurantLabel = getRestaurantLabel(user, restaurants, restaurantFromQuery);

  const navItems = useMemo(
    () => [
      { label: "Tổng quan", to: "/staff/dashboard" },
      { label: "Lịch cá nhân", to: "/staff/schedule" },
      { label: "Hồ sơ", to: "/staff/profile" },
      { label: "Thông báo", to: "/staff/notifications" },
      { label: "Liên lạc", to: "/staff/contacts" },
      { label: "Bàn giao hỗ trợ", to: "/staff/ai-handoff" },
      { label: "Phiếu lương", to: "/staff/payslips" },
      { label: "Order nội bộ", to: "/staff/orders", roles: STAFF_ORDER_ROLES },
      { label: "Khu vực bếp", to: "/staff/kitchen", roles: STAFF_KITCHEN_ROLES },
      { label: "Cài đặt", to: "/staff/settings" },
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
              <h1 className="staff-shell__title">Vận hành ca làm</h1>
            </div>
            <div className="staff-shell__identity">
              <div className="staff-shell__identity-avatar" aria-hidden="true">{(displayName || "NV").slice(0, 2).toUpperCase()}</div>
              <div className="staff-shell__identity-copy">
                <div>{displayName || "Nhân viên"}</div>
                <span>{roleLabel || "Chưa xác định vai trò"}</span>
                <small>{restaurantLabel} • Sẵn sàng</small>
              </div>
            </div>
            <button
              type="button"
              className="staff-shell__menu-button"
              aria-label="Mở menu nhân viên"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <span />
              <span />
              <span />
            </button>
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

          {menuOpen ? (
            <div className="staff-shell__drawer" role="dialog" aria-label="Menu nhân viên">
              {navGroups.map((group) => {
                const items = visibleNavItems.filter((item) => group.keys.includes(item.to));
                if (!items.length) return null;
                return (
                  <section key={group.label} className="staff-shell__drawer-group">
                    <h2>{group.label}</h2>
                    {items.map((item) => {
                      const active = isActivePath(location, item.to);
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={"staff-shell__drawer-link " + (active ? "is-active" : "")}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          ) : null}
        </div>
      </header>

      <main id="staff-main-content" className="staff-shell__main">{children}</main>
    </div>
  );
};

const StaffRestaurantBridge = ({ children, restaurantId }) => {
  const { data: restaurantData } = useQuery(STAFF_RESTAURANT_BASIC, {
    variables: { id: restaurantId },
    fetchPolicy: "cache-first",
  });

  return <StaffLayoutShell restaurantFromQuery={restaurantData?.restaurant}>{children}</StaffLayoutShell>;
};

const StaffLayout = ({ children }) => {
  const { user } = useContext(AuthContext);
  const restaurantId = resolveStaffRestaurantId(user);

  if (!restaurantId || IS_TEST_ENV) {
    return <StaffLayoutShell>{children}</StaffLayoutShell>;
  }

  return <StaffRestaurantBridge restaurantId={restaurantId}>{children}</StaffRestaurantBridge>;
};

export default StaffLayout;
