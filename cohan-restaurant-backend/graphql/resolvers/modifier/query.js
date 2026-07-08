import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  Menu,
  MenuItem,
  ModifierGroup,
} from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";
import { getPublicRestaurantOrThrow } from "../shared/restaurantCapabilityGuards.js";

const isValidId = (value) => mongoose.isValidObjectId(value);
const toId = (value) => new mongoose.Types.ObjectId(value);

const badInput = (message) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

const toCustomerModifierGroup = (group) => ({
  id: group?._id || group?.id,
  name: group?.name,
  selectionType: group?.selectionType,
  required: Boolean(group?.required),
  minSelected: Number(group?.minSelected || 0),
  maxSelected:
    group?.maxSelected == null ? null : Number(group.maxSelected),
  options: (group?.options || [])
    .filter((option) => option?.isActive !== false)
    .map((option) => ({
      id: option?._id || option?.id,
      name: option?.name,
      isDefault: Boolean(option?.isDefault),
      priceRule: {
        rule: option?.priceRule?.rule || "DELTA",
        amount: Number(option?.priceRule?.amount || 0),
      },
    })),
});

export const ModifierQuery = {
  customerModifierGroups: async (_, { restaurantId, menuItemId }) => {
    if (!isValidId(restaurantId) || !isValidId(menuItemId)) {
      throw badInput("Invalid restaurantId or menuItemId");
    }

    await getPublicRestaurantOrThrow(
      restaurantId,
      "Nhà hàng hiện chưa công khai.",
    );

    const menuItem = await MenuItem.findOne({
      _id: menuItemId,
      restaurantId,
      status: { $in: ["available", "out_of_stock"] },
    })
      .select({ menuId: 1 })
      .lean();
    if (!menuItem) return [];

    const activeMenu = await Menu.exists({
      _id: menuItem.menuId,
      restaurantId,
      isActive: true,
    });
    if (!activeMenu) return [];

    const groups = await ModifierGroup.find({
      restaurantId: toId(restaurantId),
      isActive: true,
      $or: [
        { coverage: "GLOBAL" },
        { coverage: "ITEMS", menuItemIds: toId(menuItemId) },
      ],
    })
      .sort({ name: 1, _id: 1 })
      .lean({ virtuals: true });

    return groups
      .map(toCustomerModifierGroup)
      .filter((group) => group.options.length > 0);
  },

  modifierGroups: async (_, { filter }, ctx) => {
    const {
      restaurantId,
      search,
      menuItemId,
      groupType,
      isActive,
    } = filter || {};

    if (!isValidId(restaurantId)) {
      throw badInput("Invalid restaurantId");
    }
    await requireRestaurantAccess(ctx, restaurantId);

    const query = { restaurantId: toId(restaurantId) };
    if (typeof isActive === "boolean") query.isActive = isActive;

    if (groupType) {
      const validGroupTypes = ["SIZE", "TOPPING", "PREPARATION", "CUSTOM"];
      if (!validGroupTypes.includes(groupType)) {
        throw badInput("Invalid groupType");
      }
      query.groupType = groupType;
    }

    if (search && String(search).trim()) {
      query.name = new RegExp(String(search).trim(), "i");
    }

    if (
      menuItemId !== undefined &&
      menuItemId !== null &&
      String(menuItemId).trim() !== ""
    ) {
      if (!isValidId(menuItemId)) throw badInput("Invalid menuItemId");
      const normalizedMenuItemId = toId(menuItemId);
      query.$or = [
        { coverage: "GLOBAL" },
        { coverage: "ITEMS", menuItemIds: normalizedMenuItemId },
      ];
    }

    return ModifierGroup.find(query)
      .sort({ name: 1, _id: 1 })
      .lean({ virtuals: true });
  },

  modifierGroup: async (_, { id }, ctx) => {
    if (!isValidId(id)) throw badInput("Invalid id");
    const existing = await ModifierGroup.findById(id)
      .select({ restaurantId: 1 })
      .lean();
    if (!existing) return null;
    await requireRestaurantAccess(ctx, existing.restaurantId);
    return ModifierGroup.findById(id).lean({ virtuals: true });
  },
};
