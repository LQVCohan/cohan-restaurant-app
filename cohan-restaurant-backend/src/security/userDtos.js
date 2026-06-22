import { GraphQLError } from "graphql";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  requirePermission,
  requireRestaurantPermission,
} from "../services/auth/authorization.service.js";

function toPlainObject(user) {
  if (!user) return null;
  if (typeof user.toObject === "function") return user.toObject({ virtuals: true });
  return { ...user };
}

function stringId(value) {
  if (!value) return undefined;
  if (typeof value === "object") return String(value._id || value.id || value.value || "") || undefined;
  return String(value);
}

function pickDefined(entries) {
  return Object.fromEntries(
    Object.entries(entries).filter(([, value]) => typeof value !== "undefined"),
  );
}

function sanitizeRole(role) {
  if (!role || typeof role !== "object") return role || null;
  return pickDefined({
    _id: role._id,
    id: role.id || stringId(role._id),
    name: role.name,
    slug: role.slug,
    department: role.department,
    permissions: Array.isArray(role.permissions) ? role.permissions : undefined,
  });
}

function safeWallet(wallet) {
  if (!wallet || typeof wallet !== "object") return undefined;
  return pickDefined({
    provider: wallet.provider,
    status: wallet.status,
    balance: wallet.balance,
    currency: wallet.currency,
    updatedAt: wallet.updatedAt,
  });
}

function baseUserFields(source) {
  return {
    _id: source._id,
    id: source.id || stringId(source._id),
    fullName: source.fullName || source.name,
    username: source.username,
    email: source.email,
    phone: source.phone,
    avatarUrl: source.avatarUrl,
    role: sanitizeRole(source.role),
    roleName: source.roleName || source.role?.slug || source.role?.name,
    status: source.status,
    userType: source.userType,
    refRestaurants: source.refRestaurants,
    isGuest: source.isGuest,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export function sanitizeAuthUser(user) {
  const source = toPlainObject(user);
  if (!source) return null;

  return pickDefined({
    ...baseUserFields(source),
    emailVerified:
      typeof source.emailVerified === "boolean" ? source.emailVerified : undefined,
    phoneVerified:
      typeof source.phoneVerified === "boolean" ? source.phoneVerified : undefined,
    verifiedAt: source.verifiedAt,
    emailVerifiedAt: source.emailVerifiedAt,
    phoneVerifiedAt: source.phoneVerifiedAt,
    wallet: safeWallet(source.wallet),
    restaurantForStaff: source.restaurantForStaff,
    employmentType: source.employmentType,
    department: source.department,
    positionTitle: source.positionTitle,
  });
}

export function sanitizeCustomerListUser(user) {
  const source = toPlainObject(user);
  if (!source) return null;

  return pickDefined({
    ...baseUserFields(source),
    customerType: source.customerType,
    loyaltyPoints: source.loyaltyPoints,
    loyaltyRank: source.loyaltyRank,
    totalOrders: source.totalOrders,
    totalSpending: source.totalSpending,
    guestExpiresAt: source.guestExpiresAt,
    emailVerified:
      typeof source.emailVerified === "boolean" ? source.emailVerified : undefined,
    phoneVerified:
      typeof source.phoneVerified === "boolean" ? source.phoneVerified : undefined,
    verifiedAt: source.verifiedAt,
    emailVerifiedAt: source.emailVerifiedAt,
    phoneVerifiedAt: source.phoneVerifiedAt,
    lastLoginAt: source.lastLoginAt,
    isOnline: source.isOnline,
    loyaltyDurationScore: source.loyaltyDurationScore,
  });
}

export function sanitizeAdminUserListItem(user) {
  const source = toPlainObject(user);
  if (!source) return null;

  return pickDefined({
    ...baseUserFields(source),
    address: source.address,
    provider: source.provider,
    point: source.point,
    loyaltyPoints: source.loyaltyPoints,
    loyaltyRank: source.loyaltyRank,
    foodPreferences: source.foodPreferences,
    customerType: source.customerType,
    totalOrders: source.totalOrders,
    totalSpending: source.totalSpending,
    emailVerified:
      typeof source.emailVerified === "boolean" ? source.emailVerified : undefined,
    phoneVerified:
      typeof source.phoneVerified === "boolean" ? source.phoneVerified : undefined,
    verifiedAt: source.verifiedAt,
    emailVerifiedAt: source.emailVerifiedAt,
    phoneVerifiedAt: source.phoneVerifiedAt,
    guestExpiresAt: source.guestExpiresAt,
    department: source.department,
    employeeCode: source.employeeCode,
    positionTitle: source.positionTitle,
    employmentType: source.employmentType,
    employmentStatus: source.employmentStatus,
    shiftType: source.shiftType,
    workingDays: source.workingDays,
    dateJoined: source.dateJoined,
    dateLeft: source.dateLeft,
    lastLoginAt: source.lastLoginAt,
    emergencyContact: source.emergencyContact,
    wallet: safeWallet(source.wallet),
    restaurantForStaff: source.restaurantForStaff,
    isOnline: source.isOnline,
    loyaltyDurationScore: source.loyaltyDurationScore,
  });
}

function notFound(message = "Staff not found") {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}

function idEquals(left, right) {
  const a = stringId(left);
  const b = stringId(right);
  return Boolean(a && b && a === b);
}

export function staffBelongsToRestaurant(user, restaurantId) {
  if (!restaurantId) return true;
  const source = toPlainObject(user);
  if (!source) return false;
  return idEquals(source.restaurantForStaff, restaurantId);
}

export function resolveStaffPrivateProfileScope(user, restaurantId) {
  const source = toPlainObject(user);
  if (!source) return null;
  if (restaurantId) {
    if (!staffBelongsToRestaurant(source, restaurantId)) throw notFound();
    return restaurantId;
  }
  return source.restaurantForStaff || null;
}

export async function authorizeStaffPrivateProfile(ctx, user, restaurantId) {
  const targetRestaurantId = resolveStaffPrivateProfileScope(user, restaurantId);
  const hasRestaurantScope = Boolean(targetRestaurantId);

  if (hasRestaurantScope) {
    await requireRestaurantPermission(ctx, targetRestaurantId, PERMISSIONS.STAFF_READ);
    return true;
  }

  await requirePermission(ctx, PERMISSIONS.STAFF_READ);
  return true;
}

export async function sanitizeStaffPrivateProfile(user, ctx, { restaurantId, skipAuthorization = false } = {}) {
  const source = toPlainObject(user);
  if (!source) return null;

  const targetRestaurantId = resolveStaffPrivateProfileScope(source, restaurantId);

  if (!skipAuthorization) {
    await authorizeStaffPrivateProfile(ctx, source, targetRestaurantId);
  }

  return pickDefined({
    ...sanitizeAdminUserListItem(source),
    dateOfBirth: source.dateOfBirth,
    gender: source.gender,
    nationalId: source.nationalId,
    nationalIdIssuedAt: source.nationalIdIssuedAt,
    nationalIdIssuedPlace: source.nationalIdIssuedPlace,
    maritalStatus: source.maritalStatus,
    permanentAddress: source.permanentAddress,
    temporaryAddress: source.temporaryAddress,
    contractCode: source.contractCode,
    contractType: source.contractType,
    contractStartDate: source.contractStartDate,
    contractEndDate: source.contractEndDate,
    probationEndDate: source.probationEndDate,
    officialStartDate: source.officialStartDate,
    terminationReason: source.terminationReason,
    salaryType: source.salaryType,
    baseSalary: source.baseSalary,
    hourlyRate: source.hourlyRate,
    allowanceAmount: source.allowanceAmount,
    bankName: source.bankName,
    bankAccountNumber: source.bankAccountNumber,
    bankAccountHolder: source.bankAccountHolder,
    socialInsuranceNumber: source.socialInsuranceNumber,
    healthInsuranceNumber: source.healthInsuranceNumber,
    unemploymentInsuranceNumber: source.unemploymentInsuranceNumber,
    insuranceEligible: source.insuranceEligible,
    insuranceStartDate: source.insuranceStartDate,
    educationLevel: source.educationLevel,
    certifications: source.certifications,
    skills: source.skills,
    languages: source.languages,
    uniformSize: source.uniformSize,
    deviceIds: source.deviceIds,
    accessCardCode: source.accessCardCode,
    trainingStatus: source.trainingStatus,
    lastTrainingAt: source.lastTrainingAt,
    nextTrainingDueAt: source.nextTrainingDueAt,
    emergencyContacts: source.emergencyContacts,
    forcePasswordChange: source.forcePasswordChange,
    noteInternal: source.noteInternal,
  });
}

export function assertNoSensitiveUserFields(obj) {
  const sensitive = [
    "passwordHash",
    "emailVerifyToken",
    "emailVerifyTokenHash",
    "phoneVerifyToken",
    "phoneVerifyTokenHash",
  ];
  for (const field of sensitive) {
    if (Object.prototype.hasOwnProperty.call(obj || {}, field)) {
      throw new Error(`Sensitive field leaked: ${field}`);
    }
  }
}
