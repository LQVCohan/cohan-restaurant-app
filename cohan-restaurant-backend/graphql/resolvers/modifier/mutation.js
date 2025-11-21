// src/graphql/resolvers/modifier/mutation.js

import { GraphQLError } from "graphql";
import { ModifierGroup, MenuItem } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";

export const ModifierMutation = {
  // ===== Group CRUD =====

  createModifierGroup: async (_, { input }, { user }) => {
    try {
      // requireRole(user, ["admin", "manager"]);
      const doc = await ModifierGroup.create(input);

      const result = await ModifierGroup.findById(doc._id).lean({
        virtuals: true,
      });
      return result;
    } catch (err) {
      console.error("❌ createModifierGroup error:", err);
      throw new GraphQLError(err.message || "Failed to create modifier group", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  // ✅ NEW: tạo ModifierGroup cho một MenuItem & gắn luôn vào món
  createModifierGroupForMenuItem: async (_, { input }, { user }) => {
    try {
      // requireRole(user, ["admin", "manager"]);
      const {
        menuItemId,
        restaurantId,
        name,
        selectionType,
        required,
        appliesTo,
        options,
      } = input;

      const menuItem = await MenuItem.findById(menuItemId);
      if (!menuItem) throw new GraphQLError("MenuItem not found");

      const restId = restaurantId || menuItem.restaurantId;
      if (!restId) throw new GraphQLError("restaurantId is required");

      const groupDoc = await ModifierGroup.create({
        restaurantId: restId,
        name: name || `Tuỳ chọn cho ${menuItem.name}`,
        selectionType: selectionType || "multiple",
        required: typeof required === "boolean" ? required : false,
        appliesTo: appliesTo || "item",
        options: options || [],
        isActive: true,
      });

      // Gắn group vào món
      await MenuItem.updateOne(
        { _id: menuItem._id },
        { $addToSet: { modifierGroupIds: groupDoc._id } }
      );

      const result = await ModifierGroup.findById(groupDoc._id).lean({
        virtuals: true,
      });
      return result;
    } catch (err) {
      console.error("❌ createModifierGroupForMenuItem error:", err);
      throw new GraphQLError(
        err.message || "Failed to create modifier group for menu item",
        {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        }
      );
    }
  },

  updateModifierGroup: async (_, { input }, { user }) => {
    requireRole(user, ["admin", "manager"]);
    const { id, ...rest } = input;
    const g = await ModifierGroup.findById(id);
    if (!g) throw new GraphQLError("ModifierGroup not found");
    Object.keys(rest).forEach((k) => {
      if (rest[k] !== undefined) g[k] = rest[k];
    });
    await g.save();
    return g.toObject();
  },

  deleteModifierGroup: async (_, { id }, { user }) => {
    requireRole(user, ["admin"]);
    // Có thể kiểm tra xem group đang được dùng ở món nào
    const used = await MenuItem.exists({ modifierGroupIds: id });
    if (used)
      throw new GraphQLError("Cannot delete: group is used by menu items");
    await ModifierGroup.findByIdAndDelete(id);
    return true;
  },

  // ===== Option CRUD =====
  addModifierOption: async (_, { groupId, option }) => {
    const g = await ModifierGroup.findById(groupId);
    if (!g) throw new GraphQLError("ModifierGroup not found");

    // nếu isDefault = true và selectionType=single, chỉ cho phép 1 default
    if (option.isDefault && g.selectionType === "single") {
      g.options.forEach((o) => (o.isDefault = false));
    }
    g.options.push(option);
    await g.save();
    return g.toObject();
  },

  updateModifierOption: async (_, { groupId, optionId, option }) => {
    const g = await ModifierGroup.findById(groupId);
    if (!g) throw new GraphQLError("ModifierGroup not found");

    const idx = g.options.findIndex((o) => String(o._id) === String(optionId));
    if (idx === -1) throw new GraphQLError("Option not found");

    // nếu set default trong single => reset các option khác
    if (option.isDefault && g.selectionType === "single") {
      g.options.forEach((o) => (o.isDefault = false));
    }

    const target = g.options[idx];
    ["name", "priceDelta", "isDefault", "recipe"].forEach((k) => {
      if (option[k] !== undefined) target[k] = option[k];
    });

    await g.save();
    return g.toObject();
  },

  removeModifierOption: async (_, { groupId, optionId }) => {
    const g = await ModifierGroup.findById(groupId);
    if (!g) throw new GraphQLError("ModifierGroup not found");
    g.options = g.options.filter((o) => String(o._id) !== String(optionId));
    await g.save();
    return g.toObject();
  },

  // ===== Liên kết món ↔ group =====
  setMenuItemModifierGroups: async (_, { input }) => {
    const { menuItemId, groupIds } = input;
    const unique = [...new Set(groupIds.map(String))];
    await MenuItem.updateOne(
      { _id: menuItemId },
      { $set: { modifierGroupIds: unique } }
    );
    return true;
  },

  attachMenuItemModifierGroups: async (_, { input }) => {
    const { menuItemId, groupIds } = input;
    await MenuItem.updateOne(
      { _id: menuItemId },
      { $addToSet: { modifierGroupIds: { $each: groupIds } } }
    );
    return true;
  },

  detachMenuItemModifierGroups: async (_, { input }) => {
    const { menuItemId, groupIds } = input;
    await MenuItem.updateOne(
      { _id: menuItemId },
      { $pull: { modifierGroupIds: { $in: groupIds } } }
    );
    return true;
  },
};
