import mongoose from "mongoose";
import {
  Ingredient,
  Recipe,
  StockItem,
  StockMovement,
} from "../../models/index.js";
import {
  cancelReservationForOrderTx as cancelBaseReservation,
  checkAvailabilityForLinesTx as checkBaseAvailability,
  commitReservationForOrderTx as commitBaseReservation,
  consumeForOrderTx as consumeBaseOrder,
  reserveForOrderTx as reserveBaseOrder,
} from "./inventory.service.js";

const asArray = (value) => (Array.isArray(value) ? value : []);
const asNumber = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const roundNeed = (value) => Math.ceil(Number(value || 0) - 1e-9);

const DEFAULT_CONVERSIONS = [
  { from: "kg", to: "g", ratio: 1000 },
  { from: "g", to: "kg", ratio: 1 / 1000 },
  { from: "l", to: "ml", ratio: 1000 },
  { from: "ml", to: "l", ratio: 1 / 1000 },
];

async function withOptionalTransaction(externalSession, callback) {
  if (externalSession) return callback(externalSession);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function findUnitMultiplier(fromUnit, toUnit, conversions = []) {
  const from = String(fromUnit || "").trim();
  const to = String(toUnit || "").trim();
  if (!from || !to) return null;
  if (from === to) return 1;

  const adjacency = new Map();
  const addEdge = (edgeFrom, edgeTo, ratio) => {
    if (!adjacency.has(edgeFrom)) adjacency.set(edgeFrom, []);
    adjacency.get(edgeFrom).push({ to: edgeTo, ratio });
  };

  for (const conversion of [...asArray(conversions), ...DEFAULT_CONVERSIONS]) {
    const edgeFrom = String(conversion?.from || "").trim();
    const edgeTo = String(conversion?.to || "").trim();
    const ratio = asNumber(conversion?.ratio);
    if (!edgeFrom || !edgeTo || !(ratio > 0)) continue;
    addEdge(edgeFrom, edgeTo, ratio);
    addEdge(edgeTo, edgeFrom, 1 / ratio);
  }

  const queue = [{ unit: from, multiplier: 1 }];
  const seen = new Set([from]);
  while (queue.length) {
    const current = queue.shift();
    for (const next of adjacency.get(current.unit) || []) {
      if (seen.has(next.to)) continue;
      const multiplier = current.multiplier * next.ratio;
      if (next.to === to) return multiplier;
      seen.add(next.to);
      queue.push({ unit: next.to, multiplier });
    }
  }
  return null;
}

function convertToBaseUnit(quantity, unit, ingredient) {
  const baseUnit = String(ingredient?.baseUnit || "").trim();
  const fromUnit = String(unit || baseUnit).trim();
  const multiplier = findUnitMultiplier(
    fromUnit,
    baseUnit,
    ingredient?.conversions || [],
  );
  if (multiplier == null) {
    throw new Error(
      `No unit conversion from '${fromUnit}' to '${baseUnit}' for ingredient '${ingredient?.name || ingredient?._id}'`,
    );
  }
  return Number(quantity || 0) * multiplier;
}

function getServingFactor(variant, line) {
  const mode = String(variant?.mode || "PORTION");
  const sellQty = asNumber(variant?.sellQty, 1);
  const sellUnit = String(
    variant?.sellUnit || (mode === "BY_WEIGHT" ? "kg" : "portion"),
  );
  if (!(sellQty > 0)) throw new Error("Invalid servingVariant.sellQty");

  if (mode === "BY_WEIGHT") {
    const grams = asNumber(line?.weightGrams);
    if (grams != null && grams > 0) {
      const sold = sellUnit === "g" ? grams : grams / 1000;
      if (!["g", "kg"].includes(sellUnit)) {
        throw new Error(`Unsupported sellUnit for BY_WEIGHT: ${sellUnit}`);
      }
      return sold / sellQty;
    }
    const quantity = asNumber(line?.quantity);
    if (quantity != null && quantity > 0) return quantity / sellQty;
    throw new Error("BY_WEIGHT requires weightGrams or quantity");
  }

  const quantity = asNumber(line?.quantity, 1);
  if (!(quantity > 0)) throw new Error("quantity must be > 0 for PORTION");
  return quantity / sellQty;
}

function hasInventoryModifiers(line) {
  return asArray(line?.modifiers).some(
    (modifier) =>
      modifier?.inventoryRule?.rule &&
      modifier.inventoryRule.rule !== "NONE",
  );
}

function partitionLines(lines = []) {
  const plain = [];
  const modified = [];
  for (const line of asArray(lines)) {
    (hasInventoryModifiers(line) ? modified : plain).push(line);
  }
  return { plain, modified };
}

function addIngredientLine(lineMap, line, factor, mode = "ADD") {
  const ingredientId = line?.ingredientId;
  if (!ingredientId) return;
  const key = String(ingredientId);
  const quantity =
    Number(line?.qty || 0) *
    factor *
    (1 + Number(line?.wastePct || 0) / 100);
  if (!(quantity > 0)) return;

  const next = {
    ingredientId,
    qty: quantity,
    unit: line?.unit,
  };
  if (mode === "REPLACE" || !lineMap.has(key)) {
    lineMap.set(key, next);
    return;
  }

  const current = lineMap.get(key);
  if (String(current.unit) !== String(next.unit)) {
    throw new Error(
      `Inventory unit conflict for ingredient ${key}; use one unit per modifier option`,
    );
  }
  lineMap.set(key, { ...current, qty: current.qty + next.qty });
}

async function buildModifiedNeeds({ restaurantId, lines, session }) {
  if (!lines.length) return new Map();
  const menuItemIds = [
    ...new Set(lines.map((line) => String(line.menuItemId))),
  ];

  let recipeQuery = Recipe.find({
    restaurantId,
    menuItemId: { $in: menuItemIds },
    isActive: true,
    deletedAt: null,
  }).select({ menuItemId: 1, servingVariants: 1 });
  if (session) recipeQuery = recipeQuery.session(session);
  const recipes = await recipeQuery.lean();
  const recipeMap = new Map(
    recipes.map((recipe) => [String(recipe.menuItemId), recipe]),
  );

  const resolved = [];
  const ingredientIds = new Set();
  for (const line of lines) {
    const recipe = recipeMap.get(String(line.menuItemId));
    if (!recipe) {
      throw new Error(`Recipe not found for menuItem ${line.menuItemId}`);
    }
    const servingKey = String(
      line.servingKey || line.servingVariantKey || "",
    ).trim();
    const variant = asArray(recipe.servingVariants).find(
      (candidate) => String(candidate?.key || "").trim() === servingKey,
    );
    if (!variant) {
      throw new Error(
        `ServingVariant not found for menuItem ${line.menuItemId} (servingKey=${servingKey})`,
      );
    }

    const factor = getServingFactor(variant, line);
    const lineMap = new Map();
    for (const ingredientLine of asArray(variant.ingredients)) {
      addIngredientLine(lineMap, ingredientLine, factor);
    }

    const multiplierModifier = asArray(line.modifiers).find(
      (modifier) =>
        modifier?.inventoryRule?.rule === "MULTIPLY_BASE_RECIPE",
    );
    if (multiplierModifier) {
      const multiplier = Number(
        multiplierModifier.inventoryRule.baseRecipeMultiplier,
      );
      if (!Number.isFinite(multiplier) || multiplier <= 0) {
        throw new Error("Invalid baseRecipeMultiplier");
      }
      for (const [key, ingredientLine] of lineMap.entries()) {
        lineMap.set(key, {
          ...ingredientLine,
          qty: ingredientLine.qty * multiplier,
        });
      }
    }

    for (const modifier of asArray(line.modifiers)) {
      const rule = modifier?.inventoryRule?.rule;
      if (![
        "ADD_INGREDIENTS",
        "REPLACE_INGREDIENTS",
      ].includes(rule)) {
        continue;
      }
      for (const ingredientLine of asArray(
        modifier.inventoryRule.ingredientLines,
      )) {
        addIngredientLine(
          lineMap,
          ingredientLine,
          factor,
          rule === "REPLACE_INGREDIENTS" ? "REPLACE" : "ADD",
        );
      }
    }

    for (const ingredientLine of lineMap.values()) {
      ingredientIds.add(String(ingredientLine.ingredientId));
    }
    resolved.push({ line, variant, lineMap });
  }

  let ingredientQuery = Ingredient.find({
    _id: { $in: [...ingredientIds] },
  }).select({ name: 1, baseUnit: 1, conversions: 1, minStock: 1 });
  if (session) ingredientQuery = ingredientQuery.session(session);
  const ingredients = await ingredientQuery.lean();
  const ingredientMap = new Map(
    ingredients.map((ingredient) => [String(ingredient._id), ingredient]),
  );

  const needs = new Map();
  for (const { line, variant, lineMap } of resolved) {
    for (const ingredientLine of lineMap.values()) {
      const key = String(ingredientLine.ingredientId);
      const ingredient = ingredientMap.get(key);
      if (!ingredient) throw new Error(`Ingredient not found: ${key}`);
      const required = roundNeed(
        convertToBaseUnit(
          ingredientLine.qty,
          ingredientLine.unit,
          ingredient,
        ),
      );
      if (!(required > 0)) continue;

      const current = needs.get(key) || { total: 0, parts: [] };
      current.total += required;
      current.parts.push({
        menuItemId: line.menuItemId,
        servingKey: variant.key,
        mode: variant.mode,
        sellQty: variant.sellQty,
        sellUnit: variant.sellUnit,
        quantity: line.quantity ?? null,
        weightGrams: line.weightGrams ?? null,
        need: required,
      });
      needs.set(key, current);
    }
  }
  return needs;
}

async function ensureStockItems({
  restaurantId,
  warehouseId,
  ingredientIds,
  session,
  createMissing,
}) {
  const objectIds = [...new Set(ingredientIds.map(String))].map(
    (id) => new mongoose.Types.ObjectId(id),
  );
  if (!objectIds.length) return;

  let query = StockItem.find({
    restaurantId,
    warehouseId,
    ingredientId: { $in: objectIds },
  }).select({ ingredientId: 1 });
  if (session) query = query.session(session);
  const existing = await query.lean();
  const existingIds = new Set(existing.map((item) => String(item.ingredientId)));
  const missing = objectIds.filter((id) => !existingIds.has(String(id)));
  if (!missing.length) return;
  if (!createMissing) {
    throw new Error(
      `StockItem not found for ingredients: ${missing.map(String).join(", ")}`,
    );
  }

  await StockItem.bulkWrite(
    missing.map((ingredientId) => ({
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
    })),
    { session },
  );
}

function consumeBatches(batches = [], quantity) {
  const sorted = asArray(batches)
    .map((batch) => ({
      ...batch,
      sortTime: batch.expiry
        ? new Date(batch.expiry).getTime()
        : Number.POSITIVE_INFINITY,
    }))
    .sort((left, right) => left.sortTime - right.sortTime);
  let remaining = quantity;
  const lots = [];

  for (const batch of sorted) {
    if (remaining <= 0) break;
    const available = Number(batch.qty || 0);
    if (available <= 0) continue;
    const used = Math.min(available, remaining);
    batch.qty = available - used;
    remaining -= used;
    lots.push({
      lot: batch.lot || null,
      qty: used,
      expiry: batch.expiry || null,
      costPerBaseUnit: Number(batch.costPerBaseUnit || 0),
      shortage: false,
    });
  }
  if (remaining > 0) {
    lots.push({
      lot: null,
      qty: remaining,
      expiry: null,
      costPerBaseUnit: 0,
      shortage: true,
    });
  }

  return {
    batches: sorted
      .filter((batch) => Number(batch.qty || 0) > 0)
      .map(({ sortTime, ...batch }) => batch),
    lots,
  };
}

async function findLowStocks({
  restaurantId,
  warehouseId,
  ingredientIds,
  session,
}) {
  if (!ingredientIds.length) return [];
  let stockQuery = StockItem.find({
    restaurantId,
    warehouseId,
    ingredientId: { $in: ingredientIds },
  }).select({ ingredientId: 1, onHand: 1 });
  let ingredientQuery = Ingredient.find({
    _id: { $in: ingredientIds },
  }).select({ _id: 1, minStock: 1 });
  if (session) {
    stockQuery = stockQuery.session(session);
    ingredientQuery = ingredientQuery.session(session);
  }
  const [stocks, ingredients] = await Promise.all([
    stockQuery.lean(),
    ingredientQuery.lean(),
  ]);
  const minimums = new Map(
    ingredients.map((ingredient) => [
      String(ingredient._id),
      Number(ingredient.minStock || 0),
    ]),
  );
  const lowIds = stocks
    .filter(
      (stock) =>
        Number(stock.onHand || 0) <=
        Number(minimums.get(String(stock.ingredientId)) || 0),
    )
    .map((stock) => stock.ingredientId);
  if (!lowIds.length) return [];

  let query = Ingredient.find({ _id: { $in: lowIds } });
  if (session) query = query.session(session);
  return query.lean({ virtuals: true });
}

async function checkNeeds({
  restaurantId,
  warehouseId,
  needs,
  session,
}) {
  const ingredientIds = [...needs.keys()];
  if (!ingredientIds.length) {
    return {
      isAvailable: true,
      maxAvailable: Number.MAX_SAFE_INTEGER,
      shortages: [],
    };
  }

  let query = StockItem.find({
    restaurantId,
    warehouseId,
    ingredientId: { $in: ingredientIds },
  }).select({ ingredientId: 1, onHand: 1, reserved: 1 });
  if (session) query = query.session(session);
  const stocks = await query.lean();
  const stockMap = new Map(
    stocks.map((stock) => [String(stock.ingredientId), stock]),
  );

  let maxAvailable = Number.MAX_SAFE_INTEGER;
  const shortages = [];
  for (const [ingredientId, info] of needs.entries()) {
    const required = Number(info.total || 0);
    if (!(required > 0)) continue;
    const stock = stockMap.get(String(ingredientId));
    const available = Math.max(
      0,
      Number(stock?.onHand || 0) - Number(stock?.reserved || 0),
    );
    maxAvailable = Math.min(maxAvailable, Math.floor(available / required));
    if (available < required) {
      shortages.push({
        ingredientId,
        available,
        required,
        missing: required - available,
      });
    }
  }

  return {
    isAvailable: shortages.length === 0,
    maxAvailable:
      maxAvailable === Number.MAX_SAFE_INTEGER ? 0 : maxAvailable,
    shortages,
  };
}

async function reserveNeeds({
  restaurantId,
  warehouseId,
  needs,
  allowNegative,
  session,
}) {
  const ingredientIds = [...needs.keys()];
  if (!ingredientIds.length) return;
  await ensureStockItems({
    restaurantId,
    warehouseId,
    ingredientIds,
    session,
    createMissing: Boolean(allowNegative),
  });

  for (const [ingredientId, info] of needs.entries()) {
    const required = Number(info.total || 0);
    const filter = { restaurantId, warehouseId, ingredientId };
    if (!allowNegative) {
      filter.$expr = {
        $gte: [{ $subtract: ["$onHand", "$reserved"] }, required],
      };
    }
    const result = await StockItem.updateOne(
      filter,
      { $inc: { reserved: required } },
      { session },
    );
    if (!allowNegative && result.matchedCount === 0) {
      throw new Error(
        `Insufficient available stock to reserve ingredient ${ingredientId}`,
      );
    }
  }
}

async function cancelNeeds({
  restaurantId,
  warehouseId,
  needs,
  session,
}) {
  const ingredientIds = [...needs.keys()];
  if (!ingredientIds.length) return;
  await ensureStockItems({
    restaurantId,
    warehouseId,
    ingredientIds,
    session,
    createMissing: false,
  });

  for (const [ingredientId, info] of needs.entries()) {
    const required = Number(info.total || 0);
    const result = await StockItem.updateOne(
      {
        restaurantId,
        warehouseId,
        ingredientId,
        $expr: { $gte: ["$reserved", required] },
      },
      { $inc: { reserved: -required } },
      { session },
    );
    if (result.matchedCount === 0) {
      throw new Error(
        `Not enough reserved to cancel ingredient ${ingredientId}`,
      );
    }
  }
}

async function consumeNeeds({
  restaurantId,
  warehouseId,
  orderCode,
  needs,
  allowNegative,
  session,
  fromReservation,
}) {
  const ingredientIds = [...needs.keys()];
  if (!ingredientIds.length) {
    return { totalConsumed: 0, movements: [], lowStocks: [] };
  }
  await ensureStockItems({
    restaurantId,
    warehouseId,
    ingredientIds,
    session,
    createMissing: Boolean(allowNegative),
  });

  for (const [ingredientId, info] of needs.entries()) {
    const required = Number(info.total || 0);
    const filter = { restaurantId, warehouseId, ingredientId };
    if (fromReservation) {
      filter.$expr = allowNegative
        ? { $gte: ["$reserved", required] }
        : {
            $and: [
              { $gte: ["$reserved", required] },
              { $gte: ["$onHand", required] },
            ],
          };
    } else if (!allowNegative) {
      filter.$expr = { $gte: ["$onHand", required] };
    }

    const update = fromReservation
      ? { $inc: { reserved: -required, onHand: -required } }
      : { $inc: { onHand: -required } };
    const result = await StockItem.updateOne(filter, update, { session });
    if (!allowNegative && result.matchedCount === 0) {
      throw new Error(
        `Insufficient stock to consume ingredient ${ingredientId}`,
      );
    }
  }

  const movements = [];
  let totalConsumed = 0;
  for (const [ingredientId, info] of needs.entries()) {
    const required = Number(info.total || 0);
    totalConsumed += required;
    const stock = await StockItem.findOne({
      restaurantId,
      warehouseId,
      ingredientId,
    }).session(session);
    if (!stock) continue;

    const consumed = consumeBatches(stock.batches || [], required);
    stock.batches = consumed.batches;
    await stock.save({ session });

    const documents = consumed.lots
      .filter((lot) => Number(lot.qty) > 0)
      .map((lot) => ({
        restaurantId,
        warehouseId,
        ingredientId,
        type: "outbound",
        qty: -Number(lot.qty),
        reason: `order:${orderCode}`,
        meta: {
          orderCode,
          lot: lot.lot,
          expiry: lot.expiry,
          costPerBaseUnit: lot.costPerBaseUnit,
          shortage: Boolean(lot.shortage),
        },
      }));
    if (documents.length) {
      const created = await StockMovement.insertMany(documents, { session });
      movements.push(...created.map((document) => document.toObject()));
    }
  }

  const lowStocks = await findLowStocks({
    restaurantId,
    warehouseId,
    ingredientIds,
    session,
  });
  return { totalConsumed, movements, lowStocks };
}

function mergeAvailability(base, modified) {
  return {
    isAvailable: base.isAvailable && modified.isAvailable,
    maxAvailable: Math.min(base.maxAvailable, modified.maxAvailable),
    shortages: [...(base.shortages || []), ...(modified.shortages || [])],
  };
}

function mergeOperationResults(base, modified) {
  return {
    success: true,
    totalConsumed:
      Number(base?.totalConsumed || 0) +
      Number(modified?.totalConsumed || 0),
    movements: [...(base?.movements || []), ...(modified?.movements || [])],
    lowStocks: [...(base?.lowStocks || []), ...(modified?.lowStocks || [])],
  };
}

export async function checkAvailabilityForLinesTx({
  restaurantId,
  warehouseId,
  lines,
  session,
}) {
  return withOptionalTransaction(session, async (activeSession) => {
    const { plain, modified } = partitionLines(lines);
    const baseResult = plain.length
      ? await checkBaseAvailability({
          restaurantId,
          warehouseId,
          lines: plain,
          session: activeSession,
        })
      : {
          isAvailable: true,
          maxAvailable: Number.MAX_SAFE_INTEGER,
          shortages: [],
        };
    const modifiedNeeds = await buildModifiedNeeds({
      restaurantId,
      lines: modified,
      session: activeSession,
    });
    const modifiedResult = await checkNeeds({
      restaurantId,
      warehouseId,
      needs: modifiedNeeds,
      session: activeSession,
    });
    const merged = mergeAvailability(baseResult, modifiedResult);
    if (merged.maxAvailable === Number.MAX_SAFE_INTEGER) {
      merged.maxAvailable = 0;
    }
    return merged;
  });
}

export async function reserveForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
  allowNegative = false,
  session,
}) {
  return withOptionalTransaction(session, async (activeSession) => {
    const { plain, modified } = partitionLines(lines);
    const baseResult = plain.length
      ? await reserveBaseOrder({
          restaurantId,
          warehouseId,
          orderCode,
          lines: plain,
          allowNegative,
          session: activeSession,
        })
      : { success: true, totalConsumed: 0, movements: [], lowStocks: [] };
    const modifiedNeeds = await buildModifiedNeeds({
      restaurantId,
      lines: modified,
      session: activeSession,
    });
    await reserveNeeds({
      restaurantId,
      warehouseId,
      needs: modifiedNeeds,
      allowNegative,
      session: activeSession,
    });
    return mergeOperationResults(baseResult, null);
  });
}

export async function cancelReservationForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
  session,
}) {
  return withOptionalTransaction(session, async (activeSession) => {
    const { plain, modified } = partitionLines(lines);
    const baseResult = plain.length
      ? await cancelBaseReservation({
          restaurantId,
          warehouseId,
          orderCode,
          lines: plain,
          session: activeSession,
        })
      : { success: true, totalConsumed: 0, movements: [], lowStocks: [] };
    const modifiedNeeds = await buildModifiedNeeds({
      restaurantId,
      lines: modified,
      session: activeSession,
    });
    await cancelNeeds({
      restaurantId,
      warehouseId,
      needs: modifiedNeeds,
      session: activeSession,
    });
    return mergeOperationResults(baseResult, null);
  });
}

export async function commitReservationForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
  allowNegative = false,
  session,
}) {
  return withOptionalTransaction(session, async (activeSession) => {
    const { plain, modified } = partitionLines(lines);
    const baseResult = plain.length
      ? await commitBaseReservation({
          restaurantId,
          warehouseId,
          orderCode,
          lines: plain,
          allowNegative,
          session: activeSession,
        })
      : { success: true, totalConsumed: 0, movements: [], lowStocks: [] };
    const modifiedNeeds = await buildModifiedNeeds({
      restaurantId,
      lines: modified,
      session: activeSession,
    });
    const modifiedResult = await consumeNeeds({
      restaurantId,
      warehouseId,
      orderCode,
      needs: modifiedNeeds,
      allowNegative,
      session: activeSession,
      fromReservation: true,
    });
    return mergeOperationResults(baseResult, modifiedResult);
  });
}

export async function consumeForOrderTx({
  restaurantId,
  warehouseId,
  orderCode,
  lines,
  allowNegative = false,
  session,
}) {
  return withOptionalTransaction(session, async (activeSession) => {
    const { plain, modified } = partitionLines(lines);
    const baseResult = plain.length
      ? await consumeBaseOrder({
          restaurantId,
          warehouseId,
          orderCode,
          lines: plain,
          allowNegative,
          session: activeSession,
        })
      : { success: true, totalConsumed: 0, movements: [], lowStocks: [] };
    const modifiedNeeds = await buildModifiedNeeds({
      restaurantId,
      lines: modified,
      session: activeSession,
    });
    const modifiedResult = await consumeNeeds({
      restaurantId,
      warehouseId,
      orderCode,
      needs: modifiedNeeds,
      allowNegative,
      session: activeSession,
      fromReservation: false,
    });
    return mergeOperationResults(baseResult, modifiedResult);
  });
}
