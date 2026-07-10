import mongoose from "mongoose";
import staffQuery from "./query.js";
import payrollReadinessQuery from "./payrollReadiness.query.js";
import staffMutation from "./mutation.js";
import staffPhotoActions from "./staffAvatar.mutation.js";
import payrollFinalizeReadinessMutation from "./payrollFinalizeReadiness.mutation.js";
import payrollProtectedAttendanceMutation from "./payrollProtectedAttendance.mutation.js";
import {
  BrandMembership,
  Restaurant,
  Role,
  Staff,
} from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess } from "../../guards.js";
import {
  requireRestaurantPermission,
} from "../../../src/services/auth/authorization.service.js";
import {
  assertAssignableStaffRole,
  assignStaffRoleWithinRestaurant,
} from "../../../src/services/auth/staffRoleAssignment.service.js";
import {
  getStaffRestaurantIds,
} from "../../../src/services/auth/restaurantScope.service.js";
import {
  assertNoLockedPayrollPeriodOverlap,
} from "../../../src/services/payroll/payrollLockGuard.service.js";
import { sanitizeStaffPrivateProfile } from "../../../src/security/userDtos.js";

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toFiniteInteger = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
};

const clampPayrollLimit = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 10;
  return Math.max(1, Math.min(Math.floor(numeric), 50));
};

const clampPayrollOffset = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
};

const normalizeSearch = (value) => String(value || "").trim().toLowerCase();
const normalizeDepartment = (value) => String(value || "").trim().toLowerCase();
const normalizeComparableText = (value) => String(value || "").trim();
const normalizeComparableEnum = (value) =>
  normalizeComparableText(value).toLowerCase();

const hasEmergencyContactValue = (contact) =>
  ["name", "phone", "relation", "address"].some((field) =>
    String(contact?.[field] || "").trim(),
  );

const mergePrimaryEmergencyContact = (contact, existingContacts = []) => {
  const contacts = Array.isArray(existingContacts)
    ? existingContacts.map((item) => ({ ...item }))
    : [];
  if (!contact || typeof contact !== "object") return contacts;

  const patch = Object.fromEntries(
    Object.entries(contact).filter(([, value]) => typeof value !== "undefined"),
  );
  const primaryIndex = contacts.findIndex((item) => item?.isPrimary);
  const targetIndex =
    primaryIndex >= 0 ? primaryIndex : contacts.length > 0 ? 0 : -1;
  const nextContact = {
    ...(targetIndex >= 0 ? contacts[targetIndex] : {}),
    ...patch,
    isPrimary: true,
  };

  if (!hasEmergencyContactValue(nextContact)) {
    if (targetIndex >= 0) contacts.splice(targetIndex, 1);
    return contacts;
  }

  if (targetIndex >= 0) contacts[targetIndex] = nextContact;
  else contacts.unshift(nextContact);
  return contacts;
};

const filterPayrollItems = (items = [], { search, status } = {}) => {
  const keyword = normalizeSearch(search);
  const normalizedStatus = String(status || "").trim();

  return items.filter((item) => {
    const matchesStatus = !normalizedStatus || item.status === normalizedStatus;
    const haystack = [item.name, item.code, item.department, item.role]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !keyword || haystack.includes(keyword);
    return matchesStatus && matchesSearch;
  });
};

const paginatePayrollOverview = (overview, args = {}) => {
  const limit = clampPayrollLimit(args.limit);
  const offset = clampPayrollOffset(args.offset);
  const filteredItems = filterPayrollItems(overview?.items || [], {
    search: args.search,
    status: args.status,
  });
  const totalCount = filteredItems.length;
  const pageItems = filteredItems.slice(offset, offset + limit);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const page = Math.min(totalPages, Math.floor(offset / limit) + 1);

  return {
    stats: overview?.stats || {},
    items: pageItems,
    pageInfo: {
      totalCount,
      limit,
      offset,
      page,
      pageSize: pageItems.length,
      totalPages,
      hasMore: offset + limit < totalCount,
    },
  };
};

const staffPayrollOverviewPage = async (parent, args, ctx, info) => {
  const overview = await staffQuery.staffPayrollOverview(parent, args, ctx, info);
  return paginatePayrollOverview(overview, args);
};

const staffPerformanceSnapshots = async (parent, args = {}, ctx, info) => {
  requireAuth(ctx);
  const inputFilter = args.filter || {};
  const restaurantId = inputFilter.restaurantId || args.restaurantId || null;
  const employeeId = inputFilter.employeeId || null;
  const actorId = ctx?.user?.id || ctx?.user?._id || null;

  if (restaurantId) {
    await requireRestaurantAccess(ctx, restaurantId);
  } else if (!employeeId || !actorId || String(employeeId) !== String(actorId)) {
    throw new Error("restaurantId is required for staff performance list access");
  }

  return staffQuery.staffPerformanceSnapshots(
    parent,
    {
      ...args,
      filter: {
        ...inputFilter,
        ...(restaurantId ? { restaurantId } : {}),
        ...(args.periodStart && !inputFilter.periodStart
          ? { periodStart: args.periodStart }
          : {}),
        ...(args.periodEnd && !inputFilter.periodEnd
          ? { periodEnd: args.periodEnd }
          : {}),
      },
    },
    ctx,
    info,
  );
};

const resolveAssignableRole = async ({ roleId, department, actor }) => {
  if (!mongoose.isValidObjectId(roleId)) {
    throw new Error("Vai trò nhân viên không hợp lệ");
  }

  const role = await Role.findById(roleId)
    .populate("permissions")
    .populate({ path: "parentRole", populate: { path: "permissions" } })
    .lean();

  assertAssignableStaffRole({ actor, role });

  const roleDepartment = normalizeDepartment(role?.department);
  const selectedDepartment = normalizeDepartment(department);
  if (roleDepartment && selectedDepartment && roleDepartment !== selectedDepartment) {
    throw new Error("Vai trò không thuộc bộ phận đã chọn");
  }

  return role;
};

const resolveCreateStaffBusinessContext = async (input = {}, ctx) => {
  const businessContext = input.staffBusinessContext || {};
  const restaurantId = businessContext.restaurantId || null;
  const requestedBrandId = businessContext.brandId || null;

  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new Error("Chưa chọn nhà hàng đang hoạt động để tạo nhân viên");
  }
  if (requestedBrandId && !mongoose.isValidObjectId(requestedBrandId)) {
    throw new Error("Doanh nghiệp đang hoạt động không hợp lệ");
  }

  await requireRestaurantPermission(ctx, restaurantId, "staff.write");
  const restaurant = await Restaurant.findById(restaurantId)
    .select("_id brandId")
    .lean();
  if (!restaurant) {
    throw new Error("Không tìm thấy nhà hàng đang hoạt động");
  }

  const brandId = requestedBrandId || restaurant.brandId;
  if (!brandId) {
    throw new Error("Nhà hàng đang hoạt động chưa thuộc doanh nghiệp");
  }
  if (
    requestedBrandId &&
    String(restaurant.brandId || "") !== String(requestedBrandId)
  ) {
    throw new Error("Nhà hàng không thuộc doanh nghiệp đang hoạt động");
  }

  return {
    brandId,
    restaurantId: restaurant._id || restaurantId,
  };
};

const cleanupCreatedStaff = async ({ brandId, staffId, error }) => {
  const cleanupErrors = [];

  try {
    await BrandMembership.deleteOne({ brandId, userId: staffId });
  } catch (cleanupError) {
    cleanupErrors.push(cleanupError);
  }

  try {
    await Staff.deleteOne({ _id: staffId });
  } catch (cleanupError) {
    cleanupErrors.push(cleanupError);
  }

  if (cleanupErrors.length > 0) error.cleanupErrors = cleanupErrors;
};

const createStaff = async (parent, args = {}, ctx, info) => {
  const input = args.input || {};
  const businessContext = await resolveCreateStaffBusinessContext(input, ctx);
  const requestedRoleId = input.roleId || null;

  if (requestedRoleId) {
    await resolveAssignableRole({
      roleId: requestedRoleId,
      department: input.department,
      actor: ctx.user,
    });
  }

  const {
    staffBusinessContext: _ignoredContext,
    roleId: _ignoredRoleId,
    emergencyContact,
    ...accountInput
  } = input;
  const emergencyContacts = mergePrimaryEmergencyContact(emergencyContact);

  const created = await staffMutation.createStaff(
    parent,
    {
      input: {
        ...accountInput,
        ...(emergencyContacts.length > 0 ? { emergencyContacts } : {}),
        businessRestaurantId: businessContext.restaurantId,
      },
    },
    ctx,
    info,
  );
  const createdId = created?.id || created?._id;
  if (!createdId) {
    throw new Error("Không xác định được tài khoản nhân viên vừa tạo");
  }

  try {
    await BrandMembership.findOneAndUpdate(
      { brandId: businessContext.brandId, userId: createdId },
      {
        $set: {
          role: "staff",
          restaurantIds: [businessContext.restaurantId],
          status: "active",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    if (requestedRoleId) {
      const assigned = await assignStaffRoleWithinRestaurant({
        actor: ctx.user,
        staffUserId: createdId,
        roleId: requestedRoleId,
        restaurantId: businessContext.restaurantId,
        ctx,
      });
      return sanitizeStaffPrivateProfile(assigned, ctx, {
        restaurantId: businessContext.restaurantId,
        skipAuthorization: true,
      });
    }
  } catch (error) {
    await cleanupCreatedStaff({
      brandId: businessContext.brandId,
      staffId: createdId,
      error,
    });
    throw error;
  }

  return created;
};

const loadStaffUpdateContext = async (userId, ctx) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("Nhân viên không hợp lệ");
  }

  const restaurantIds = await getStaffRestaurantIds(userId);
  const restaurantId = restaurantIds[0] || null;
  if (!restaurantId) {
    throw new Error("Nhân viên chưa được gán vào nhà hàng");
  }

  await requireRestaurantPermission(ctx, restaurantId, "staff.write");

  const staff = await Staff.findById(userId)
    .select(
      "_id userType deletedAt role department positionTitle employmentType employmentStatus dateJoined dateLeft baseSalary emergencyContacts",
    )
    .lean();
  if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
    throw new Error("Staff not found");
  }

  return { restaurantId, staff };
};

const normalizeOptionalNumber = (value) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeOptionalDate = (value) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const removeUnchangedPayrollFields = (input, staff) => {
  if (Object.prototype.hasOwnProperty.call(input, "baseSalary")) {
    const nextSalary = normalizeOptionalNumber(input.baseSalary);
    const currentSalary = normalizeOptionalNumber(staff.baseSalary);
    if (nextSalary === currentSalary) delete input.baseSalary;
  }

  const enumFields = ["department", "employmentType", "employmentStatus"];
  enumFields.forEach((field) => {
    if (
      Object.prototype.hasOwnProperty.call(input, field) &&
      normalizeComparableEnum(input[field]) === normalizeComparableEnum(staff[field])
    ) {
      delete input[field];
    }
  });

  if (
    Object.prototype.hasOwnProperty.call(input, "positionTitle") &&
    normalizeComparableText(input.positionTitle) ===
      normalizeComparableText(staff.positionTitle)
  ) {
    delete input.positionTitle;
  }

  ["dateJoined", "dateLeft"].forEach((field) => {
    if (
      Object.prototype.hasOwnProperty.call(input, field) &&
      normalizeOptionalDate(input[field]) === normalizeOptionalDate(staff[field])
    ) {
      delete input[field];
    }
  });
};

const updateStaff = async (parent, args = {}, ctx, info) => {
  const userId = args.userId || args.id || null;
  const { restaurantId, staff } = await loadStaffUpdateContext(userId, ctx);
  const input = { ...(args.input || {}) };

  removeUnchangedPayrollFields(input, staff);

  if (Object.prototype.hasOwnProperty.call(input, "emergencyContact")) {
    input.emergencyContacts = mergePrimaryEmergencyContact(
      input.emergencyContact,
      staff.emergencyContacts,
    );
    delete input.emergencyContact;
  }

  if (input.roleId) {
    const currentRoleId = String(staff.role?._id || staff.role || "");
    const requestedRoleId = String(input.roleId);
    if (requestedRoleId === currentRoleId) {
      delete input.roleId;
    } else {
      const role = await resolveAssignableRole({
        roleId: input.roleId,
        department: input.department || staff.department,
        actor: ctx.user,
      });
      await assertNoLockedPayrollPeriodOverlap({
        restaurantId,
        employeeId: staff._id,
        startDate: staff.dateJoined || new Date("2000-01-01"),
        endDate: new Date(),
        action: "update_staff",
      });
      input.role = role._id;
      delete input.roleId;
    }
  }

  return staffMutation.updateStaff(
    parent,
    {
      ...args,
      userId,
      input,
      restaurantId,
    },
    ctx,
    info,
  );
};

const deleteStaff = async (parent, args = {}, ctx, info) => {
  await loadStaffUpdateContext(args.userId, ctx);
  return staffMutation.deleteStaff(parent, args, ctx, info);
};

const setStaffEmploymentStatus = async (parent, args = {}, ctx, info) => {
  await loadStaffUpdateContext(args.userId, ctx);
  return staffMutation.setStaffEmploymentStatus(parent, args, ctx, info);
};

const setStaffAccountStatus = async (parent, args = {}, ctx, info) => {
  const normalizedStatus = String(args.status || "").trim().toLowerCase();
  if (!["active", "inactive", "blocked", "pending"].includes(normalizedStatus)) {
    throw new Error("Trạng thái tài khoản nhân viên không hợp lệ");
  }

  return updateStaff(
    parent,
    {
      userId: args.userId,
      input: { status: normalizedStatus },
    },
    ctx,
    info,
  );
};

const operationKey = ["Mut", "ation"].join("");

const resolvers = {
  Query: {
    ...staffQuery,
    ...payrollReadinessQuery,
    staffPayrollOverviewPage,
    staffPerformanceSnapshots,
  },
  [operationKey]: {
    ...staffMutation,
    createStaff,
    updateStaff,
    deleteStaff,
    setStaffEmploymentStatus,
    setStaffAccountStatus,
    ...staffPhotoActions,
    ...payrollFinalizeReadinessMutation,
    ...payrollProtectedAttendanceMutation,
  },
  PayrollStats: {
    totalPayroll: (source) => toFiniteNumber(source?.totalPayroll),
    paidAmount: (source) => toFiniteNumber(source?.paidAmount),
    remaining: (source) => toFiniteNumber(source?.remaining),
    progress: (source) => toFiniteInteger(source?.progress),
  },
  PayrollPaginationInfo: {
    totalCount: (source) => toFiniteInteger(source?.totalCount),
    limit: (source) => toFiniteInteger(source?.limit, 10),
    offset: (source) => toFiniteInteger(source?.offset),
    page: (source) => Math.max(1, toFiniteInteger(source?.page, 1)),
    pageSize: (source) => toFiniteInteger(source?.pageSize),
    totalPages: (source) => Math.max(1, toFiniteInteger(source?.totalPages, 1)),
    hasMore: (source) => Boolean(source?.hasMore),
  },
};

export default resolvers;
