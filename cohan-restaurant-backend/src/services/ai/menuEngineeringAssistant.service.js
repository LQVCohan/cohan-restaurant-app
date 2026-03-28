import mongoose from "mongoose";
import { Ingredient, Order, Recipe } from "../../../models/index.js";

const ACTIVE_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "customer_attached",
  "preparing",
  "ready",
  "served",
  "completed",
]);

const CANCELLED_ITEM_STATUSES = new Set(["cancelled", "returned"]);
const DEFAULT_FALLBACK_MARGIN_RATE = 0.65;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const convertToBaseUnitQty = (ingredientDoc, qty, unit) => {
  const baseUnit = ingredientDoc?.baseUnit;
  if (!baseUnit) return null;
  if (baseUnit === unit) return qty;

  const conversions = ingredientDoc?.conversions || [];
  const direct = conversions.find((row) => row.from === unit && row.to === baseUnit);
  if (direct) return qty * Number(direct.ratio || 0);

  const reverse = conversions.find((row) => row.from === baseUnit && row.to === unit);
  if (reverse) return qty / Number(reverse.ratio || 0);

  const map = {
    "kg->g": 1000,
    "g->kg": 1 / 1000,
    "l->ml": 1000,
    "ml->l": 1 / 1000,
  };
  const key = `${unit}->${baseUnit}`;
  if (map[key]) return qty * map[key];
  return null;
};

const resolveFactorFromItemAndVariant = (item, variant) => {
  const mode = String(variant?.mode || item?.servingVariant?.mode || "PORTION").toUpperCase();
  if (mode === "BY_WEIGHT") {
    const grams = parseNumber(item?.weightGrams, 0);
    if (!grams) return parseNumber(item?.quantity, 0);
    const sellQty = Math.max(0.000001, parseNumber(variant?.sellQty || item?.servingVariant?.sellQty, 1));
    const sellUnit = String(variant?.sellUnit || item?.servingVariant?.sellUnit || "g");
    const soldAmount = sellUnit === "kg" ? grams / 1000 : grams;
    return soldAmount / sellQty;
  }
  return parseNumber(item?.quantity, 0);
};

const estimateRecipeCostForItem = ({ item, recipeMap, ingredientMap }) => {
  const dishId = item?.dishId ? String(item.dishId) : null;
  if (!dishId) return null;

  const recipe = recipeMap.get(dishId);
  if (!recipe?.servingVariants?.length) return null;

  const servingKey = String(item?.servingKey || "").trim();
  const variant =
    recipe.servingVariants.find((v) => String(v?.key || "") === servingKey) ||
    recipe.servingVariants.find((v) => v?.isDefault) ||
    recipe.servingVariants[0];
  if (!variant) return null;

  const factor = resolveFactorFromItemAndVariant(item, variant);
  if (!factor) return null;

  let estimatedCost = 0;
  let hasAtLeastOnePricedLine = false;

  for (const line of variant.ingredients || []) {
    const ingredientId = line?.ingredientId ? String(line.ingredientId) : null;
    if (!ingredientId) continue;
    const ingredient = ingredientMap.get(ingredientId);
    if (!ingredient) continue;

    const lineQty = parseNumber(line?.qty, 0);
    if (!lineQty) continue;
    const wasteFactor = 1 + clamp(parseNumber(line?.wastePct, 0) / 100, 0, 2);
    const qtyWithWaste = lineQty * factor * wasteFactor;

    const baseQty = convertToBaseUnitQty(ingredient, qtyWithWaste, line?.unit);
    if (!Number.isFinite(baseQty) || baseQty <= 0) continue;

    const cpu = parseNumber(ingredient?.costPerBaseUnit, NaN);
    if (!Number.isFinite(cpu) || cpu < 0) continue;

    estimatedCost += baseQty * cpu;
    hasAtLeastOnePricedLine = true;
  }

  return hasAtLeastOnePricedLine ? Math.max(0, estimatedCost) : null;
};

const recommendationByQuadrant = {
  star: "Giữ chất lượng, ưu tiên hiển thị và cân nhắc upsell combo.",
  plowhorse: "Rà soát cost/portion để cải thiện biên lợi nhuận.",
  puzzle: "Đẩy marketing/in-menu placement để tăng độ phổ biến.",
  dog: "Cân nhắc tối ưu công thức, thay đổi giá, hoặc loại khỏi menu.",
};

const getQuadrant = ({ quantity, avgQuantity, contributionMargin, avgContributionMargin }) => {
  const highPopularity = quantity >= avgQuantity;
  const highMargin = contributionMargin >= avgContributionMargin;
  if (highPopularity && highMargin) return "star";
  if (highPopularity && !highMargin) return "plowhorse";
  if (!highPopularity && highMargin) return "puzzle";
  return "dog";
};

export async function buildMenuEngineeringAssistant({
  restaurantId,
  lookbackDays = 30,
  timezone = "Asia/Ho_Chi_Minh",
  fallbackMarginRate = DEFAULT_FALLBACK_MARGIN_RATE,
}) {
  const rid = mongoose.isValidObjectId(restaurantId)
    ? new mongoose.Types.ObjectId(restaurantId)
    : null;
  if (!rid) throw new Error("Invalid restaurantId");

  const safeLookbackDays = clamp(parseNumber(lookbackDays, 30), 7, 90);
  const safeFallbackMarginRate = clamp(parseNumber(fallbackMarginRate, DEFAULT_FALLBACK_MARGIN_RATE), 0.2, 0.9);
  const now = new Date();
  const startDate = new Date(now.getTime() - safeLookbackDays * 24 * 60 * 60 * 1000);

  const orders = await Order.find({
    restaurantId: rid,
    createdAt: { $gte: startDate, $lte: now },
    currentStatus: { $in: [...ACTIVE_ORDER_STATUSES] },
  })
    .select({
      items: 1,
      createdAt: 1,
    })
    .lean();

  const dishIds = [
    ...new Set(
      (orders || [])
        .flatMap((order) => order?.items || [])
        .map((item) => (item?.dishId ? String(item.dishId) : null))
        .filter(Boolean)
    ),
  ];

  const recipes = dishIds.length
    ? await Recipe.find({ restaurantId: rid, menuItemId: { $in: dishIds } })
      .select({ menuItemId: 1, servingVariants: 1 })
      .lean()
    : [];
  const recipeMap = new Map(recipes.map((recipe) => [String(recipe.menuItemId), recipe]));

  const ingredientIds = [
    ...new Set(
      recipes
        .flatMap((recipe) => recipe?.servingVariants || [])
        .flatMap((variant) => variant?.ingredients || [])
        .map((line) => (line?.ingredientId ? String(line.ingredientId) : null))
        .filter(Boolean)
    ),
  ];
  const ingredients = ingredientIds.length
    ? await Ingredient.find({ _id: { $in: ingredientIds } })
      .select({ baseUnit: 1, conversions: 1, costPerBaseUnit: 1 })
      .lean()
    : [];
  const ingredientMap = new Map(ingredients.map((ingredient) => [String(ingredient._id), ingredient]));

  const dishMap = new Map();
  let recipeCostCount = 0;
  let snapshotCostCount = 0;
  let fallbackCostCount = 0;

  for (const order of orders || []) {
    for (const item of order?.items || []) {
      if (CANCELLED_ITEM_STATUSES.has(String(item?.status || "").toLowerCase())) continue;
      const dishId = item?.dishId ? String(item.dishId) : null;
      if (!dishId) continue;

      const dishName = String(item?.name || "Món không tên").trim() || "Món không tên";
      const quantity = Math.max(0, parseNumber(item?.quantity, 0));
      if (!quantity) continue;

      const revenue = Math.max(
        0,
        parseNumber(item?.lineSubtotal, parseNumber(item?.unitPrice, 0) * quantity)
      );

      const snapshotCost = (item?.ingredientsSnapshot || []).reduce((sum, line) => {
        const lineCost = parseNumber(line?.totalCost, NaN);
        return Number.isFinite(lineCost) ? sum + Math.max(0, lineCost) : sum;
      }, 0);

      let estimatedCost = Number.isFinite(snapshotCost) && snapshotCost > 0 ? snapshotCost : null;
      if (estimatedCost != null) {
        snapshotCostCount += 1;
      } else {
        estimatedCost = estimateRecipeCostForItem({ item, recipeMap, ingredientMap });
        if (estimatedCost != null) {
          recipeCostCount += 1;
        } else {
          estimatedCost = revenue * (1 - safeFallbackMarginRate);
          fallbackCostCount += 1;
        }
      }

      const prev = dishMap.get(dishId) || {
        dishId,
        dishName,
        quantity: 0,
        revenue: 0,
        estimatedCost: 0,
      };

      prev.quantity += quantity;
      prev.revenue += revenue;
      prev.estimatedCost += Math.max(0, estimatedCost);
      dishMap.set(dishId, prev);
    }
  }

  const rows = [...dishMap.values()];
  const maxQuantity = Math.max(1, ...rows.map((row) => row.quantity));
  const contributions = rows.map((row) => (row.quantity > 0 ? (row.revenue - row.estimatedCost) / row.quantity : 0));
  const maxContribution = Math.max(1, ...contributions.map((value) => Math.max(0, value)));
  const avgQuantity = rows.length ? rows.reduce((sum, row) => sum + row.quantity, 0) / rows.length : 0;
  const avgContributionMargin = contributions.length
    ? contributions.reduce((sum, value) => sum + value, 0) / contributions.length
    : 0;

  const dishes = rows
    .map((row) => {
      const profit = row.revenue - row.estimatedCost;
      const marginPct = row.revenue > 0 ? (profit / row.revenue) * 100 : 0;
      const contributionMargin = row.quantity > 0 ? profit / row.quantity : 0;
      const popularityScore = Math.round((row.quantity / maxQuantity) * 100);
      const marginScore = Math.round((Math.max(0, contributionMargin) / maxContribution) * 100);
      const quadrant = getQuadrant({
        quantity: row.quantity,
        avgQuantity,
        contributionMargin,
        avgContributionMargin,
      });

      return {
        dishId: row.dishId,
        dishName: row.dishName,
        quantity: Math.round(row.quantity * 100) / 100,
        revenue: Math.round(row.revenue),
        estimatedCost: Math.round(row.estimatedCost),
        profit: Math.round(profit),
        marginPct: Math.round(marginPct * 100) / 100,
        popularityScore,
        marginScore,
        contributionMargin: Math.round(contributionMargin),
        quadrant,
        recommendation: recommendationByQuadrant[quadrant],
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity);

  const summary = {
    totalDishes: dishes.length,
    starCount: dishes.filter((dish) => dish.quadrant === "star").length,
    plowhorseCount: dishes.filter((dish) => dish.quadrant === "plowhorse").length,
    puzzleCount: dishes.filter((dish) => dish.quadrant === "puzzle").length,
    dogCount: dishes.filter((dish) => dish.quadrant === "dog").length,
    avgMarginPct: dishes.length
      ? Number((dishes.reduce((sum, dish) => sum + parseNumber(dish.marginPct, 0), 0) / dishes.length).toFixed(2))
      : 0,
    notes: [
      `Phân tích ${dishes.length} món trong ${safeLookbackDays} ngày gần nhất.`,
      `Ước tính cost: snapshot ${snapshotCostCount} dòng, recipe ${recipeCostCount} dòng, fallback ${fallbackCostCount} dòng.`,
    ],
  };

  const recommendations = [
    ...dishes
      .filter((dish) => dish.quadrant === "puzzle")
      .sort((a, b) => b.marginPct - a.marginPct)
      .slice(0, 2)
      .map((dish) => `Đẩy truyền thông cho "${dish.dishName}" để tăng độ phổ biến.`),
    ...dishes
      .filter((dish) => dish.quadrant === "plowhorse")
      .sort((a, b) => a.marginPct - b.marginPct)
      .slice(0, 2)
      .map((dish) => `Tối ưu cost/portion cho "${dish.dishName}" để tăng lợi nhuận.`),
    ...dishes
      .filter((dish) => dish.quadrant === "star")
      .slice(0, 1)
      .map((dish) => `Giữ chuẩn chất lượng và ưu tiên upsell món STAR "${dish.dishName}".`),
  ].slice(0, 5);

  return {
    summary,
    dishes,
    recommendations,
    meta: {
      method: "menu_engineering_v1",
      fallbackUsed: fallbackCostCount > 0,
      fallbackMarginRate: safeFallbackMarginRate,
      generatedAt: now,
      timezone,
      sampleOrders: orders.length,
      sampleDays: safeLookbackDays,
    },
  };
}
