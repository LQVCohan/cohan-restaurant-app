// src/graphql/resolvers/user/query.js
import {
  User,
  Role,
  Customer,
  Order,
  CustomerRankSetting,
  WalletTransaction,
} from "../../../models/index.js";
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { requireRole } from "../../../utils/authz.js";
import { requireRestaurantAccess } from "../../guards.js";
import { requirePermission } from "../../../src/services/auth/authorization.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";

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

      return fullUser;
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

  async users(_, { roleId, isGuest, search }, { user: authUser }) {
    try {
      requireRole(authUser, ["admin"]);

      const cond = {};
      if (typeof isGuest === "boolean") cond.isGuest = isGuest;
      if (roleId) cond.role = toObjectId(roleId);

      const s = buildSearchCond(search);
      const finalCond = s ? { ...cond, ...s } : cond;

      const list = await User.find(finalCond)
        .populate({ path: "role", select: "name slug" })
        .sort({ createdAt: -1 })
        .lean();

      return list;
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
            refRestaurants: {
              $in: [toObjectId(scopedRestaurantId)],
            },
          }
        : {};

      const s = buildSearchCond(search);

      // Tìm role "customer"
      const customerRole = await Role.findOne({ slug: "customer" }).lean();

      if (!customerRole?._id) {
        const guestOnlyCond = {
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

        return guestOnly;
      }

      const customerCond = {
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

      return merged;
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
    const restaurantScopeCond = { refRestaurants: { $in: [toObjectId(restaurantId)] } };
    const searchCond = buildSearchCond(search);
    const customerRole = await Role.findOne({ slug: "customer" }).lean();

    const customerRoleClause = customerRole?._id ? { role: customerRole._id } : null;
    const guestClause = { isGuest: true };
    let kindClause = null;
    if (customerKind === "GUEST") {
      if (!includeGuests) {
        return { items: [], totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null, limit: normalizedLimit } };
      }
      kindClause = guestClause;
    } else if (customerKind === "REGISTERED") {
      kindClause = customerRoleClause || { _id: { $exists: false } };
    } else {
      if (includeGuests) kindClause = customerRoleClause ? { $or: [customerRoleClause, guestClause] } : guestClause;
      else kindClause = customerRoleClause || { _id: { $exists: false } };
    }

    const finalCond = { ...restaurantScopeCond, ...(searchCond || {}), ...kindClause };
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
    return {
      items,
      totalCount,
      pageInfo: {
        hasNextPage,
        endCursor: hasNextPage ? encodeOffsetCursor(nextOffset) : null,
        limit: normalizedLimit,
      },
    };
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

    const orders = await Order.find({ restaurantId: rid }).lean();
    const dishes = new Map();
    const daily = new Map();
    const customerCountByUserId = new Map();
    for (const o of orders) {
      for (const item of o.items || []) {
        const name = item?.name?.trim();
        if (!name) continue;
        dishes.set(name, (dishes.get(name) || 0) + Number(item.quantity || 1));
      }
      const d = new Date(o.createdAt);
      if (Number.isFinite(d.getTime())) {
        const key = d.toISOString().slice(0, 10);
        daily.set(key, (daily.get(key) || 0) + 1);
      }
      if (o.userId) {
        const key = normalizeIdKey(o.userId);
        customerCountByUserId.set(
          key,
          (customerCountByUserId.get(key) || 0) + 1,
        );
      }
    }

    const scopedCustomers = await Customer.find({
      refRestaurants: { $in: [rid] },
    }).lean();
    const membershipDays =
      scopedCustomers.reduce(
        (sum, c) => sum + computeLoyaltyDurationScore(c.createdAt),
        0,
      ) || 0;

    return {
      restaurantId,
      mostPopularDishes: [...dishes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([dishName, quantity]) => ({ dishName, quantity })),
      busiestDays: [...daily.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([date, orderCount]) => ({ date, orderCount })),
      averageMembershipDays:
        scopedCustomers.length > 0
          ? Math.round(membershipDays / scopedCustomers.length)
          : 0,
      activeCustomerCount: customerCountByUserId.size,
      returningCustomerCount: [...customerCountByUserId.values()].filter(
        (v) => v >= 2,
      ).length,
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
    const doc = await CustomerRankSetting.findOne({ restaurantId: rid }).lean();
    return (
      doc || {
        restaurantId,
        ranks: [
          { name: "Mới", minPoints: 0, benefits: "" },
          { name: "Thân thiết", minPoints: 5, benefits: "Ưu đãi dịp đặc biệt" },
          { name: "VIP", minPoints: 20, benefits: "Ưu tiên đặt bàn" },
        ],
      }
    );
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
