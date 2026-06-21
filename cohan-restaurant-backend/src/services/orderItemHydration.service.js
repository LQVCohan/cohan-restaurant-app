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
  return mongoose.isValidObjectId(sid)
    ? new mongoose.Types.ObjectId(sid)
    : null;
};

function throwInvalidItems(message) {
  throw new OrderItemHydrationError(message, "INVALID_ITEMS");
}

function assertPositiveIntegerGrams(value, field = "weightGrams") {
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number <= 0) {
    throwInvalidItems(
      `${field} must be a positive integer (grams). Có lỗi trong chuyển đổi sang đơn vị chuẩn.`,
    );
  }
  return number;
}

function assertPositiveNumber(value, field = "quantity") {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throwInvalidItems(`${field} must be > 0`);
  }
  return number;
}

function resolveMenuItemId(input = {}) {
  return input.dishId || input.menuItemId || input.menuId || input.id || input._id || null;
}

function convertToBaseUnitQty(ingredientDoc, quantity, unit) {
  const baseUnit = ingredientDoc?.baseUnit;
  if (!baseUnit) throwInvalidItems("Ingredient missing baseUnit");
  if (unit === baseUnit) return quantity;

  const conversions = ingredientDoc?.conversions || [];
  const direct = conversions.find(
    (conversion) => conversion.from === unit && conversion.to === baseUnit,
  );
  if (direct) return quantity * Number(direct.ratio);

  const reverse = conversions.find(
    (conversion) => conversion.from === baseUnit && conversion.to === unit,
  );
  if (reverse) return quantity / Number(reverse.ratio);

  const table = {
    "kg->g": 1000,
    "g->kg": 1 / 1000,
    "l->ml": 1000,
    "ml->l": 1 / 1000,
  };
  const key = `${unit}->${baseUnit}`;
  if (table[key]) return quantity * table[key];

  throwInvalidItems(
    `No conversion from ${unit} to baseUnit ${baseUnit} for ingredient ${ingredientDoc?.name || ""}`,
  );
}

function normalizeItemWeightGrams(item) {
  if (item?.servingVariant?.mode !== "BY_WEIGHT") return;
  if (item.weightGrams != null) return;

  const quantity = Number(item.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throwInvalidItems("BY_WEIGHT item missing weightGrams/quantity");
  }

  const unit = String(item.unit || "kg");
  item.weightGrams = unit === "g" ? Math.round(quantity) : Math.round(quantity * 1000);
}

function computeFactorFromVariant({ variant, item }) {
  if (variant.mode === "BY_WEIGHT") {
    const grams = Number(item.weightGrams);
    if (!Number.isFinite(grams) || grams <= 0) {
      throwInvalidItems("BY_WEIGHT requires weightGrams > 0");
    }
    const sold = variant.sellUnit === "g" ? grams : grams / 1000;
    return sold / Number(variant.sellQty || 1);
  }

  return assertPositiveNumber(item.quantity || 1, "quantity");
}

function normalizeSelectedModifiers(inputModifiers) {
  const source = Array.isArray(inputModifiers) ? inputModifiers : [];
  return source.map((modifier) => {
    const groupId = toId(modifier?.groupId ? String(modifier.groupId) : "");
    const optionId = toId(modifier?.optionId ? String(modifier.optionId) : "");
    if (!groupId) throwInvalidItems("Invalid modifier.groupId");
    if (!optionId) throwInvalidItems("Invalid modifier.optionId");
    return { groupId, optionId };
  });
}

function getApplicableGroupsForDish({ groups, dishId }) {
  const normalizedDishId = String(dishId);
  return (groups || []).filter((group) => {
    if (!group?.isActive) return false;
    if (group.coverage === "GLOBAL") return true;
    if (group.coverage === "ITEMS") {
      return (group.menuItemIds || []).map(String).includes(normalizedDishId);
    }
    return false;
  });
}

function validateGroupSelection({ applicableGroups, selectedByGroup }) {
  for (const group of applicableGroups) {
    const groupId = String(group._id);
    const selectedOptionIds = selectedByGroup.get(groupId) || [];

    if (!group.required && selectedOptionIds.length === 0) continue;

    const selectionType = group.selectionType || "multiple";
    const minSelected = Number(group.minSelected ?? 0);
    const maxSelected = group.maxSelected != null
      ? Number(group.maxSelected)
      : null;

    if (selectionType === "single") {
      if (group.required && selectedOptionIds.length < 1) {
        throwInvalidItems(`Missing required modifier group "${group.name}"`);
      }
      if (selectedOptionIds.length > 1) {
        throwInvalidItems(`Group "${group.name}" allows only 1 option`);
      }
      continue;
    }

    const requiredMinimum = group.required ? Math.max(1, minSelected) : minSelected;
    if (selectedOptionIds.length < requiredMinimum) {
      throwInvalidItems(`Need more options in group "${group.name}"`);
    }
    if (maxSelected != null && selectedOptionIds.length > maxSelected) {
      throwInvalidItems(`Too many options in group "${group.name}"`);
    }
  }
}

function buildModifierSnapshotsForItem({ item, groups }) {
  const selectedModifiers = normalizeSelectedModifiers(
    item.selectedModifiers || item.modifiers,
  );
  const selectedByGroup = new Map();

  for (const selectedModifier of selectedModifiers) {
    const groupId = String(selectedModifier.groupId);
    const optionId = String(selectedModifier.optionId);
    selectedByGroup.set(groupId, [
      ...(selectedByGroup.get(groupId) || []),
      optionId,
    ]);
  }

  const applicableGroups = getApplicableGroupsForDish({
    groups,
    dishId: item.dishId,
  });

  // Required groups must be validated even when the customer selected no option.
  validateGroupSelection({ applicableGroups, selectedByGroup });

  if (!selectedModifiers.length) {
    item.modifiers = [];
    return;
  }

  const groupMap = new Map(
    (groups || []).map((group) => [String(group._id), group]),
  );
  const nextModifiers = [];

  for (const [groupId, optionIds] of selectedByGroup.entries()) {
    const group = groupMap.get(groupId);
    if (!group) throwInvalidItems(`ModifierGroup not found: ${groupId}`);

    if (!applicableGroups.some((candidate) => String(candidate._id) === groupId)) {
      throwInvalidItems(
        `ModifierGroup "${group.name}" is not applicable to this item`,
      );
    }

    const uniqueOptionIds = [...new Set(optionIds)];
    if (uniqueOptionIds.length !== optionIds.length) {
      throwInvalidItems(`Duplicate options in group "${group.name}"`);
    }
    if (group.selectionType === "single" && uniqueOptionIds.length > 1) {
      throwInvalidItems(`Group "${group.name}" allows only 1 option`);
    }

    for (const optionId of uniqueOptionIds) {
      const option = (group.options || []).find(
        (candidate) => String(candidate._id) === optionId,
      );
      if (!option) {
        throwInvalidItems(`Option ${optionId} not found in group "${group.name}"`);
      }
      if (option.isActive === false) {
        throwInvalidItems(`Option "${option.name}" is inactive`);
      }
      if (
        !option.priceRule?.rule ||
        option.priceRule.amount == null ||
        Number.isNaN(Number(option.priceRule.amount))
      ) {
        throwInvalidItems(`Option "${option.name}" missing priceRule`);
      }
      if (!option.inventoryRule?.rule) {
        throwInvalidItems(`Option "${option.name}" missing inventoryRule.rule`);
      }

      nextModifiers.push({
        groupId: toId(groupId),
        groupName: group.name,
        optionId: toId(optionId),
        optionName: option.name,
        priceRule: {
          rule: option.priceRule.rule,
          amount: Number(option.priceRule.amount),
        },
        inventoryRule: {
          rule: option.inventoryRule.rule,
          ingredientLines: (option.inventoryRule.ingredientLines || []).map(
            (line) => ({
              ingredientId: toId(line.ingredientId),
              qty: Number(line.qty),
              unit: line.unit,
              wastePct: Number(line.wastePct ?? 0),
            }),
          ),
          baseRecipeMultiplier:
            option.inventoryRule.rule === "MULTIPLY_BASE_RECIPE"
              ? Number(option.inventoryRule.baseRecipeMultiplier)
              : undefined,
          note: option.inventoryRule.note ?? undefined,
        },
      });
    }
  }

  if (nextModifiers.filter((modifier) => modifier.priceRule?.rule === "SET").length > 1) {
    throwInvalidItems("Only one SET price modifier is allowed per item");
  }
  if (
    nextModifiers.filter(
      (modifier) => modifier.inventoryRule?.rule === "MULTIPLY_BASE_RECIPE",
    ).length > 1
  ) {
    throwInvalidItems(
      "Only one MULTIPLY_BASE_RECIPE modifier is allowed per item",
    );
  }

  item.modifiers = nextModifiers;
}

function computeUnitPriceFromModifiers(servingVariantPrice, modifiers = []) {
  const setModifier = modifiers.find(
    (modifier) => modifier.priceRule?.rule === "SET",
  );
  const delta = modifiers
    .filter((modifier) => modifier.priceRule?.rule === "DELTA")
    .reduce(
      (sum, modifier) => sum + Number(modifier.priceRule.amount || 0),
      0,
    );
  const unitPrice = Math.max(
    0,
    (setModifier
      ? Number(setModifier.priceRule.amount)
      : Number(servingVariantPrice)) + delta,
  );

  return {
    baseUnitPrice: Number(servingVariantPrice),
    unitPrice,
    modifiersPricePerUnit: unitPrice - Number(servingVariantPrice),
  };
}

function computeLineSubtotal({ item, variant, unitPrice }) {
  if (variant.mode === "BY_WEIGHT") {
    const grams = assertPositiveIntegerGrams(item.weightGrams, "weightGrams");
    const sold = variant.sellUnit === "g" ? grams : grams / 1000;
    return Math.round(unitPrice * (sold / Number(variant.sellQty || 1)));
  }

  return Math.round(
    unitPrice * assertPositiveNumber(item.quantity || 1, "quantity"),
  );
}

function applyModifierInventoryRules({ baseLines, factor, modifiers }) {
  const lineMap = new Map();
  for (const line of baseLines) {
    lineMap.set(String(line.ingredientId), { ...line });
  }

  const multiplierModifier = modifiers.find(
    (modifier) => modifier.inventoryRule?.rule === "MULTIPLY_BASE_RECIPE",
  );
  if (multiplierModifier) {
    const multiplier = Number(
      multiplierModifier.inventoryRule.baseRecipeMultiplier,
    );
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      throwInvalidItems("Invalid baseRecipeMultiplier");
    }
    for (const [key, line] of lineMap.entries()) {
      lineMap.set(key, { ...line, qty: Number(line.qty) * multiplier });
    }
  }

  for (const modifier of modifiers) {
    const rule = modifier.inventoryRule?.rule;
    if (!["ADD_INGREDIENTS", "REPLACE_INGREDIENTS"].includes(rule)) {
      continue;
    }

    for (const line of modifier.inventoryRule.ingredientLines || []) {
      const quantityWithWaste =
        Number(line.qty || 0) *
        factor *
        (1 + Number(line.wastePct || 0) / 100);
      const key = String(line.ingredientId);

      if (rule === "ADD_INGREDIENTS") {
        const current = lineMap.get(key);
        if (!current) {
          lineMap.set(key, {
            ingredientId: line.ingredientId,
            qty: quantityWithWaste,
            unit: line.unit,
            wastePct: Number(line.wastePct || 0),
          });
        } else {
          if (String(current.unit) !== String(line.unit)) {
            throwInvalidItems(
              `Inventory unit conflict for ingredient ${key} (need consistent unit)`,
            );
          }
          lineMap.set(key, {
            ...current,
            qty: Number(current.qty) + quantityWithWaste,
          });
        }
      }

      if (rule === "REPLACE_INGREDIENTS") {
        lineMap.set(key, {
          ingredientId: line.ingredientId,
          qty: quantityWithWaste,
          unit: line.unit,
          wastePct: Number(line.wastePct || 0),
        });
      }
    }
  }

  return [...lineMap.values()];
}

export async function hydrateCheckoutOrderItems({
  restaurantId,
  items = [],
  session,
}) {
  const normalizedRestaurantId = toId(restaurantId);
  if (!normalizedRestaurantId) throwInvalidItems("Invalid restaurantId");
  if (!Array.isArray(items) || !items.length) {
    throwInvalidItems("No checkout items to hydrate");
  }

  const hydratedItems = items.map((item) => ({
    ...item,
    selectedModifiers: Array.isArray(item.selectedModifiers)
      ? item.selectedModifiers.map((modifier) => ({ ...modifier }))
      : item.selectedModifiers,
    modifiers: Array.isArray(item.modifiers)
      ? item.modifiers.map((modifier) => ({ ...modifier }))
      : item.modifiers,
  }));

  for (const item of hydratedItems) {
    const menuItemId = resolveMenuItemId(item);
    if (!menuItemId || !mongoose.isValidObjectId(String(menuItemId))) {
      throwInvalidItems("Invalid menu item");
    }
    item.dishId = toId(menuItemId);
  }

  const menuItemIds = [
    ...new Set(hydratedItems.map((item) => String(item.dishId))),
  ].map(toId);

  const menuQuery = MenuItem.find({
    restaurantId: normalizedRestaurantId,
    _id: { $in: menuItemIds },
  }).select("_id name categoryId status defaultServingKey");
  const menuItems = await (session ? menuQuery.session(session) : menuQuery).lean();
  const menuItemMap = new Map(
    (menuItems || []).map((menuItem) => [String(menuItem._id), menuItem]),
  );

  if (menuItemMap.size !== menuItemIds.length) {
    throwInvalidItems(
      "One or more checkout items are unavailable for this restaurant",
    );
  }

  const recipeQuery = Recipe.find({
    restaurantId: normalizedRestaurantId,
    menuItemId: { $in: menuItemIds },
  });
  const recipes = await (session ? recipeQuery.session(session) : recipeQuery).lean();
  const recipeMap = new Map(
    (recipes || []).map((recipe) => [String(recipe.menuItemId), recipe]),
  );

  const modifierGroupQuery = ModifierGroup.find({
    restaurantId: normalizedRestaurantId,
    isActive: true,
    $or: [
      { coverage: "GLOBAL" },
      { coverage: "ITEMS", menuItemIds: { $in: menuItemIds } },
    ],
  });
  const modifierGroups = await (
    session ? modifierGroupQuery.session(session) : modifierGroupQuery
  ).lean({ virtuals: true });

  const ingredientIds = new Set();
  for (const item of hydratedItems) {
    const recipe = recipeMap.get(String(item.dishId));
    if (!recipe) {
      throwInvalidItems(`Recipe not found for menuItemId=${item.dishId}`);
    }

    const menuItem = menuItemMap.get(String(item.dishId));
    const servingKey = String(
      item.servingKey || menuItem?.defaultServingKey || "",
    ).trim();
    if (!servingKey) {
      throwInvalidItems(
        `ServingVariant key is required for menuItemId=${item.dishId}`,
      );
    }
    item.servingKey = servingKey;

    const variant = recipe.servingVariants?.find(
      (candidate) => String(candidate.key) === servingKey,
    );
    if (!variant) {
      throwInvalidItems(
        `ServingVariant key="${servingKey}" not found in recipe for menuItemId=${item.dishId}`,
      );
    }

    for (const line of variant.ingredients || []) {
      ingredientIds.add(String(line.ingredientId));
    }
  }

  for (const group of modifierGroups || []) {
    for (const option of group.options || []) {
      for (const line of option?.inventoryRule?.ingredientLines || []) {
        if (line?.ingredientId) ingredientIds.add(String(line.ingredientId));
      }
    }
  }

  const ingredientObjectIds = [...ingredientIds]
    .map(toId)
    .filter(Boolean);
  const ingredientQuery = Ingredient.find({
    _id: { $in: ingredientObjectIds },
  });
  const ingredientDocs = await (
    session ? ingredientQuery.session(session) : ingredientQuery
  ).lean();
  const ingredientMap = new Map(
    (ingredientDocs || []).map((ingredient) => [
      String(ingredient._id),
      ingredient,
    ]),
  );

  for (const item of hydratedItems) {
    const menuItem = menuItemMap.get(String(item.dishId));
    const recipe = recipeMap.get(String(item.dishId));
    const variant = recipe.servingVariants.find(
      (candidate) => String(candidate.key) === String(item.servingKey),
    );

    item.menuItem = {
      _id: menuItem._id,
      id: menuItem._id,
      categoryId: menuItem.categoryId,
      name: menuItem.name,
    };
    item.menuId = menuItem._id;
    item.categoryId = menuItem.categoryId;
    item.name = menuItem.name;
    item.status = String(item.status || "pending");
    item.servingVariant = {
      key: variant.key,
      name: variant.name || variant.key,
      mode: variant.mode,
      price: Number(variant.price || 0),
      sellQty: Number(variant.sellQty || 1),
      sellUnit: String(
        variant.sellUnit || (variant.mode === "PORTION" ? "portion" : "kg"),
      ),
    };

    normalizeItemWeightGrams(item);
    buildModifierSnapshotsForItem({ item, groups: modifierGroups });
    const factor = computeFactorFromVariant({ variant, item });

    const baseLines = [];
    for (const line of variant.ingredients || []) {
      const ingredient = ingredientMap.get(String(line.ingredientId));
      if (!ingredient) {
        throwInvalidItems(`Ingredient not found: ${line.ingredientId}`);
      }
      const quantityWithWaste =
        Number(line.qty || 0) *
        factor *
        (1 + Number(line.wastePct || 0) / 100);
      baseLines.push({
        ingredientId: toId(line.ingredientId),
        qty: quantityWithWaste,
        unit: line.unit,
        wastePct: Number(line.wastePct || 0),
      });
    }

    const finalLines = applyModifierInventoryRules({
      baseLines,
      factor,
      modifiers: item.modifiers || [],
    });

    item.ingredientsSnapshot = finalLines.map((line) => {
      const ingredient = ingredientMap.get(String(line.ingredientId));
      if (!ingredient) {
        throwInvalidItems(`Ingredient not found: ${line.ingredientId}`);
      }
      const baseUnitQuantity = convertToBaseUnitQty(
        ingredient,
        Number(line.qty),
        line.unit,
      );
      const costPerBaseUnit = ingredient.costPerBaseUnit != null
        ? Number(ingredient.costPerBaseUnit)
        : null;
      return {
        ingredientId: toId(line.ingredientId),
        name: ingredient.name,
        quantity: Number(line.qty),
        unit: line.unit,
        baseUnitQuantity,
        costPerBaseUnit,
        totalCost:
          costPerBaseUnit != null
            ? baseUnitQuantity * costPerBaseUnit
            : null,
      };
    });

    const {
      baseUnitPrice,
      unitPrice,
      modifiersPricePerUnit,
    } = computeUnitPriceFromModifiers(
      item.servingVariant.price,
      item.modifiers || [],
    );
    item.baseUnitPrice = baseUnitPrice;
    item.unitPrice = unitPrice;
    item.modifiersPricePerUnit = modifiersPricePerUnit;
    item.modifiersPrice = modifiersPricePerUnit;
    item.lineSubtotal = computeLineSubtotal({ item, variant, unitPrice });
  }

  if (hydratedItems.length !== items.length) {
    throwInvalidItems("Unable to hydrate all checkout items");
  }

  return hydratedItems;
}
