import mongoose from "mongoose";

import {
  MenuItem,
  StockItem,
  StockMovement,
  Supply,
} from "../../models/index.js";
import * as recipeInventory from "./inventoryRecipe.service.js";

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const roundQuantity = (value, digits = 9) => {
  const factor = 10 ** digits;
  return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
};

const toObjectId = (value) =>
  mongoose.isValidObjectId(String(value || ""))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

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

const supplyReferenceId = (line = {}) =>
  line.supplyId || line.menuItemId || line.dishId || null;

async function partitionInventoryLines({ restaurantId, lines = [], session }) {
  const normalized = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (!normalized.length) return { recipeLines: [], supplyLines: [] };

  const explicitSupplyLines = normalized.filter(
    (line) =>
      String(line?.itemType || "").toUpperCase() === "SUPPLY" ||
      Boolean(line?.supplyId),
  );
  const unresolved = normalized.filter(
    (line) => !explicitSupplyLines.includes(line),
  );
  const unresolvedIds = [
    ...new Set(
      unresolved
        .map((line) => line?.menuItemId)
        .filter(Boolean)
        .map(String),
    ),
  ]
    .map(toObjectId)
    .filter(Boolean);

  let menuItemQuery = MenuItem.find({
    restaurantId,
    _id: { $in: unresolvedIds },
  }).select({ _id: 1 });
  if (session) menuItemQuery = menuItemQuery.session(session);
  const menuItems = await menuItemQuery.lean();
  const menuItemIds = new Set(menuItems.map((item) => String(item._id)));

  const possibleSupplyIds = unresolvedIds.filter(
    (id) => !menuItemIds.has(String(id)),
  );
  let supplyQuery = Supply.find({
    restaurantId,
    _id: { $in: possibleSupplyIds },
    isActive: { $ne: false },
    pricePerUnit: { $gt: 0 },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  }).select({ _id: 1 });
  if (session) supplyQuery = supplyQuery.session(session);
  const supplies = await supplyQuery.lean();
  const supplyIds = new Set(supplies.map((supply) => String(supply._id)));

  const supplyLines = [...explicitSupplyLines];
  const recipeLines = [];
  for (const line of unresolved) {
    const id = line?.menuItemId;
    if (id && supplyIds.has(String(id))) {
      supplyLines.push({
        ...line,
        itemType: "SUPPLY",
        supplyId: id,
      });
    } else {
      recipeLines.push(line);
    }
  }

  return { recipeLines, supplyLines };
}

function buildSupplyNeeds(lines = []) {
  const needs = new Map();
  for (const [index, line] of lines.entries()) {
    const id = toObjectId(supplyReferenceId(line));
    if (!id) throw new Error(`Line missing supplyId at index ${index}`);
    const quantity = toNumber(line?.quantity, null);
    if (!(quantity > 0)) {
      throw new Error(`Supply quantity must be greater than zero at index ${index}`);
    }
    const key = String(id);
    const current = needs.get(key) || { supplyId: id, total: 0, parts: [] };
    current.total = roundQuantity(current.total + quantity);
    current.parts.push({ quantity, servingKey: line?.servingKey || "unit" });
    needs.set(key, current);
  }
  return needs;
}

async function ensureSupplyStockItems({
  restaurantId,
  warehouseId,
  needs,
  session,
  createMissing,
}) {
  const supplyIds = [...needs.values()].map((entry) => entry.supplyId);
  if (!supplyIds.length) return;

  let query = StockItem.find({
    restaurantId,
    warehouseId,
    supplyId: { $in: supplyIds },
  }).select({ supplyId: 1 });
  if (session) query = query.session(session);
  const existing = await query.lean();
  const existingIds = new Set(existing.map((item) => String(item.supplyId)));
  const missing = supplyIds.filter((id) => !existingIds.has(String(id)));
  if (!missing.length) return;
  if (!createMissing) {
    throw new Error(
      `StockItem not found for supplies: ${missing.map(String).join(", ")}`,
    );
  }

  await StockItem.bulkWrite(
    missing.map((supplyId) => ({
      updateOne: {
        filter: { restaurantId, warehouseId, supplyId },
        update: {
          $setOnInsert: {
            restaurantId,
            warehouseId,
            supplyId,
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

function consumeSupplyBatches(batches = [], requiredQuantity) {
  const rows = (Array.isArray(batches) ? batches : [])
    .map((batch) => ({
      ...batch,
      _expiry: batch?.expiry
        ? new Date(batch.expiry).getTime()
        : Number.POSITIVE_INFINITY,
    }))
    .sort((left, right) => left._expiry - right._expiry);
  let remaining = roundQuantity(requiredQuantity);
  const lots = [];

  for (const batch of rows) {
    if (remaining <= 0) break;
    const available = Math.max(0, toNumber(batch.qty));
    if (!available) continue;
    const used = roundQuantity(Math.min(available, remaining));
    batch.qty = roundQuantity(available - used);
    remaining = roundQuantity(remaining - used);
    lots.push({
      lot: batch.lot || null,
      expiry: batch.expiry || null,
      qty: used,
      costPerBaseUnit: toNumber(batch.costPerBaseUnit),
      shortage: false,
    });
  }

  if (remaining > 0) {
    lots.push({
      lot: null,
      expiry: null,
      qty: remaining,
      costPerBaseUnit: 0,
      shortage: true,
    });
  }

  return {
    batches: rows
      .filter((batch) => toNumber(batch.qty) > 0)
      .map(({ _expiry, ...batch }) => batch),
    lots,
  };
}

async function getSupplyAvailability({
  restaurantId,
  warehouseId,
  supplyLines,
  session,
}) {
  const needs = buildSupplyNeeds(supplyLines);
  const supplyIds = [...needs.values()].map((entry) => entry.supplyId);
  if (!supplyIds.length) {
    return {
      isAvailable: true,
      maxAvailable: Number.MAX_SAFE_INTEGER,
      shortages: [],
    };
  }

  let query = StockItem.find({
    restaurantId,
    warehouseId,
    supplyId: { $in: supplyIds },
  }).select({ supplyId: 1, onHand: 1, reserved: 1 });
  if (session) query = query.session(session);
  const stocks = await query.lean();
  const stockBySupplyId = new Map(
    stocks.map((stock) => [String(stock.supplyId), stock]),
  );

  let maxAvailable = Number.MAX_SAFE_INTEGER;
  const shortages = [];
  for (const [supplyId, need] of needs.entries()) {
    const stock = stockBySupplyId.get(supplyId);
    const available = Math.max(
      0,
      toNumber(stock?.onHand) - toNumber(stock?.reserved),
    );
    const required = toNumber(need.total);
    maxAvailable = Math.min(
      maxAvailable,
      required > 0 ? Math.floor(available / required) : 0,
    );
    if (available < required) {
      shortages.push({
        supplyId,
        available,
        required,
        missing: roundQuantity(required - available),
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

async function reserveSupplies({
  restaurantId,
  warehouseId,
  supplyLines,
  allowNegative,
  session,
}) {
  const needs = buildSupplyNeeds(supplyLines);
  await ensureSupplyStockItems({
    restaurantId,
    warehouseId,
    needs,
    session,
    createMissing: Boolean(allowNegative),
  });

  for (const { supplyId, total } of needs.values()) {
    const filter = { restaurantId, warehouseId, supplyId };
    if (!allowNegative) {
      filter.$expr = {
        $gte: [{ $subtract: ["$onHand", "$reserved"] }, total],
      };
    }
    const result = await StockItem.updateOne(
      filter,
      { $inc: { reserved: total } },
      { session },
    );
    if (!allowNegative && result.matchedCount === 0) {
      throw new Error(`Insufficient available stock to reserve supply ${supplyId}`);
    }
  }
}

async function cancelSupplyReservations({
  restaurantId,
  warehouseId,
  supplyLines,
  session,
}) {
  const needs = buildSupplyNeeds(supplyLines);
  await ensureSupplyStockItems({
    restaurantId,
    warehouseId,
    needs,
    session,
    createMissing: false,
  });

  for (const { supplyId, total } of needs.values()) {
    const result = await StockItem.updateOne(
      {
        restaurantId,
        warehouseId,
        supplyId,
        $expr: { $gte: ["$reserved", total] },
      },
      { $inc: { reserved: -total } },
      { session },
    );
    if (result.matchedCount === 0) {
      throw new Error(`Not enough reserved to cancel supply ${supplyId}`);
    }
  }
}

async function consumeSupplies({
  restaurantId,
  warehouseId,
  orderCode,
  supplyLines,
  allowNegative,
  fromReservation,
  session,
}) {
  const needs = buildSupplyNeeds(supplyLines);
  await ensureSupplyStockItems({
    restaurantId,
    warehouseId,
    needs,
    session,
    createMissing: Boolean(allowNegative),
  });

  const movements = [];
  let totalConsumed = 0;
  for (const { supplyId, total } of needs.values()) {
    const filter = { restaurantId, warehouseId, supplyId };
    if (fromReservation) {
      filter.$expr = allowNegative
        ? { $gte: ["$reserved", total] }
        : {
            $and: [
              { $gte: ["$reserved", total] },
              { $gte: ["$onHand", total] },
            ],
          };
    } else if (!allowNegative) {
      filter.$expr = { $gte: ["$onHand", total] };
    }

    const increment = fromReservation
      ? { reserved: -total, onHand: -total }
      : { onHand: -total };
    const result = await StockItem.updateOne(
      filter,
      { $inc: increment },
      { session },
    );
    if (!allowNegative && result.matchedCount === 0) {
      throw new Error(`Insufficient stock to consume supply ${supplyId}`);
    }

    const stockItem = await StockItem.findOne({
      restaurantId,
      warehouseId,
      supplyId,
    }).session(session);
    if (!stockItem) continue;
    const consumed = consumeSupplyBatches(stockItem.batches, total);
    stockItem.batches = consumed.batches;
    await stockItem.save({ session });

    const movementDocuments = consumed.lots
      .filter((lot) => lot.qty > 0)
      .map((lot) => ({
        restaurantId,
        warehouseId,
        supplyId,
        type: "outbound",
        qty: -lot.qty,
        reason: `order:${orderCode}`,
        meta: {
          orderCode,
          lot: lot.lot,
          expiry: lot.expiry,
          costPerBaseUnit: lot.costPerBaseUnit,
          shortage: lot.shortage,
        },
      }));
    if (movementDocuments.length) {
      const created = await StockMovement.insertMany(movementDocuments, {
        session,
      });
      movements.push(...created.map((document) => document.toObject()));
    }
    totalConsumed = roundQuantity(totalConsumed + total);
  }

  const supplyIds = [...needs.values()].map((entry) => entry.supplyId);
  let supplyQuery = Supply.find({ _id: { $in: supplyIds } }).select({
    _id: 1,
    name: 1,
    minStock: 1,
  });
  if (session) supplyQuery = supplyQuery.session(session);
  const supplies = await supplyQuery.lean();
  const supplyById = new Map(
    supplies.map((supply) => [String(supply._id), supply]),
  );
  let stockQuery = StockItem.find({
    restaurantId,
    warehouseId,
    supplyId: { $in: supplyIds },
  }).select({ supplyId: 1, onHand: 1 });
  if (session) stockQuery = stockQuery.session(session);
  const remainingStocks = await stockQuery.lean();
  const lowStocks = remainingStocks
    .filter((stock) => {
      const supply = supplyById.get(String(stock.supplyId));
      return toNumber(stock.onHand) <= toNumber(supply?.minStock);
    })
    .map((stock) => supplyById.get(String(stock.supplyId)))
    .filter(Boolean);

  return { totalConsumed, movements, lowStocks };
}

const mergeOperationResults = (recipeResult, supplyResult) => ({
  success: true,
  totalConsumed: roundQuantity(
    toNumber(recipeResult?.totalConsumed) + toNumber(supplyResult?.totalConsumed),
  ),
  movements: [
    ...(recipeResult?.movements || []),
    ...(supplyResult?.movements || []),
  ],
  lowStocks: [
    ...(recipeResult?.lowStocks || []),
    ...(supplyResult?.lowStocks || []),
  ],
});

export async function checkAvailabilityForLinesTx(args) {
  return withOptionalTransaction(args?.session, async (session) => {
    const { recipeLines, supplyLines } = await partitionInventoryLines({
      restaurantId: args.restaurantId,
      lines: args.lines,
      session,
    });
    const recipeResult = recipeLines.length
      ? await recipeInventory.checkAvailabilityForLinesTx({
          ...args,
          lines: recipeLines,
          session,
        })
      : {
          isAvailable: true,
          maxAvailable: Number.MAX_SAFE_INTEGER,
          shortages: [],
        };
    const supplyResult = supplyLines.length
      ? await getSupplyAvailability({
          restaurantId: args.restaurantId,
          warehouseId: args.warehouseId,
          supplyLines,
          session,
        })
      : {
          isAvailable: true,
          maxAvailable: Number.MAX_SAFE_INTEGER,
          shortages: [],
        };
    const maxAvailable = Math.min(
      recipeResult.maxAvailable,
      supplyResult.maxAvailable,
    );
    return {
      isAvailable: recipeResult.isAvailable && supplyResult.isAvailable,
      maxAvailable:
        maxAvailable === Number.MAX_SAFE_INTEGER ? 0 : maxAvailable,
      shortages: [
        ...(recipeResult.shortages || []),
        ...(supplyResult.shortages || []),
      ],
    };
  });
}

export async function reserveForOrderTx(args) {
  return withOptionalTransaction(args?.session, async (session) => {
    const { recipeLines, supplyLines } = await partitionInventoryLines({
      restaurantId: args.restaurantId,
      lines: args.lines,
      session,
    });
    const recipeResult = recipeLines.length
      ? await recipeInventory.reserveForOrderTx({
          ...args,
          lines: recipeLines,
          session,
        })
      : null;
    if (supplyLines.length) {
      await reserveSupplies({
        restaurantId: args.restaurantId,
        warehouseId: args.warehouseId,
        supplyLines,
        allowNegative: args.allowNegative,
        session,
      });
    }
    return mergeOperationResults(recipeResult, null);
  });
}

export async function cancelReservationForOrderTx(args) {
  return withOptionalTransaction(args?.session, async (session) => {
    const { recipeLines, supplyLines } = await partitionInventoryLines({
      restaurantId: args.restaurantId,
      lines: args.lines,
      session,
    });
    const recipeResult = recipeLines.length
      ? await recipeInventory.cancelReservationForOrderTx({
          ...args,
          lines: recipeLines,
          session,
        })
      : null;
    if (supplyLines.length) {
      await cancelSupplyReservations({
        restaurantId: args.restaurantId,
        warehouseId: args.warehouseId,
        supplyLines,
        session,
      });
    }
    return mergeOperationResults(recipeResult, null);
  });
}

export async function commitReservationForOrderTx(args) {
  return withOptionalTransaction(args?.session, async (session) => {
    const { recipeLines, supplyLines } = await partitionInventoryLines({
      restaurantId: args.restaurantId,
      lines: args.lines,
      session,
    });
    const recipeResult = recipeLines.length
      ? await recipeInventory.commitReservationForOrderTx({
          ...args,
          lines: recipeLines,
          session,
        })
      : null;
    const supplyResult = supplyLines.length
      ? await consumeSupplies({
          restaurantId: args.restaurantId,
          warehouseId: args.warehouseId,
          orderCode: args.orderCode,
          supplyLines,
          allowNegative: args.allowNegative,
          fromReservation: true,
          session,
        })
      : null;
    return mergeOperationResults(recipeResult, supplyResult);
  });
}

export async function consumeForOrderTx(args) {
  return withOptionalTransaction(args?.session, async (session) => {
    const { recipeLines, supplyLines } = await partitionInventoryLines({
      restaurantId: args.restaurantId,
      lines: args.lines,
      session,
    });
    const recipeResult = recipeLines.length
      ? await recipeInventory.consumeForOrderTx({
          ...args,
          lines: recipeLines,
          session,
        })
      : null;
    const supplyResult = supplyLines.length
      ? await consumeSupplies({
          restaurantId: args.restaurantId,
          warehouseId: args.warehouseId,
          orderCode: args.orderCode,
          supplyLines,
          allowNegative: args.allowNegative,
          fromReservation: false,
          session,
        })
      : null;
    return mergeOperationResults(recipeResult, supplyResult);
  });
}
