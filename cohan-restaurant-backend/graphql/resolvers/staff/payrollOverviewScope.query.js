import { PayrollPeriod } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";
import staffQuery from "./query.js";

const clampLimit = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 10;
  return Math.max(1, Math.min(Math.floor(numeric), 50));
};

const clampOffset = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
};

const filterItems = (items = [], { search, status } = {}) => {
  const keyword = String(search || "").trim().toLowerCase();
  const normalizedStatus = String(status || "").trim();

  return items.filter((item) => {
    const matchesStatus = !normalizedStatus || item.status === normalizedStatus;
    const haystack = [item.name, item.code, item.department, item.role]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesStatus && (!keyword || haystack.includes(keyword));
  });
};

const paginate = (overview, args = {}) => {
  const limit = clampLimit(args.limit);
  const offset = clampOffset(args.offset);
  const filteredItems = filterItems(overview?.items || [], args);
  const totalCount = filteredItems.length;
  const items = filteredItems.slice(offset, offset + limit);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return {
    stats: overview?.stats || {},
    items,
    pageInfo: {
      totalCount,
      limit,
      offset,
      page: Math.min(totalPages, Math.floor(offset / limit) + 1),
      pageSize: items.length,
      totalPages,
      hasMore: offset + limit < totalCount,
    },
  };
};

async function assertPeriodRestaurantScope({ periodId, restaurantId }, ctx) {
  if (!periodId) return null;

  const period = await PayrollPeriod.findById(periodId)
    .select({ restaurantId: 1 })
    .lean();
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");

  await requireRestaurantAccess(ctx, period.restaurantId);
  if (
    restaurantId &&
    String(period.restaurantId) !== String(restaurantId)
  ) {
    const error = new Error("PAYROLL_PERIOD_RESTAURANT_MISMATCH");
    error.code = "PAYROLL_PERIOD_RESTAURANT_MISMATCH";
    throw error;
  }

  return period;
}

const staffPayrollOverview = async (parent, args = {}, ctx, info) => {
  await assertPeriodRestaurantScope(args, ctx);
  return staffQuery.staffPayrollOverview(parent, args, ctx, info);
};

const staffPayrollOverviewPage = async (parent, args = {}, ctx, info) => {
  const overview = await staffPayrollOverview(parent, args, ctx, info);
  return paginate(overview, args);
};

export default { staffPayrollOverview, staffPayrollOverviewPage };
