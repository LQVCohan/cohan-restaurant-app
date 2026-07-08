// src/services/inventory.service.js (baseUnit quantities, servingKey, recipe per 1 sell unit)
import mongoose from "mongoose";
import {
  Recipe,
  Ingredient,
  StockItem,
  StockMovement,
} from "../../models/index.js";

/* ---------------- utils ---------------- */
const arr = (v) => (Array.isArray(v) ? v : []);
const s = (v) => (v == null ? "" : String(v));
const toNum = (v, d = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const uniq = (list) => Array.from(new Set((list || []).map(String)));

async function withOptionalTransaction(externalSession, fn) {
  if (externalSession) return fn(externalSession);
  const session = await mongoose.startSession();
  try {
    let out;
    await session.withTransaction(async () => {
      out = await fn(session);
    });
    return out;
  } finally {
    await session.endSession();
  }
}

function roundQty(value, digits = 9) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** digits;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

/* ------------ unit conversion graph ------------ */
const DEFAULT_EDGES = [
  { from: "kg", to: "g", ratio: 1000 },
  { from: "g", to: "kg", ratio: 1 / 1000 },
  { from: "l", to: "ml", ratio: 1000 },
  { from: "ml", to: "l", ratio: 1 / 1000 },
];

function buildAdj(conversions = []) {
  const edges = [];

  for (const c of arr(conversions)) {
    const from = s(c?.from).trim();
    const to = s(c?.to).trim();
    const ratio = toNum(c?.ratio, null);
    if (!from || !to || !(ratio > 0)) continue;

    edges.push({ from, to, ratio });
    edges.push({ from: to, to: from, ratio: 1 / ratio });
  }
  for (const d of DEFAULT_EDGES) edges.push(d);

  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push({ to: e.to, ratio: e.ratio });
  }
  return adj;
}

function findMultiplier(fromUnit, toUnit, conversions = []) {
  const from = s(fromUnit).trim();
  const to = s(toUnit).trim();
  if (!from || !to) return null;
  if (from === to) return 1;

  const adj = buildAdj(conversions);

  const q = [{ u: from, m: 1 }];
  const seen = new Set([from]);

  while (q.length) {
    const cur = q.shift();
    const nexts = adj.get(cur.u) || [];
    for (const nx of nexts) {
      if (seen.has(nx.to)) continue;
      const m = cur.m * nx.ratio;
      if (nx.to === to) return m;
      seen.add(nx.to);
      q.push({ u: nx.to, m });
    }
  }
  return null;
}

function convertToBaseFloat(qty, fromUnit, ing) {
  const n = toNum(qty, null);
  if (!(n >= 0)) return null;

  const baseUnit = s(ing?.baseUnit).trim();
  const from = s(fromUnit || baseUnit).trim();
  if (!baseUnit) return null;

  const mult = findMultiplier(from, baseUnit, ing?.conversions || []);
  if (mult == null) {
    throw new Error(
      `No unit conversion from '${from}' to baseUnit '${baseUnit}' for ingredient '${
        ing?.name || ing?._id
      }'`
    );
  }
  return roundQty(n * mult);
}

/* ------------ serving variant resolve (key only) ------------ */
function normalizeKey(k) {
  return s(k).trim();
}
function deriveKeyFromName(name) {
  const t = s(name).trim().toLowerCase();
  if (!t) return "";
  return t.replace(/\s+/g, "_").slice(0, 80);
}
function pickServingVariant(recipe, line) {
  const variants = arr(recipe?.servingVariants);

  let key = normalizeKey(line?.servingKey || line?.servingVariantKey || "");
  if (!key && line?.preparationMethodName)
    key = deriveKeyFromName(line.preparationMethodName);
  if (!key) return null;

  return variants.find((v) => normalizeKey(v?.key) === key) || null;
}

/* ------------ multiplier (recipe per 1 sell unit) ------------ */
function getSellDef(serving) {
  const mode = s(serving?.mode) || "PORTION";
  const sellQty = toNum(serving?.sellQty, 1);
  const sellUnit =
    s(serving?.sellUnit) || (mode === "BY_WEIGHT" ? "kg" : "portion");

  if (!(sellQty > 0)) throw new Error("Invalid servingVariant.sellQty");
  return { mode, sellQty, sellUnit };
}

function multiplierForLine(serving, line) {
  const { mode, sellQty, sellUnit } = getSellDef(serving);

  if (mode === "BY_WEIGHT") {
    const wg = toNum(line?.weightGrams, null);

    if (wg != null && wg > 0) {
      let w = 0;
      if (sellUnit === "kg") w = wg / 1000;
      else if (sellUnit === "g") w = wg;
      else throw new Error(`Unsupported sellUnit for BY_WEIGHT: ${sellUnit}`);
      return w / sellQty;
    }

    // fallback: quantity = amount in sellUnit
    const q = toNum(line?.quantity, null);
    if (q != null && q > 0) return q / sellQty;

    throw new Error(
      "BY_WEIGHT requires weightGrams (>0) or quantity (>0) fallback"
    );
  }

  const q = toNum(line?.quantity, 1);
  if (!(q > 0)) throw new Error("quantity must be > 0 for PORTION");
  return q / sellQty;
}

/* ------------ needs builder (ingredient baseUnit) ------------ */
async function buildNeeds({ restaurantId, lines, session }) {
  if (!restaurantId) throw new Error("restaurantId is required");
  if (!Array.isArray(lines) || !lines.length) return new Map();

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l?.menuItemId)
      throw new Error(`Line missing menuItemId at index ${i}`);

    const hasKey =
      !!normalizeKey(l?.servingKey || l?.servingVariantKey) ||
      !!deriveKeyFromName(l?.preparationMethodName);
    if (!hasKey) {
      throw new Error(
        `Line missing servingKey at index ${i} (ServingVariant uses key-only, no _id).`
      );
    }
  }

  const menuItemIds = uniq(lines.map((l) => l.menuItemId));

  let q = Recipe.find({
    restaurantId,
    menuItemId: { $in: menuItemIds },
    isActive: true,
  }).select({ menuItemId: 1, servingVariants: 1 });
  if (session) q = q.session(session);
  const recipes = await q.lean();

  const recipeMap = new Map(recipes.map((r) => [String(r.menuItemId), r]));

  // pass1
  const resolved = [];
  const ingIdsSet = new Set();

  for (const line of lines) {
    const recipe = recipeMap.get(String(line.menuItemId));
    if (!recipe)
      throw new Error(`Recipe not found for menuItem ${line.menuItemId}`);

    const serving = pickServingVariant(recipe, line);
    if (!serving) {
      throw new Error(
        `ServingVariant not found for menuItem ${line.menuItemId} (servingKey=${
          s(line.servingKey) || deriveKeyFromName(line.preparationMethodName)
        })`
      );
    }

    const comps = arr(serving?.ingredients);
    if (!comps.length) {
      throw new Error(
        `ServingVariant has no ingredients for menuItem ${
          line.menuItemId
        } (key=${s(serving.key)})`
      );
    }

    for (const c of comps)
      if (c?.ingredientId) ingIdsSet.add(String(c.ingredientId));
    resolved.push({ line, serving, comps });
  }

  const ingIds = Array.from(ingIdsSet);
  let q2 = Ingredient.find({ _id: { $in: ingIds } }).select({
    name: 1,
    baseUnit: 1,
    conversions: 1,
    minStock: 1,
  });
  if (session) q2 = q2.session(session);
  const ings = await q2.lean();
  const ingMap = new Map(ings.map((d) => [String(d._id), d]));

  const needs = new Map();

  for (const r of resolved) {
    const { line, serving, comps } = r;
    const mult = multiplierForLine(serving, line);

    for (const c of comps) {
      const ingredientId = c?.ingredientId;
      if (!ingredientId) continue;

      const ing = ingMap.get(String(ingredientId));
      if (!ing) throw new Error(`Ingredient not found: ${ingredientId}`);

      const qty = toNum(c?.qty, 0);
      const unit = c?.unit || ing.baseUnit;
      const wastePct = toNum(c?.wastePct, 0);

      if (!(qty > 0)) continue;

      const baseQty = convertToBaseFloat(qty, unit, ing);
      if (!(baseQty > 0)) continue;

      const need = roundQty(baseQty * mult * (1 + wastePct / 100));
      if (!(need > 0)) continue;

      const k = String(ingredientId);
      const curr = needs.get(k) || { total: 0, parts: [] };
      curr.total = roundQty(curr.total + need);
      curr.parts.push({
        menuItemId: line.menuItemId,
        servingKey: s(serving.key),
        mode: s(serving.mode),
        sellQty: serving.sellQty,
        sellUnit: serving.sellUnit,
        quantity: line.quantity ?? null,
        weightGrams: line.weightGrams ?? null,
        need,
      });
      needs.set(k, curr);
    }
  }

  return needs;
}

/* ------------ FEFO batches ------------ */
function consumeFromBatchesFEFO(batches = [], qtyNeed) {
  const clone = arr(batches).map((b) => ({ ...b }));
  const sorted = clone
    .map((b) => ({
      ...b,
      _t: b.expiry ? new Date(b.expiry).getTime() : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a._t - b._t);

  let remain = roundQty(qtyNeed);
  const lots = [];

  for (const b of sorted) {
    if (remain <= 0) break;

    const available = toNum(b.qty, 0);
    if (available <= 0) continue;

    const take = roundQty(Math.min(available, remain));
    if (take > 0) {
      b.qty = roundQty(available - take);
      remain = roundQty(remain - take);

      lots.push({
        lot: b.lot || null,
        qty: take,
        expiry: b.expiry || null,
        costPerBaseUnit: toNum(b.costPerBaseUnit, 0) || 0,
        shortage: false,
      });
    }
  }

  if (remain > 0) {
    lots.push({
      lot: null,
      qty: remain,
      expiry: null,
      costPerBaseUnit: 0,
      shortage: true,
    });
  }

  const newBatches = sorted
    .filter((b) => toNum(b.qty, 0) > 0)
    .map(({ _t, ...rest }) => rest);

  return { newBatches, lots };
}

async function ensureStockItems({
  restaurantId,
  warehouseId,
  ingredientIds,
  session,
  createMissing,
}) {
  // normalize + unique ids
  const ids = Array.from(
    new Set((ingredientIds || []).map((x) => String(x)).filter(Boolean))
  ).map((x) => new mongoose.Types.ObjectId(x));

  if (!ids.length) return;

  let q = StockItem.find({
    restaurantId,
    warehouseId,
    ingredientId: { $in: ids },
  }).select({ ingredientId: 1 });

  if (session) q = q.session(session);

  const existing = await q.lean();
  const existSet = new Set(existing.map((x) => String(x.ingredientId)));
  const missing = ids.filter((id) => !existSet.has(String(id)));

  if (!missing.length) return;

  if (!createMissing) {
    throw new Error(
      `StockItem not found for ingredients: ${missing.map(String).join(", ")}`
    );
  }

  // ✅ race-safe: upsert per (restaurantId, warehouseId, ingredientId)
  const ops = missing.map((ingredientId) => ({
    updateOne: {
      filter: { restaurantId, warehouseId, ingredientId },
      update: {
        $setOnInsert: {
          restaurantId,
          warehouseId,
          ingredientId,
          onHand: 0,
          reserved: 0,
          batches: [],
        },
      },
      upsert: true,
    },
  }));

  await StockItem.bulkWrite(ops, { session });
}

async function findLowStocks({
  restaurantId,
  warehouseId,
  ingredientIds,
  session,
}) {
  if (!ingredientIds?.length) return [];

  let q1 = StockItem.find({
    restaurantId,
    warehouseId,
    ingredientId: { $in: ingredientIds },
  }).select({ ingredientId: 1, onHand: 1 });
  if (session) q1 = q1.session(session);
  const stock = await q1.lean();

  let q2 = Ingredient.find({ _id: { $in: ingredientIds } }).select({
    _id: 1,
    minStock: 1,
  });
  if (session) q2 = q2.session(session);
  const ing = await q2.lean();

  const minMap = new Map(
    ing.map((x) => [String(x._id), toNum(x.minStock, 0) || 0])
  );

  const lowIds = stock
    .filter(
      (st) =>
        (toNum(st.onHand, 0) || 0) <= (minMap.get(String(st.ingredientId)) || 0)
    )
    .map((st) => st.ingredientId);

  if (!lowIds.length) return [];

  let q3 = Ingredient.find({ _id: { $in: lowIds } });
  if (session) q3 = q3.session(session);
  return q3.lean({ virtuals: true });
}

export async function checkAvailabilityForLinesTx({
  restaurantId,
  warehouseId,
  lines,
  session,
}) {
  return withOptionalTransaction(session, async (sesh) => {
    const normalizedLines = Array.isArray(lines) ? lines : [];
    if (!normalizedLines.length) return { isAvailable: true, maxAvailable: 0, shortages: [] };

    const needs = await buildNeeds({ restaurantId, lines: normalizedLines, session: sesh });
    const ingredientIds = Array.from(needs.keys());
    if (!ingredientIds.length) return { isAvailable: true, maxAvailable: Number.MAX_SAFE_INTEGER, shortages: [] };

    let q = StockItem.find({ restaurantId, warehouseId, ingredientId: { $in: ingredientIds } }).select({ ingredientId: 1, onHand: 1, reserved: 1 });
    if (sesh) q = q.session(sesh);
    const stocks = await q.lean();
    const stockMap = new Map(stocks.map((st) => [String(st.ingredientId), st]));

    let maxAvailable = Number.MAX_SAFE_INTEGER;
    const shortages = [];

    for (const [ingredientId, info] of needs) {
      const need = Number(info.total || 0);
      if (!(need > 0)) continue;
      const st = stockMap.get(String(ingredientId));
      const available = Math.max(0, Number(st?.onHand || 0) - Number(st?.reserved || 0));
      const maxByIngredient = Math.floor(available / need);
      if (maxByIngredient < maxAvailable) maxAvailable = maxByIngredient;
      if (available < need) {
        shortages.push({
          ingredientId,
          available,
          required: need,
          missing: roundQty(need - available),
        });
      }
    }

    if (maxAvailable === Number.MAX_SAFE_INTEGER) maxAvailable = 0;

    return {
      isAvailable: shortages.length === 0,
      maxAvailable,
      shortages,
    };
  });
}

/* ---------------- Public APIs ---------------- */

// Reserve: reserved += quantity in ingredient baseUnit
export async function reserveForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
  allowNegative = false,
  session,
}) {
  return withOptionalTransaction(session, async (sesh) => {
    const needs = await buildNeeds({ restaurantId, lines, session: sesh });
    const ingredientIds = Array.from(needs.keys());
    if (!ingredientIds.length)
      return { success: true, totalConsumed: 0, movements: [], lowStocks: [] };

    await ensureStockItems({
      restaurantId,
      warehouseId,
      ingredientIds,
      session: sesh,
      createMissing: !!allowNegative,
    });

    for (const [ingredientId, info] of needs) {
      const need = Number(info.total || 0);

      const filter = { restaurantId, warehouseId, ingredientId };
      if (!allowNegative) {
        filter.$expr = {
          $gte: [{ $subtract: ["$onHand", "$reserved"] }, need],
        };
      }

      const res = await StockItem.updateOne(
        filter,
        { $inc: { reserved: need } },
        { session: sesh }
      );
      if (!allowNegative && res.matchedCount === 0) {
        throw new Error(
          `Insufficient available stock to reserve ingredient ${ingredientId}`
        );
      }
    }

    return { success: true, totalConsumed: 0, movements: [], lowStocks: [] };
  });
}

// Cancel reservation: reserved -= need (must have reserved >= need)
export async function cancelReservationForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
  session,
}) {
  return withOptionalTransaction(session, async (sesh) => {
    const needs = await buildNeeds({ restaurantId, lines, session: sesh });
    const ingredientIds = Array.from(needs.keys());
    if (!ingredientIds.length)
      return { success: true, totalConsumed: 0, movements: [], lowStocks: [] };

    await ensureStockItems({
      restaurantId,
      warehouseId,
      ingredientIds,
      session: sesh,
      createMissing: false,
    });

    for (const [ingredientId, info] of needs) {
      const need = Number(info.total || 0);

      const filter = {
        restaurantId,
        warehouseId,
        ingredientId,
        $expr: { $gte: ["$reserved", need] },
      };
      const res = await StockItem.updateOne(
        filter,
        { $inc: { reserved: -need } },
        { session: sesh }
      );

      if (res.matchedCount === 0) {
        throw new Error(
          `Not enough reserved to cancel ingredient ${ingredientId}`
        );
      }
    }

    return { success: true, totalConsumed: 0, movements: [], lowStocks: [] };
  });
}

// Commit: reserved/onHand decrease in baseUnit + FEFO + outbound movements
export async function commitReservationForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
  allowNegative = false,
  session,
}) {
  return withOptionalTransaction(session, async (sesh) => {
    const needs = await buildNeeds({ restaurantId, lines, session: sesh });
    const ingredientIds = Array.from(needs.keys());
    if (!ingredientIds.length)
      return { success: true, totalConsumed: 0, movements: [], lowStocks: [] };

    await ensureStockItems({
      restaurantId,
      warehouseId,
      ingredientIds,
      session: sesh,
      createMissing: !!allowNegative,
    });

    // atomic decrement
    for (const [ingredientId, info] of needs) {
      const need = Number(info.total || 0);

      const filter = { restaurantId, warehouseId, ingredientId };
      filter.$expr = allowNegative
        ? { $gte: ["$reserved", need] }
        : {
            $and: [{ $gte: ["$reserved", need] }, { $gte: ["$onHand", need] }],
          };

      const res = await StockItem.updateOne(
        filter,
        { $inc: { reserved: -need, onHand: -need } },
        { session: sesh }
      );

      if (res.matchedCount === 0) {
        throw new Error(
          `Insufficient reserved/onHand to commit ingredient ${ingredientId}`
        );
      }
    }

    const movements = [];
    let totalConsumed = 0;

    for (const [ingredientId, info] of needs) {
      const need = Number(info.total || 0);
      totalConsumed = roundQty(totalConsumed + need);

      const item = await StockItem.findOne({
        restaurantId,
        warehouseId,
        ingredientId,
      }).session(sesh);
      if (!item) continue;

      const { newBatches, lots } = consumeFromBatchesFEFO(
        item.batches || [],
        need
      );
      item.batches = newBatches;
      await item.save({ session: sesh });

      const docs = lots
        .filter((l) => Number(l.qty) > 0)
        .map((l) => ({
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
            costPerBaseUnit: l.costPerBaseUnit,
            shortage: !!l.shortage,
          },
        }));

      if (docs.length) {
        const created = await StockMovement.insertMany(docs, { session: sesh });
        movements.push(...created.map((d) => d.toObject()));
      }
    }

    const lowStocks = await findLowStocks({
      restaurantId,
      warehouseId,
      ingredientIds,
      session: sesh,
    });
    return { success: true, totalConsumed, movements, lowStocks };
  });
}

// Consume directly: onHand decreases in baseUnit + FEFO + outbound movements
export async function consumeForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
  allowNegative = false,
  session,
}) {
  return withOptionalTransaction(session, async (sesh) => {
    const needs = await buildNeeds({ restaurantId, lines, session: sesh });
    const ingredientIds = Array.from(needs.keys());
    if (!ingredientIds.length)
      return { success: true, totalConsumed: 0, movements: [], lowStocks: [] };

    await ensureStockItems({
      restaurantId,
      warehouseId,
      ingredientIds,
      session: sesh,
      createMissing: !!allowNegative,
    });

    for (const [ingredientId, info] of needs) {
      const need = Number(info.total || 0);

      const filter = { restaurantId, warehouseId, ingredientId };
      if (!allowNegative) filter.$expr = { $gte: ["$onHand", need] };

      const res = await StockItem.updateOne(
        filter,
        { $inc: { onHand: -need } },
        { session: sesh }
      );

      if (!allowNegative && res.matchedCount === 0) {
        throw new Error(
          `Insufficient onHand to consume ingredient ${ingredientId}`
        );
      }
    }

    const movements = [];
    let totalConsumed = 0;

    for (const [ingredientId, info] of needs) {
      const need = Number(info.total || 0);
      totalConsumed = roundQty(totalConsumed + need);

      const item = await StockItem.findOne({
        restaurantId,
        warehouseId,
        ingredientId,
      }).session(sesh);
      if (!item) continue;

      const { newBatches, lots } = consumeFromBatchesFEFO(
        item.batches || [],
        need
      );
      item.batches = newBatches;
      await item.save({ session: sesh });

      const docs = lots
        .filter((l) => Number(l.qty) > 0)
        .map((l) => ({
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
            costPerBaseUnit: l.costPerBaseUnit,
            shortage: !!l.shortage,
          },
        }));

      if (docs.length) {
        const created = await StockMovement.insertMany(docs, { session: sesh });
        movements.push(...created.map((d) => d.toObject()));
      }
    }

    const lowStocks = await findLowStocks({
      restaurantId,
      warehouseId,
      ingredientIds,
      session: sesh,
    });
    return { success: true, totalConsumed, movements, lowStocks };
  });
}
