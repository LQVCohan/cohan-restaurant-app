// src/graphql/resolvers/restaurant/mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { User, Role, Restaurant } from "../../../models/index.js";

async function userHasRoleSlug(userDoc, slug) {
  const want = String(slug).toLowerCase();
  const role = userDoc.role || [];

  // TH1: đã populate => phần tử là object có slug/name
  const fromPopulated = role
    .filter((r) => r && typeof r === "object")
    .map((r) => (r.slug || r.name || "").toLowerCase());

  // TH2: phần tử là string slug (ít gặp)
  const stringRoles = role
    .filter((r) => typeof r === "string")
    .map((s) => s.toLowerCase());

  // TH3: phần tử là ObjectId => cần truy vấn Role để lấy slug
  const objectIds = role.filter((r) => mongoose.isValidObjectId(r));
  let fromIds = [];
  if (objectIds.length) {
    const roleDocs = await Role.find(
      { _id: { $in: objectIds } },
      { slug: 1, name: 1 }
    ).lean();
    fromIds = roleDocs.map((r) => (r.slug || r.name || "").toLowerCase());
  }

  const all = new Set([...fromPopulated, ...stringRoles, ...fromIds]);
  return all.has(want);
}

export const RestaurantMutation = {
  async createRestaurant(_, { input }) {
    try {
      const { managerId, ...rest } = input;

      // if (!mongoose.isValidObjectId(managerId)) {
      //   throw new GraphQLError("Invalid managerId", {
      //     extensions: { code: "BAD_USER_INPUT" },
      //   });
      // }

      // Lấy user (không cần populate, ta tự resolve)
      // const manager = await User.findById(managerId).lean();
      // if (!manager) {
      //   throw new GraphQLError("Manager not found", {
      //     extensions: { code: "BAD_USER_INPUT" },
      //   });
      // }

      // Kiểm tra user có role 'manager'
      // const isManager = await userHasRoleSlug(manager, "manager");
      // if (!isManager) {
      //   throw new GraphQLError("User is not a manager", {
      //     extensions: { code: "FORBIDDEN" },
      //   });
      // }

      // Đảm bảo 1 manager chỉ có 1 nhà hàng
      // const existed = await Restaurant.exists({ managerId });
      // if (existed) {
      //   throw new GraphQLError(
      //     "This manager is already assigned to another restaurant",
      //     {
      //       extensions: { code: "BAD_REQUEST" },
      //     }
      //   );
      // }

      const doc = await Restaurant.create({ ...rest, managerId });
      return doc.toObject(); // có virtual id
    } catch (err) {
      console.error("Error creating restaurant:", err);
      throw new GraphQLError(err.message || "Error creating restaurant", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },
};
