import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { AuditLog } from "../../../models/index.js";
import { hasPermission } from "./authorization.service.js";
import { isSystemAdmin } from "./restaurantScope.service.js";

export const SENSITIVE_ACCESS = Object.freeze({
  CUSTOMER_CONTACT: "customer_contact",
  STAFF_INTERNAL: "staff_internal",
  FINANCE: "finance",
  PAYROLL: "payroll",
  WALLET: "wallet",
  PAYMENT: "payment",
  TENANT_DATA: "tenant_data",
});

export const ADMIN_SENSITIVE_PERMISSIONS = Object.freeze({
  [SENSITIVE_ACCESS.CUSTOMER_CONTACT]: { read: "admin.sensitive.customer_contact.read" },
  [SENSITIVE_ACCESS.STAFF_INTERNAL]: { read: "admin.sensitive.staff_internal.read" },
  [SENSITIVE_ACCESS.FINANCE]: { read: "admin.sensitive.finance.read" },
  [SENSITIVE_ACCESS.PAYROLL]: { read: "admin.sensitive.payroll.read" },
  [SENSITIVE_ACCESS.WALLET]: { read: "admin.sensitive.wallet.read" },
  [SENSITIVE_ACCESS.PAYMENT]: { read: "admin.sensitive.payment.read" },
  [SENSITIVE_ACCESS.TENANT_DATA]: { write: "admin.sensitive.tenant_data.write" },
});

const STRONG_VERIFICATION_MESSAGE = "Admin cần xác thực email/số điện thoại và hoàn tất đổi mật khẩu trước khi truy cập dữ liệu nhạy cảm.";
const forbidden = (message = "FORBIDDEN") => new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
const idOf = (value) => String(value?._id || value?.id || value || "") || undefined;
const toObjectId = (value) => (mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : undefined);

function header(ctx, name) {
  const headers = ctx?.req?.headers || ctx?.request?.headers || ctx?.headers || {};
  return headers[name] || headers[name.toLowerCase()] || (typeof headers.get === "function" ? headers.get(name) : undefined);
}

function reasonFrom(ctx, reason) {
  return String(reason || header(ctx, "x-admin-access-reason") || header(ctx, "x-admin-access-ticket") || "").trim();
}

export function isStronglyVerifiedAdmin(user) {
  if (!isSystemAdmin(user)) return false;
  if (String(user?.status || "active").toLowerCase() !== "active") return false;
  if (user?.emailVerified !== true) return false;
  if (Object.prototype.hasOwnProperty.call(user, "phoneVerified") && user.phoneVerified !== true) return false;
  if (user?.forcePasswordChange === true) return false;
  return true;
}

function permissionFor(category, action) {
  return ADMIN_SENSITIVE_PERMISSIONS[category]?.[action] || ADMIN_SENSITIVE_PERMISSIONS[category]?.read;
}

export async function requireAdminSensitiveAccess(ctx, { category, action = "read", resourceType, resourceId, brandId, restaurantId, reason } = {}) {
  const user = ctx?.user;
  if (!isSystemAdmin(user)) throw forbidden();
  if (!isStronglyVerifiedAdmin(user)) throw forbidden(STRONG_VERIFICATION_MESSAGE);

  const permission = permissionFor(category, action);
  if (!permission || !(await hasPermission(user, permission))) throw forbidden();

  const accessReason = reasonFrom(ctx, reason);
  if (!accessReason) throw forbidden("Admin access reason is required for sensitive data.");

  await AuditLog.create({
    actorId: toObjectId(idOf(user)),
    byUserId: toObjectId(idOf(user)),
    action: `admin.sensitive.${category}.${action}`,
    module: "admin_sensitive_access",
    targetType: resourceType,
    targetId: toObjectId(resourceId),
    restaurantId: toObjectId(restaurantId),
    metadata: {
      category,
      resourceType,
      resourceId: idOf(resourceId),
      brandId: idOf(brandId),
      restaurantId: idOf(restaurantId),
      reason: accessReason,
      ticket: String(header(ctx, "x-admin-access-ticket") || "").trim() || undefined,
    },
    ipAddress: ctx?.ip || ctx?.req?.ip || ctx?.request?.ip || header(ctx, "x-forwarded-for"),
    userAgent: header(ctx, "user-agent"),
  });

  return true;
}

export async function canAdminSensitiveAccess(ctx, options) {
  if (!isSystemAdmin(ctx?.user)) return false;
  try {
    await requireAdminSensitiveAccess(ctx, options);
    return true;
  } catch {
    return false;
  }
}

export function maskSensitiveValue(value, type = "text") {
  if (value === null || typeof value === "undefined") return value;
  const text = String(value);
  if (type === "email") {
    const [name, domain] = text.split("@");
    if (!domain) return "masked";
    return `${name.slice(0, 2)}***@${domain}`;
  }
  if (type === "phone") return text.length > 4 ? `${text.slice(0, 2)}${"*".repeat(Math.max(4, text.length - 4))}${text.slice(-2)}` : "masked";
  if (["wallet", "balance", "money", "salary", "payroll"].includes(type)) return null;
  return "masked";
}

export function maskUserSensitiveFields(user, { allowContact = false, allowWallet = false, allowStaffInternal = false } = {}) {
  if (!user) return user;
  const out = { ...user };
  if (!allowContact) {
    if ("email" in out) out.email = maskSensitiveValue(out.email, "email");
    if ("phone" in out) out.phone = maskSensitiveValue(out.phone, "phone");
    if ("taxCode" in out) out.taxCode = maskSensitiveValue(out.taxCode, "taxCode");
    if ("address" in out) out.address = maskSensitiveValue(out.address, "address");
    if ("emergencyContact" in out) out.emergencyContact = undefined;
    if ("emergencyContacts" in out) out.emergencyContacts = undefined;
  }
  if (!allowWallet && out.wallet && typeof out.wallet === "object") out.wallet = { ...out.wallet, balance: null };
  if (!allowStaffInternal) {
    for (const key of ["baseSalary", "salaryType", "hourlyRate", "allowanceAmount", "nationalId", "bankName", "bankAccountNumber", "bankAccountHolder", "socialInsuranceNumber", "healthInsuranceNumber", "unemploymentInsuranceNumber", "noteInternal"]) {
      if (key in out) out[key] = key.toLowerCase().includes("salary") || key === "hourlyRate" || key === "allowanceAmount" ? null : "masked";
    }
  }
  return out;
}

export const maskCustomerContact = (customer, options) => maskUserSensitiveFields(customer, options);
export function maskFinanceFields(record, { allowFinance = false } = {}) {
  if (allowFinance || !record) return record;
  const out = { ...record };
  for (const key of ["balance", "amount", "salary", "payroll", "bankAccountNumber", "bankName", "taxCode", "revenue"]) if (key in out) out[key] = maskSensitiveValue(out[key], key);
  return out;
}
