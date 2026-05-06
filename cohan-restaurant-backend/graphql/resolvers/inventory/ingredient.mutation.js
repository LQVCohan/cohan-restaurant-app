import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  Ingredient,
  Order,
  IngredientRecent,
  IngredientCategory,
  Recipe,
  MenuItem,
} from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

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
const ACTIVE_MENU_ITEM_STATUSES = ["available"];
const SOFT_DELETE_RETENTION_DAYS = 30;

function toObjectId(value) {
  return new mongoose.Types.ObjectId(String(value));
}

async function purgeExpiredIngredientsByRestaurant(restaurantId) {
  await Ingredient.deleteMany({
    restaurantId,
    deletedAt: { $ne: null },
    deleteExpiresAt: { $lte: new Date() },
  });
}

async function findBlockingActiveMenuItems({ ingredientId, restaurantId }) {
  const recipes = await Recipe.find({
    restaurantId,
    isActive: true,
    "servingVariants.ingredients.ingredientId": ingredientId,
  })
    .select({ menuItemId: 1 })
    .lean();

  const menuItemIds = [
    ...new Set(
      recipes
        .map((r) => r.menuItemId)
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => String(id))
    ),
  ];

  if (!menuItemIds.length) return [];

  return MenuItem.find({
    restaurantId,
    _id: { $in: menuItemIds.map((id) => toObjectId(id)) },
    status: { $in: ACTIVE_MENU_ITEM_STATUSES },
  })
    .select({ _id: 1, name: 1, status: 1 })
    .sort({ name: 1 })
    .lean();
}

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSku(input) {
  return String(input || "").trim().toLowerCase();
}

function normalizeCategoryScope({ ingredientCategoryId, category }) {
  if (ingredientCategoryId && mongoose.isValidObjectId(ingredientCategoryId)) {
    return `cat:${String(ingredientCategoryId)}`;
  }
  const normalizedCategory = normalizeText(category);
  if (!normalizedCategory) return "cat:none";
  return `cat-name:${normalizedCategory}`;
}

function resolveCategoryLabel({ category, ingredientCategoryId }) {
  if (String(category || "").trim()) return String(category).trim();
  if (ingredientCategoryId) return "Đã phân loại";
  return "Chưa phân loại";
}

async function assertIngredientBusinessUnique({
  restaurantId,
  excludeId = null,
  name,
  sku,
  ingredientCategoryId,
  category,
}) {
  const restaurantObjectId = new mongoose.Types.ObjectId(String(restaurantId));
  const matchScope = { restaurantId: restaurantObjectId };
  if (excludeId && mongoose.isValidObjectId(excludeId)) {
    matchScope._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
  }

  const normalizedSku = normalizeSku(sku);
  if (normalizedSku) {
    const skuRegex = new RegExp(`^\\s*${escapeRegex(String(sku).trim())}\\s*$`, "i");
    const existedSku = await Ingredient.findOne({
      ...matchScope,
      sku: skuRegex,
    })
      .select({ _id: 1, sku: 1, name: 1 })
      .lean();
    if (existedSku) {
      throw new GraphQLError(`SKU "${existedSku.sku}" đã tồn tại. Vui lòng dùng SKU khác.`, {
        extensions: { code: "DUPLICATE_INGREDIENT_SKU" },
      });
    }
  }

  const normalizedName = normalizeText(name);
  const targetScope = normalizeCategoryScope({ ingredientCategoryId, category });
  const candidates = await Ingredient.find(matchScope)
    .select({ _id: 1, name: 1, category: 1, ingredientCategoryId: 1, isActive: 1 })
    .lean();

  const existedName = candidates.find((item) => {
    const itemName = normalizeText(item?.name);
    if (!itemName || itemName !== normalizedName) return false;
    const itemScope = normalizeCategoryScope(item || {});
    return itemScope === targetScope;
  });

  if (existedName) {
    const categoryLabel = resolveCategoryLabel(existedName);
    throw new GraphQLError(
      `Nguyên liệu "${existedName.name}" đã tồn tại trong danh mục "${categoryLabel}". Vui lòng dùng tên khác hoặc chỉnh sửa bản ghi hiện có.`,
      { extensions: { code: "DUPLICATE_INGREDIENT_NAME" } }
    );
  }
}

const EN_CATEGORY_BY_ALIAS = {
  meat: "Meat",
  thit: "Meat",
  seafood: "Seafood",
  hai_san: "Seafood",
  vegetable: "Vegetable",
  rau_cu: "Vegetable",
  spice: "Spice",
  gia_vi: "Spice",
  starch: "Starch",
  tinh_bot: "Starch",
  dairy_egg: "Dairy & Egg",
  sua_trung: "Dairy & Egg",
  beverage: "Beverage",
  do_uong: "Beverage",
  other: "Other",
  khac: "Other",
};

function toEnglishCategoryName(input) {
  const alias = normalizeText(input).replace(/\s+/g, "_");
  if (EN_CATEGORY_BY_ALIAS[alias]) return EN_CATEGORY_BY_ALIAS[alias];
  return normalizeText(input)
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
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

  const categoryName = toEnglishCategoryName(category);
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
  createIngredient: async (_p, { input }, ctx) => {
    if (!mongoose.isValidObjectId(input?.restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    await requireRestaurantAccess(ctx, input.restaurantId);

    try {
      const categoryRef = await resolveIngredientCategoryRef({
        restaurantId: input.restaurantId,
        ingredientCategoryId: input.ingredientCategoryId,
        category: input.category,
      });
      await assertIngredientBusinessUnique({
        restaurantId: input.restaurantId,
        name: input.name,
        sku: input.sku,
        ingredientCategoryId: categoryRef.ingredientCategoryId,
        category: categoryRef.category,
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

  updateIngredient: async (_p, { input }, ctx) => {
    const { id, ...patch } = input || {};
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    try {
      // 1) Load ingredient để lấy restaurantId (scope check đúng nhà hàng)
      const ing = await Ingredient.findById(id)
        .select({ _id: 1, restaurantId: 1, name: 1, category: 1, ingredientCategoryId: 1 })
        .lean();

      if (!ing) throw new GraphQLError("Ingredient not found");
      await requireRestaurantAccess(ctx, ing.restaurantId);
      delete patch.restaurantId;

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
      await assertIngredientBusinessUnique({
        restaurantId: ing.restaurantId,
        excludeId: id,
        name: patch.name ?? ing.name,
        sku: patch.sku ?? ing.sku,
        ingredientCategoryId: categoryRef.ingredientCategoryId,
        category: categoryRef.category,
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

  deleteIngredient: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return false;

    const ing = await Ingredient.findById(id)
      .select({ _id: 1, restaurantId: 1, name: 1, deletedAt: 1 })
      .lean();
    if (!ing) return false;
    if (ing.deletedAt) return true;

    await requireRestaurantAccess(ctx, ing.restaurantId);
    await purgeExpiredIngredientsByRestaurant(ing.restaurantId);

    const activeMenuItems = await findBlockingActiveMenuItems({
      ingredientId: ing._id,
      restaurantId: ing.restaurantId,
    });

    if (activeMenuItems.length) {
      throw new GraphQLError(
        `Không thể xóa nguyên liệu "${ing.name}" vì đang được sử dụng trong các món ăn đang hoạt động.`,
        {
          extensions: {
            code: "INGREDIENT_IN_USE_ACTIVE_MENU_ITEMS",
            activeMenuItems: activeMenuItems.map((it) => ({
              id: String(it._id),
              name: it.name,
              status: it.status,
            })),
          },
        }
      );
    }

    const now = new Date();
    const deleteExpiresAt = new Date(
      now.getTime() + SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const res = await Ingredient.updateOne(
      { _id: ing._id, deletedAt: null },
      {
        $set: {
          deletedAt: now,
          deleteExpiresAt,
          isActive: false,
        },
      }
    );

    return res.modifiedCount > 0;
  },

  restoreIngredient: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return null;
    const now = new Date();
    const existing = await Ingredient.findById(id)
      .select({ restaurantId: 1, deletedAt: 1, deleteExpiresAt: 1 })
      .lean();
    if (!existing) {
      throw new GraphQLError(
        "Không thể khôi phục nguyên liệu. Bản ghi đã bị xóa vĩnh viễn hoặc đã hết hạn khôi phục."
      );
    }

    await requireRestaurantAccess(ctx, existing.restaurantId);

    const restored = await Ingredient.findOneAndUpdate(
      {
        _id: id,
        deletedAt: { $ne: null },
        deleteExpiresAt: { $gt: now },
      },
      {
        $set: { isActive: true },
        $unset: { deletedAt: 1, deleteExpiresAt: 1, deletedBy: 1 },
      },
      { new: true }
    ).lean({ virtuals: true });

    if (!restored) {
      throw new GraphQLError(
        "Không thể khôi phục nguyên liệu. Bản ghi đã bị xóa vĩnh viễn hoặc đã hết hạn khôi phục."
      );
    }
    return restored;
  },

  deleteIngredientPermanently: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const existing = await Ingredient.findById(id)
      .select({ restaurantId: 1, deletedAt: 1 })
      .lean();
    if (!existing) return false;

    await requireRestaurantAccess(ctx, existing.restaurantId);

    const res = await Ingredient.deleteOne({
      _id: id,
      deletedAt: { $ne: null },
    });
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

    await requireRestaurantAccess(ctx, restaurantId);

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
