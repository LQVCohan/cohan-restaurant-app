// src/services/inventory.service.js
import mongoose from "mongoose";
import {
  Recipe,
  Ingredient,
  StockItem,
  StockMovement,
} from "../../models/index.js";

// Tính hệ số tiêu hao cho 1 dòng order (legacy)
function computeMultiplier({
  yieldQty = 1,
  yieldUnit = "portion",
  quantity = 1,
  weightGrams,
}) {
  if (typeof weightGrams === "number" && weightGrams > 0) {
    if (yieldUnit === "100g") return weightGrams / 100;
    if (yieldUnit === "g") return weightGrams / (yieldQty || 1);
  }
  return quantity / (yieldQty || 1);
}

function pickServing(recipe, line) {
  // 1) theo servingKey
  if (line.servingKey) {
    const sv = recipe.servingVariants?.find(
      (v) =>
        v.key === line.servingKey &&
        (!v.preparationMethodName ||
          v.preparationMethodName === line.preparationMethodName)
    );
    if (sv) return sv;
  }

  // 2) theo servingMode
  if (line.servingMode) {
    const sv = recipe.servingVariants?.find(
      (v) =>
        v.mode === line.servingMode &&
        (!v.preparationMethodName ||
          v.preparationMethodName === line.preparationMethodName)
    );
    if (sv) return sv;
  }

  // 3) có weightGrams → ưu tiên BY_WEIGHT
  if (typeof line.weightGrams === "number" && line.weightGrams > 0) {
    const sv = recipe.servingVariants?.find(
      (v) =>
        v.mode === "BY_WEIGHT" &&
        (!v.preparationMethodName ||
          v.preparationMethodName === line.preparationMethodName)
    );
    if (sv) return sv;
  }

  // 4) fallback PORTION
  const svPortion = recipe.servingVariants?.find(
    (v) =>
      v.mode === "PORTION" &&
      (!v.preparationMethodName ||
        v.preparationMethodName === line.preparationMethodName)
  );
  if (svPortion) return svPortion;

  // 5) fallback legacy
  return null;
}

function computeMultiplierFromServing(serving, line, fallbackRecipe) {
  if (serving) {
    if (serving.mode === "BY_WEIGHT") {
      if (serving.yieldUnit === "100g") return (line.weightGrams || 0) / 100;
      if (serving.yieldUnit === "g")
        return (line.weightGrams || 0) / (serving.yieldQty || 1);
    }
    // PORTION
    return (line.quantity || 1) / (serving.yieldQty || 1);
  }
  // legacy fallback
  return computeMultiplier({
    yieldQty: fallbackRecipe.yieldQty,
    yieldUnit: fallbackRecipe.yieldUnit,
    quantity: line.quantity,
    weightGrams: line.weightGrams,
  });
}

// Dùng servingVariants.Ingredients trước, rồi fallback baseComponents
async function buildIngredientNeeds({ restaurantId, lines }) {
  const menuItemIds = Array.from(
    new Set(lines.map((l) => String(l.menuItemId)))
  );

  const recipes = await Recipe.find({
    restaurantId,
    menuItemId: { $in: menuItemIds },
  }).lean();

  const recipeMap = new Map(recipes.map((r) => [String(r.menuItemId), r]));

  const needs = new Map();

  for (const line of lines) {
    const recipe = recipeMap.get(String(line.menuItemId));
    if (!recipe)
      throw new Error(`Recipe not found for menuItem ${line.menuItemId}`);

    const serving = pickServing(recipe, line);

    if (serving?.mode === "BY_WEIGHT") {
      if (!(line.weightGrams > 0))
        throw new Error("weightGrams is required for BY_WEIGHT serving");
    } else {
      if (!(line.quantity > 0))
        throw new Error("quantity is required for PORTION serving");
    }

    let comps;
    let mult;

    if (serving) {
      // ✅ NEW: dùng Ingredients trong servingVariant
      comps = serving.Ingredients || [];
      mult = computeMultiplierFromServing(serving, line, recipe);
    } else {
      // legacy: dùng baseComponents
      comps = recipe.baseComponents || [];
      mult = computeMultiplier({
        yieldQty: recipe.yieldQty,
        yieldUnit: recipe.yieldUnit,
        quantity: line.quantity,
        weightGrams: line.weightGrams,
      });
    }

    for (const comp of comps) {
      // dùng quantify (schema mới), fallback qty (nếu data cũ)
      const base = comp.quantify ?? comp.qty ?? 0;
      const need = base * mult * (1 + (comp.wastePct || 0) / 100);
      if (need <= 0) continue;

      const key = String(comp.ingredientId);
      const current = needs.get(key) || { total: 0, parts: [] };
      current.total += need;
      current.parts.push({
        need,
        menuItemId: line.menuItemId,
        preparationMethodName:
          line.preparationMethodName || serving?.preparationMethodName || null,
        weightGrams: line.weightGrams || null,
        quantity: line.quantity,
        servingKey: line.servingKey || serving?.key || null,
        servingMode: line.servingMode || serving?.mode || null,
      });
      needs.set(key, current);
    }
  }

  return needs;
}

/**
 * FEFO (First Expiry First Out)
 */
function consumeFromBatchesFIFO(batches = [], qtyNeed) {
  const clone = (batches || []).map((b) => ({ ...b }));
  const sortable = clone
    .map((b) => ({
      ...b,
      expirySortable: b.expiry
        ? new Date(b.expiry).getTime()
        : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.expirySortable - b.expirySortable);

  let remain = qtyNeed;
  const lots = [];

  for (const b of sortable) {
    if (remain <= 0) break;
    const take = Math.min(b.qty || 0, remain);
    if (take > 0) {
      b.qty -= take;
      remain -= take;
      lots.push({
        lot: b.lot || null,
        qty: take,
        expiry: b.expiry || null,
        expirySortable: b.expiry
          ? new Date(b.expiry).getTime()
          : Number.POSITIVE_INFINITY,
        costPerBaseUnit: b.costPerBaseUnit || 0,
      });
    }
  }

  if (remain > 0) {
    lots.push({
      lot: null,
      qty: remain,
      expiry: null,
      expirySortable: Number.POSITIVE_INFINITY,
      costPerBaseUnit: 0,
    });
  }

  const newBatches = sortable
    .filter((b) => (b.qty || 0) > 0)
    .map(({ expirySortable, ...rest }) => rest);

  return { newBatches, lots };
}

/**
 * ============================
 *     STOCK MAP HELPERS
 * ============================
 */

async function buildStockMap({
  restaurantId,
  warehouseId,
  ingredientIds,
  session,
}) {
  const items = await StockItem.find({
    restaurantId,
    warehouseId,
    ingredientId: { $in: ingredientIds },
  }).session(session);
  const map = new Map(items.map((doc) => [String(doc.ingredientId), doc]));
  return map;
}

async function ensureAllStockDocsExist({
  restaurantId,
  warehouseId,
  ingredientIds,
  session,
}) {
  const count = await StockItem.countDocuments({
    restaurantId,
    warehouseId,
    ingredientId: { $in: ingredientIds },
  }).session(session);
  if (count !== ingredientIds.length) {
    const existing = await StockItem.find({
      restaurantId,
      warehouseId,
      ingredientId: { $in: ingredientIds },
    })
      .select({ ingredientId: 1 })
      .session(session)
      .lean();

    const existingSet = new Set(existing.map((x) => String(x.ingredientId)));
    const missing = ingredientIds.filter((id) => !existingSet.has(String(id)));
    throw new Error(
      `StockItem not found for ingredients: ${missing.join(", ")}`
    );
  }
}

/**
 * ======================================
 *     ATOMIC OPERATIONS & TRANSACTIONS
 * ======================================
 */

// 1) RESERVATION: Giữ chỗ (reserved += need)
export async function reserveForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
}) {
  const session = await mongoose.startSession();

  try {
    const needs = await buildIngredientNeeds({ restaurantId, lines });
    const ingredientIds = Array.from(needs.keys());

    await session.withTransaction(async () => {
      await ensureAllStockDocsExist({
        restaurantId,
        warehouseId,
        ingredientIds,
        session,
      });

      for (const [ingredientId, info] of needs) {
        const need = info.total;

        const res = await StockItem.updateOne(
          {
            restaurantId,
            warehouseId,
            ingredientId,
            $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, need] },
          },
          { $inc: { reserved: need } },
          { session }
        );

        if (res.matchedCount === 0) {
          throw new Error(
            `Insufficient available stock to reserve ingredient ${ingredientId}`
          );
        }
      }
    });

    session.endSession();
    return { success: true, totalConsumed: 0, movements: [], lowStocks: [] };
  } catch (e) {
    session.endSession();
    throw e;
  }
}

// 2) COMMIT RESERVATION: reserved -= need, onHand -= need, FEFO, movement
export async function commitReservationForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
}) {
  const session = await mongoose.startSession();
  const movements = [];
  const lowStocksSet = new Set();
  let totalConsumed = 0;

  try {
    const needs = await buildIngredientNeeds({ restaurantId, lines });
    const ingredientIds = Array.from(needs.keys());

    await session.withTransaction(async () => {
      await ensureAllStockDocsExist({
        restaurantId,
        warehouseId,
        ingredientIds,
        session,
      });

      const stockMap = await buildStockMap({
        restaurantId,
        warehouseId,
        ingredientIds,
        session,
      });

      // 2.1 Giảm reserved + onHand
      for (const [ingredientId, info] of needs) {
        const need = info.total;

        const res = await StockItem.updateOne(
          {
            restaurantId,
            warehouseId,
            ingredientId,
            $expr: { $gte: ["$reserved", need] },
          },
          { $inc: { reserved: -need } },
          { session }
        );
        if (res.matchedCount === 0) {
          throw new Error(
            `Insufficient reserved to commit ingredient ${ingredientId}`
          );
        }

        const res2 = await StockItem.updateOne(
          {
            restaurantId,
            warehouseId,
            ingredientId,
            $expr: { $gte: ["$onHand", need] },
          },
          { $inc: { onHand: -need } },
          { session }
        );
        if (res2.matchedCount === 0) {
          throw new Error(
            `Insufficient stock to commit ingredient ${ingredientId}`
          );
        }
      }

      // 2.2 FEFO + movement theo lô
      for (const [ingredientId, info] of needs) {
        const need = info.total;

        let current = stockMap.get(String(ingredientId));
        if (!current) {
          current = await StockItem.findOne({
            restaurantId,
            warehouseId,
            ingredientId,
          }).session(session);
          if (current) stockMap.set(String(ingredientId), current);
        }
        if (!current) continue;

        const { newBatches, lots } = consumeFromBatchesFIFO(
          current.batches,
          need
        );
        current.batches = newBatches;
        await current.save({ session });

        totalConsumed += need;

        const lotMoves = lots.filter((l) => l.qty > 0);
        if (lotMoves.length) {
          const docs = lotMoves.map((l) => ({
            restaurantId,
            warehouseId,
            ingredientId,
            type: "outbound",
            qty: -l.qty,
            reason: `order:${orderCode}`,
            meta: {
              orderCode,
              lot: l.lot,
              expiry: l.expiry,
              expirySortable: l.expirySortable,
              costPerBaseUnit: l.costPerBaseUnit,
              lines: info.parts,
            },
          }));
          const created = await StockMovement.insertMany(docs, { session });
          movements.push(...created.map((x) => x.toObject()));
        }

        const ing = await Ingredient.findById(ingredientId)
          .select({ minStock: 1 })
          .session(session)
          .lean();
        if (ing && (current.onHand ?? 0) <= (ing.minStock ?? 0)) {
          lowStocksSet.add(String(ingredientId));
        }
      }
    });

    const lowStocks = lowStocksSet.size
      ? await Ingredient.find({ _id: { $in: Array.from(lowStocksSet) } }).lean({
          virtuals: true,
        })
      : [];

    session.endSession();
    return { success: true, totalConsumed, movements, lowStocks };
  } catch (e) {
    session.endSession();
    throw e;
  }
}

// 3) CANCEL RESERVATION: reserved -= need
export async function cancelReservationForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
}) {
  const session = await mongoose.startSession();

  try {
    const needs = await buildIngredientNeeds({ restaurantId, lines });
    const ingredientIds = Array.from(needs.keys());

    await session.withTransaction(async () => {
      await ensureAllStockDocsExist({
        restaurantId,
        warehouseId,
        ingredientIds,
        session,
      });

      for (const [ingredientId, info] of needs) {
        const need = info.total;

        const res = await StockItem.updateOne(
          {
            restaurantId,
            warehouseId,
            ingredientId,
            $expr: { $gte: ["$reserved", need] },
          },
          { $inc: { reserved: -need } },
          { session }
        );

        if (res.matchedCount === 0) {
          throw new Error(
            `Not enough reserved to cancel for ingredient ${ingredientId}`
          );
        }
      }
    });

    session.endSession();
    return { success: true, totalConsumed: 0, movements: [], lowStocks: [] };
  } catch (e) {
    session.endSession();
    throw e;
  }
}

// 4) DIRECT CONSUMPTION: vẫn giữ nếu sau này muốn dùng ở nơi khác
export async function consumeForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
}) {
  const session = await mongoose.startSession();
  const movements = [];
  const lowStocksSet = new Set();
  let totalConsumed = 0;

  try {
    const needs = await buildIngredientNeeds({ restaurantId, lines });
    const ingredientIds = Array.from(needs.keys());

    await session.withTransaction(async () => {
      await ensureAllStockDocsExist({
        restaurantId,
        warehouseId,
        ingredientIds,
        session,
      });

      const stockMap = await buildStockMap({
        restaurantId,
        warehouseId,
        ingredientIds,
        session,
      });

      // 4.1 Atomic trừ onHand
      for (const [ingredientId, info] of needs) {
        const need = info.total;

        const res = await StockItem.updateOne(
          {
            restaurantId,
            warehouseId,
            ingredientId,
            $expr: { $gte: ["$onHand", need] },
          },
          { $inc: { onHand: -need } },
          { session }
        );
        if (res.matchedCount === 0) {
          throw new Error(`Insufficient stock for ingredient ${ingredientId}`);
        }
      }

      // 4.2 FEFO + movement
      for (const [ingredientId, info] of needs) {
        const need = info.total;

        let current = stockMap.get(String(ingredientId));
        if (!current) {
          current = await StockItem.findOne({
            restaurantId,
            warehouseId,
            ingredientId,
          }).session(session);
          if (current) stockMap.set(String(ingredientId), current);
        }
        if (!current) continue;

        const { newBatches, lots } = consumeFromBatchesFIFO(
          current.batches,
          need
        );
        current.batches = newBatches;
        await current.save({ session });

        totalConsumed += need;

        const lotMoves = lots.filter((l) => l.qty > 0);
        if (lotMoves.length) {
          const docs = lotMoves.map((l) => ({
            restaurantId,
            warehouseId,
            ingredientId,
            type: "outbound",
            qty: -l.qty,
            reason: `order:${orderCode}`,
            meta: {
              orderCode,
              lot: l.lot,
              expiry: l.expiry,
              expirySortable: l.expirySortable,
              costPerBaseUnit: l.costPerBaseUnit,
              lines: info.parts,
            },
          }));
          const created = await StockMovement.insertMany(docs, { session });
          movements.push(...created.map((x) => x.toObject()));
        }

        const ing = await Ingredient.findById(ingredientId)
          .select({ minStock: 1 })
          .session(session)
          .lean();
        if (ing && (current.onHand ?? 0) <= (ing.minStock ?? 0)) {
          lowStocksSet.add(String(ingredientId));
        }
      }
    });

    const lowStocks = lowStocksSet.size
      ? await Ingredient.find({ _id: { $in: Array.from(lowStocksSet) } }).lean({
          virtuals: true,
        })
      : [];

    session.endSession();
    return { success: true, totalConsumed, movements, lowStocks };
  } catch (e) {
    session.endSession();
    throw e;
  }
}
