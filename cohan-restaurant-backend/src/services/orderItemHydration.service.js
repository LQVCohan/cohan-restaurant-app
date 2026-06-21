import mongoose from "mongoose";
import {
  Ingredient,
  MenuItem,
  ModifierGroup,
  Recipe,
} from "../../models/index.js";

export class OrderItemHydrationError extends Error {
  constructor(message, code = "INVALID_ITEMS") {
    super(message);
    this.name = "OrderItemHydrationError";
    this.code = code;
  }
}

const toId = (id) => {
  if (!id) return null;
  const sid = String(id);
  return mongoose.isValidObjectId(sid) ? new mongoose.Types.ObjectId(sid) : null;
};

function throwInvalidItems(message) {
  throw new OrderItemHydrationError(message, "INVALID_ITEMS");
}

function assertPositiveIntegerGrams(v, field = "weightGrams") {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throwInvalidItems(`${field} must be a positive integer (grams). Có lỗi trong chuyển đổi sang đơn vị chuẩn.`);
  }
  return n;
}

function assertPositiveNumber(v, field = "quantity") {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throwInvalidItems(`${field} must be > 0`);
  return n;
}

function resolveMenuItemId(input = {}) {
  return input.dishId || input.menuItemId || input.menuId || input.id || input._id || null;
}

function convertToBaseUnitQty(ingredientDoc, qty, unit) {
  const baseUnit = ingredientDoc?.baseUnit;
  if (!baseUnit) throwInvalidItems("Ingredient missing baseUnit");
  if (unit === baseUnit) return qty;
  const convs = ingredientDoc?.conversions || [];
  const direct = convs.find((c) => c.from === unit && c.to === baseUnit);
  if (direct) return qty * Number(direct.ratio);
  const reverse = convs.find((c) => c.from === baseUnit && c.to === unit);
  if (reverse) return qty / Number(reverse.ratio);
  const table = { "kg->g": 1000, "g->kg": 1 / 1000, "l->ml": 1000, "ml->l": 1 / 1000 };
  const key = `${unit}->${baseUnit}`;
  if (table[key]) return qty * table[key];
  throwInvalidItems(`No conversion from ${unit} to baseUnit ${baseUnit} for ingredient ${ingredientDoc?.name || ""}`);
}

function normalizeItemWeightGrams(it) {
  if (it?.servingVariant?.mode !== "BY_WEIGHT") return;
  if (it.weightGrams != null) return;
  const qty = Number(it.quantity);
  if (!Number.isFinite(qty) || qty <= 0) throwInvalidItems("BY_WEIGHT item missing weightGrams/quantity");
  const u = (it.unit || "kg").toString();
  it.weightGrams = u === "g" ? Math.round(qty) : Math.round(qty * 1000);
}

function computeFactorFromVariant({ v, it }) {
  if (v.mode === "BY_WEIGHT") {
    const grams = Number(it.weightGrams);
    if (!Number.isFinite(grams) || grams <= 0) throwInvalidItems("BY_WEIGHT requires weightGrams > 0");
    const sold = v.sellUnit === "g" ? grams : grams / 1000;
    return sold / Number(v.sellQty || 1);
  }
  return assertPositiveNumber(it.quantity || 1, "quantity");
}

function normalizeSelectedModifiers(inputMods) {
  const arr = Array.isArray(inputMods) ? inputMods : [];
  return arr.map((m) => {
    const groupId = toId(m?.groupId ? String(m.groupId) : "");
    const optionId = toId(m?.optionId ? String(m.optionId) : "");
    if (!groupId) throwInvalidItems("Invalid modifier.groupId");
    if (!optionId) throwInvalidItems("Invalid modifier.optionId");
    return { groupId, optionId };
  });
}

function getApplicableGroupsForDish({ groups, dishId }) {
  const did = String(dishId);
  return (groups || []).filter((g) => {
    if (!g?.isActive) return false;
    if (g.coverage === "GLOBAL") return true;
    if (g.coverage === "ITEMS") return (g.menuItemIds || []).map(String).includes(did);
    return false;
  });
}

function validateGroupSelection({ applicableGroups, selectedByGroup }) {
  for (const g of applicableGroups) {
    const gid = String(g._id);
    const chosen = selectedByGroup.get(gid) || [];
    if (!g.required && chosen.length === 0) continue;
    const selectionType = g.selectionType || "multiple";
    const minSelected = Number(g.minSelected ?? 0);
    const maxSelected = g.maxSelected != null ? Number(g.maxSelected) : null;
    if (selectionType === "single") {
      if (g.required && chosen.length < 1) throwInvalidItems(`Missing required modifier group "${g.name}"`);
      if (chosen.length > 1) throwInvalidItems(`Group "${g.name}" allows only 1 option`);
    } else {
      const needMin = g.required ? Math.max(1, minSelected) : minSelected;
      if (chosen.length < needMin) throwInvalidItems(`Need more options in group "${g.name}"`);
      if (maxSelected != null && chosen.length > maxSelected) throwInvalidItems(`Too many options in group "${g.name}"`);
    }
  }
}

function buildModifierSnapshotsForItem({ it, groups }) {
  const selected = normalizeSelectedModifiers(it.selectedModifiers || it.modifiers);
  if (!selected.length) {
    it.modifiers = [];
    return;
  }
  const selectedByGroup = new Map();
  for (const s of selected) {
    const gid = String(s.groupId);
    const oid = String(s.optionId);
    selectedByGroup.set(gid, [...(selectedByGroup.get(gid) || []), oid]);
  }
  const applicable = getApplicableGroupsForDish({ groups, dishId: it.dishId });
  validateGroupSelection({ applicableGroups: applicable, selectedByGroup });
  const groupMap = new Map((groups || []).map((g) => [String(g._id), g]));
  const nextMods = [];
  for (const [gid, optionIds] of selectedByGroup.entries()) {
    const g = groupMap.get(gid);
    if (!g) throwInvalidItems(`ModifierGroup not found: ${gid}`);
    if (!applicable.some((x) => String(x._id) === gid)) throwInvalidItems(`ModifierGroup "${g.name}" is not applicable to this item`);
    const uniqueOptionIds = [...new Set(optionIds)];
    if (uniqueOptionIds.length !== optionIds.length) throwInvalidItems(`Duplicate options in group "${g.name}"`);
    if (g.selectionType === "single" && uniqueOptionIds.length > 1) throwInvalidItems(`Group "${g.name}" allows only 1 option`);
    for (const oid of uniqueOptionIds) {
      const opt = (g.options || []).find((o) => String(o._id) === oid);
      if (!opt) throwInvalidItems(`Option ${oid} not found in group "${g.name}"`);
      if (opt.isActive === false) throwInvalidItems(`Option "${opt.name}" is inactive`);
      if (!opt.priceRule?.rule || opt.priceRule.amount == null || Number.isNaN(Number(opt.priceRule.amount))) throwInvalidItems(`Option "${opt.name}" missing priceRule`);
      if (!opt.inventoryRule?.rule) throwInvalidItems(`Option "${opt.name}" missing inventoryRule.rule`);
      nextMods.push({
        groupId: toId(gid), groupName: g.name, optionId: toId(oid), optionName: opt.name,
        priceRule: { rule: opt.priceRule.rule, amount: Number(opt.priceRule.amount) },
        inventoryRule: {
          rule: opt.inventoryRule.rule,
          ingredientLines: (opt.inventoryRule.ingredientLines || []).map((l) => ({ ingredientId: toId(l.ingredientId), qty: Number(l.qty), unit: l.unit, wastePct: Number(l.wastePct ?? 0) })),
          baseRecipeMultiplier: opt.inventoryRule.rule === "MULTIPLY_BASE_RECIPE" ? Number(opt.inventoryRule.baseRecipeMultiplier) : undefined,
          note: opt.inventoryRule.note ?? undefined,
        },
      });
    }
  }
  if (nextMods.filter((m) => m.priceRule?.rule === "SET").length > 1) throwInvalidItems("Only one SET price modifier is allowed per item");
  if (nextMods.filter((m) => m.inventoryRule?.rule === "MULTIPLY_BASE_RECIPE").length > 1) throwInvalidItems("Only one MULTIPLY_BASE_RECIPE modifier is allowed per item");
  it.modifiers = nextMods;
}

function computeUnitPriceFromModifiers(servingVariantPrice, modifiers = []) {
  const set = modifiers.find((m) => m.priceRule?.rule === "SET");
  const delta = modifiers.filter((m) => m.priceRule?.rule === "DELTA").reduce((acc, m) => acc + Number(m.priceRule.amount || 0), 0);
  const unitPrice = Math.max(0, (set ? Number(set.priceRule.amount) : Number(servingVariantPrice)) + delta);
  return { baseUnitPrice: Number(servingVariantPrice), unitPrice, modifiersPricePerUnit: unitPrice - Number(servingVariantPrice) };
}

function computeLineSubtotal({ it, v, unitPrice }) {
  if (v.mode === "BY_WEIGHT") {
    const grams = assertPositiveIntegerGrams(it.weightGrams, "weightGrams");
    const sold = v.sellUnit === "g" ? grams : grams / 1000;
    return Math.round(unitPrice * (sold / Number(v.sellQty || 1)));
  }
  return Math.round(unitPrice * assertPositiveNumber(it.quantity || 1, "quantity"));
}

function applyModifierInventoryRules({ baseLines, factor, modifiers }) {
  const map = new Map();
  for (const l of baseLines) map.set(String(l.ingredientId), { ...l });
  const mult = modifiers.find((m) => m.inventoryRule?.rule === "MULTIPLY_BASE_RECIPE");
  if (mult) {
    const f = Number(mult.inventoryRule.baseRecipeMultiplier);
    if (!Number.isFinite(f) || f <= 0) throwInvalidItems("Invalid baseRecipeMultiplier");
    for (const [k, v] of map.entries()) map.set(k, { ...v, qty: Number(v.qty) * f });
  }
  for (const m of modifiers) {
    const rule = m.inventoryRule?.rule;
    if (!["ADD_INGREDIENTS", "REPLACE_INGREDIENTS"].includes(rule)) continue;
    for (const l of m.inventoryRule.ingredientLines || []) {
      const qtyWithWaste = Number(l.qty || 0) * factor * (1 + Number(l.wastePct || 0) / 100);
      const key = String(l.ingredientId);
      if (rule === "ADD_INGREDIENTS") {
        const cur = map.get(key);
        if (!cur) map.set(key, { ingredientId: l.ingredientId, qty: qtyWithWaste, unit: l.unit, wastePct: Number(l.wastePct || 0) });
        else {
          if (String(cur.unit) !== String(l.unit)) throwInvalidItems(`Inventory unit conflict for ingredient ${key} (need consistent unit)`);
          map.set(key, { ...cur, qty: Number(cur.qty) + qtyWithWaste });
        }
      }
      if (rule === "REPLACE_INGREDIENTS") map.set(key, { ingredientId: l.ingredientId, qty: qtyWithWaste, unit: l.unit, wastePct: Number(l.wastePct || 0) });
    }
  }
  return [...map.values()];
}

export async function hydrateCheckoutOrderItems({ restaurantId, items = [], session }) {
  const rid = toId(restaurantId);
  if (!rid) throwInvalidItems("Invalid restaurantId");
  if (!Array.isArray(items) || !items.length) throwInvalidItems("No checkout items to hydrate");

  const hydratedItems = items.map((item) => ({ ...item }));
  for (const it of hydratedItems) {
    const id = resolveMenuItemId(it);
    if (!id || !mongoose.isValidObjectId(String(id))) throwInvalidItems("Invalid menu item");
    it.dishId = toId(id);
  }

  const menuItemIds = [...new Set(hydratedItems.map((it) => String(it.dishId)))].map(toId);
  const menuQuery = MenuItem.find({ restaurantId: rid, _id: { $in: menuItemIds } }).select("_id name categoryId status defaultServingKey");
  const menuItems = await (session ? menuQuery.session(session) : menuQuery).lean();
  const menuItemMap = new Map((menuItems || []).map((m) => [String(m._id), m]));
  if (menuItemMap.size !== menuItemIds.length) throwInvalidItems("One or more checkout items are unavailable for this restaurant");

  const recipes = await Recipe.find({ restaurantId: rid, menuItemId: { $in: menuItemIds } }).session(session).lean();
  const recipeMap = new Map((recipes || []).map((r) => [String(r.menuItemId), r]));

  const groups = await ModifierGroup.find({ restaurantId: rid, isActive: true, $or: [{ coverage: "GLOBAL" }, { coverage: "ITEMS", menuItemIds: { $in: menuItemIds } }] }).session(session).lean({ virtuals: true });

  const ingredientIds = new Set();
  for (const it of hydratedItems) {
    const recipe = recipeMap.get(String(it.dishId));
    if (!recipe) throwInvalidItems(`Recipe not found for menuItemId=${it.dishId}`);
    const menuItem = menuItemMap.get(String(it.dishId));
    const key = String(it.servingKey || menuItem?.defaultServingKey || "").trim();
    if (!key) throwInvalidItems(`ServingVariant key is required for menuItemId=${it.dishId}`);
    it.servingKey = key;
    const v = recipe.servingVariants?.find((x) => String(x.key) === key);
    if (!v) throwInvalidItems(`ServingVariant key="${key}" not found in recipe for menuItemId=${it.dishId}`);
    for (const line of v.ingredients || []) ingredientIds.add(String(line.ingredientId));
  }
  for (const g of groups || []) for (const opt of g.options || []) for (const l of opt?.inventoryRule?.ingredientLines || []) if (l?.ingredientId) ingredientIds.add(String(l.ingredientId));

  const ingDocs = await Ingredient.find({ _id: { $in: [...ingredientIds].map(toId) } }).session(session).lean();
  const ingMap = new Map((ingDocs || []).map((d) => [String(d._id), d]));

  for (const it of hydratedItems) {
    const menuItem = menuItemMap.get(String(it.dishId));
    const recipe = recipeMap.get(String(it.dishId));
    const v = recipe.servingVariants.find((x) => String(x.key) === String(it.servingKey));

    it.menuItem = { _id: menuItem._id, id: menuItem._id, categoryId: menuItem.categoryId, name: menuItem.name };
    it.menuId = menuItem._id;
    it.categoryId = menuItem.categoryId;
    it.name = menuItem.name;
    it.status = String(it.status || "pending");
    it.servingVariant = { key: v.key, name: v.name || v.key, mode: v.mode, price: Number(v.price || 0), sellQty: Number(v.sellQty || 1), sellUnit: String(v.sellUnit || (v.mode === "PORTION" ? "portion" : "kg")) };
    normalizeItemWeightGrams(it);
    buildModifierSnapshotsForItem({ it, groups });
    const factor = computeFactorFromVariant({ v, it });

    const baseLines = [];
    for (const line of v.ingredients || []) {
      const ing = ingMap.get(String(line.ingredientId));
      if (!ing) throwInvalidItems(`Ingredient not found: ${line.ingredientId}`);
      const qtyWithWaste = Number(line.qty || 0) * factor * (1 + Number(line.wastePct || 0) / 100);
      baseLines.push({ ingredientId: toId(line.ingredientId), qty: qtyWithWaste, unit: line.unit, wastePct: Number(line.wastePct || 0) });
    }
    const finalLines = applyModifierInventoryRules({ baseLines, factor, modifiers: it.modifiers || [] });
    it.ingredientsSnapshot = finalLines.map((line) => {
      const ing = ingMap.get(String(line.ingredientId));
      if (!ing) throwInvalidItems(`Ingredient not found: ${line.ingredientId}`);
      const baseQty = convertToBaseUnitQty(ing, Number(line.qty), line.unit);
      const cpu = ing.costPerBaseUnit != null ? Number(ing.costPerBaseUnit) : null;
      return { ingredientId: toId(line.ingredientId), name: ing.name, quantity: Number(line.qty), unit: line.unit, baseUnitQuantity: baseQty, costPerBaseUnit: cpu, totalCost: cpu != null ? baseQty * cpu : null };
    });
    const { baseUnitPrice, unitPrice, modifiersPricePerUnit } = computeUnitPriceFromModifiers(it.servingVariant.price, it.modifiers || []);
    it.baseUnitPrice = baseUnitPrice;
    it.unitPrice = unitPrice;
    it.modifiersPricePerUnit = modifiersPricePerUnit;
    it.modifiersPrice = modifiersPricePerUnit;
    it.lineSubtotal = computeLineSubtotal({ it, v, unitPrice });
  }

  if (hydratedItems.length !== items.length) throwInvalidItems("Unable to hydrate all checkout items");
  return hydratedItems;
}
