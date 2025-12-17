// src/services/inventory.service.js
import mongoose from "mongoose";
import {
  Recipe,
  Ingredient,
  StockItem,
  StockMovement,
} from "../../models/index.js";

/**
 * =========================
 *   SERVING MULTIPLIER
 * =========================
 * - PORTION: multiplier = quantity / yieldQty
 * - BY_WEIGHT:
 *    - yieldUnit "g":   multiplier = weightGrams / yieldQty
 *    - yieldUnit "100g": multiplier = weightGrams / 100
 *    - yieldUnit "kg":  multiplier = (weightGrams/1000) / yieldQty
 * NOTE:
 * - We assume serving.Ingredients quantify is in Ingredient.baseUnit (thường là g/ml/unit...)
 * - yieldQty/yieldUnit chỉ để scale theo line (phần hoặc gram)
 */

function requirePositiveNumber(val, name) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be > 0`);
  return n;
}

function computeMultiplierFromServing(serving, line) {
  if (!serving?.mode) throw new Error("Missing serving.mode");

  if (serving.mode === "BY_WEIGHT") {
    const weightGrams = Number(line.weightGrams || 0);
    if (!(weightGrams > 0)) {
      throw new Error("weightGrams is required for BY_WEIGHT serving");
    }

    const yieldQty = Number(serving.yieldQty || 0) || 1;
    const yieldUnit = serving.yieldUnit || "g";

    // weightGrams -> grams
    if (yieldUnit === "100g") return weightGrams / 100;
    if (yieldUnit === "g") return weightGrams / yieldQty;
    if (yieldUnit === "kg") return weightGrams / 1000 / yieldQty;

    // fallback: treat as grams-based
    return weightGrams / yieldQty;
  }

  // PORTION
  const qty = requirePositiveNumber(line.quantity ?? 1, "quantity");
  const yieldQty = Number(serving.yieldQty || 0) || 1;
  return qty / yieldQty;
}

/**
 * =========================
 *   RECIPE LOOKUP HELPERS
 * =========================
 * We fetch recipes by menuItemId and locate servingVariant by servingVariantId.
 */

function toStrId(x) {
  return x == null ? "" : String(x);
}

function findServingVariantById(recipe, servingVariantId) {
  if (!recipe?.servingVariants?.length) return null;
  const sid = toStrId(servingVariantId);
  if (!sid) return null;
  return recipe.servingVariants.find((v) => toStrId(v._id) === sid) || null;
}

/**
 * =========================
 *   BUILD INGREDIENT NEEDS
 * =========================
 * Output: Map<ingredientId, { total, parts[] }>
 * total: tổng need theo baseUnit của Ingredient (giả định quantify đã là baseUnit)
 */
async function buildIngredientNeeds({ restaurantId, lines }) {
  if (!restaurantId) throw new Error("restaurantId is required");
  if (!Array.isArray(lines) || lines.length === 0) return new Map();

  // Validate minimal line fields
  for (const l of lines) {
    if (!l?.menuItemId) throw new Error("Line missing menuItemId");
    if (!l?.servingVariantId) {
      throw new Error("Line missing servingVariantId (required)");
    }
    // mode-based required fields checked later
  }

  const menuItemIds = Array.from(
    new Set(lines.map((l) => String(l.menuItemId)))
  );

  // Only pick needed fields for performance
  const recipes = await Recipe.find({
    restaurantId,
    menuItemId: { $in: menuItemIds },
    isActive: true,
  })
    .select({
      menuItemId: 1,
      servingVariants: 1, // includes Ingredients
    })
    .lean();

  const recipeMap = new Map(recipes.map((r) => [String(r.menuItemId), r]));

  const needs = new Map();

  for (const line of lines) {
    const recipe = recipeMap.get(String(line.menuItemId));
    if (!recipe) {
      throw new Error(`Recipe not found for menuItem ${line.menuItemId}`);
    }

    const serving = findServingVariantById(recipe, line.servingVariantId);
    if (!serving) {
      throw new Error(
        `ServingVariant not found for menuItem ${line.menuItemId} with servingVariantId ${line.servingVariantId}`
      );
    }

    // Optional consistency check if client sends servingVariantMode
    if (line.servingVariantMode && serving.mode !== line.servingVariantMode) {
      throw new Error(
        `ServingVariant mode mismatch for menuItem ${line.menuItemId}: line=${line.servingVariantMode} recipe=${serving.mode}`
      );
    }

    // Mode required fields
    if (serving.mode === "BY_WEIGHT") {
      if (!(Number(line.weightGrams) > 0)) {
        throw new Error("weightGrams is required for BY_WEIGHT serving");
      }
    } else {
      if (!(Number(line.quantity) > 0)) {
        throw new Error("quantity is required for PORTION serving");
      }
    }

    const comps = serving.Ingredients || serving.ingredients || [];
    if (!Array.isArray(comps) || comps.length === 0) {
      // nếu variant không có Ingredients thì coi như không trừ kho
      // (hoặc bạn muốn throw để bắt buộc khai báo công thức)
      throw new Error(
        `ServingVariant ${serving._id} has no Ingredients for menuItem ${line.menuItemId}`
      );
    }

    const mult = computeMultiplierFromServing(serving, line);

    for (const comp of comps) {
      const ingredientId = comp.ingredientId;
      if (!ingredientId) continue;

      // quantify: schema mới
      const base = Number(comp.quantify ?? 0);
      if (!(base > 0)) continue;

      const wastePct = Number(comp.wastePct || 0);
      const need = base * mult * (1 + wastePct / 100);

      if (!(need > 0)) continue;

      const key = String(ingredientId);
      const current = needs.get(key) || { total: 0, parts: [] };

      current.total += need;
      current.parts.push({
        need,
        menuItemId: line.menuItemId,
        servingVariantId: line.servingVariantId,
        servingMode: serving.mode,
        quantity: line.quantity ?? null,
        weightGrams: line.weightGrams ?? null,
        // debug/tracing
        servingKey: serving.key || null,
        servingName: serving.name || null,
      });

      needs.set(key, current);
    }
  }

  return needs;
}

/**
 * =========================
 *   FEFO (First Expiry First Out)
 * =========================
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
    const take = Math.min(Number(b.qty || 0), remain);
    if (take > 0) {
      b.qty = Number(b.qty || 0) - take;
      remain -= take;
      lots.push({
        lot: b.lot || null,
        qty: take,
        expiry: b.expiry || null,
        expirySortable: b.expiry
          ? new Date(b.expiry).getTime()
          : Number.POSITIVE_INFINITY,
        costPerBaseUnit: Number(b.costPerBaseUnit || 0),
      });
    }
  }

  // If not enough, still record shortage lot (optional)
  if (remain > 0) {
    lots.push({
      lot: null,
      qty: remain,
      expiry: null,
      expirySortable: Number.POSITIVE_INFINITY,
      costPerBaseUnit: 0,
      shortage: true,
    });
  }

  const newBatches = sortable
    .filter((b) => Number(b.qty || 0) > 0)
    .map(({ expirySortable, ...rest }) => rest);

  return { newBatches, lots };
}

/**
 * =========================
 *   STOCK MAP HELPERS
 * =========================
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

  return new Map(items.map((doc) => [String(doc.ingredientId), doc]));
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

  if (count === ingredientIds.length) return;

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

  throw new Error(`StockItem not found for ingredients: ${missing.join(", ")}`);
}

/**
 * =========================
 *  ATOMIC OPS & TRANSACTIONS
 * =========================
 *
 * Reserved logic:
 * - reserveForOrderTx: reserved += need (requires available onHand - reserved >= need)
 * - commitReservationForOrderTx: reserved -= need, onHand -= need, FEFO, create StockMovement
 * - cancelReservationForOrderTx: reserved -= need
 * - consumeForOrderTx: onHand -= need, FEFO, movement (no reserve phase)
 */

/**
 * 1) RESERVATION: Giữ chỗ (reserved += need)
 */
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
        const need = Number(info.total || 0);

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

/**
 * 2) COMMIT RESERVATION: reserved -= need, onHand -= need, FEFO, movement
 */
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

      // 2.1 Atomic giảm reserved + onHand
      for (const [ingredientId, info] of needs) {
        const need = Number(info.total || 0);

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
        const need = Number(info.total || 0);

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

        const lotMoves = lots.filter((l) => Number(l.qty) > 0);
        if (lotMoves.length) {
          const docs = lotMoves.map((l) => ({
            restaurantId,
            warehouseId,
            ingredientId,
            type: "outbound",
            qty: -Number(l.qty),
            reason: `order:${orderCode}`,
            meta: {
              orderCode,
              lot: l.lot,
              expiry: l.expiry,
              expirySortable: l.expirySortable,
              costPerBaseUnit: l.costPerBaseUnit,
              shortage: !!l.shortage,
              lines: info.parts,
            },
          }));

          const created = await StockMovement.insertMany(docs, { session });
          movements.push(...created.map((x) => x.toObject()));
        }

        // Low stock check
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

/**
 * 3) CANCEL RESERVATION: reserved -= need
 */
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
        const need = Number(info.total || 0);

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

/**
 * 4) DIRECT CONSUMPTION (no reserve phase)
 */
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
        const need = Number(info.total || 0);

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
        const need = Number(info.total || 0);

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

        const lotMoves = lots.filter((l) => Number(l.qty) > 0);
        if (lotMoves.length) {
          const docs = lotMoves.map((l) => ({
            restaurantId,
            warehouseId,
            ingredientId,
            type: "outbound",
            qty: -Number(l.qty),
            reason: `order:${orderCode}`,
            meta: {
              orderCode,
              lot: l.lot,
              expiry: l.expiry,
              expirySortable: l.expirySortable,
              costPerBaseUnit: l.costPerBaseUnit,
              shortage: !!l.shortage,
              lines: info.parts,
            },
          }));
          const created = await StockMovement.insertMany(docs, { session });
          movements.push(...created.map((x) => x.toObject()));
        }

        // Low stock check
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
