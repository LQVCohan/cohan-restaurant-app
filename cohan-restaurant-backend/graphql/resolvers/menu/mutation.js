// src/graphql/resolvers/menu/mutation.js
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Menu, MenuItem, Restaurant } from "../../../models/index.js";
function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapMethodsToPreparation(methods) {
  if (!Array.isArray(methods)) return [];
  return methods
    .filter((m) => m && typeof m.name === "string" && m.name.trim())
    .map((m) => ({
      name: m.name.trim(),
      price: toNumberOrNull(m.price) ?? 0,
      isDefault: !!m.isDefault,
    }));
}

function avgCookTimeFromMethods(methods) {
  if (!Array.isArray(methods) || methods.length === 0) return null;
  const nums = methods
    .map((m) => toNumberOrNull(m.cookTime))
    .filter((n) => n !== null && n >= 0);
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}
export const MenuMutation = {
  ensureMenu: async (_, { input }) => {
    const { restaurantId, timeSlot, name, description, coverImage } = input;
    const rest = await Restaurant.findById(restaurantId).lean();
    if (!rest) throw new GraphQLError("Restaurant not found");

    const doc = await Menu.findOneAndUpdate(
      { restaurantId, timeSlot },
      {
        $setOnInsert: {
          restaurantId,
          timeSlot,
          name: name || "Menu",
          description,
          coverImage,
          isActive: true,
        },
      },
      { new: true, upsert: true }
    ).lean({ virtuals: true });

    return doc;
  },

  createMenuItem: async (_, { input }) => {
    const {
      restaurantId,
      timeSlot,
      categoryId,
      methods,
      preparationMethods,
      basePrice,
    } = input;

    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(categoryId)
    ) {
      throw new GraphQLError("Invalid restaurantId or categoryId");
    }

    const menu = await Menu.findOneAndUpdate(
      { restaurantId, timeSlot },
      {
        $setOnInsert: { restaurantId, timeSlot, name: "Menu", isActive: true },
      },
      { new: true, upsert: true }
    ).lean();

    // Ưu tiên preparationMethods nếu FE đã gửi đúng schema; nếu không, map từ methods
    const prep =
      Array.isArray(preparationMethods) && preparationMethods.length
        ? preparationMethods.map((p) => ({
            name: String(p.name || "").trim(),
            price: toNumberOrNull(p.price) ?? 0,
            isDefault: !!p.isDefault,
          }))
        : mapMethodsToPreparation(methods);

    const docToCreate = {
      restaurantId,
      menuId: menu._id,
      categoryId,
      name: input.name,
      description: input.description,
      basePrice: toNumberOrNull(basePrice) ?? undefined,
      preparationMethods: prep,
      thumbImage: input.thumbImage,
      mediaAssetIds: input.mediaAssetIds,
      modifierGroupIds: input.modifierGroupIds,
      status: input.status,
      // Nếu FE không gửi avgPrepTimeMin riêng, ước lượng trung bình từ methods.cookTime
      avgPrepTimeMin:
        toNumberOrNull(input.avgPrepTimeMin) ??
        avgCookTimeFromMethods(methods) ??
        undefined,
      recipe: input.recipe,
      notes: input.notes,
    };

    const created = await MenuItem.create(docToCreate);

    // đọc lại dạng plain object kèm virtuals
    const doc = await MenuItem.findById(created._id).lean({
      virtuals: true,
      getters: true,
    });
    if (!Array.isArray(doc.preparationMethods)) doc.preparationMethods = [];
    return doc;
  },

  updateMenuItem: async (_, { input }) => {
    const item = await MenuItem.findById(input.id);
    if (!item) throw new GraphQLError("MenuItem not found");

    // Nếu FE gửi methods => map sang preparationMethods
    let nextPreparationMethods = null;
    if (Array.isArray(input.methods)) {
      nextPreparationMethods = mapMethodsToPreparation(input.methods);
    } else if (Array.isArray(input.preparationMethods)) {
      nextPreparationMethods = input.preparationMethods.map((p) => ({
        name: String(p.name || "").trim(),
        price: toNumberOrNull(p.price) ?? 0,
        isDefault: !!p.isDefault,
      }));
    }

    // Nếu FE không gửi avgPrepTimeMin nhưng có methods, suy ra trung bình cookTime
    const inferredAvgFromMethods = Array.isArray(input.methods)
      ? avgCookTimeFromMethods(input.methods)
      : null;

    const fields = [
      "categoryId",
      "name",
      "description",
      "thumbImage",
      "mediaAssetIds",
      "modifierGroupIds",
      "status",
      "recipe",
      "notes",
    ];
    for (const f of fields) {
      if (input[f] !== undefined) item[f] = input[f];
    }

    if (input.basePrice !== undefined) {
      item.basePrice = toNumberOrNull(input.basePrice);
    }

    if (nextPreparationMethods) {
      item.preparationMethods = nextPreparationMethods;
      item.markModified("preparationMethods");
    }

    if (input.avgPrepTimeMin !== undefined) {
      item.avgPrepTimeMin = toNumberOrNull(input.avgPrepTimeMin);
    } else if (inferredAvgFromMethods !== null) {
      item.avgPrepTimeMin = inferredAvgFromMethods;
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

    // Xây patch theo trường có truyền
    const patch = {};
    if (typeof name === "string") patch.name = name;
    if (typeof description === "string") patch.description = description;
    if (categoryId) patch.categoryId = categoryId;

    if (!Object.keys(patch).length) {
      // Không có gì để cập nhật → trả về bản ghi hiện tại
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
        const hasPreps =
          Array.isArray(it.preparationMethods) &&
          it.preparationMethods.length > 0;

        if (hasBase) {
          const oldPrice = Number(it.basePrice || 0);
          let newPrice =
            mode === "PERCENT" ? oldPrice * (1 + factor) : oldPrice + value;

          newPrice = rounder(newPrice);
          if (floorZero && newPrice < 0) newPrice = 0;

          console.log(`💰 BasePrice [${it.name}] ${oldPrice} → ${newPrice}`);
          it.basePrice = newPrice;
          await it.save();
          updated.push(it.toObject());
          continue;
        }

        if (hasPreps) {
          let changed = false;
          it.preparationMethods = it.preparationMethods.map((p) => {
            const old =
              typeof p.price === "number" && Number.isFinite(p.price)
                ? p.price
                : 0;
            let np = mode === "PERCENT" ? old * (1 + factor) : old + value;
            np = rounder(np);
            if (floorZero && np < 0) np = 0;
            if (np !== old) changed = true;
            return { ...(p.toObject?.() ?? p), price: np };
          });

          if (changed) {
            it.markModified("preparationMethods");
            console.log(
              `🛠️ PrepPrices [${it.name}] updated (${it.preparationMethods.length} methods)`
            );
            await it.save();
            updated.push(it.toObject());
          } else {
            console.log(`ℹ️ PrepPrices [${it.name}] no change`);
          }
          continue;
        }

        console.warn(
          `⚠️ [${it.name}] has no basePrice and no preparationMethods, skipped`
        );
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
