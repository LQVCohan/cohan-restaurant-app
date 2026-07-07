// src/graphql/resolvers/user/query.js
import {
  User,
  Role,
  Customer,
  Order,
  WalletTransaction,
} from "../../../models/index.js";
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { requireRole } from "../../../utils/authz.js";
import { requireRestaurantAccess } from "../../guards.js";
import { requirePermission } from "../../../src/services/auth/authorization.service.js";
import { isSystemAdmin } from "../../../src/services/auth/restaurantScope.service.js";
import { requireAdminSensitiveAccess, tryAdminSensitiveAccessWithAudit, SENSITIVE_ACCESS } from "../../../src/services/auth/adminSensitiveAccess.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { getEffectiveCustomerRankSetting } from "../../../src/services/customerRankSetting.service.js";
import {
  sanitizeAdminUserListItem,
  sanitizeAuthUser,
  sanitizeCustomerListUser,
  resolveStaffPrivateProfileScope,
  sanitizeStaffPrivateProfile,
} from "../../../src/security/userDtos.js";

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

function normalizeIdKey(value) {
  if (!value) return "";
  if (value?._mockObjectId) return String(value._mockObjectId);
  if (typeof value?.toString === "function" && value.toString !== Object.prototype.toString) {
    return String(value.toString());
  }
  return String(value);
}

function buildSearchCond(search) {
  if (!search || !search.trim()) return null;
  const q = search.trim();
  return {
    $or: [
      { fullName: new RegExp(q, "i") },
      { email: new RegExp(q, "i") },
      { phone: new RegExp(q, "i") },
      { username: new RegExp(q, "i") },
    ],
  };
}
const CUSTOMER_PAGE_LIMIT_DEFAULT = 30;
const CUSTOMER_PAGE_LIMIT_MAX = 100;
const CUSTOMER_EXPORT_LIMIT_DEFAULT = 1000;
const CUSTOMER_EXPORT_LIMIT_MAX = 2000;

function encodeOffsetCursor(offset) {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64");
}

function decodeOffsetCursor(cursor) {
  if (!cursor) return 0;
  try {
    const raw = Buffer.from(String(cursor), "base64").toString("utf8");
    const parsed = JSON.parse(raw);
    return Math.max(0, Number(parsed?.offset) || 0);
  } catch {
    throw new GraphQLError("Invalid cursor", { extensions: { code: "BAD_USER_INPUT" } });
  }
}
function buildCustomerQueryCondition({
  restaurantId,
  search,
  includeGuests = true,
  customerKind = "ALL",
  customerRoleId = null,
  customerRank = null,
}) {
  const activeCond = { deletedAt: null };
  const restaurantScopeCond = { customerRestaurants: { $in: [toObjectId(restaurantId)] } };
  const searchCond = buildSearchCond(search);
  const customerRoleClause = customerRoleId ? { role: customerRoleId } : null;
  const guestClause = { isGuest: true };
  let kindClause = null;
  if (customerKind === "GUEST") {
    if (!includeGuests) return { finalCond: { _id: { $exists: false } }, empty: true };
    kindClause = guestClause;
  } else if (customerKind === "REGISTERED") {
    kindClause = customerRoleClause || { _id: { $exists: false } };
  } else if (includeGuests) {
    kindClause = customerRoleClause ? { $or: [customerRoleClause, guestClause] } : guestClause;
  } else {
    kindClause = customerRoleClause || { _id: { $exists: false } };
  }
  const rankClauses = [];
  if (typeof customerRank?.minPoints === "number") rankClauses.push({ loyaltyPoints: { $gte: customerRank.minPoints } });
  if (typeof customerRank?.maxPointsExclusive === "number") rankClauses.push({ loyaltyPoints: { $lt: customerRank.maxPointsExclusive } });
  const clauses = [activeCond, restaurantScopeCond, kindClause, searchCond, ...rankClauses].filter(Boolean);
  return { finalCond: clauses.length === 1 ? clauses[0] : { $and: clauses }, empty: false };
}

const ONLINE_MINUTES = 5;
const VND_PER_RANK_POINT = 1_000_000;

function computeLoyaltyDurationScore(createdAt) {
  const createdMs = new Date(createdAt || 0).getTime();
  if (!Number.isFinite(createdMs) || createdMs <= 0) return 0;
  const days = Math.max(
    0,
    Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24)),
  );
  return days;
}

function computeRankPoints(totalSpending) {
  return Math.max(
    0,
    Math.floor((Number(totalSpending) || 0) / VND_PER_RANK_POINT),
  );
}

export const UserQuery = {
  // ========== Current user ==========
  async me(_, __, { user }) {
    try {
      if (!user?.id) {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const fullUser = await User.findById(toObjectId(user.id))
        .populate({ path: "role" })
        .lean();

      if (!fullUser) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return sanitizeAuthUser(fullUser);
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err.message || "Failed to fetch user info", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  // ========== Danh sách vai trò (để FE map slug -> id) ==========
  async roleList(_, __, { user: authUser }) {
    try {
      // Cho phép các vai trò quản lý nhân sự tải role list
      requireRole(authUser, ["admin", "manager", "hr"]);

      const list = await Role.find({})
        .populate({ path: "parentRole", select: "name slug" })
        .sort({ createdAt: 1 })
        .lean();
      return list;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err.message || "Failed to fetch role list", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  // ========== Lấy toàn bộ users (mục đích: tổng quản trị) ==========

  async users(_, { roleId, isGuest, search }, ctx) {
    const authUser = ctx?.user;
    try {
      requireRole(authUser, ["admin"]);

      const cond = { deletedAt: null };
      if (typeof isGuest === "boolean") cond.isGuest = isGuest;
      if (roleId) cond.role = toObjectId(roleId);

      const s = buildSearchCond(search);
      const finalCond = s ? { ...cond, ...s } : cond;

      const list = await User.find(finalCond)
        .populate({ path: "role", select: "name slug" })
        .sort({ createdAt: -1 })
        .lean();

      const allowSensitive = await tryAdminSensitiveAccessWithAudit(ctx, {
        category: SENSITIVE_ACCESS.STAFF_INTERNAL,
        resourceType: "User",
        resourceId: "list",
      });
      return list.map((item) => sanitizeAdminUserListItem(item, {
        maskSensitive: isSystemAdmin(authUser) && !allowSensitive,
        allowContact: allowSensitive,
        allowWallet: allowSensitive,
        allowStaffInternal: allowSensitive,
      }));
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new GraphQLError(err.message || "Failed to fetch users", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  // ========== Lấy khách hàng (mục đích: quản trị KH) ==========
  // Args: search?: String, includeGuests?: Boolean (default = true)
  // Kết quả = users có role=customer UNION (isGuest = true nếu includeGuests)
  async customers(_, { search, includeGuests = true, restaurantId }, ctx) {
    try {
      const authUser = ctx?.user;
      requireRole(authUser, ["admin", "manager", "staff"]);

      const roleName = String(authUser?.roleName || "").toLowerCase();
      const isAdmin = roleName === "admin";
      const allowCustomerSensitive = await tryAdminSensitiveAccessWithAudit(ctx, {
        category: SENSITIVE_ACCESS.CUSTOMER_CONTACT,
        resourceType: "Customer",
        resourceId: "list",
        restaurantId,
      });
      const customerSensitiveOptions = {
        maskSensitive: isSystemAdmin(authUser) && !allowCustomerSensitive,
        allowContact: allowCustomerSensitive,
        allowWallet: allowCustomerSensitive,
      };

      let scopedRestaurantId = null;

      if (restaurantId) {
        if (!mongoose.isValidObjectId(restaurantId)) {
          throw new GraphQLError("Invalid restaurantId", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        scopedRestaurantId = restaurantId;
      } else if (!isAdmin && authUser?.restaurantForStaff) {
        scopedRestaurantId = authUser.restaurantForStaff;
      }

      if (!isAdmin && !scopedRestaurantId) {
        throw new GraphQLError("restaurantId is required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      if (scopedRestaurantId) {
        await requireRestaurantAccess(ctx, scopedRestaurantId);
      }

      const restaurantScopeCond = scopedRestaurantId
        ? {
            customerRestaurants: {
              $in: [toObjectId(scopedRestaurantId)],
            },
          }
        : {};

      const s = buildSearchCond(search);

      // Tìm role "customer"
      const customerRole = await Role.findOne({ slug: "customer" }).lean();

      if (!customerRole?._id) {
        const guestOnlyCond = {
          deletedAt: null,
          isGuest: true,
          ...(s || {}),
          ...restaurantScopeCond,
        };

        const guestOnly = includeGuests
          ? await Customer.find(guestOnlyCond)
              .populate({ path: "role", select: "name slug" })
              .sort({ createdAt: -1 })
              .lean()
          : [];

        return guestOnly.map((item) => sanitizeCustomerListUser(item, customerSensitiveOptions));
      }

      const customerCond = {
        deletedAt: null,
        role: customerRole._id,
        ...(s || {}),
        ...restaurantScopeCond,
      };

      const roleCustomers = await Customer.find(customerCond)
        .populate({ path: "role", select: "name slug" })
        .sort({ createdAt: -1 })
        .lean();

      let guests = [];
      if (includeGuests) {
        const guestCond = {
          deletedAt: null,
          isGuest: true,
          ...(s || {}),
          ...restaurantScopeCond,
        };

        guests = await Customer.find(guestCond)
          .populate({ path: "role", select: "name slug" })
          .sort({ createdAt: -1 })
          .lean();
      }

      const merged = [...roleCustomers, ...guests].reduce((acc, cur) => {
        if (
          !acc.find((x) => String(x._id || x.id) === String(cur._id || cur.id))
        ) {
          acc.push(cur);
        }
        return acc;
      }, []);

      return merged.map((item) => sanitizeCustomerListUser(item, customerSensitiveOptions));
    } catch (err) {
      if (err instanceof GraphQLError) throw err;

      if (err?.statusCode === 401 || err?.message === "UNAUTHENTICATED") {
        throw new GraphQLError("Unauthorized", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      if (
        err?.statusCode === 403 ||
        err?.message === "FORBIDDEN" ||
        err?.message === "FORBIDDEN_SCOPE"
      ) {
        throw new GraphQLError("Forbidden", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      throw new GraphQLError(err.message || "Failed to fetch customers", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  async customerListPage(
    _,
    {
      restaurantId,
      search,
      includeGuests = true,
      customerKind = "ALL",
      customerRank,
      sortBy = "CREATED_AT",
      sortDirection = "DESC",
      limit = CUSTOMER_PAGE_LIMIT_DEFAULT,
      cursor,
    },
    ctx,
  ) {
    requireRole(ctx?.user, ["admin", "manager", "staff"]);
    await requirePermission(ctx, PERMISSIONS.CUSTOMER_READ);
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", { extensions: { code: "BAD_USER_INPUT" } });
    }
    await requireRestaurantAccess(ctx, restaurantId);

    const normalizedLimit = Math.min(
      CUSTOMER_PAGE_LIMIT_MAX,
      Math.max(1, Number(limit) || CUSTOMER_PAGE_LIMIT_DEFAULT),
    );
    const offset = decodeOffsetCursor(cursor);
    const customerRole = await Role.findOne({ slug: "customer" }).lean();
    const { finalCond, empty } = buildCustomerQueryCondition({
      restaurantId, search, includeGuests, customerKind, customerRoleId: customerRole?._id, customerRank,
    });
    if (empty) return { items: [], totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null, limit: normalizedLimit } };
    const dir = String(sortDirection).toUpperCase() === "ASC" ? 1 : -1;
    const sortMap = {
      CREATED_AT: { createdAt: dir, _id: dir },
      LAST_LOGIN_AT: { lastLoginAt: dir, _id: dir },
      TOTAL_SPENDING: { totalSpending: dir, _id: dir },
      TOTAL_ORDERS: { totalOrders: dir, _id: dir },
      LOYALTY_POINTS: { loyaltyPoints: dir, _id: dir },
      NAME: { fullName: dir, username: dir, _id: dir },
    };
    const sort = sortMap[sortBy] || sortMap.CREATED_AT;

    const totalCount = await Customer.countDocuments(finalCond);
    const items = await Customer.find(finalCond)
      .populate({ path: "role", select: "name slug" })
      .populate({ path: "refRestaurants", select: "name" })
      .sort(sort)
      .skip(offset)
      .limit(normalizedLimit)
      .lean();
    const nextOffset = offset + items.length;
    const hasNextPage = nextOffset < totalCount;
    const allowCustomerSensitive = await tryAdminSensitiveAccessWithAudit(ctx, {
      category: SENSITIVE_ACCESS.CUSTOMER_CONTACT,
      resourceType: "Customer",
      resourceId: "page",
      restaurantId,
    });
    const customerSensitiveOptions = {
      maskSensitive: isSystemAdmin(ctx?.user) && !allowCustomerSensitive,
      allowContact: allowCustomerSensitive,
      allowWallet: allowCustomerSensitive,
    };
    return {
      items: items.map((item) => sanitizeCustomerListUser(item, customerSensitiveOptions)),
      totalCount,
      pageInfo: {
        hasNextPage,
        endCursor: hasNextPage ? encodeOffsetCursor(nextOffset) : null,
        limit: normalizedLimit,
      },
    };
  },

  async staffPrivateProfile(_, { userId, restaurantId }, ctx) {
    const authUser = ctx?.user;
    requireRole(authUser, ["admin", "manager", "hr"]);
    if (!mongoose.isValidObjectId(userId)) {
      throw new GraphQLError("Invalid userId", { extensions: { code: "BAD_USER_INPUT" } });
    }
    if (restaurantId && !mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", { extensions: { code: "BAD_USER_INPUT" } });
    }

    const staff = await User.findById(toObjectId(userId))
      .populate({ path: "role", select: "name slug department permissions" })
      .populate({ path: "customerRestaurants", select: "name" })
      .lean();

    if (!staff || staff.deletedAt || String(staff.userType || "").toUpperCase() !== "STAFF") {
      throw new GraphQLError("Staff not found", { extensions: { code: "NOT_FOUND" } });
    }

    const targetRestaurantId = resolveStaffPrivateProfileScope(staff, restaurantId);
    if (isSystemAdmin(authUser)) {
      await requireAdminSensitiveAccess(ctx, {
        category: SENSITIVE_ACCESS.STAFF_INTERNAL,
        resourceType: "StaffPrivateProfile",
        resourceId: userId,
        restaurantId: targetRestaurantId,
      });
    }
    return sanitizeStaffPrivateProfile(staff, ctx, { restaurantId: targetRestaurantId });
  },
  async customerExportRows(
    _,
    { restaurantId, search, includeGuests = true, customerKind = "ALL", customerRank, sortBy = "CREATED_AT", sortDirection = "DESC", limit = CUSTOMER_EXPORT_LIMIT_DEFAULT },
    ctx,
  ) {
    requireRole(ctx?.user, ["admin", "manager", "staff"]);
    await requirePermission(ctx, PERMISSIONS.CUSTOMER_READ);
    if (!mongoose.isValidObjectId(restaurantId)) throw new GraphQLError("Invalid restaurantId", { extensions: { code: "BAD_USER_INPUT" } });
    await requireRestaurantAccess(ctx, restaurantId);
    const customerRole = await Role.findOne({ slug: "customer" }).lean();
    const { finalCond } = buildCustomerQueryCondition({
      restaurantId, search, includeGuests, customerKind, customerRoleId: customerRole?._id, customerRank,
    });
    const normalizedLimit = Math.min(CUSTOMER_EXPORT_LIMIT_MAX, Math.max(1, Number(limit) || CUSTOMER_EXPORT_LIMIT_DEFAULT));
    const dir = String(sortDirection).toUpperCase() === "ASC" ? 1 : -1;
    const sortMap = {
      CREATED_AT: { createdAt: dir, _id: dir }, LAST_LOGIN_AT: { lastLoginAt: dir, _id: dir }, TOTAL_SPENDING: { totalSpending: dir, _id: dir }, TOTAL_ORDERS: { totalOrders: dir, _id: dir }, LOYALTY_POINTS: { loyaltyPoints: dir, _id: dir }, NAME: { fullName: dir, username: dir, _id: dir },
    };
    const rows = await Customer.find(finalCond)
      .select("fullName username phone email loyaltyPoints totalOrders totalSpending isGuest lastLoginAt isOnline createdAt customerType refRestaurants role")
      .populate({ path: "role", select: "name slug" })
      .populate({ path: "refRestaurants", select: "name" })
      .sort(sortMap[sortBy] || sortMap.CREATED_AT)
      .limit(normalizedLimit)
      .lean();
    const allowCustomerSensitive = await tryAdminSensitiveAccessWithAudit(ctx, {
      category: SENSITIVE_ACCESS.CUSTOMER_CONTACT,
      resourceType: "CustomerExport",
      resourceId: restaurantId || "export",
      restaurantId,
    });
    if (!isSystemAdmin(ctx?.user)) return rows;
    return rows.map((item) => sanitizeCustomerListUser(item, {
      maskSensitive: !allowCustomerSensitive,
      allowContact: allowCustomerSensitive,
      allowWallet: allowCustomerSensitive,
    }));
  },

  async customerDetailAnalytics(_, { userId, restaurantId }, ctx) {
    const authUser = ctx?.user;
    requireRole(authUser, ["admin", "manager", "staff"]);
    if (!mongoose.isValidObjectId(userId)) {
      throw new GraphQLError("Invalid userId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const cond = {
      userId: toObjectId(userId),
    };
    if (restaurantId) {
      if (!mongoose.isValidObjectId(restaurantId)) {
        throw new GraphQLError("Invalid restaurantId", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const rid = toObjectId(restaurantId);
      await requireRestaurantAccess(ctx, rid);
      cond.restaurantId = rid;
    } else {
      const roleName = String(authUser?.roleName || "").toLowerCase();
      if (roleName !== "admin") {
        throw new GraphQLError("restaurantId is required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
    }

    const orders = await Order.find(cond)
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const dishMap = new Map();
    for (const o of orders) {
      for (const item of o.items || []) {
        const name = item?.name?.trim();
        if (!name) continue;
        const qty = Number(item?.quantity || 1);
        dishMap.set(name, (dishMap.get(name) || 0) + qty);
      }
    }

    const topDishes = [...dishMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([dishName, quantity]) => ({ dishName, quantity }));

    const userDoc = await User.findById(userId).lean();
    const loyaltyDurationScore = computeLoyaltyDurationScore(
      userDoc?.createdAt,
    );
    const rankPoints = computeRankPoints(userDoc?.totalSpending);

    return {
      userId,
      favoriteFoods: topDishes.map((x) => x.dishName),
      recentOrderCodes: orders
        .slice(0, 5)
        .map((x) => x.orderCode)
        .filter(Boolean),
      topDishes,
      loyaltyDurationScore,
      rankPoints,
    };
  },

  async customerListSummaries(
    _,
    { restaurantId, userIds = [], recentLimit = 5, topDishLimit = 3 },
    ctx,
  ) {
    const authUser = ctx?.user;
    requireRole(authUser, ["admin", "manager", "staff"]);
    await requirePermission(ctx, PERMISSIONS.CUSTOMER_READ);
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const rid = toObjectId(restaurantId);
    await requireRestaurantAccess(ctx, rid);

    const validUserIds = [...new Set((userIds || []).filter(mongoose.isValidObjectId))]
      .slice(0, 200)
      .map((id) => toObjectId(id));
    if (!validUserIds.length) return [];

    const safeRecentLimit = Math.min(Math.max(Number(recentLimit) || 5, 1), 10);
    const safeTopDishLimit = Math.min(Math.max(Number(topDishLimit) || 3, 1), 10);

    const orders = await Order.find({
      restaurantId: rid,
      userId: { $in: validUserIds },
    })
      .sort({ createdAt: -1 })
      .lean();

    const ordersByUserId = new Map();
    for (const o of orders) {
      const uid = String(o?.userId || "");
      if (!uid) continue;
      if (!ordersByUserId.has(uid)) ordersByUserId.set(uid, []);
      ordersByUserId.get(uid).push(o);
    }

    return validUserIds.map((id) => {
      const uid = String(id);
      const userOrders = ordersByUserId.get(uid) || [];
      const dishCount = new Map();
      for (const order of userOrders) {
        for (const item of order.items || []) {
          const name = item?.name?.trim();
          if (!name) continue;
          dishCount.set(name, (dishCount.get(name) || 0) + Number(item.quantity || 1));
        }
      }
      return {
        userId: uid,
        recentOrders: userOrders.slice(0, safeRecentLimit).map((o) => ({
          id: String(o?._id || o?.id || ""),
          orderCode: o?.orderCode || null,
          createdAt: o?.createdAt || null,
          amount: Number(o?.totals?.grandTotal || 0),
          items: (o?.items || []).map((it) => it?.name).filter(Boolean),
        })),
        topDishes: [...dishCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, safeTopDishLimit)
          .map(([dishName, quantity]) => ({ dishName, quantity })),
      };
    });
  },

  async customerAnalytics(_, { restaurantId }, ctx) {
    const authUser = ctx?.user;
    requireRole(authUser, ["admin", "manager", "staff"]);
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const rid = toObjectId(restaurantId);
    await requireRestaurantAccess(ctx, rid);

    const orders = await Order.find({
      restaurantId: rid,
      currentStatus: { $nin: ["cancelled", "failed", "draft"] },
    })
      .select(
        "restaurantId userId createdAt currentStatus orderPaymentStatus payment.status items.name items.quantity totals.grandTotal",
      )
      .lean();
    const dishes = new Map();
    const daily = new Map();
    const customerCountByUserId = new Map();
    const customerStats = new Map();
    let totalCustomerSpend = 0;
    const nowMs = Date.now();
    const oneDayMs = 1000 * 60 * 60 * 24;

    for (const o of orders) {
      const grandTotal = Number(o?.totals?.grandTotal || 0);
      if (Number.isFinite(grandTotal) && grandTotal >= 0) {
        totalCustomerSpend += grandTotal;
      }

      for (const item of o.items || []) {
        const name = item?.name?.trim();
        if (!name) continue;
        const quantity = Number(item?.quantity || 1);
        const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
        dishes.set(name, (dishes.get(name) || 0) + safeQuantity);
      }

      const d = new Date(o?.createdAt);
      const isValidCreatedAt = Number.isFinite(d.getTime());
      if (isValidCreatedAt) {
        const key = d.toISOString().slice(0, 10);
        daily.set(key, (daily.get(key) || 0) + 1);
      }

      if (o.userId) {
        const key = normalizeIdKey(o.userId);
        customerCountByUserId.set(
          key,
          (customerCountByUserId.get(key) || 0) + 1,
        );
        if (!customerStats.has(key)) {
          customerStats.set(key, {
            userId: key,
            totalOrders: 0,
            totalSpend: 0,
            firstOrderAt: null,
            lastOrderAt: null,
            orderDates: [],
          });
        }

        const stat = customerStats.get(key);
        stat.totalOrders += 1;
        if (Number.isFinite(grandTotal) && grandTotal >= 0) {
          stat.totalSpend += grandTotal;
        }
        if (isValidCreatedAt) {
          stat.orderDates.push(d);
          if (!stat.firstOrderAt || d < stat.firstOrderAt) stat.firstOrderAt = d;
          if (!stat.lastOrderAt || d > stat.lastOrderAt) stat.lastOrderAt = d;
        }
      }
    }

    const scopedCustomers = await Customer.find({
      customerRestaurants: { $in: [rid] },
    }).lean();
    const membershipDays =
      scopedCustomers.reduce(
        (sum, c) => sum + computeLoyaltyDurationScore(c.createdAt),
        0,
      ) || 0;
    const customerProfileMap = new Map(
      scopedCustomers.map((customer) => {
        const normalizedId = normalizeIdKey(customer?._id || customer?.id);
        const normalizedFullName = customer?.fullName || customer?.name || null;
        const normalizedPhone = customer?.phone || null;
        return [
          normalizedId,
          {
            fullName: normalizedFullName || null,
            phone: normalizedPhone || null,
          },
        ];
      }),
    );

    const totalOrderCount = orders.length;
    const averageOrderValue =
      totalOrderCount > 0 ? totalCustomerSpend / totalOrderCount : 0;
    const activeCustomerCount = customerCountByUserId.size;
    const returningCustomerCount = [...customerCountByUserId.values()].filter(
      (v) => v >= 2,
    ).length;

    const customerStatRows = [...customerStats.values()].map((stat) => {
      const daysSinceLastOrder = stat.lastOrderAt
        ? Math.max(0, Math.floor((nowMs - stat.lastOrderAt.getTime()) / oneDayMs))
        : 0;
      return {
        ...stat,
        daysSinceLastOrder,
      };
    });

    let intervalCount = 0;
    let intervalDaysTotal = 0;
    for (const stat of customerStatRows) {
      if (!Array.isArray(stat.orderDates) || stat.orderDates.length < 2) continue;
      const sortedDates = [...stat.orderDates].sort((a, b) => a - b);
      for (let i = 1; i < sortedDates.length; i += 1) {
        const diffMs = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
        if (Number.isFinite(diffMs) && diffMs >= 0) {
          intervalDaysTotal += diffMs / oneDayMs;
          intervalCount += 1;
        }
      }
    }
    const averageRepeatIntervalDays =
      intervalCount > 0 ? intervalDaysTotal / intervalCount : 0;

    const dormantCustomerCount = customerStatRows.filter(
      (stat) => stat.daysSinceLastOrder >= 45,
    ).length;

    const valueCustomers = customerStatRows
      .filter((stat) => Number(stat.totalSpend) > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend);
    const highValueCutoffCount = Math.ceil(valueCustomers.length * 0.2);
    const highValueCustomers = valueCustomers.slice(0, highValueCutoffCount);
    const highValueSet = new Set(highValueCustomers.map((c) => c.userId));
    const highValueCustomerCount = highValueSet.size;

    const churnRiskCustomers = customerStatRows
      .filter((stat) => stat.totalOrders >= 2 && stat.daysSinceLastOrder >= 30)
      .sort(
        (a, b) =>
          b.daysSinceLastOrder - a.daysSinceLastOrder ||
          b.totalSpend - a.totalSpend,
      )
      .slice(0, 10)
      .map((stat) => {
        const profile = customerProfileMap.get(stat.userId);
        return {
          userId: stat.userId,
          fullName: profile?.fullName || null,
          phone: profile?.phone || null,
          lastOrderAt: stat.lastOrderAt || null,
          daysSinceLastOrder: stat.daysSinceLastOrder,
          totalOrders: stat.totalOrders,
          totalSpend: stat.totalSpend,
        };
      });

    const topValueCustomers = [...valueCustomers]
      .sort(
        (a, b) =>
          b.totalSpend - a.totalSpend ||
          b.totalOrders - a.totalOrders ||
          (b.lastOrderAt?.getTime?.() || 0) - (a.lastOrderAt?.getTime?.() || 0),
      )
      .slice(0, 10)
      .map((stat) => {
        const profile = customerProfileMap.get(stat.userId);
        return {
          userId: stat.userId,
          fullName: profile?.fullName || null,
          phone: profile?.phone || null,
          totalOrders: stat.totalOrders,
          totalSpend: stat.totalSpend,
          averageOrderValue:
            stat.totalOrders > 0 ? stat.totalSpend / stat.totalOrders : 0,
          lastOrderAt: stat.lastOrderAt || null,
        };
      });

    const segmentConfigs = [
      { segmentKey: "NEW", segmentLabel: "Khách mới" },
      { segmentKey: "REPEAT", segmentLabel: "Khách quay lại" },
      { segmentKey: "DORMANT", segmentLabel: "Khách ngủ quên" },
      { segmentKey: "HIGH_VALUE", segmentLabel: "Khách giá trị cao" },
    ];
    const segmentCounts = {
      NEW: 0,
      REPEAT: 0,
      DORMANT: 0,
      HIGH_VALUE: 0,
    };
    for (const stat of customerStatRows) {
      if (stat.totalOrders === 1 && stat.daysSinceLastOrder < 45) segmentCounts.NEW += 1;
      if (stat.totalOrders >= 2 && stat.daysSinceLastOrder < 45) segmentCounts.REPEAT += 1;
      if (stat.daysSinceLastOrder >= 45) segmentCounts.DORMANT += 1;
      if (highValueSet.has(stat.userId)) segmentCounts.HIGH_VALUE += 1;
    }
    const customerSegments = segmentConfigs.map(({ segmentKey, segmentLabel }) => {
      const customerCount = segmentCounts[segmentKey] || 0;
      return {
        segmentKey,
        segmentLabel,
        customerCount,
        percentage:
          activeCustomerCount > 0
            ? (customerCount / activeCustomerCount) * 100
            : 0,
      };
    });

    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const cohortBuckets = new Map();
    for (const stat of customerStatRows) {
      if (!stat.firstOrderAt) continue;
      const cohortMonth = stat.firstOrderAt.toISOString().slice(0, 7);
      if (!cohortBuckets.has(cohortMonth)) {
        cohortBuckets.set(cohortMonth, {
          cohortMonth,
          cohortSize: 0,
          retainedCount: 0,
        });
      }
      const bucket = cohortBuckets.get(cohortMonth);
      bucket.cohortSize += 1;
      const retained = (stat.orderDates || []).some((orderDate) => {
        if (!orderDate || !Number.isFinite(orderDate.getTime())) return false;
        return orderDate.toISOString().slice(0, 7) > cohortMonth;
      });
      if (retained) bucket.retainedCount += 1;
    }
    const cohortRetention = [...cohortBuckets.values()]
      .filter((bucket) => bucket.cohortMonth !== currentMonthKey)
      .sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth))
      .slice(0, 6)
      .map((bucket) => ({
        cohortMonth: bucket.cohortMonth,
        cohortSize: bucket.cohortSize,
        retainedCount: bucket.retainedCount,
        retentionRate:
          bucket.cohortSize > 0
            ? (bucket.retainedCount / bucket.cohortSize) * 100
            : 0,
      }));

    const recommendations = [];
    if (activeCustomerCount === 0) {
      recommendations.push({
        key: "NEED_CUSTOMER_DATA",
        title: "Cần thêm dữ liệu khách hàng",
        description:
          "Khi có thêm đơn hàng và khách hàng, hệ thống sẽ tạo insight chính xác hơn.",
        priority: "LOW",
      });
    }
    if (
      activeCustomerCount > 0 &&
      returningCustomerCount / activeCustomerCount < 0.2
    ) {
      recommendations.push({
        key: "LOW_RETURNING_RATE",
        title: "Tỷ lệ quay lại thấp",
        description:
          "Cân nhắc tạo ưu đãi quay lại hoặc chăm sóc nhóm khách đã mua.",
        priority: "HIGH",
      });
    }
    if (dormantCustomerCount > 0) {
      recommendations.push({
        key: "DORMANT_CUSTOMERS",
        title: "Có khách lâu chưa quay lại",
        description: "Xem nhóm khách ngủ quên để tạo chiến dịch chăm sóc.",
        priority: "MEDIUM",
      });
    }
    const mostPopularDishes = [...dishes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([dishName, quantity]) => ({ dishName, quantity }));
    if (mostPopularDishes.length > 0) {
      recommendations.push({
        key: "POPULAR_DISH",
        title: "Món được quan tâm nổi bật",
        description: "Chuẩn bị tồn kho và nhân sự cho món đang được gọi nhiều.",
        priority: "LOW",
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        key: "STABLE_CUSTOMER_SIGNALS",
        title: "Tín hiệu khách hàng ổn định",
        description:
          "Tiếp tục theo dõi nhóm khách quay lại và món được quan tâm.",
        priority: "LOW",
      });
    }

    return {
      restaurantId,
      mostPopularDishes,
      busiestDays: [...daily.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([date, orderCount]) => ({ date, orderCount })),
      averageMembershipDays:
        scopedCustomers.length > 0
          ? Math.round(membershipDays / scopedCustomers.length)
          : 0,
      activeCustomerCount,
      returningCustomerCount,
      totalOrderCount,
      totalCustomerSpend,
      averageOrderValue,
      averageRepeatIntervalDays,
      dormantCustomerCount,
      highValueCustomerCount,
      customerSegments,
      churnRiskCustomers,
      topValueCustomers,
      cohortRetention,
      recommendations,
    };
  },

  async customerRankSettings(_, { restaurantId }, ctx) {
    const authUser = ctx?.user;
    requireRole(authUser, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const rid = toObjectId(restaurantId);
    await requireRestaurantAccess(ctx, rid);
    const setting = await getEffectiveCustomerRankSetting({ restaurantId: rid });
    return {
      restaurantId: setting.restaurantId,
      ranks: setting.ranks,
    };
  },

  async myWalletTransactions(
    _,
    { limit = 20, offset = 0 },
    { user: authUser },
  ) {
    if (!authUser?.id) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const rows = await WalletTransaction.find({
      userId: toObjectId(authUser.id),
    })
      .sort({ createdAt: -1, _id: -1 })
      .skip(safeOffset)
      .limit(safeLimit)
      .lean();
    return rows.map((row) => ({
      ...row,
      id: String(row._id),
      userId: String(row.userId),
    }));
  },
};
