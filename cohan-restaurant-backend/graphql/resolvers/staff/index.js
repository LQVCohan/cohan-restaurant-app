import mongoose from "mongoose";
import staffQuery from "./query.js";
import payrollReadinessQuery from "./payrollReadiness.query.js";
import staffMutation from "./mutation.js";
import staffPhotoActions from "./staffAvatar.mutation.js";
import payrollFinalizeReadinessMutation from "./payrollFinalizeReadiness.mutation.js";
import payrollProtectedAttendanceMutation from "./payrollProtectedAttendance.mutation.js";
import { BrandMembership, Restaurant, Staff } from "../../../models/index.js";
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

const resolveCreateStaffBusinessContext = async (input = {}, ctx) => {
  const businessContext = input.staffBusinessContext || {};
  const restaurantId =
    businessContext.restaurantId || input.restaurantForStaff || null;
  const requestedBrandId = businessContext.brandId || null;

  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new Error("Chưa chọn nhà hàng đang hoạt động để tạo nhân viên");
  }
  if (requestedBrandId && !mongoose.isValidObjectId(requestedBrandId)) {
    throw new Error("Doanh nghiệp đang hoạt động không hợp lệ");
  }

  await requireRestaurantAccess(ctx, restaurantId);
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

const createStaff = async (parent, args = {}, ctx, info) => {
  const input = args.input || {};
  const businessContext = await resolveCreateStaffBusinessContext(input, ctx);
  const { staffBusinessContext: _ignoredContext, ...accountInput } = input;

  const created = await staffMutation.createStaff(
    parent,
    {
      input: {
        ...accountInput,
        // ponytail: legacy staff modules still read this fallback; scope comes from BrandMembership.
        restaurantForStaff: businessContext.restaurantId,
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
  } catch (error) {
    try {
      await Staff.deleteOne({ _id: createdId });
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }
    throw error;
  }

  return created;
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
