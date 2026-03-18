// src/graphql/resolvers/user/query.js
import { User, Role, Customer } from "../../../models/index.js";
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
};
