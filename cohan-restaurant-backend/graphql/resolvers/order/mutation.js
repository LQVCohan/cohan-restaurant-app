// src/graphql/resolvers/order/mutation.js

import mongoose from "mongoose";

import {
  Order,
  Reservation,
  TableCustomer,
  Warehouse,
  Recipe,
  Ingredient,
  ModifierGroup,
  CheckoutSession,
  Coupon,
  Customer,
  User,
  WalletTransaction,
  PrintSetting,
} from "../../../models/index.js";

import { normalizeItem, toId } from "./helper/orderUtils.js";
import { emitOrderEvent } from "./helper/emitOrderEvent.js";
import { ensureUserForOrder, resolveTable } from "./helper/userUtils.js";
import { markTableStatus } from "./helper/tableUtils.js";
import { createOrderTrackingEvent } from "./helper/tracking.js";
import generateOrderCode from "../../../utils/generateOrderCode.js";

import {
  reserveForOrderTx,
  commitReservationForOrderTx,
  cancelReservationForOrderTx,
} from "../../../src/services/inventory.service.js";

const RESERVABLE_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "customer_attached",
];
const COMMIT_STATUSES = ["preparing", "ready", "served", "completed"];
const RANK_POINT_DIVISOR = 1_000_000;

const CANCELLED_ITEM_STATUSES = ["cancelled", "returned"];
const PRINT_STATIONS = {
  kitchen: "kitchen",
  bar: "bar",
  cashier: "cashier",
};

function mapItemToStation(item = {}) {
  const categoryName = String(item?.categoryName || item?.category?.name || "").toLowerCase();
  const itemName = String(item?.name || "").toLowerCase();
  const isDrink = categoryName.includes("drink") || categoryName.includes("đồ uống") || itemName.includes("nước");
  return isDrink ? PRINT_STATIONS.bar : PRINT_STATIONS.kitchen;
}

async function enqueuePrintJobsForConfirmedOrder({ order, printType = "order_confirmed" }) {
  if (!order?.restaurantId || !Array.isArray(order?.items) || order.currentStatus !== "confirmed") return [];
  const printSetting = await PrintSetting.findOne({ restaurantId: order.restaurantId }).lean();
  if (!printSetting) return [];
  const stationPrinters = printSetting?.stations || {};
  const itemsByStation = order.items.reduce((acc, item) => {
    const stationId = mapItemToStation(item);
    if (!acc[stationId]) acc[stationId] = [];
    acc[stationId].push(item);
    return acc;
  }, {});

  const jobs = Object.entries(itemsByStation)
    .filter(([stationId]) => Array.isArray(stationPrinters?.[stationId]) && !!stationPrinters[stationId][0])
    .map(([stationId, items]) => {
      const printerId = stationPrinters[stationId][0];
      const createdAt = new Date().toISOString();
      return {
        id: `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        orderId: String(order._id),
        stationId,
        stationType: stationId,
        printerId,
        printType,
        items: (items || []).map((it) => ({
          orderItemId: String(it?._id || ""),
          dishId: String(it?.dishId || ""),
          name: it?.name || "",
          quantity: Number(it?.quantity || 0),
          note: it?.note || "",
        })),
        status: "pending",
        retryCount: 0,
        payload: { orderCode: order.orderCode, tableCode: order.tableCode },
        createdAt,
        printedAt: null,
        updatedAt: createdAt,
      };
    });
  if (!jobs.length) return [];
  await PrintSetting.updateOne(
    { _id: printSetting._id },
    {
      $push: { jobs: { $each: jobs, $position: 0, $slice: 300 } },
      $set: { updatedAt: new Date() },
    }
  );
  return jobs;
}

async function enqueueTemporaryBillPrintJob(order) {
  if (!order?.restaurantId || order.currentStatus !== "confirmed") {
    return { jobs: [], message: "Only confirmed orders can be printed" };
  }

  const printSetting = await PrintSetting.findOne({ restaurantId: order.restaurantId }).lean();
  if (!printSetting) {
    return { jobs: [], message: "Chưa cấu hình in cho nhà hàng." };
  }

  const cashierPrinters = Array.isArray(printSetting?.stations?.[PRINT_STATIONS.cashier])
    ? printSetting.stations[PRINT_STATIONS.cashier]
    : [];
  const printerId = cashierPrinters[0];
  if (!printerId) {
    return { jobs: [], message: "Chưa cấu hình máy in thu ngân." };
  }

  const createdAt = new Date().toISOString();
  const job = {
    id: `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    orderId: String(order._id),
    stationId: PRINT_STATIONS.cashier,
    stationType: PRINT_STATIONS.cashier,
    printerId,
    printType: "temporary_bill",
    items: [],
    status: "pending",
    retryCount: 0,
    payload: { orderCode: order.orderCode, tableCode: order.tableCode },
    createdAt,
    printedAt: null,
    updatedAt: createdAt,
  };

  await PrintSetting.updateOne(
    { _id: printSetting._id },
    {
      $push: { jobs: { $each: [job], $position: 0, $slice: 300 } },
      $set: { updatedAt: new Date() },
    }
  );

  return { jobs: [job], message: "Đã tạo job in tạm tính." };
}

function normalizePriorityLevel(value) {
  const key = String(value || "").toUpperCase();
  if (["LOW", "MEDIUM", "HIGH"].includes(key)) return key;
  return "MEDIUM";
}

async function syncCustomerMetricsByOrderUser(userId) {
  if (!userId || !mongoose.isValidObjectId(userId)) return;
  const uid = toId(userId);
  if (!uid) return;

  const completedOrders = await Order.find({
    userId: uid,
    currentStatus: "completed",
    "payment.status": { $in: ["paid", "partially_refunded", "refunded"] },
  }).lean();

  const totalSpending = completedOrders.reduce(
    (sum, o) => sum + Number(o?.totals?.grandTotal || 0),
    0
  );
  const totalOrders = completedOrders.length;
  const loyaltyPoints = Math.max(
    0,
    Math.floor((Number(totalSpending) || 0) / RANK_POINT_DIVISOR)
  );
  const customerType =
    loyaltyPoints >= 20 ? "VIP" : loyaltyPoints >= 5 ? "OFTEN" : "NEW";

  await Customer.findByIdAndUpdate(uid, {
    totalSpending,
    totalOrders,
    loyaltyPoints,
    customerType,
  });
}

/** =========================
 * Guards
 * ========================= */
function assertPositiveIntegerGrams(v, field = "weightGrams") {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(
      `${field} must be a positive integer (grams). Có lỗi trong chuyển đổi sang đơn vị chuẩn.`
    );
  }
  return n;
}

function assertPositiveNumber(v, field = "quantity") {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${field} must be > 0`);
  return n;
}

/** =========================
 * Inventory line builders (NEW STANDARD)
 * - REQUIRED servingKey
 * - BY_WEIGHT requires weightGrams integer (grams)
 * ========================= */
function buildInventoryLineFromItem(it) {
  if (!it) return null;

  const menuItemId = it.dishId;
  if (!menuItemId) return null;

  const servingKey = it.servingKey ? String(it.servingKey).trim() : "";
  if (!servingKey) {
    throw new Error(
      "servingKey is required for inventory. Có lỗi trong chuyển đổi sang đơn vị chuẩn."
    );
  }

  const mode = it.servingVariant?.mode ?? null;

  if (mode === "BY_WEIGHT") {
    const grams = assertPositiveIntegerGrams(it.weightGrams, "weightGrams");
    return {
      menuItemId,
      quantity: 1,
      weightGrams: grams,
      servingKey,
      servingMode: "BY_WEIGHT",
      preparationMethodName: it.servingVariant?.name ?? null,
    };
  }

  const qty = assertPositiveNumber(it.quantity ?? 1, "quantity");

  let gramsOrNull = null;
  if (it.weightGrams != null) {
    gramsOrNull = assertPositiveIntegerGrams(it.weightGrams, "weightGrams");
  }

  return {
    menuItemId,
    quantity: qty,
    weightGrams: gramsOrNull,
    servingKey,
    servingMode: it.servingVariant?.mode ?? null,
    preparationMethodName: it.servingVariant?.name ?? null,
  };
}

function buildInventoryLinesFromItems(items = []) {
  return (items || [])
    .filter((it) => it && !CANCELLED_ITEM_STATUSES.includes(it.status))
    .map(buildInventoryLineFromItem)
    .filter(Boolean);
}

/** =========================
 * Unit conversion to ingredient.baseUnit
 * ========================= */
function convertToBaseUnitQty(ingredientDoc, qty, unit) {
  const baseUnit = ingredientDoc?.baseUnit;
  if (!baseUnit) throw new Error("Ingredient missing baseUnit");

  if (unit === baseUnit) return qty;

  const convs = ingredientDoc?.conversions || [];

  const direct = convs.find((c) => c.from === unit && c.to === baseUnit);
  if (direct) return qty * Number(direct.ratio);

  const reverse = convs.find((c) => c.from === baseUnit && c.to === unit);
  if (reverse) return qty / Number(reverse.ratio);

  const key = `${unit}->${baseUnit}`;
  const table = {
    "kg->g": 1000,
    "g->kg": 1 / 1000,
    "l->ml": 1000,
    "ml->l": 1 / 1000,
  };
  if (table[key]) return qty * table[key];

  throw new Error(
    `No conversion from ${unit} to baseUnit ${baseUnit} for ingredient ${
      ingredientDoc?.name || ""
    }`
  );
}

/** =========================
 * Normalize BY_WEIGHT grams (if needed)
 * ========================= */
function normalizeItemWeightGrams(it) {
  if (it?.servingVariant?.mode !== "BY_WEIGHT") return;

  if (it.weightGrams != null) return;

  const qty = Number(it.quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("BY_WEIGHT item missing weightGrams/quantity");
  }

  const u = (it.unit || "kg").toString();
  const grams = u === "g" ? Math.round(qty) : Math.round(qty * 1000);
  it.weightGrams = grams;
}
function validateIncomingOrderItems(items = []) {
  for (const it of items || []) {
    const mode = it?.servingVariant?.mode;
    if (mode !== "BY_WEIGHT") continue;

    const grams = Number(it.weightGrams);
    if (!Number.isFinite(grams) || grams <= 0) {
      throw new Error("BY_WEIGHT items require weightGrams > 0");
    }
    const proofImages = Array.isArray(it.proofImages) ? it.proofImages.filter(Boolean) : [];
    if (!proofImages.length) {
      throw new Error("BY_WEIGHT items require at least one proof image");
    }
    if (!it?.servingKey || !it?.servingVariant?.key) {
      throw new Error("BY_WEIGHT items require valid servingKey/servingVariant");
    }
  }
}



/** =========================
 * Compute factor from variant (scale recipe lines)
 * - PORTION: factor = item.quantity
 * - BY_WEIGHT: factor = soldAmount / sellQty
 * ========================= */
function computeFactorFromVariant({ v, it }) {
  if (v.mode === "BY_WEIGHT") {
    const grams = Number(it.weightGrams);
    if (!Number.isFinite(grams) || grams <= 0)
      throw new Error("BY_WEIGHT requires weightGrams > 0");

    const sold = v.sellUnit === "g" ? grams : grams / 1000; // kg
    const sellQty = Number(v.sellQty || 1);
    return sold / sellQty;
  }

  const qty = Number(it.quantity || 1);
  if (!Number.isFinite(qty) || qty <= 0)
    throw new Error("quantity must be > 0");
  return qty;
}

/** =========================
 * Modifier helpers (NEW MODEL)
 * - selected modifiers input expected: [{groupId, optionId}]
 * - build snapshot: groupName, optionName, priceRule, inventoryRule
 * - validate group applicability by coverage (GLOBAL/ITEMS)
 * - validate required/min/max/selectionType
 * ========================= */

function normalizeSelectedModifiers(inputMods) {
  const arr = Array.isArray(inputMods) ? inputMods : [];
  return arr.map((m) => {
    const gid = m?.groupId ? String(m.groupId) : "";
    const oid = m?.optionId ? String(m.optionId) : "";
    const groupId = toId(gid);
    const optionId = toId(oid);
    if (!groupId) throw new Error("Invalid modifier.groupId");
    if (!optionId) throw new Error("Invalid modifier.optionId");
    return { groupId, optionId };
  });
}

function getApplicableGroupsForDish({ groups, dishId }) {
  const did = String(dishId);
  return (groups || []).filter((g) => {
    if (!g?.isActive) return false;
    if (g.coverage === "GLOBAL") return true;
    if (g.coverage === "ITEMS") {
      const ids = (g.menuItemIds || []).map((x) => String(x));
      return ids.includes(did);
    }
    return false;
  });
}

function validateGroupSelection({ applicableGroups, selectedByGroup }) {
  for (const g of applicableGroups) {
    const gid = String(g._id);
    const chosen = selectedByGroup.get(gid) || [];

    const required = !!g.required;
    const selectionType = g.selectionType || "multiple";
    const minSelected = Number(g.minSelected ?? 0);
    const maxSelected = g.maxSelected != null ? Number(g.maxSelected) : null;

    if (!required && chosen.length === 0) continue;

    if (selectionType === "single") {
      if (required && chosen.length < 1)
        throw new Error(`Missing required modifier group "${g.name}"`);
      if (chosen.length > 1)
        throw new Error(`Group "${g.name}" allows only 1 option`);
    } else {
      const needMin = required ? Math.max(1, minSelected) : minSelected;
      if (chosen.length < needMin)
        throw new Error(`Need more options in group "${g.name}"`);
      if (maxSelected != null && chosen.length > maxSelected)
        throw new Error(`Too many options in group "${g.name}"`);
    }
  }
}

function buildModifierSnapshotsForItem({ it, groups }) {
  const selected = normalizeSelectedModifiers(it.modifiers);
  if (!selected.length) {
    it.modifiers = [];
    return;
  }

  const selectedByGroup = new Map(); // gid(string) -> [oid(string)]
  for (const s of selected) {
    const gid = String(s.groupId);
    const oid = String(s.optionId);
    const list = selectedByGroup.get(gid) || [];
    list.push(oid);
    selectedByGroup.set(gid, list);
  }

  const applicable = getApplicableGroupsForDish({ groups, dishId: it.dishId });
  validateGroupSelection({ applicableGroups: applicable, selectedByGroup });

  const groupMap = new Map((groups || []).map((g) => [String(g._id), g]));

  const nextMods = [];

  for (const [gid, optionIds] of selectedByGroup.entries()) {
    const g = groupMap.get(gid);
    if (!g) throw new Error(`ModifierGroup not found: ${gid}`);

    const isApplicable = applicable.some((x) => String(x._id) === gid);
    if (!isApplicable)
      throw new Error(
        `ModifierGroup "${g.name}" is not applicable to this item`
      );

    const uniqueOptionIds = [...new Set(optionIds)];
    if (uniqueOptionIds.length !== optionIds.length)
      throw new Error(`Duplicate options in group "${g.name}"`);

    if (g.selectionType === "single" && uniqueOptionIds.length > 1) {
      throw new Error(`Group "${g.name}" allows only 1 option`);
    }

    // Snapshot options
    for (const oid of uniqueOptionIds) {
      const opt = (g.options || []).find((o) => String(o._id) === oid);
      if (!opt) throw new Error(`Option ${oid} not found in group "${g.name}"`);
      if (opt.isActive === false)
        throw new Error(`Option "${opt.name}" is inactive`);

      // Basic rule sanity
      if (!opt.priceRule?.rule)
        throw new Error(`Option "${opt.name}" missing priceRule.rule`);
      if (
        opt.priceRule.amount == null ||
        Number.isNaN(Number(opt.priceRule.amount))
      )
        throw new Error(`Option "${opt.name}" missing priceRule.amount`);
      if (!opt.inventoryRule?.rule)
        throw new Error(`Option "${opt.name}" missing inventoryRule.rule`);

      nextMods.push({
        groupId: toId(gid),
        groupName: g.name,
        optionId: toId(oid),
        optionName: opt.name,
        priceRule: {
          rule: opt.priceRule.rule,
          amount: Number(opt.priceRule.amount),
        },
        inventoryRule: {
          rule: opt.inventoryRule.rule,
          ingredientLines: (opt.inventoryRule.ingredientLines || []).map(
            (l) => ({
              ingredientId: toId(l.ingredientId),
              qty: Number(l.qty),
              unit: l.unit,
              wastePct: Number(l.wastePct ?? 0),
            })
          ),
          baseRecipeMultiplier:
            opt.inventoryRule.rule === "MULTIPLY_BASE_RECIPE"
              ? Number(opt.inventoryRule.baseRecipeMultiplier)
              : undefined,
          note: opt.inventoryRule.note ?? undefined,
        },
      });
    }
  }

  // Professional constraints:
  const setCount = nextMods.filter((m) => m.priceRule?.rule === "SET").length;
  if (setCount > 1)
    throw new Error("Only one SET price modifier is allowed per item");

  const multCount = nextMods.filter(
    (m) => m.inventoryRule?.rule === "MULTIPLY_BASE_RECIPE"
  ).length;
  if (multCount > 1)
    throw new Error(
      "Only one MULTIPLY_BASE_RECIPE modifier is allowed per item"
    );

  it.modifiers = nextMods;
}

function computeUnitPriceFromModifiers(basePrice, modifiers = []) {
  const set = modifiers.find((m) => m.priceRule?.rule === "SET");
  const setPrice = set ? Number(set.priceRule.amount) : null;

  const delta = modifiers
    .filter((m) => m.priceRule?.rule === "DELTA")
    .reduce((acc, m) => acc + Number(m.priceRule.amount || 0), 0);

  const unitPrice = Math.max(
    0,
    (setPrice != null ? setPrice : Number(basePrice)) + delta
  );
  return {
    baseUnitPrice: Number(basePrice),
    unitPrice,
    modifiersPricePerUnit: unitPrice - Number(basePrice),
  };
}

function computeLineSubtotal({ it, v, unitPrice }) {
  if (v.mode === "BY_WEIGHT") {
    const grams = assertPositiveIntegerGrams(it.weightGrams, "weightGrams");
    const sold = v.sellUnit === "g" ? grams : grams / 1000; // kg
    const sellQty = Number(v.sellQty || 1);
    const factor = sold / sellQty;
    return Math.round(unitPrice * factor);
  }

  const qty = assertPositiveNumber(it.quantity || 1, "quantity");
  return Math.round(unitPrice * qty);
}

/** =========================
 * Apply modifier inventory rules to base recipe lines
 * - MULTIPLY_BASE_RECIPE: multiply base lines once
 * - ADD_INGREDIENTS: add
 * - REPLACE_INGREDIENTS: override ingredient line
 * ========================= */
function applyModifierInventoryRules({ baseLines, factor, modifiers }) {
  const map = new Map(); // ingredientId -> {ingredientId, qty, unit, wastePct}

  for (const l of baseLines) {
    map.set(String(l.ingredientId), { ...l });
  }

  const mult = modifiers.find(
    (m) => m.inventoryRule?.rule === "MULTIPLY_BASE_RECIPE"
  );
  if (mult) {
    const f = Number(mult.inventoryRule.baseRecipeMultiplier);
    if (!Number.isFinite(f) || f <= 0)
      throw new Error("Invalid baseRecipeMultiplier");
    for (const [k, v] of map.entries()) {
      map.set(k, { ...v, qty: Number(v.qty) * f });
    }
  }

  for (const m of modifiers) {
    const rule = m.inventoryRule?.rule;
    if (!["ADD_INGREDIENTS", "REPLACE_INGREDIENTS"].includes(rule)) continue;

    const lines = Array.isArray(m.inventoryRule.ingredientLines)
      ? m.inventoryRule.ingredientLines
      : [];

    for (const l of lines) {
      const waste = Number(l.wastePct || 0) / 100;
      const qtyScaled = Number(l.qty || 0) * factor;
      const qtyWithWaste = qtyScaled * (1 + waste);
      const key = String(l.ingredientId);

      if (rule === "ADD_INGREDIENTS") {
        const cur = map.get(key);
        if (!cur) {
          map.set(key, {
            ingredientId: l.ingredientId,
            qty: qtyWithWaste,
            unit: l.unit,
            wastePct: Number(l.wastePct || 0),
          });
        } else {
          if (String(cur.unit) !== String(l.unit)) {
            throw new Error(
              `Inventory unit conflict for ingredient ${key} (need consistent unit)`
            );
          }
          map.set(key, { ...cur, qty: Number(cur.qty) + qtyWithWaste });
        }
      }

      if (rule === "REPLACE_INGREDIENTS") {
        map.set(key, {
          ingredientId: l.ingredientId,
          qty: qtyWithWaste,
          unit: l.unit,
          wastePct: Number(l.wastePct || 0),
        });
      }
    }
  }

  return [...map.values()];
}

/** =========================
 * Hydrate full order items:
 * - recipe + servingKey -> servingVariant snapshot
 * - modifiers snapshot from ModifierGroup new model
 * - ingredientsSnapshot = base recipe + modifiers inventory rules
 * - pricing: SET + DELTA
 * ========================= */
async function hydrateOrderItems({ restaurantId, items, session }) {
  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId");

  const menuItemIds = [
    ...new Set(items.map((it) => String(it.dishId)).filter(Boolean)),
  ].map(toId);

  // 1) load recipes
  const recipes = await Recipe.find({
    restaurantId: rid,
    menuItemId: { $in: menuItemIds },
  })
    .session(session)
    .lean();

  const recipeMap = new Map(recipes.map((r) => [String(r.menuItemId), r]));

  // 2) load modifier groups (GLOBAL or ITEMS intersect menuItemIds)
  const groups = await ModifierGroup.find({
    restaurantId: rid,
    isActive: true,
    $or: [
      { coverage: "GLOBAL" },
      { coverage: "ITEMS", menuItemIds: { $in: menuItemIds } },
    ],
  })
    .session(session)
    .lean({ virtuals: true });

  // 3) collect ingredient ids needed (base recipe + modifier ingredient lines)
  const ingredientIds = new Set();

  for (const it of items) {
    const recipe = recipeMap.get(String(it.dishId));
    if (!recipe)
      throw new Error(`Recipe not found for menuItemId=${it.dishId}`);

    const key = String(it.servingKey || "").trim();
    const v = recipe.servingVariants?.find((x) => String(x.key) === key);
    if (!v)
      throw new Error(
        `ServingVariant key="${key}" not found in recipe for menuItemId=${it.dishId}`
      );

    for (const line of v.ingredients || []) {
      ingredientIds.add(String(line.ingredientId));
    }
  }

  // Also add modifier ingredientLines (for snapshot cost conversion)
  for (const g of groups) {
    for (const opt of g.options || []) {
      const lines = opt?.inventoryRule?.ingredientLines || [];
      for (const l of lines) {
        if (l?.ingredientId) ingredientIds.add(String(l.ingredientId));
      }
    }
  }

  const ingDocs = await Ingredient.find({
    _id: { $in: [...ingredientIds].map(toId) },
  })
    .session(session)
    .lean();

  const ingMap = new Map(ingDocs.map((d) => [String(d._id), d]));

  // 4) hydrate each item
  for (const it of items) {
    const recipe = recipeMap.get(String(it.dishId));
    const key = String(it.servingKey || "").trim();
    const v = recipe.servingVariants.find((x) => String(x.key) === key);

    // servingVariant snapshot
    it.servingVariant = {
      key: v.key,
      name: v.name || v.key,
      mode: v.mode,
      price: Number(v.price || 0),
      sellQty: Number(v.sellQty || 1),
      sellUnit: String(v.sellUnit || (v.mode === "PORTION" ? "portion" : "kg")),
    };

    normalizeItemWeightGrams(it);

    // modifier snapshots + validations
    buildModifierSnapshotsForItem({ it, groups });

    // factor
    const factor = computeFactorFromVariant({ v, it });

    // base lines scaled + waste
    const baseLines = [];
    for (const line of v.ingredients || []) {
      const ing = ingMap.get(String(line.ingredientId));
      if (!ing) throw new Error(`Ingredient not found: ${line.ingredientId}`);

      const waste = Number(line.wastePct || 0) / 100;
      const qtyNeed = Number(line.qty || 0) * factor;
      const qtyWithWaste = qtyNeed * (1 + waste);

      baseLines.push({
        ingredientId: toId(line.ingredientId),
        qty: qtyWithWaste,
        unit: line.unit,
        wastePct: Number(line.wastePct || 0),
      });
    }

    // apply modifiers inventory rules
    const finalLines = applyModifierInventoryRules({
      baseLines,
      factor,
      modifiers: it.modifiers || [],
    });

    // build ingredientsSnapshot
    const snap = [];
    for (const line of finalLines) {
      const ing = ingMap.get(String(line.ingredientId));
      if (!ing) throw new Error(`Ingredient not found: ${line.ingredientId}`);

      const baseQty = convertToBaseUnitQty(ing, Number(line.qty), line.unit);
      const cpu =
        ing.costPerBaseUnit != null ? Number(ing.costPerBaseUnit) : null;

      snap.push({
        ingredientId: toId(line.ingredientId),
        name: ing.name,
        quantity: Number(line.qty),
        unit: line.unit,
        baseUnitQuantity: baseQty,
        costPerBaseUnit: cpu,
        totalCost: cpu != null ? baseQty * cpu : null,
      });
    }
    it.ingredientsSnapshot = snap;

    // pricing snapshot
    const { baseUnitPrice, unitPrice, modifiersPricePerUnit } =
      computeUnitPriceFromModifiers(
        it.servingVariant.price,
        it.modifiers || []
      );

    it.baseUnitPrice = baseUnitPrice;
    it.unitPrice = unitPrice;
    it.modifiersPricePerUnit = modifiersPricePerUnit;

    it.lineSubtotal = computeLineSubtotal({ it, v, unitPrice });
  }
}

/** =========================
 * Totals from hydrated items
 * ========================= */
function computeTotalsFromHydratedItems(items = [], pricing = {}) {
  let subtotal = 0;

  for (const it of items) {
    if (!CANCELLED_ITEM_STATUSES.includes(it.status)) {
      subtotal += Number(it.lineSubtotal || 0);
    }
  }

  subtotal = Math.round(subtotal);

  const serviceRate = Math.max(0, Number(pricing.serviceRate || 0));
  const taxRate = Math.max(0, Number(pricing.taxRate || 0));
  const promotionDiscount = Math.max(0, Number(pricing.promotionDiscount || 0));
  const voucherDiscount = Math.max(0, Number(pricing.voucherDiscount || 0));
  const shippingFee = Math.max(0, Number(pricing.shippingFee || 0));

  const service = Math.round(subtotal * serviceRate);
  const discount = Math.min(subtotal + service, promotionDiscount + voucherDiscount);
  const beforeTax = Math.max(0, subtotal + service - discount);
  const tax = Math.round(beforeTax * taxRate);
  const grandTotal = Math.round(beforeTax + tax + shippingFee);

  return {
    subtotal,
    discount,
    tax,
    service,
    shippingFee,
    grandTotal,
    taxRate,
    serviceRate,
    voucherCode: pricing.voucherCode || undefined,
  };
}

async function resolveVoucherDiscount({
  restaurantId,
  voucherCode,
  subtotal,
  userId,
  session,
}) {
  const code = String(voucherCode || "").trim().toUpperCase();
  if (!code) return null;

  const now = new Date();
  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId for voucher");

  const coupon = await Coupon.findOne({
    restaurantId: rid,
    code,
    isActive: true,
  }).session(session);

  // Keep query readable: startAt/endAt may be missing in old docs
  const validCoupon =
    coupon &&
    (!coupon.publishAt || coupon.publishAt <= now) &&
    (!coupon.startAt || coupon.startAt <= now) &&
    (!coupon.endAt || coupon.endAt >= now);

  if (!validCoupon) throw new Error("Invalid voucher: not found or not active");

  const minOrderValue = Math.max(0, Number(coupon.minOrderValue || 0));
  if (Number(subtotal || 0) < minOrderValue) {
    throw new Error(`Invalid voucher: minimum order value is ${minOrderValue}`);
  }

  const maxUsage = Number(coupon.maxUsage || 0);
  const used = Number(coupon.used || 0);
  if (maxUsage > 0 && used >= maxUsage) {
    throw new Error("Invalid voucher: usage limit reached");
  }

  let discount = 0;
  const discountValue = Number(coupon.discountValue || 0);
  if (coupon.discountType === "PERCENT") {
    discount = (Number(subtotal || 0) * discountValue) / 100;
    const maxDiscount = Number(coupon.maxDiscount || 0);
    if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);
  } else {
    discount = discountValue;
  }

  discount = Math.max(0, Math.min(Number(subtotal || 0), Math.round(discount)));

  return {
    couponId: coupon._id,
    voucherCode: code,
    voucherDiscount: discount,
    discountReason: `coupon:${coupon._id}${userId ? `;user:${userId}` : ""}`,
  };
}

/** =========================
 * Find / create orderCode
 * ========================= */
async function findOrCreateOrderCode({
  restaurantId,
  tableId,
  tableCode,
  requestedOrderCode,
  session,
}) {
  if (requestedOrderCode && String(requestedOrderCode).trim()) {
    return String(requestedOrderCode).trim();
  }

  const activeResQuery = Reservation.findOne(
    {
      restaurantId: toId(restaurantId),
      tableId: toId(tableId),
      status: { $in: ["pending_payment", "confirmed", "seated"] },
    },
    { orderCode: 1 }
  ).sort({ createdAt: -1 });

  if (session) activeResQuery.session(session);
  const activeRes = await activeResQuery.lean();

  if (activeRes?.orderCode) return activeRes.orderCode;

  const firstOrderQuery = Order.findOne(
    {
      restaurantId: toId(restaurantId),
      tableCode,
      currentStatus: { $nin: ["completed", "cancelled", "failed"] },
    },
    { orderCode: 1, createdAt: 1 }
  ).sort({ createdAt: 1, _id: 1 });

  if (session) firstOrderQuery.session(session);
  const firstOrder = await firstOrderQuery.lean();

  if (firstOrder?.orderCode) return firstOrder.orderCode;

  return generateOrderCode("POS", new Date(), tableCode || null);
}

/** =========================
 * Upsert TableCustomer
 * ========================= */
async function upsertTableCustomerFromOrder({
  restaurantId,
  tableId,
  tableCode,
  customer,
  note,
  session,
}) {
  if (!restaurantId || (!tableId && !tableCode)) return;

  const rid = toId(restaurantId);
  if (!rid) return;

  const tid = tableId ? toId(tableId) : null;

  const cond =
    tid != null
      ? { restaurantId: rid, tableId: tid }
      : { restaurantId: rid, tableCode: String(tableCode) };

  const fullName = (customer?.fullName || customer?.name || "").trim() || null;
  const phone = customer?.phone ? String(customer.phone).trim() : null;
  const email = customer?.email ? String(customer.email).trim() : null;

  const update = {
    $set: {
      restaurantId: rid,
      ...(tid != null ? { tableId: tid } : {}),
      ...(tableCode ? { tableCode: String(tableCode) } : {}),
      customerName: fullName,
      customerPhone: phone,
      customerEmail: email,
      note: note ?? null,
      updatedAt: new Date(),
    },
    $setOnInsert: { createdAt: new Date() },
  };

  await TableCustomer.findOneAndUpdate(cond, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    session: session || undefined,
  }).lean();
}

/** =========================
 * Resolve warehouse id (session-aware)
 * ========================= */
async function resolveWarehouseIdOrDefault(
  restaurantId,
  warehouseIdInput,
  session
) {
  const rid = toId(restaurantId);
  if (!rid) throw new Error("Invalid restaurantId for warehouse resolution");

  if (warehouseIdInput) {
    const wid = toId(warehouseIdInput);
    if (!wid) throw new Error("Invalid warehouseId");
    return wid;
  }

  const q = Warehouse.findOne({ restaurantId: rid, isActive: true }).sort({
    createdAt: 1,
    _id: 1,
  });

  if (session) q.session(session);

  const wh = await q.lean();
  if (!wh) throw new Error("No warehouse found for this restaurant");
  return wh._id;
}

/** =========================
 * Shipping builder (off-premise)
 * ========================= */
function buildShippingForOffPremise(orderType, shipping = {}, customer = {}) {
  const s = shipping || {};
  const c = customer || {};
  const baseLocation = s.location || s.customerLocation || null;

  return {
    fullName: s.fullName || c.fullName || c.name || null,
    phone: s.phone || c.phone || null,
    email: s.email || c.email || null,
    address: s.address || null,
    note: s.note || null,

    location: baseLocation
      ? {
          lat: baseLocation.lat ?? null,
          lng: baseLocation.lng ?? null,
          address: baseLocation.address ?? s.address ?? null,
        }
      : undefined,

    distance: s.distance ?? null,
    shippingFee: s.shippingFee ?? 0,

    deliveryMethod: s.deliveryMethod || null,
    deliveryTime: s.deliveryTime || null,
    scheduleDate: s.scheduleDate || null,
    scheduleTime: s.scheduleTime || null,

    customerLocation: s.customerLocation
      ? {
          lat: s.customerLocation.lat ?? null,
          lng: s.customerLocation.lng ?? null,
          address: s.customerLocation.address ?? null,
        }
      : undefined,

    restaurantLocation: s.restaurantLocation
      ? {
          lat: s.restaurantLocation.lat ?? null,
          lng: s.restaurantLocation.lng ?? null,
          address: s.restaurantLocation.address ?? null,
        }
      : undefined,

    driverLocation: s.driverLocation
      ? {
          lat: s.driverLocation.lat ?? null,
          lng: s.driverLocation.lng ?? null,
          address: s.driverLocation.address ?? null,
          accuracy: s.driverLocation.accuracy ?? null,
          speed: s.driverLocation.speed ?? null,
          bearing: s.driverLocation.bearing ?? null,
          updatedAt: s.driverLocation.updatedAt || new Date(),
        }
      : undefined,

    driverName: s.driverName || null,
    driverPhone: s.driverPhone || null,
    driverAvatar: s.driverAvatar || null,
    driverVehiclePlate: s.driverVehiclePlate || null,

    deliveryStatus: s.deliveryStatus || "pending",

    duration: s.duration ?? null,
    eta: s.eta ? new Date(s.eta) : null,

    externalTrackingCode: s.externalTrackingCode || null,
  };
}

export const OrderMutation = {
  /** =========================================
   * CREATE TABLE ORDER (dine_in)
   * - reserve inventory (atomic with order)
   * ========================================= */
  async createOrderForTable(_, { input }, ctx) {
    const {
      restaurantId,
      tableId,
      tableCode,
      orderCode,
      items,
      note,
      customer,
      userId,
      clientMeta,
      warehouseId,
    } = input || {};

    const rid = toId(restaurantId);
    if (!rid) throw new Error("restaurantId is required");
    if (!Array.isArray(items) || items.length === 0)
      throw new Error("items is required");

    const tableInfo = await resolveTable(restaurantId, { tableId, tableCode });
    if (!tableInfo) throw new Error("Table not found");

    const activeReservation = await Reservation.findOne({
      restaurantId: rid,
      tableId: toId(tableInfo.tableId),
      status: { $in: ["pending_payment", "confirmed", "seated"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const reservationCustomer =
      activeReservation &&
      (activeReservation.customerName ||
        activeReservation.customerPhone ||
        activeReservation.customerEmail)
        ? {
            fullName: activeReservation.customerName || undefined,
            phone: activeReservation.customerPhone || undefined,
            email: activeReservation.customerEmail || undefined,
          }
        : null;

    const effectiveCustomer = reservationCustomer || customer || null;

    // normalizeItem: enforce servingKey + grams integer for BY_WEIGHT
    const normalizedItems = items.map(normalizeItem);

    const finalUserId = await ensureUserForOrder(userId, effectiveCustomer);

    const session = await mongoose.startSession();
    let createdOrderDoc = null;

    try {
      await session.withTransaction(async () => {
        const effectiveOrderCode =
          (orderCode && String(orderCode).trim()) ||
          (await findOrCreateOrderCode({
            restaurantId,
            tableId: tableInfo.tableId,
            tableCode: tableInfo.tableCode,
            session,
          }));

        // ✅ hydrate: modifiers + ingredientsSnapshot + pricing
        await hydrateOrderItems({
          restaurantId,
          items: normalizedItems,
          session,
        });

        const totals = computeTotalsFromHydratedItems(normalizedItems);

        const [order] = await Order.create(
          [
            {
              restaurantId: rid,
              tableId: toId(tableInfo.tableId),
              tableCode: tableInfo.tableCode,

              userId: finalUserId ? toId(finalUserId) : undefined,
              orderCode: effectiveOrderCode,

              orderType: "dine_in",
              items: normalizedItems,
              totals,
              note,

              currentStatus: "pending",
              payment: { method: "cash", status: "pending" },
              statusTimeline: [
                {
                  status: "pending",
                  at: new Date(),
                  byUserId: finalUserId ? toId(finalUserId) : undefined,
                  note: "Created via POS",
                },
              ],
              clientMeta,
            },
          ],
          { session }
        );

        createdOrderDoc = order;

        if (effectiveCustomer) {
          await upsertTableCustomerFromOrder({
            restaurantId,
            tableId: tableInfo.tableId,
            tableCode: tableInfo.tableCode,
            customer: effectiveCustomer,
            note,
            session,
          });
        }

        const lines = buildInventoryLinesFromItems(normalizedItems);
        if (lines.length) {
          const whId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId,
            session
          );

          await reserveForOrderTx({
            restaurantId: rid,
            warehouseId: whId,
            orderCode: effectiveOrderCode,
            lines,
            session,
          });
        }
      });
    } finally {
      await session.endSession();
    }

    await markTableStatus(restaurantId, tableInfo.tableCode, "occupied");
    await emitOrderEvent(ctx, restaurantId, "ORDER_CREATED", createdOrderDoc);

    return { isNewOrder: true, order: createdOrderDoc.toJSON() };
  },

  /** =========================================
   * CREATE OFF-PREMISE ORDER (takeaway/delivery)
   * - reserve inventory (atomic with order)
   * ========================================= */
  async createOffPremiseOrder(_, { input }, ctx) {
    const {
      restaurantId,
      orderType,
      items,
      note,
      customer,
      shipping,
      userId,
      warehouseId,
      clientMeta,
      paymentMethod,
    } = input || {};

    const rid = toId(restaurantId);
    if (!rid) throw new Error("restaurantId is required");
    if (!orderType || !["takeaway", "delivery"].includes(orderType)) {
      throw new Error("orderType must be 'takeaway' or 'delivery'");
    }
    if (!Array.isArray(items) || items.length === 0)
      throw new Error("items is required");

    const normalizedItems = items.map(normalizeItem);
    const finalUserId = await ensureUserForOrder(userId, customer);

    const prefix = orderType === "delivery" ? "DEL" : "TAKE";
    const effectiveOrderCode = generateOrderCode(prefix, new Date(), null);

    const shippingObj = buildShippingForOffPremise(
      orderType,
      shipping,
      customer
    );

    const session = await mongoose.startSession();
    let createdOrderDoc = null;

    try {
      await session.withTransaction(async () => {
        // ✅ hydrate: modifiers + ingredientsSnapshot + pricing
        await hydrateOrderItems({
          restaurantId,
          items: normalizedItems,
          session,
        });

        validateIncomingOrderItems(normalizedItems);
        const totals = computeTotalsFromHydratedItems(normalizedItems);

        const [order] = await Order.create(
          [
            {
              restaurantId: rid,
              userId: finalUserId ? toId(finalUserId) : undefined,
              orderCode: effectiveOrderCode,

              orderType,
              shipping: shippingObj,

              items: normalizedItems,
              totals,
              note,

              currentStatus: "pending",
              payment: { method: paymentMethod || "cash", status: paymentMethod === "transfer" ? "pending" : "pending" },
              statusTimeline: [
                {
                  status: "pending",
                  at: new Date(),
                  byUserId: finalUserId ? toId(finalUserId) : undefined,
                  note: "Off-premise order created",
                },
              ],
              clientMeta,
            },
          ],
          { session }
        );

        createdOrderDoc = order;

        const lines = buildInventoryLinesFromItems(normalizedItems);
        if (lines.length) {
          const whId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId,
            session
          );

          await reserveForOrderTx({
            restaurantId: rid,
            warehouseId: whId,
            orderCode: effectiveOrderCode,
            lines,
            session,
          });
        }
      });
    } finally {
      await session.endSession();
    }

    if (createdOrderDoc && createdOrderDoc.orderType === "delivery") {
      await createOrderTrackingEvent({
        order: createdOrderDoc,
        restaurantId,
        eventType: "status_changed",
        ctx,
        payload: {
          statusFrom: null,
          statusTo: "pending",
          note: "Delivery order created",
        },
      });
    }

    await emitOrderEvent(ctx, restaurantId, "ORDER_CREATED", createdOrderDoc);
    return { order: createdOrderDoc.toJSON() };
  },



  async createStaffRemoteOrder(_, { input }, ctx) {
    const {
      restaurantId,
      orderType,
      items,
      note,
      customer,
      shipping,
      userId,
      warehouseId,
      paymentMethod,
      pricing,
      channel,
      idempotencyKey,
      clientMeta,
    } = input || {};

    if (idempotencyKey) {
      const existing = await Order.findOne({
        restaurantId: toId(restaurantId),
        "clientMeta.source": "staff_remote",
        "clientMeta.idempotencyKey": idempotencyKey,
      }).sort({ createdAt: -1 });
      if (existing) return { order: existing.toJSON(), idempotentHit: true };
    }

    const receivedByStaffId = ctx?.user?.id ? toId(ctx.user.id) : undefined;
    const finalClientMeta = {
      ...(clientMeta || {}),
      source: "staff_remote",
      channel: channel || clientMeta?.channel || "other",
      idempotencyKey: idempotencyKey || undefined,
      receivedByStaffId,
    };

    const payload = await this.createOffPremiseOrder(_, {
      input: {
        restaurantId,
        orderType,
        items,
        note,
        customer,
        shipping,
        userId,
        warehouseId,
        paymentMethod,
        pricing,
        clientMeta: finalClientMeta,
      },
    }, ctx);

    return { order: payload.order, idempotentHit: false };
  },

  async confirmIncomingOrder(_, { input }, ctx) {
    const { id, restaurantId, note, warehouseId } = input || {};
    const order = await Order.findById(id);
    if (!order) throw new Error("Order not found");
    if (restaurantId && String(order.restaurantId) !== String(toId(restaurantId))) throw new Error("Order not found");
    if (order.currentStatus !== "pending") throw new Error("Only pending orders can be confirmed");

    const updated = await this.updateOrderStatus(_, {
      input: {
        id: String(order._id),
        restaurantId: restaurantId || String(order.restaurantId),
        status: "confirmed",
        note: note || "Incoming order confirmed by POS",
        warehouseId,
      },
    }, ctx);

    const printJobs = await enqueuePrintJobsForConfirmedOrder({
      order: updated,
      printType: "order_confirmed",
    });
    if (printJobs.length) {
      await emitOrderEvent(ctx, String(updated.restaurantId), "ORDER_PRINT_JOBS_CREATED", {
        orderId: String(updated._id || updated.id),
        orderCode: updated.orderCode,
        printJobs,
      });
    }

    return { order: updated };
  },

  async createTemporaryBillPrintJob(_, { input }, ctx) {
    const { orderId, restaurantId } = input || {};
    if (!orderId || !restaurantId) throw new Error("orderId and restaurantId are required");
    const order = await Order.findById(orderId).lean();
    if (!order) throw new Error("Order not found");
    if (String(order.restaurantId) !== String(toId(restaurantId))) throw new Error("Order not found");
    if (order.currentStatus !== "confirmed") throw new Error("Only confirmed orders can be printed");
    const { jobs, message } = await enqueueTemporaryBillPrintJob(order);
    const cashierJob = jobs[0] || null;
    if (cashierJob) {
      await emitOrderEvent(ctx, String(order.restaurantId), "ORDER_PRINT_JOBS_CREATED", {
        orderId: String(order._id),
        orderCode: order.orderCode,
        printJobs: [cashierJob],
      });
    }
    return { ok: !!cashierJob, message };
  },

  async rejectIncomingOrder(_, { input }, ctx) {
    const { id, restaurantId, reason, warehouseId } = input || {};
    if (!reason || !String(reason).trim()) throw new Error("reason is required");
    const order = await Order.findById(id);
    if (!order) throw new Error("Order not found");
    if (restaurantId && String(order.restaurantId) !== String(toId(restaurantId))) throw new Error("Order not found");
    if (order.currentStatus !== "pending") throw new Error("Only pending orders can be rejected");

    const updated = await this.updateOrderStatus(_, {
      input: {
        id: String(order._id),
        restaurantId: restaurantId || String(order.restaurantId),
        status: "cancelled",
        note: `Incoming order rejected: ${reason}`,
        warehouseId,
      },
    }, ctx);

    return { order: updated };
  },
  async requestPaymentForOrder(_, { input }) {
    const { restaurantId, orderIds } = input || {};
    if (!restaurantId || !Array.isArray(orderIds) || !orderIds.length) {
      throw new Error("restaurantId and orderIds are required");
    }
    await Order.updateMany(
      { restaurantId: toId(restaurantId), _id: { $in: orderIds.map((id) => toId(id)).filter(Boolean) } },
      { $set: { "payment.status": "payment_requested" } },
    );
    return { ok: true, message: "Đã gửi yêu cầu thanh toán theo đơn." };
  },
  async requestPaymentForTable(_, { input }) {
    const { restaurantId, tableCode } = input || {};
    if (!restaurantId || !tableCode) throw new Error("restaurantId and tableCode are required");
    await Order.updateMany(
      { restaurantId: toId(restaurantId), tableCode: String(tableCode), currentStatus: { $nin: ["cancelled", "completed"] } },
      { $set: { "payment.status": "payment_requested" } },
    );
    return { ok: true, message: "Đã gửi yêu cầu thanh toán theo bàn." };
  },
  async remindOrderItem(_, { input }, ctx) {
    const { restaurantId, orderId, orderItemId, note } = input || {};
    if (!restaurantId || !orderId || !orderItemId) throw new Error("restaurantId/orderId/orderItemId are required");
    await emitOrderEvent(ctx, restaurantId, "ORDER_ITEM_REMINDER", {
      orderId,
      orderItemId,
      note: note || "Staff nhắc món",
    });
    return { ok: true, message: "Đã gửi nhắc món tới bếp/KDS." };
  },
  async createCheckoutOrders(_, { input }, ctx) {
    const {
      orderType,
      items,
      note,
      customer,
      shipping,
      userId,
      warehouseId,
      clientMeta,
      paymentMethod,
      idempotencyKey,
      pricing,
    } = input || {};

    if (!orderType || !["takeaway", "delivery"].includes(orderType)) {
      throw new Error("orderType must be 'takeaway' or 'delivery'");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("items is required");
    }
    if (
      paymentMethod &&
      !["cash", "transfer", "wallet", "e_wallet", "card", "bank_transfer"].includes(
        String(paymentMethod).toLowerCase(),
      )
    ) {
      throw new Error("Unsupported payment method");
    }

    if (idempotencyKey) {
      const existing = await CheckoutSession.findOne({ idempotencyKey }).lean();
      if (existing?.orderIds?.length) {
        const existingOrders = await Order.find({ _id: { $in: existing.orderIds } }).lean({ virtuals: true });
        return {
          checkout: {
            checkoutCode: existing.checkoutCode,
            orderIds: existing.orderIds.map(String),
            grandTotal: Math.round(existing?.totals?.grandTotal || 0),
          },
          orders: existingOrders,
        };
      }
    }

    const grouped = new Map();
    for (const rawItem of items) {
      const rid = toId(rawItem?.restaurantId);
      if (!rid) throw new Error("Each checkout item must include valid restaurantId");
      const normalized = normalizeItem(rawItem);
      const key = String(rid);
      if (!grouped.has(key)) grouped.set(key, { restaurantId: rid, items: [] });
      grouped.get(key).items.push(normalized);
    }

    const checkoutCode = generateOrderCode("CHK", new Date(), null);
    const finalUserId = await ensureUserForOrder(userId, customer);
    const createdOrders = [];
    const normalizedPaymentMethodRaw = String(paymentMethod || "cash").toLowerCase();
    const normalizedPaymentMethod =
      normalizedPaymentMethodRaw === "e_wallet" ? "wallet" : normalizedPaymentMethodRaw;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const g of grouped.values()) {
          await hydrateOrderItems({
            restaurantId: g.restaurantId,
            items: g.items,
            session,
          });

          const trustedPricing = {
            taxRate: pricing?.taxRate,
            serviceRate: pricing?.serviceRate,
            shippingFee: pricing?.shippingFee,
            voucherCode: pricing?.voucherCode,
            promotionDiscount: 0,
            voucherDiscount: 0,
          };

          const baseTotals = computeTotalsFromHydratedItems(g.items, trustedPricing);
          let voucherMeta = null;
          if (trustedPricing.voucherCode) {
            voucherMeta = await resolveVoucherDiscount({
              restaurantId: g.restaurantId,
              voucherCode: trustedPricing.voucherCode,
              subtotal: baseTotals.subtotal,
              userId: finalUserId,
              session,
            });
          }
          const totals = computeTotalsFromHydratedItems(g.items, {
            ...trustedPricing,
            voucherDiscount: voucherMeta?.voucherDiscount || 0,
            voucherCode: voucherMeta?.voucherCode,
          });
          if (voucherMeta?.discountReason) totals.discountReason = voucherMeta.discountReason;

          const shippingObj = buildShippingForOffPremise(orderType, shipping, customer);
          if (orderType === "delivery" && grouped.size > 1) {
            shippingObj.shippingFee = Math.round((Number(pricing?.shippingFee || 0)) / grouped.size);
            totals.shippingFee = shippingObj.shippingFee;
            totals.grandTotal = Math.round(
              totals.subtotal - totals.discount + totals.service + totals.tax + totals.shippingFee
            );
          }

          const prefix = orderType === "delivery" ? "DEL" : "TAKE";
          const childOrderCode = generateOrderCode(prefix, new Date(), null);

          const [order] = await Order.create([
            {
              restaurantId: g.restaurantId,
              userId: finalUserId ? toId(finalUserId) : undefined,
              orderCode: childOrderCode,
              parentOrderCode: checkoutCode,
              orderType,
              shipping: shippingObj,
              items: g.items,
              totals,
              note,
              currentStatus: "pending",
              payment: { method: normalizedPaymentMethod, status: "pending" },
              statusTimeline: [
                {
                  status: "pending",
                  at: new Date(),
                  byUserId: finalUserId ? toId(finalUserId) : undefined,
                  note: `Created from checkout ${checkoutCode}`,
                },
              ],
              clientMeta: { ...(clientMeta || {}), checkoutCode },
            },
          ], { session });

          createdOrders.push(order);

          if (voucherMeta?.couponId) {
            const updateResult = await Coupon.updateOne(
              {
                _id: voucherMeta.couponId,
                $expr: {
                  $or: [
                    { $lte: ["$maxUsage", 0] },
                    { $lt: ["$used", "$maxUsage"] },
                  ],
                },
              },
              { $inc: { used: 1 } },
              { session }
            );
            if (!updateResult.modifiedCount) {
              throw new Error("Invalid voucher: usage limit reached");
            }
          }

          const lines = buildInventoryLinesFromItems(g.items);
          if (lines.length) {
            const whId = await resolveWarehouseIdOrDefault(g.restaurantId, warehouseId, session);
            await reserveForOrderTx({
              restaurantId: g.restaurantId,
              warehouseId: whId,
              orderCode: childOrderCode,
              lines,
              session,
            });
          }
        }

        await CheckoutSession.create([
          {
            checkoutCode,
            idempotencyKey: idempotencyKey || undefined,
            userId: finalUserId ? toId(finalUserId) : undefined,
            customer: customer || undefined,
            orderIds: createdOrders.map((o) => o._id),
            restaurantIds: createdOrders.map((o) => o.restaurantId),
            payment: { method: normalizedPaymentMethod, status: "pending" },
            totals: createdOrders.reduce(
              (acc, o) => {
                acc.subtotal += Number(o.totals?.subtotal || 0);
                acc.promotionDiscount += 0;
                acc.voucherDiscount += 0;
                acc.tax += Number(o.totals?.tax || 0);
                acc.shippingFee += Number(o.totals?.shippingFee || 0);
                acc.grandTotal += Number(o.totals?.grandTotal || 0);
                return acc;
              },
              { subtotal: 0, promotionDiscount: 0, voucherDiscount: 0, tax: 0, shippingFee: 0, grandTotal: 0 }
            ),
          },
        ], { session });

        if (normalizedPaymentMethod === "wallet") {
          if (!finalUserId || !mongoose.isValidObjectId(finalUserId)) {
            throw new Error("Wallet payment requires an authenticated account");
          }
          const uid = toId(finalUserId);
          const walletOwner = await User.findById(uid).session(session);
          if (!walletOwner?.wallet || walletOwner.wallet.status !== "active") {
            throw new Error("Wallet is not active");
          }

          const totalPayable = createdOrders.reduce(
            (acc, o) => acc + Number(o?.totals?.grandTotal || 0),
            0,
          );
          const balanceBefore = Number(walletOwner.wallet.balance || 0);
          if (balanceBefore < totalPayable) {
            throw new Error("Insufficient wallet balance");
          }

          const balanceAfter = balanceBefore - totalPayable;
          walletOwner.wallet.balance = balanceAfter;
          walletOwner.wallet.updatedAt = new Date();
          await walletOwner.save({ session });

          await WalletTransaction.create(
            [
              {
                userId: uid,
                type: "PAYMENT",
                amount: totalPayable,
                currency: walletOwner.wallet.currency || "VND",
                balanceBefore,
                balanceAfter,
                status: "SUCCESS",
                referenceType: "CHECKOUT_SESSION",
                orderIds: createdOrders.map((o) => o._id),
                metadata: {
                  checkoutCode,
                  paymentMethod: "wallet",
                },
              },
            ],
            { session },
          );

          await Order.updateMany(
            { _id: { $in: createdOrders.map((o) => o._id) } },
            { $set: { "payment.status": "paid" } },
            { session },
          );

          await CheckoutSession.updateOne(
            { checkoutCode },
            { $set: { "payment.status": "paid" } },
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }

    for (const order of createdOrders) {
      if (order.orderType === "delivery") {
        await createOrderTrackingEvent({
          order,
          restaurantId: order.restaurantId,
          eventType: "status_changed",
          ctx,
          payload: { statusFrom: null, statusTo: "pending", note: `Delivery order created from ${checkoutCode}` },
        });
      }
      await emitOrderEvent(ctx, order.restaurantId, "ORDER_CREATED", order);
    }

    const grandTotal = createdOrders.reduce((sum, o) => sum + Number(o.totals?.grandTotal || 0), 0);

    return {
      checkout: {
        checkoutCode,
        orderIds: createdOrders.map((o) => String(o._id)),
        grandTotal: Math.round(grandTotal),
      },
      orders: createdOrders.map((o) => o.toJSON()),
    };
  },

  /** =========================================
   * UPDATE ORDER STATUS
   * - inventory commit/cancel + order save in ONE transaction
   * ========================================= */
  async updateOrderStatus(_, { input }, ctx) {
    const { id, restaurantId, status, note, warehouseId } = input || {};
    const oid = toId(id);
    if (!oid) throw new Error("Invalid order id");
    if (!status) throw new Error("Missing status");

    const filter = { _id: oid };
    if (restaurantId) {
      const rid = toId(restaurantId);
      if (!rid) throw new Error("Invalid restaurantId");
      filter.restaurantId = rid;
    }

    const session = await mongoose.startSession();

    let order = null;
    let prevStatus = null;

    try {
      await session.withTransaction(async () => {
        order = await Order.findOne(filter).session(session);
        if (!order) throw new Error("Order not found");

        prevStatus = order.currentStatus;

        const lines = buildInventoryLinesFromItems(order.items);

        if (lines.length) {
          const wasReservable = RESERVABLE_STATUSES.includes(prevStatus);

          const shouldCommitNow =
            (wasReservable && COMMIT_STATUSES.includes(status)) ||
            (status === "confirmed" && ["delivery", "takeaway"].includes(order.orderType));

          if (shouldCommitNow) {
            const whId = await resolveWarehouseIdOrDefault(
              order.restaurantId,
              warehouseId,
              session
            );

            await commitReservationForOrderTx({
              restaurantId: order.restaurantId,
              warehouseId: whId,
              orderCode: order.orderCode,
              lines,
              session,
            });
          }

          if (wasReservable && status === "cancelled") {
            const whId = await resolveWarehouseIdOrDefault(
              order.restaurantId,
              warehouseId,
              session
            );

            await cancelReservationForOrderTx({
              restaurantId: order.restaurantId,
              warehouseId: whId,
              orderCode: order.orderCode,
              lines,
              session,
            });
          }
        }

        order.currentStatus = status;
        order.statusTimeline.push({
          status,
          at: new Date(),
          note,
          byUserId: ctx?.user?.id ? toId(ctx.user.id) : undefined,
        });

        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    if (order && order.orderType === "delivery") {
      await createOrderTrackingEvent({
        order,
        restaurantId: order.restaurantId,
        eventType: "status_changed",
        ctx,
        payload: {
          statusFrom: prevStatus,
          statusTo: status,
          note,
        },
      });
    }

    await emitOrderEvent(ctx, order.restaurantId, "ORDER_STATUS_CHANGED", {
      order,
      meta: { statusFrom: prevStatus, statusTo: status, note },
    });

    if (["completed", "cancelled", "failed"].includes(status)) {
      await syncCustomerMetricsByOrderUser(order?.userId);
    }

    return order.toJSON();
  },

  /** =========================================
   * UPDATE ORDER ITEM STATUS
   * - if order is reservable: cancel/reserve inventory per-item (atomic with save)
   * ========================================= */
  async updateOrderItemStatus(_, { input }, ctx) {
    const { restaurantId, orderId, itemKey, status, note } = input || {};
    const oid = toId(orderId);
    if (!oid) throw new Error("Invalid orderId");
    if (!itemKey || !status) throw new Error("Missing fields");

    const filter = { _id: oid };
    if (restaurantId) {
      const rid = toId(restaurantId);
      if (!rid) throw new Error("Invalid restaurantId");
      filter.restaurantId = rid;
    }

    const session = await mongoose.startSession();
    let order = null;
    let prevItemStatus = null;
    let item = null;

    try {
      await session.withTransaction(async () => {
        order = await Order.findOne(filter).session(session);
        if (!order) throw new Error("Order not found");

        const idx = order.items.findIndex(
          (it, i) =>
            String(it._id) === String(itemKey) ||
            String(it.dishId) === String(itemKey) ||
            String(i) === String(itemKey)
        );
        if (idx === -1) throw new Error("Item not found");

        item = order.items[idx];
        prevItemStatus = item.status;

        const isOrderReservable = RESERVABLE_STATUSES.includes(
          order.currentStatus
        );

        if (isOrderReservable) {
          const fromCancelled =
            CANCELLED_ITEM_STATUSES.includes(prevItemStatus);
          const toCancelled = CANCELLED_ITEM_STATUSES.includes(status);

          const line = buildInventoryLineFromItem(item);

          if (line) {
            const whId = await resolveWarehouseIdOrDefault(
              order.restaurantId,
              null,
              session
            );

            if (!fromCancelled && toCancelled) {
              await cancelReservationForOrderTx({
                restaurantId: order.restaurantId,
                warehouseId: whId,
                orderCode: order.orderCode,
                lines: [line],
                session,
              });
            }

            if (fromCancelled && !toCancelled) {
              await reserveForOrderTx({
                restaurantId: order.restaurantId,
                warehouseId: whId,
                orderCode: order.orderCode,
                lines: [line],
                session,
              });
            }
          }
        }

        item.status = status;
        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    if (order?.orderType === "delivery") {
      await createOrderTrackingEvent({
        order,
        restaurantId: order.restaurantId,
        eventType: "item_status_changed",
        ctx,
        payload: {
          itemId: item?._id,
          itemName: item?.name,
          itemStatusFrom: prevItemStatus,
          itemStatusTo: status,
          note,
        },
      });
    }

    await emitOrderEvent(ctx, order.restaurantId, "ORDER_ITEM_STATUS_CHANGED", {
      order,
      meta: {
        itemId: item?._id,
        itemName: item?.name,
        statusFrom: prevItemStatus,
        statusTo: status,
        note,
      },
    });

    return { order: order.toJSON() };
  },

  /** =========================================
   * UPDATE ORDER ITEM PRIORITY
   * ========================================= */
  async updateOrderItemPriority(_, { input }, ctx) {
    const { restaurantId, orderId, itemKey, priority } = input || {};
    const oid = toId(orderId);
    if (!oid) throw new Error("Invalid orderId");
    if (!itemKey) throw new Error("Missing itemKey");

    const filter = { _id: oid };
    if (restaurantId) {
      const rid = toId(restaurantId);
      if (!rid) throw new Error("Invalid restaurantId");
      filter.restaurantId = rid;
    }

    const order = await Order.findOne(filter);
    if (!order) throw new Error("Order not found");

    const idx = order.items.findIndex(
      (it, i) =>
        String(it._id) === String(itemKey) ||
        String(it.dishId) === String(itemKey) ||
        String(i) === String(itemKey)
    );
    if (idx === -1) throw new Error("Item not found");

    order.items[idx].priority = normalizePriorityLevel(priority);
    await order.save();

    await emitOrderEvent(ctx, order.restaurantId, "ORDER_ITEM_PRIORITY_CHANGED", {
      order,
      meta: {
        itemId: order.items[idx]?._id,
        itemName: order.items[idx]?.name,
        priority: order.items[idx]?.priority,
      },
    });

    return { order: order.toJSON() };
  },

  /** =========================================
   * UPDATE ORDER CUSTOMER BY CODE
   * ========================================= */
  async updateOrderCustomerByCode(_, { input }) {
    const { restaurantId, orderCode, userId, customer } = input || {};
    const rid = toId(restaurantId);
    if (!rid) throw new Error("Invalid restaurantId");
    if (!orderCode) throw new Error("orderCode is required");
    if (!customer) throw new Error("customer is required");

    const finalUserId = await ensureUserForOrder(userId, customer);

    const res = await Order.updateMany(
      {
        restaurantId: rid,
        orderCode: String(orderCode),
        currentStatus: { $nin: ["completed", "cancelled"] },
      },
      { $set: { userId: finalUserId ? toId(finalUserId) : undefined } }
    );

    const one = await Order.findOne({
      restaurantId: rid,
      orderCode: String(orderCode),
      currentStatus: { $nin: ["completed", "cancelled"] },
    })
      .select({ tableId: 1, tableCode: 1 })
      .lean();

    await upsertTableCustomerFromOrder({
      restaurantId,
      tableId: one?.tableId,
      tableCode: one?.tableCode,
      customer,
      session: null,
    });

    return { success: true, modifiedCount: res.modifiedCount };
  },

  /** =========================================
   * CANCEL ORDER
   * - cancel reservation + save in one transaction
   * ========================================= */
  async cancelOrder(_, { restaurantId, orderId, reason, warehouseId }, ctx) {
    const rid = toId(restaurantId);
    const oid = toId(orderId);
    if (!rid || !oid) throw new Error("Missing/invalid fields");

    const session = await mongoose.startSession();

    let order = null;
    let prevStatus = null;

    try {
      await session.withTransaction(async () => {
        order = await Order.findOne({ _id: oid, restaurantId: rid }).session(
          session
        );
        if (!order) throw new Error("Order not found");

        prevStatus = order.currentStatus;

        const lines = buildInventoryLinesFromItems(order.items);

        if (RESERVABLE_STATUSES.includes(prevStatus) && lines.length) {
          const whId = await resolveWarehouseIdOrDefault(
            restaurantId,
            warehouseId,
            session
          );

          await cancelReservationForOrderTx({
            restaurantId: rid,
            warehouseId: whId,
            orderCode: order.orderCode,
            lines,
            session,
          });
        }

        order.currentStatus = "cancelled";
        order.statusTimeline.push({
          status: "cancelled",
          at: new Date(),
          note: reason || "Cancelled",
          byUserId: ctx?.user?.id ? toId(ctx.user.id) : undefined,
        });

        await order.save({ session });
      });
    } finally {
      await session.endSession();
    }

    if (order?.orderType === "delivery") {
      await createOrderTrackingEvent({
        order,
        restaurantId,
        eventType: "status_changed",
        ctx,
        payload: {
          statusFrom: prevStatus,
          statusTo: "cancelled",
          note: reason || "Cancelled",
        },
      });
    }

    await emitOrderEvent(ctx, restaurantId, "ORDER_CANCELLED", order);

    if (order?.tableCode) {
      await markTableStatus(restaurantId, order.tableCode, "available");
    }

    return { success: true, order: order.toJSON() };
  },
};

export default { OrderMutation };
