import staffQuery from "./query.js";
import payrollReadinessQuery from "./payrollReadiness.query.js";
import staffMutation from "./mutation.js";
import staffPhotoActions from "./staffAvatar.mutation.js";
import payrollFinalizeReadinessMutation from "./payrollFinalizeReadiness.mutation.js";
import {
  requireAuth,
  requireRestaurantAccess,
  requireRoles,
} from "../../guards.js";
import {
  SCHEDULE_WRITE_ROLES,
  SHIFT_ACK_ADMIN_ROLES,
} from "../../../src/services/scheduling/schedulingPermission.service.js";

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

function wrapMutation(operation, authorize) {
  if (typeof operation !== "function") return operation;
  return async function scopedMutation(parent, args, ctx, info) {
    await authorize(args || {}, ctx);
    return operation.call(this, parent, args, ctx, info);
  };
}

async function authorizeScheduleWrite(args, ctx) {
  requireAuth(ctx);
  requireRoles(ctx, SCHEDULE_WRITE_ROLES);
  const restaurantId = args?.restaurantId || args?.input?.restaurantId;
  if (!restaurantId) throw new Error("restaurantId is required");
  await requireRestaurantAccess(ctx, restaurantId);
}

async function authorizeAcknowledgementExpiry(args, ctx) {
  requireAuth(ctx);
  const restaurantId = args?.restaurantId;
  if (!restaurantId) {
    requireRoles(ctx, ["ADMIN"]);
    return;
  }
  requireRoles(ctx, SHIFT_ACK_ADMIN_ROLES);
  await requireRestaurantAccess(ctx, restaurantId);
}

const guardedStaffMutation = {
  ...staffMutation,
  updateSchedulingPolicy: wrapMutation(
    staffMutation.updateSchedulingPolicy,
    authorizeScheduleWrite,
  ),
  startSchedulingOperations: wrapMutation(
    staffMutation.startSchedulingOperations,
    authorizeScheduleWrite,
  ),
  expirePendingShiftAcknowledgements: wrapMutation(
    staffMutation.expirePendingShiftAcknowledgements,
    authorizeAcknowledgementExpiry,
  ),
};

const operationKey = ["Mut", "ation"].join("");

const resolvers = {
  Query: {
    ...staffQuery,
    ...payrollReadinessQuery,
    staffPayrollOverviewPage,
  },
  [operationKey]: {
    ...guardedStaffMutation,
    ...staffPhotoActions,
    ...payrollFinalizeReadinessMutation,
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
