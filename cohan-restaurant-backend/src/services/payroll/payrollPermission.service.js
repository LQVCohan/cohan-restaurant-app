const ACTION_ROLE_MAP = {
  "payroll.view": ["ADMIN", "ACCOUNTANT", "HR", "MANAGER"],
  "payroll.validate": ["ADMIN", "ACCOUNTANT", "HR", "MANAGER"],
  "payroll.settings.update": ["ADMIN", "ACCOUNTANT", "MANAGER"],
  "payroll.period.create": ["ADMIN", "ACCOUNTANT", "MANAGER"],
  "payroll.period.recalculate": ["ADMIN", "ACCOUNTANT", "MANAGER"],
  "payroll.period.finalize": ["ADMIN", "ACCOUNTANT", "MANAGER"],
  "payroll.period.lock": ["ADMIN", "ACCOUNTANT", "MANAGER"],
  "payroll.period.markPaid": ["ADMIN", "ACCOUNTANT", "HR", "MANAGER"],
  "payroll.payment.record": ["ADMIN", "ACCOUNTANT", "HR", "MANAGER"],
  "payroll.payout.execute": ["ADMIN", "ACCOUNTANT"],
  "payroll.adjustment.write": ["ADMIN", "ACCOUNTANT"],
  "payroll.payslip.self": ["STAFF", "ADMIN", "ACCOUNTANT", "HR", "MANAGER"],
  "payroll.export": ["ADMIN", "ACCOUNTANT", "HR", "MANAGER"],
};

export function hasPayrollPermission(ctx, action) {
  const userType = String(ctx?.user?.userType || "").toUpperCase();
  const roleName = String(ctx?.user?.roleName || "").toUpperCase();
  const roleSlug = String(ctx?.user?.role?.slug || "").toUpperCase();

  const allowed = ACTION_ROLE_MAP[action] || ["ADMIN"];
  if (allowed.includes(userType)) return true;
  if (allowed.includes(roleName)) return true;
  if (allowed.includes(roleSlug)) return true;
  return false;
}

export function assertPayrollPermission(ctx, action) {
  if (!hasPayrollPermission(ctx, action)) {
    throw new Error("Bạn không có quyền thực hiện thao tác bảng lương này.");
  }
}
