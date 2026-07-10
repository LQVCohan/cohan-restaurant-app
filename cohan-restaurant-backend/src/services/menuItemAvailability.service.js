import mongoose from "mongoose";
import { Ingredient, Recipe, StockItem, Warehouse } from "../../models/index.js";
import { checkAvailabilityForLinesTx } from "./inventory.service.js";

const INVENTORY_STATUS = {
  NOT_TRACKED: "NOT_TRACKED",
  IN_STOCK: "IN_STOCK",
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  ERROR: "ERROR",
};

const arr = (value) => (Array.isArray(value) ? value : []);
const toNum = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const normalizeKey = (value) => String(value || "").trim();

const resolveActiveWarehouseId = async (restaurantId) => {
  const warehouse = await Warehouse.findOne({ restaurantId, isActive: true })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  if (!warehouse?._id) throw new Error("Nhà hàng chưa có kho hoạt động.");
  return warehouse._id;
};

const resolveActiveRecipeVariant = async ({
  restaurantId,
  menuItemId,
  servingKey,
}) => {
  const recipe = await Recipe.findOne({
    restaurantId,
    menuItemId,
    isActive: true,
    deletedAt: null,
  })
    .select({ servingVariants: 1 })
    .lean();

  const variants = arr(recipe?.servingVariants);
  const requestedKey = normalizeKey(servingKey);
  const variant =
    (requestedKey
      ? variants.find(
          (candidate) => normalizeKey(candidate?.key) === requestedKey,
        )
      : null) ||
    variants.find((candidate) => candidate?.isDefault) ||
    variants[0] ||
    null;

  if (!recipe || !variant || !normalizeKey(variant.key)) {
    throw new Error("Món chưa có công thức và cách chế biến đang hoạt động.");
  }

  return { recipe, variant };
};

export async function getMenuItemVariantAvailability({
  restaurantId,
  menuItemId,
  servingKey,
  warehouseId,
}) {
  if (
    !mongoose.isValidObjectId(restaurantId) ||
    !mongoose.isValidObjectId(menuItemId)
  ) {
    throw new Error("Thiếu restaurantId hoặc menuItemId hợp lệ.");
  }

  const [{ variant }, resolvedWarehouseId] = await Promise.all([
    resolveActiveRecipeVariant({ restaurantId, menuItemId, servingKey }),
    warehouseId
      ? Promise.resolve(warehouseId)
      : resolveActiveWarehouseId(restaurantId),
  ]);

  const availability = await checkAvailabilityForLinesTx({
    restaurantId,
    warehouseId: resolvedWarehouseId,
    lines: [
      {
        menuItemId,
        quantity: 1,
        servingKey: normalizeKey(variant.key),
      },
    ],
  });

  return {
    ...availability,
    warehouseId: resolvedWarehouseId,
    servingVariantKey: normalizeKey(variant.key),
    variant,
  };
}

export async function getMenuItemInventoryAvailability({
  restaurantId,
  menuItemId,
}) {
  if (
    !mongoose.isValidObjectId(restaurantId) ||
    !mongoose.isValidObjectId(menuItemId)
  ) {
    return {
      inventoryStatus: INVENTORY_STATUS.ERROR,
      maxAvailable: 0,
      stockWarnings: ["Thiếu restaurantId hoặc menuItemId hợp lệ."],
      stockShortages: [],
    };
  }

  try {
    const availability = await getMenuItemVariantAvailability({
      restaurantId,
      menuItemId,
    });
    const ingredientLines = arr(availability.variant?.ingredients).filter(
      (line) => line?.ingredientId && toNum(line?.qty, 0) > 0,
    );

    if (!ingredientLines.length) {
      return {
        inventoryStatus: INVENTORY_STATUS.NOT_TRACKED,
        maxAvailable: 0,
        stockWarnings: ["Món chưa có định lượng nguyên liệu để kiểm tra tồn kho."],
        stockShortages: [],
      };
    }

    const ingredientIds = Array.from(
      new Set(ingredientLines.map((line) => String(line.ingredientId))),
    );
    const [ingredients, stockItems] = await Promise.all([
      Ingredient.find({
        _id: { $in: ingredientIds },
        restaurantId,
      })
        .select({ name: 1, baseUnit: 1, minStock: 1 })
        .lean(),
      StockItem.find({
        restaurantId,
        warehouseId: availability.warehouseId,
        ingredientId: { $in: ingredientIds },
      })
        .select({ ingredientId: 1, onHand: 1, reserved: 1 })
        .lean(),
    ]);

    const ingredientById = new Map(
      ingredients.map((ingredient) => [String(ingredient._id), ingredient]),
    );
    const stockByIngredientId = new Map(
      stockItems.map((stockItem) => [String(stockItem.ingredientId), stockItem]),
    );
    const shortageByIngredientId = new Map(
      arr(availability.shortages).map((shortage) => [
        String(shortage.ingredientId),
        shortage,
      ]),
    );

    const stockShortages = [];
    const lowStockWarnings = [];

    for (const ingredientId of ingredientIds) {
      const ingredient = ingredientById.get(ingredientId);
      const stockItem = stockByIngredientId.get(ingredientId);
      const available = Math.max(
        0,
        toNum(stockItem?.onHand, 0) - toNum(stockItem?.reserved, 0),
      );
      const shortage = shortageByIngredientId.get(ingredientId);

      if (shortage) {
        stockShortages.push({
          ingredientId,
          ingredientName: ingredient?.name || null,
          available: toNum(shortage.available, available),
          required: toNum(shortage.required, 0),
          missing: toNum(shortage.missing, 0),
          unit: ingredient?.baseUnit || null,
        });
        continue;
      }

      const minStock = toNum(ingredient?.minStock, 0);
      if (minStock > 0 && available <= minStock) {
        lowStockWarnings.push(
          `${ingredient?.name || "Nguyên liệu"} đang gần mức tối thiểu (${available}/${minStock} ${ingredient?.baseUnit || ""}).`,
        );
      }
    }

    const stockWarnings = [
      ...lowStockWarnings,
      ...stockShortages.map(
        (shortage) =>
          `${shortage.ingredientName || "Nguyên liệu"} thiếu ${shortage.missing} ${shortage.unit || ""} để bán 1 phần mặc định.`,
      ),
    ];
    const rawMaxAvailable = Number(availability.maxAvailable);
    const maxAvailable =
      Number.isFinite(rawMaxAvailable) &&
      rawMaxAvailable !== Number.MAX_SAFE_INTEGER
        ? Math.max(0, Math.floor(rawMaxAvailable))
        : 0;

    return {
      inventoryStatus: !availability.isAvailable
        ? INVENTORY_STATUS.OUT_OF_STOCK
        : lowStockWarnings.length
          ? INVENTORY_STATUS.LOW_STOCK
          : INVENTORY_STATUS.IN_STOCK,
      maxAvailable,
      stockWarnings,
      stockShortages,
    };
  } catch (error) {
    return {
      inventoryStatus: INVENTORY_STATUS.ERROR,
      maxAvailable: 0,
      stockWarnings: [error?.message || "Không thể kiểm tra tồn kho món."],
      stockShortages: [],
    };
  }
}

export { INVENTORY_STATUS as MENU_ITEM_INVENTORY_STATUS };
