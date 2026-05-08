const normalizeRoleName = (role) => {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toLowerCase();
  return normalized || null;
};

export const ADMIN_ROLES = new Set(["admin"]);
export const MANAGER_ROLES = new Set(["manager"]);
export const HR_ROLES = new Set(["hr"]);
export const ACCOUNTANT_ROLES = new Set(["accountant"]);
export const STAFF_OPERATIONAL_ROLES = new Set([
  "staff",
  "server",
  "host",
  "cashier",
  "chef",
  "cook",
  "kitchen_helper",
  "cleaner",
  "shipper",
  "storekeeper",
  "bartender",
  "supervisor",
]);
export const CUSTOMER_ROLES = new Set(["customer"]);

export { normalizeRoleName };

export const isAdminRole = (role) => ADMIN_ROLES.has(normalizeRoleName(role));
export const isManagerRole = (role) => MANAGER_ROLES.has(normalizeRoleName(role));
export const isHrRole = (role) => HR_ROLES.has(normalizeRoleName(role));
export const isAccountantRole = (role) => ACCOUNTANT_ROLES.has(normalizeRoleName(role));
export const isStaffOperationalRole = (role) =>
  STAFF_OPERATIONAL_ROLES.has(normalizeRoleName(role));
export const isCustomerRole = (role) => CUSTOMER_ROLES.has(normalizeRoleName(role));

export const getDefaultPathForRole = (role) => {
  const normalized = normalizeRoleName(role);
  if (isAdminRole(normalized)) return "/admin/dashboard";
  if (isManagerRole(normalized)) return "/manager";
  if (isHrRole(normalized)) return "/manager#staff";
  if (isAccountantRole(normalized)) return "/manager#payroll";
  if (isStaffOperationalRole(normalized)) return "/staff/schedule";
  if (isCustomerRole(normalized)) return "/";
  return "/";
};

const ROUTE_ACCESS_RULES = [
  { test: /^\/admin(\/|$)/, allow: ["admin"] },
  { test: /^\/manager(\/|$)/, allow: ["admin", "manager", "hr", "accountant"] },
  { test: /^\/staff(\/|$)/, allow: ["admin", "manager", "hr", ...STAFF_OPERATIONAL_ROLES] },
  { test: /^\/(orders|restaurants|restaurant\/|profile|notifications|search|checkout|cus-menu|food\/|vouchers\/|favorites\/|address-book\/|help-center\/|track-order\/)/, allow: ["customer", "admin", "manager"] },
];

export const canAccessRoute = (role, pathname) => {
  const normalizedRole = normalizeRoleName(role);
  if (!normalizedRole || typeof pathname !== "string") return false;

  for (const rule of ROUTE_ACCESS_RULES) {
    if (rule.test.test(pathname)) {
      return rule.allow.includes(normalizedRole);
    }
  }

  return true;
};

export const filterNavigationByRole = (items, role) => {
  const normalizedRole = normalizeRoleName(role);
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (Array.isArray(item.items)) {
        const childItems = item.items.filter((child) => {
          if (!Array.isArray(child.roles) || child.roles.length === 0) return true;
          return child.roles.map(normalizeRoleName).includes(normalizedRole);
        });
        if (childItems.length === 0) return null;
        return { ...item, items: childItems };
      }

      if (!Array.isArray(item.roles) || item.roles.length === 0) return item;
      return item.roles.map(normalizeRoleName).includes(normalizedRole) ? item : null;
    })
    .filter(Boolean);
};
