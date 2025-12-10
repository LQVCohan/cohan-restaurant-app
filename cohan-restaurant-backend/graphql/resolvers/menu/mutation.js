// src/graphql/resolvers/menu/mutation.js
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Menu, MenuItem, Restaurant } from "../../../models/index.js";

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const MenuMutation = {
  // ================================
  // ENSURE MENU (CREATE / UPDATE)
  // ================================
  ensureMenu: async (_, { input }) => {
    const {
      restaurantId,
      timeSlot,
      name,
      description,
      coverImage,
      isActive,
      categoryMenuId,
    } = input;
    console.log(
      "🔥 [ensureMenu] restaurantId=",
      restaurantId,
      "timeSlot=",
      timeSlot,
      "name=",
      name,
      "description=",
      description,
      "coverImage=",
      coverImage,
      "isActive=",
      isActive,
      "categoryMenuId=",
      categoryMenuId
    );
    // check restaurant tồn tại
    const rest = await Restaurant.findById(restaurantId).lean();
    if (!rest) throw new GraphQLError("Restaurant not found");

    // validate categoryMenuId nếu được truyền
    if (categoryMenuId && !mongoose.isValidObjectId(categoryMenuId)) {
      throw new GraphQLError("Invalid categoryMenuId");
    }

    // tìm menu hiện có cho (restaurantId, timeSlot)
    let menu = await Menu.findOne({ restaurantId, timeSlot });

    if (menu) {
      // ✅ UPDATE: chỉ ghi đè field nào được truyền vào input
      if (name !== undefined && name !== null) menu.name = name;
      if (description !== undefined) menu.description = description;
      if (coverImage !== undefined) menu.coverImage = coverImage;
      if (typeof isActive === "boolean") menu.isActive = isActive;
      if (categoryMenuId !== undefined) menu.categoryMenuId = categoryMenuId;

      await menu.save();
      return menu.toObject();
    }

    // ✅ CREATE mới nếu chưa có
    const docToCreate = {
      restaurantId,
      timeSlot,
      name: name || "Menu",
      description,
      coverImage,
      isActive: typeof isActive === "boolean" ? isActive : true,
    };

    if (categoryMenuId) {
      docToCreate.categoryMenuId = categoryMenuId;
    }

    const created = await Menu.create(docToCreate);
    return created.toObject();
  },

  // ================================
  // MENU ITEM CRUD
  // ================================
  createMenuItem: async (_, { input }) => {
    const { restaurantId, timeSlot, categoryId, basePrice, avgPrepTimeMin } =
      input;

    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(categoryId)
    ) {
      throw new GraphQLError("Invalid restaurantId or categoryId");
    }

    const menu = await Menu.findOneAndUpdate(
      { restaurantId, timeSlot },
      {
        $setOnInsert: {
          restaurantId,
          timeSlot,
          name: "Menu",
          isActive: true,
        },
      },
      { new: true, upsert: true }
    ).lean();

    const docToCreate = {
      restaurantId,
      menuId: menu._id,
      categoryId,
      name: input.name,
      description: input.description,
      basePrice: toNumberOrNull(basePrice) ?? undefined,
      thumbImage: input.thumbImage,
      mediaAssetIds: input.mediaAssetIds,
      modifierGroupIds: input.modifierGroupIds,
      status: input.status,
      byWeight:
        typeof input.byWeight === "boolean" ? input.byWeight : undefined,
      avgPrepTimeMin: toNumberOrNull(avgPrepTimeMin) ?? undefined,
      notes: input.notes,
    };

    const created = await MenuItem.create(docToCreate);

    const doc = await MenuItem.findById(created._id).lean({
      virtuals: true,
      getters: true,
    });

    return doc;
  },

  updateMenuItem: async (_, { input }) => {
    const item = await MenuItem.findById(input.id);
    if (!item) throw new GraphQLError("MenuItem not found");

    const fields = [
      "categoryId",
      "name",
      "description",
      "thumbImage",
      "mediaAssetIds",
      "modifierGroupIds",
      "status",
      "notes",
    ];
    for (const f of fields) {
      if (input[f] !== undefined) item[f] = input[f];
    }

    if (input.basePrice !== undefined) {
      item.basePrice = toNumberOrNull(input.basePrice);
    }

    if (typeof input.byWeight === "boolean") {
      item.byWeight = input.byWeight;
    }

    if (input.avgPrepTimeMin !== undefined) {
      item.avgPrepTimeMin = toNumberOrNull(input.avgPrepTimeMin);
    }

    await item.save();
    return item.toObject();
  },

  deleteMenuItem: async (_, { id }) => {
    await MenuItem.findByIdAndDelete(id);
    return true;
  },

  updateMenuItemBasic: async (_p, { input }) => {
    const { restaurantId, menuItemId, name, description, categoryId } = input;
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId)) {
      throw new GraphQLError("Invalid ids");
    }
    if (categoryId && !mongoose.isValidObjectId(categoryId)) {
      throw new GraphQLError("Invalid categoryId");
    }

    const patch = {};
    if (typeof name === "string") patch.name = name;
    if (typeof description === "string") patch.description = description;
    if (categoryId) patch.categoryId = categoryId;

    if (!Object.keys(patch).length) {
      const doc = await MenuItem.findOne({
        _id: menuItemId,
        restaurantId,
      }).lean({ virtuals: true });
      if (!doc) throw new GraphQLError("MenuItem not found");
      return doc;
    }

    const doc = await MenuItem.findOneAndUpdate(
      { _id: menuItemId, restaurantId },
      { $set: patch },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });

    if (!doc) throw new GraphQLError("MenuItem not found");
    return doc;
  },

  toggleMenuItemStatus: async (_, { id, status }) => {
    const item = await MenuItem.findById(id);
    if (!item) throw new GraphQLError("MenuItem not found");
    item.status = status;
    await item.save();
    return item.toObject();
  },

  bulkUpdateMenuItemPrices: async (_, { input }) => {
    try {
      console.log("📦 [bulkUpdateMenuItemPrices] Input:", input);

      const {
        restaurantId,
        timeSlot,
        target,
        mode,
        value,
        roundTo = 0,
        floorZero = true,
      } = input;

      if (!mongoose.isValidObjectId(restaurantId)) {
        throw new GraphQLError("Invalid restaurantId");
      }
      if (
        !target ||
        (!target.categoryId && !Array.isArray(target.menuItemIds))
      ) {
        throw new GraphQLError("Provide categoryId or menuItemIds");
      }
      if (mode !== "PERCENT" && mode !== "AMOUNT") {
        throw new GraphQLError("mode must be PERCENT or AMOUNT");
      }
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new GraphQLError("value must be a number");
      }

      let menuId = null;
      if (timeSlot) {
        const menu = await Menu.findOne({ restaurantId, timeSlot }).lean();
        if (!menu) {
          console.warn("⚠️ No menu found for restaurant/timeSlot");
          return { updatedCount: 0, items: [] };
        }
        menuId = menu._id;
      }

      const q = { restaurantId };
      if (menuId) q.menuId = menuId;

      if (target.categoryId) {
        if (!mongoose.isValidObjectId(target.categoryId)) {
          throw new GraphQLError("Invalid categoryId");
        }
        q.categoryId = target.categoryId;
      }

      if (Array.isArray(target.menuItemIds) && target.menuItemIds.length > 0) {
        const validIds = target.menuItemIds.filter((id) =>
          mongoose.isValidObjectId(id)
        );
        if (validIds.length === 0) {
          console.warn("⚠️ menuItemIds provided but none valid");
          return { updatedCount: 0, items: [] };
        }
        q._id = { $in: validIds };
      }

      console.log("🧾 Query:", q);
      const items = await MenuItem.find(q);
      console.log("🔢 Items found:", items.length);
      if (!items.length) return { updatedCount: 0, items: [] };

      const factor = mode === "PERCENT" ? value / 100 : null;
      const rounder =
        typeof roundTo === "number" && roundTo >= 0
          ? (n) => {
              const p = Math.pow(10, roundTo);
              return Math.round(n * p) / p;
            }
          : (n) => n;

      const updated = [];

      for (const it of items) {
        const hasBase =
          typeof it.basePrice === "number" &&
          Number.isFinite(it.basePrice) &&
          it.basePrice > 0;

        if (!hasBase) {
          console.warn(
            `⚠️ [${it.name}] has no basePrice, skipped in bulkUpdate`
          );
          continue;
        }

        const oldPrice = Number(it.basePrice || 0);
        let newPrice =
          mode === "PERCENT" ? oldPrice * (1 + factor) : oldPrice + value;

        newPrice = rounder(newPrice);
        if (floorZero && newPrice < 0) newPrice = 0;

        console.log(`💰 BasePrice [${it.name}] ${oldPrice} → ${newPrice}`);
        it.basePrice = newPrice;
        await it.save();
        updated.push(it.toObject());
      }

      console.log("✅ Updated total:", updated.length);
      return { updatedCount: updated.length, items: updated };
    } catch (err) {
      console.error("❌ [bulkUpdateMenuItemPrices] Error:", err);
      throw new GraphQLError(err.message || "Bulk update failed", {
        extensions: { code: "INTERNAL_SERVER_ERROR", details: err.stack },
      });
    }
  },
};
