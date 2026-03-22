// src/graphql/resolvers/user/query.js
import {
  User,
  Role,
  Customer,
  Order,
  CustomerRankSetting,
} from "../../../models/index.js";
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { requireRole } from "../../../utils/authz.js";

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
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

const ONLINE_MINUTES = 5;
const VND_PER_RANK_POINT = 1_000_000;

function computeLoyaltyDurationScore(createdAt) {
  const createdMs = new Date(createdAt || 0).getTime();
  if (!Number.isFinite(createdMs) || createdMs <= 0) return 0;
  const days = Math.max(
    0,
    Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24))
  );
  return days;
}

function computeRankPoints(totalSpending) {
  return Math.max(0, Math.floor((Number(totalSpending) || 0) / VND_PER_RANK_POINT));
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
      // Cho phép admin/manager xem role list (tuỳ chính sách của bạn)
      requireRole(authUser, ["admin", "manager"]);

      const list = await Role.find({}).sort({ createdAt: 1 }).lean();
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
      requireRole(authUser, ["admin", "manager"]);

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
  async customers(_, { search, includeGuests = true }, { user: authUser }) {
    try {
      // Cho phép admin, manager, staff
      requireRole(authUser, ["admin", "manager", "staff"]);

      // Tìm role "customer"
      const customerRole = await Role.findOne({ slug: "customer" }).lean();
      const staffRestaurantId =
        authUser?.restaurantForStaff || authUser?.primaryRestaurantId || null;
      const isStaff = String(authUser?.roleName || "").toLowerCase() === "staff";

      const restaurantScopeCond =
        isStaff && mongoose.isValidObjectId(staffRestaurantId)
          ? {
              refRestaurants: {
                $in: [toObjectId(staffRestaurantId)],
              },
            }
          : {};

      if (!customerRole?._id) {
        // Không có role "customer" thì chỉ có thể trả về guest (nếu includeGuests)
        const s = buildSearchCond(search);
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

      const s = buildSearchCond(search);

      // 1) Customers theo role
      const customerCond = {
        role: customerRole._id,
        ...(s || {}),
        ...restaurantScopeCond,
      };
      const roleCustomers = await Customer.find(customerCond)
        .populate({ path: "role", select: "name slug" })
        .sort({ createdAt: -1 })
        .lean();

      // 2) Guests nếu cần
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

      // 3) Merge & unique theo id
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
      throw new GraphQLError(err.message || "Failed to fetch customers", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  async customerDetailAnalytics(_, { userId, restaurantId }, { user: authUser }) {
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
      cond.restaurantId = toObjectId(restaurantId);
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
    const loyaltyDurationScore = computeLoyaltyDurationScore(userDoc?.createdAt);
    const rankPoints = computeRankPoints(userDoc?.totalSpending);

    return {
      userId,
      favoriteFoods: topDishes.map((x) => x.dishName),
      recentOrderCodes: orders.slice(0, 5).map((x) => x.orderCode).filter(Boolean),
      topDishes,
      loyaltyDurationScore,
      rankPoints,
    };
  },

  async customerAnalytics(_, { restaurantId }, { user: authUser }) {
    requireRole(authUser, ["admin", "manager", "staff"]);
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const rid = toObjectId(restaurantId);

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
        const key = String(o.userId);
        customerCountByUserId.set(key, (customerCountByUserId.get(key) || 0) + 1);
      }
    }

    const scopedCustomers = await Customer.find({
      refRestaurants: { $in: [rid] },
    }).lean();
    const membershipDays =
      scopedCustomers.reduce(
        (sum, c) => sum + computeLoyaltyDurationScore(c.createdAt),
        0
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
        (v) => v >= 2
      ).length,
    };
  },

  async customerRankSettings(_, { restaurantId }, { user: authUser }) {
    requireRole(authUser, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const rid = toObjectId(restaurantId);
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
};
