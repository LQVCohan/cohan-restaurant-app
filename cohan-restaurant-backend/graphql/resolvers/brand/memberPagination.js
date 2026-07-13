import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { BrandMembership, User } from "../../../models/index.js";
import { canManageBrand } from "../../../src/services/auth/restaurantScope.service.js";

const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "staff"]);
const ALLOWED_STATUSES = new Set(["active", "inactive", "invited"]);

const forbidden = () =>
  new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
const bad = (message) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

const toObjectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) throw bad(`${label} không hợp lệ`);
  return new mongoose.Types.ObjectId(value);
};

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeBrandMemberPageArgs({ page = 1, pageSize = 10 } = {}) {
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const normalizedPageSize = Math.min(
    Math.max(Number.parseInt(pageSize, 10) || 10, 1),
    100,
  );
  return { page: normalizedPage, pageSize: normalizedPageSize };
}

export function buildBrandMemberBaseFilter({
  brandId,
  role,
  restaurantId,
  status,
}) {
  const filter = { brandId: toObjectId(brandId, "Brand") };

  if (role) {
    const normalizedRole = String(role).trim().toLowerCase();
    if (!ALLOWED_ROLES.has(normalizedRole)) throw bad("Vai trò lọc không hợp lệ");
    filter.role = normalizedRole;
  }

  if (status) {
    const normalizedStatus = String(status).trim().toLowerCase();
    if (!ALLOWED_STATUSES.has(normalizedStatus)) {
      throw bad("Trạng thái lọc không hợp lệ");
    }
    filter.status = normalizedStatus;
  }

  if (restaurantId) {
    filter.restaurantIds = toObjectId(restaurantId, "Chi nhánh");
  }

  return filter;
}

async function resolveSearchUserIds(search) {
  const keyword = String(search || "").trim();
  if (!keyword) return null;

  const regex = new RegExp(escapeRegex(keyword), "i");
  const conditions = [
    { fullName: regex },
    { username: regex },
    { email: regex },
  ];
  if (mongoose.isValidObjectId(keyword)) {
    conditions.push({ _id: new mongoose.Types.ObjectId(keyword) });
  }

  const users = await User.find({
    deletedAt: null,
    $or: conditions,
  })
    .select("_id")
    .limit(500)
    .lean();

  return users.map((user) => user._id);
}

async function getBrandMemberSummary(brandObjectId) {
  const [summary] = await BrandMembership.aggregate([
    { $match: { brandId: brandObjectId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
        },
        inactive: {
          $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
        },
        invited: {
          $sum: { $cond: [{ $eq: ["$status", "invited"] }, 1, 0] },
        },
      },
    },
  ]);

  return {
    total: summary?.total || 0,
    active: summary?.active || 0,
    inactive: summary?.inactive || 0,
    invited: summary?.invited || 0,
  };
}

const Query = {
  brandMembersPage: async (
    _,
    {
      brandId,
      search,
      role,
      restaurantId,
      status,
      page = 1,
      pageSize = 10,
    },
    ctx,
  ) => {
    if (!ctx?.user || !(await canManageBrand(ctx.user, brandId))) {
      throw forbidden();
    }

    const pagination = normalizeBrandMemberPageArgs({ page, pageSize });
    const filter = buildBrandMemberBaseFilter({
      brandId,
      role,
      restaurantId,
      status,
    });
    const userIds = await resolveSearchUserIds(search);
    if (userIds) filter.userId = { $in: userIds };

    const [totalCount, summary] = await Promise.all([
      BrandMembership.countDocuments(filter),
      getBrandMemberSummary(filter.brandId),
    ]);

    const totalPages = totalCount ? Math.ceil(totalCount / pagination.pageSize) : 0;
    const effectivePage = totalPages
      ? Math.min(pagination.page, totalPages)
      : 1;
    const skip = (effectivePage - 1) * pagination.pageSize;

    const items = await BrandMembership.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(pagination.pageSize)
      .lean();

    return {
      items,
      pageInfo: {
        page: effectivePage,
        pageSize: pagination.pageSize,
        totalCount,
        totalPages,
        hasNextPage: totalPages > 0 && effectivePage < totalPages,
        hasPreviousPage: effectivePage > 1,
      },
      summary,
    };
  },
};

export default { Query };
