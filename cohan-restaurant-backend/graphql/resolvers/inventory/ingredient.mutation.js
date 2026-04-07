import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  Ingredient,
  Order,
  IngredientRecent,
  IngredientCategory,
} from "../../../models/index.js";

function normalizeDupKeyError(err) {
  // Mongo duplicate key
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    const fieldText = fields.length ? fields.join(", ") : "unique field";
    return new GraphQLError(`Duplicate ${fieldText}`);
  }
  return err;
}

const ACTIVE_ORDER_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "customer_attached",
  "preparing",
  "ready",
  "served",
];

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveIngredientCategoryRef({
  restaurantId,
  ingredientCategoryId,
  category,
  fallbackIngredientCategoryId = null,
  fallbackCategory = "",
}) {
  const hasCategoryIdInput = ingredientCategoryId !== undefined;
  const hasCategoryNameInput = category !== undefined;

  if (!hasCategoryIdInput && !hasCategoryNameInput) {
    return {
      ingredientCategoryId: fallbackIngredientCategoryId || null,
      category: fallbackCategory || "",
    };
  }

  if (
    hasCategoryIdInput &&
    ingredientCategoryId &&
    !mongoose.isValidObjectId(ingredientCategoryId)
  ) {
    throw new GraphQLError("Invalid ingredientCategoryId");
  }

  if (ingredientCategoryId && mongoose.isValidObjectId(ingredientCategoryId)) {
    const cat = await IngredientCategory.findOne({
      _id: ingredientCategoryId,
      restaurantId,
      isActive: true,
    })
      .select({ _id: 1, name: 1 })
      .lean();

    if (!cat) throw new GraphQLError("Ingredient category not found");
    return { ingredientCategoryId: cat._id, category: cat.name };
  }

  const categoryName = String(category || "").trim();
  if (!categoryName) return { ingredientCategoryId: null, category: "" };

  const cat = await IngredientCategory.findOne({
    restaurantId,
    name: new RegExp(`^\\s*${escapeRegex(categoryName)}\\s*$`, "i"),
    isActive: true,
  })
    .select({ _id: 1, name: 1 })
    .lean();

  if (!cat) return { ingredientCategoryId: null, category: categoryName };
  return { ingredientCategoryId: cat._id, category: cat.name };
}

export default {
  createIngredient: async (_p, { input }) => {
    if (!mongoose.isValidObjectId(input?.restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    try {
      const categoryRef = await resolveIngredientCategoryRef({
        restaurantId: input.restaurantId,
        ingredientCategoryId: input.ingredientCategoryId,
        category: input.category,
      });
      const created = await Ingredient.create({
        ...input,
        ingredientCategoryId: categoryRef.ingredientCategoryId,
        category: categoryRef.category,
      });
      return created.toObject({ virtuals: true });
    } catch (err) {
      const e = normalizeDupKeyError(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "Create ingredient failed");
    }
  },

  updateIngredient: async (_p, { input }) => {
    const { id, ...patch } = input || {};
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    try {
      // 1) Load ingredient để lấy restaurantId (scope check đúng nhà hàng)
      const ing = await Ingredient.findById(id)
        .select({ _id: 1, restaurantId: 1, name: 1, category: 1, ingredientCategoryId: 1 })
        .lean();

      if (!ing) throw new GraphQLError("Ingredient not found");

      // 2) Check ingredient đang được dùng trong order nào không (active orders)
      const usedOrder = await Order.findOne({
        restaurantId: ing.restaurantId,
        currentStatus: { $in: ACTIVE_ORDER_STATUSES },
        "items.ingredientsSnapshot.ingredientId": ing._id,
      })
        .select({ orderCode: 1, tableCode: 1, currentStatus: 1 })
        .lean();

      if (usedOrder) {
        const code = usedOrder.orderCode || "unknown";
        const table = usedOrder.tableCode
          ? ` (bàn ${usedOrder.tableCode})`
          : "";
        throw new GraphQLError(
          `Không thể cập nhật nguyên liệu "${ing.name}" vì đang được sử dụng trong đơn ${code}${table} (status: ${usedOrder.currentStatus}).`
        );
      }

      // 3) Update nếu không bị dùng
      const categoryRef = await resolveIngredientCategoryRef({
        restaurantId: ing.restaurantId,
        ingredientCategoryId: patch.ingredientCategoryId,
        category: patch.category,
        fallbackIngredientCategoryId: ing.ingredientCategoryId,
        fallbackCategory: ing.category,
      });

      const doc = await Ingredient.findByIdAndUpdate(
        id,
        {
          $set: {
            ...patch,
            ingredientCategoryId: categoryRef.ingredientCategoryId,
            category: categoryRef.category,
          },
        },
        { new: true, runValidators: true }
      ).lean({ virtuals: true });

      if (!doc) throw new GraphQLError("Ingredient not found");
      return doc;
    } catch (err) {
      const e = normalizeDupKeyError(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "Update ingredient failed");
    }
  },

  deleteIngredient: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const res = await Ingredient.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },

  /**
   * ✅ FE gọi khi user chọn ingredient
   * -> lưu recent-used theo user+restaurant
   */
  recordIngredientUsed: async (_p, { restaurantId, ingredientId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    if (!mongoose.isValidObjectId(ingredientId)) {
      throw new GraphQLError("Invalid ingredientId");
    }

    const userIdRaw = ctx?.user?.id;
    if (!userIdRaw || !mongoose.isValidObjectId(userIdRaw)) {
      throw new GraphQLError("Unauthenticated", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const rid = new mongoose.Types.ObjectId(String(restaurantId));
    const iid = new mongoose.Types.ObjectId(String(ingredientId));
    const uid = new mongoose.Types.ObjectId(String(userIdRaw));

    // optional: verify ingredient belongs to restaurant
    const ing = await Ingredient.findOne({ _id: iid, restaurantId: rid })
      .select({ _id: 1 })
      .lean();
    if (!ing) throw new GraphQLError("Ingredient not found");

    await IngredientRecent.updateOne(
      { restaurantId: rid, userId: uid, ingredientId: iid },
      {
        $set: { lastUsedAt: new Date() },
        $inc: { times: 1 },
      },
      { upsert: true }
    );

    return true;
  },
};
