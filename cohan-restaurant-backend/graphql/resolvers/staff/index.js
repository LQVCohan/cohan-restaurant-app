import staffQuery from "./query.js";
import payrollReadinessQuery from "./payrollReadiness.query.js";
import staffMutation from "./mutation.js";
import staffPhotoActions from "./staffAvatar.mutation.js";
import payrollFinalizeReadinessMutation from "./payrollFinalizeReadiness.mutation.js";
import payrollProtectedAttendanceMutation from "./payrollProtectedAttendance.mutation.js";
import { requireAuth, requireRestaurantAccess } from "../../guards.js";

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
