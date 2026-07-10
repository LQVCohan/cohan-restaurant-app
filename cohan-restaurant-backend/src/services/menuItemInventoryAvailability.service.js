import mongoose from "mongoose";
import { Ingredient, Recipe, StockItem, Warehouse } from "../../models/index.js";

const DEFAULT_EDGES = [
  { from: "kg", to: "g", ratio: 1000 },
  { from: "g", to: "kg", ratio: 1 / 1000 },
  { from: "l", to: "ml", ratio: 1000 },
  { from: "ml", to: "l", ratio: 1 / 1000 },
];

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
const str = (value) => (value == null ? "" : String(value));

const ceilInt = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.ceil(number - 1e-9);
};

const buildAdj = (conversions = []) => {
  const edges = [...DEFAULT_EDGES];

  for (const conversion of arr(conversions)) {
    const from = str(conversion?.from).trim();
    const to = str(conversion?.to).trim();
    const ratio = toNum(conversion?.ratio, null);
    if (!from || !to || !(ratio > 0)) continue;
    edges.push({ from, to, ratio });
    edges.push({ from: to, to: from, ratio: 1 / ratio });
  }

  const adj = new Map();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from).push({ to: edge.to, ratio: edge.ratio });
  }
  return adj;
};

const findMultiplier = (fromUnit, toUnit, conversions = []) => {
  const from = str(fromUnit).trim();
  const to = str(toUnit).trim();
  if (!from || !to) return null;
  if (from === to) return 1;

  const adj = buildAdj(conversions);
  const queue = [{ unit: from, multiplier: 1 }];
  const seen = new Set([from]);

  while (queue.length) {
    const current = queue.shift();
    const next = adj.get(current.unit) || [];
    for (const edge of next) {
      if (seen.has(edge.to)) continue;
      const multiplier = current.multiplier * edge.ratio;
      if (edge.to === to) return multiplier;
      seen.add(edge.to);
      queue.push({ unit: edge.to, multiplier });
    }
  }

  return null;
};

const convertToBase = (qty, fromUnit, ingredient) => {
  const quantity = toNum(qty, null);
  if (!(quantity > 0)) return 0;

  const baseUnit = str(ingredient?.baseUnit).trim();
  const sourceUnit = str(fromUnit || baseUnit).trim();
  if (!baseUnit) return null;

  const multiplier = findMultiplier(sourceUnit, baseUnit, ingredient?.conversions || []);
  if (multiplier == null) return null;
  return quantity * multiplier;
};

const getDefaultVariant = (recipe) => {
  const variants = arr(recipe?.servingVariants);
  return variants.find((variant) => variant?.isDefault) || variants[0] || null;
};

const buildRequiredByIngredient = async ({ restaurantId, menuItemId }) => {
  const recipe = await Recipe.findOne({
    restaurantId,
    menuItemId,
    isActive: true,
  })
    .select({ servingVariants: 1 })
    .lean();

  const variant = getDefaultVariant(recipe);
  const ingredientLines = arr(variant?.ingredients).filter(
    (line) => line?.ingredientId && toNum(line?.qty, 0) > 0,
  );

  if (!recipe || !variant || !ingredientLines.length) {
    return { tracked: false, variant: variant || null, required: [] };
  }

  const ingredientIds = Array.from(
    new Set(ingredientLines.map((line) => String(line.ingredientId))),
  );

  const ingredients = await Ingredient.find({
    _id: { $in: ingredientIds },
    restaurantId,
  })
    .select({ name: 1, baseUnit: 1, conversions: 1, minStock: 1 })
    .lean();

  const ingredientById = new Map(ingredients.map((ingredient) => [String(ingredient._id), ingredient]));
  const requiredById = new Map();
  const conversionWarnings = [];

  for (const line of ingredientLines) {
    const ingredientId = String(line.ingredientId);
    const ingredient = ingredientById.get(ingredientId);

    if (!ingredient) {
      conversionWarnings.push(`Không tìm thấy nguyên liệu ${ingredientId}.`);
      continue;
    }

    const baseQty = convertToBase(line.qty, line.unit || ingredient.baseUnit, ingredient);
    if (baseQty == null) {
      conversionWarnings.push(
        `Thiếu quy đổi đơn vị ${line.unit || "?"} → ${ingredient.baseUnit} cho ${ingredient.name}.`,
      );
      continue;
    }

    const required = ceilInt(baseQty * (1 + toNum(line.wastePct, 0) / 100));
    if (!(required > 0)) continue;

    const current = requiredById.get(ingredientId) || {
      ingredientId,
      ingredientName: ingredient.name,
      unit: ingredient.baseUnit,
      minStock: toNum(ingredient.minStock, 0),
      required: 0,
    };
    current.required += required;
    requiredById.set(ingredientId, current);
  }

  return {
    tracked: requiredById.size > 0,
    variant,
    required: Array.from(requiredById.values()),
    conversionWarnings,
  };
};

const resolveActiveWarehouseId = async (restaurantId) => {
  const warehouse = await Warehouse.findOne({ restaurantId, isActive: true })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  if (!warehouse?._id) throw new Error("Nhà hàng chưa có kho hoạt động.");
  return warehouse._id;
};

const getAvailableStockByIngredient = async ({
  restaurantId,
  warehouseId,
  ingredientIds,
}) => {
  if (!ingredientIds.length) return new Map();

  const rows = await StockItem.aggregate([
    {
      $match: {
        restaurantId: new mongoose.Types.ObjectId(restaurantId),
        warehouseId: new mongoose.Types.ObjectId(warehouseId),
        ingredientId: {
          $in: ingredientIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      },
    },
    {
      $group: {
        _id: "$ingredientId",
        onHand: { $sum: { $ifNull: ["$onHand", 0] } },
        reserved: { $sum: { $ifNull: ["$reserved", 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        ingredientId: "$_id",
        available: { $max: [{ $subtract: ["$onHand", "$reserved"] }, 0] },
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row.ingredientId), toNum(row.available, 0)]));
};

export async function getMenuItemInventoryAvailability({ restaurantId, menuItemId }) {
  if (!mongoose.isValidObjectId(restaurantId) || !mongoose.isValidObjectId(menuItemId)) {
    return {
      inventoryStatus: INVENTORY_STATUS.ERROR,
      maxAvailable: 0,
      stockWarnings: ["Thiếu restaurantId hoặc menuItemId hợp lệ."],
      stockShortages: [],
    };
  }

  try {
    const requiredState = await buildRequiredByIngredient({ restaurantId, menuItemId });
    if (!requiredState.tracked) {
      return {
        inventoryStatus: INVENTORY_STATUS.NOT_TRACKED,
        maxAvailable: 0,
        stockWarnings: ["Món chưa có recipe/nguyên liệu để kiểm tra tồn kho."],
        stockShortages: [],
      };
    }

    const required = requiredState.required;
    const warehouseId = await resolveActiveWarehouseId(restaurantId);
    const availableMap = await getAvailableStockByIngredient({
      restaurantId,
      warehouseId,
      ingredientIds: required.map((line) => line.ingredientId),
    });

    const shortages = [];
    const lowStockWarnings = [];
    let maxAvailable = Number.MAX_SAFE_INTEGER;

    for (const line of required) {
      const available = Math.max(0, toNum(availableMap.get(line.ingredientId), 0));
      const requiredQty = Math.max(0, toNum(line.required, 0));
      const maxByIngredient = requiredQty > 0 ? Math.floor(available / requiredQty) : 0;
      if (maxByIngredient < maxAvailable) maxAvailable = maxByIngredient;

      if (available < requiredQty) {
        shortages.push({
          ingredientId: line.ingredientId,
          ingredientName: line.ingredientName,
          available,
          required: requiredQty,
          missing: requiredQty - available,
          unit: line.unit,
        });
      } else if (line.minStock > 0 && available <= line.minStock) {
        lowStockWarnings.push(
          `${line.ingredientName} đang gần mức tối thiểu (${available}/${line.minStock} ${line.unit}).`,
        );
      }
    }

    if (maxAvailable === Number.MAX_SAFE_INTEGER) maxAvailable = 0;

    const warnings = [
      ...(requiredState.conversionWarnings || []),
      ...lowStockWarnings,
      ...shortages.map(
        (line) =>
          `${line.ingredientName} thiếu ${line.missing} ${line.unit} để bán 1 phần mặc định.`,
      ),
    ];

    const inventoryStatus = shortages.length
      ? INVENTORY_STATUS.OUT_OF_STOCK
      : lowStockWarnings.length
      ? INVENTORY_STATUS.LOW_STOCK
      : INVENTORY_STATUS.IN_STOCK;

    return {
      inventoryStatus,
      maxAvailable,
      stockWarnings: warnings,
      stockShortages: shortages,
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
