// src/graphql/resolvers/modifier/query.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { ModifierGroup } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

const isValidId = (v) => mongoose.isValidObjectId(v);
const toId = (v) => new mongoose.Types.ObjectId(v);

export const ModifierQuery = {
  /**
   * GraphQL (new):
   * modifierGroups(filter: ModifierGroupFilterInput!): [ModifierGroup!]!
   *
   * filter:
   * - restaurantId (required)
   * - search (optional)
   * - menuItemId (optional): applicable groups = GLOBAL OR (ITEMS contains menuItemId)
   * - groupType (optional)
   * - isActive (optional, default true in schema)
   */
  modifierGroups: async (_, { filter }, ctx) => {
    const { restaurantId, search, menuItemId, groupType, isActive } =
      filter || {};

    if (!isValidId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    await requireRestaurantAccess(ctx, restaurantId);

    const q = { restaurantId: toId(restaurantId) };

    if (typeof isActive === "boolean") {
      q.isActive = isActive;
    }

    if (groupType) {
      const ok = ["SIZE", "TOPPING", "PREPARATION", "CUSTOM"].includes(
        groupType
      );
      if (!ok) {
        throw new GraphQLError("Invalid groupType", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      q.groupType = groupType;
    }

    if (search && String(search).trim()) {
      q.name = new RegExp(String(search).trim(), "i");
    }

    // applicable groups for a menu item:
    // - coverage=GLOBAL
    // - OR coverage=ITEMS with menuItemIds includes menuItemId
    if (
      menuItemId !== undefined &&
      menuItemId !== null &&
      String(menuItemId).trim() !== ""
    ) {
      if (!isValidId(menuItemId)) {
        throw new GraphQLError("Invalid menuItemId", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const mid = toId(menuItemId);
      q.$or = [{ coverage: "GLOBAL" }, { coverage: "ITEMS", menuItemIds: mid }];
    }

    return ModifierGroup.find(q).sort({ name: 1 }).lean({ virtuals: true });
  },

  modifierGroup: async (_, { id }, ctx) => {
    if (!isValidId(id)) {
      throw new GraphQLError("Invalid id", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const existing = await ModifierGroup.findById(id).select({ restaurantId: 1 }).lean();
    if (!existing) return null;
    await requireRestaurantAccess(ctx, existing.restaurantId);
    return ModifierGroup.findById(id).lean({ virtuals: true });
  },
};
