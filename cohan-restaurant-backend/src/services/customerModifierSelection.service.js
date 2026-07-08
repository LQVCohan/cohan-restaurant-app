import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { ModifierGroup } from "../../models/index.js";

const badInput = (message) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

const normalizeId = (value, field) => {
  const id = String(value || "").trim();
  if (!mongoose.isValidObjectId(id)) throw badInput(`${field} không hợp lệ.`);
  return id;
};

const normalizeSelections = (selectedModifiers = []) => {
  if (!Array.isArray(selectedModifiers)) {
    throw badInput("Danh sách tùy chọn món không hợp lệ.");
  }

  const seen = new Set();
  return selectedModifiers.map((selection) => {
    const groupId = normalizeId(selection?.groupId, "Nhóm tùy chọn");
    const optionId = normalizeId(selection?.optionId, "Tùy chọn");
    const key = `${groupId}:${optionId}`;
    if (seen.has(key)) throw badInput("Tùy chọn món bị trùng lặp.");
    seen.add(key);
    return { groupId, optionId };
  });
};

const getRequiredMinimum = (group) =>
  group?.required ? Math.max(1, Number(group?.minSelected || 0)) : Number(group?.minSelected || 0);

const validateGroupSelection = (group, selectedOptionIds) => {
  const count = selectedOptionIds.length;
  if (!group?.required && count === 0) return;

  if (group?.selectionType === "single") {
    if (group.required && count < 1) {
      throw badInput(`Vui lòng chọn một lựa chọn cho ${group.name}.`);
    }
    if (count > 1) throw badInput(`${group.name} chỉ cho phép chọn một lựa chọn.`);
    return;
  }

  const minimum = getRequiredMinimum(group);
  const maximum = group?.maxSelected == null ? null : Number(group.maxSelected);
  if (count < minimum) {
    throw badInput(`Vui lòng chọn ít nhất ${minimum} lựa chọn cho ${group.name}.`);
  }
  if (maximum != null && count > maximum) {
    throw badInput(`Chỉ được chọn tối đa ${maximum} lựa chọn cho ${group.name}.`);
  }
};

const normalizeInventoryRule = (inventoryRule = {}) => ({
  rule: inventoryRule.rule || "NONE",
  ingredientLines: (inventoryRule.ingredientLines || []).map((line) => ({
    ingredientId: line.ingredientId,
    qty: Number(line.qty || 0),
    unit: line.unit,
    wastePct: Number(line.wastePct || 0),
  })),
  baseRecipeMultiplier:
    inventoryRule.baseRecipeMultiplier == null
      ? null
      : Number(inventoryRule.baseRecipeMultiplier),
  note: inventoryRule.note || null,
});

export const buildCustomerModifierSelectionKey = (modifiers = []) =>
  (modifiers || [])
    .map((modifier) => `${modifier.groupId}:${modifier.optionId}`)
    .sort()
    .join("|");

export async function resolveCustomerModifierSelection({
  restaurantId,
  menuItemId,
  selectedModifiers = [],
  basePrice = 0,
  session,
}) {
  const normalizedRestaurantId = normalizeId(restaurantId, "Nhà hàng");
  const normalizedMenuItemId = normalizeId(menuItemId, "Món ăn");
  const selections = normalizeSelections(selectedModifiers);

  let query = ModifierGroup.find({
    restaurantId: normalizedRestaurantId,
    isActive: true,
    $or: [
      { coverage: "GLOBAL" },
      { coverage: "ITEMS", menuItemIds: normalizedMenuItemId },
    ],
  }).sort({ name: 1, _id: 1 });
  if (session) query = query.session(session);
  const groups = await query.lean({ virtuals: true });

  const groupMap = new Map(groups.map((group) => [String(group._id), group]));
  const selectedByGroup = new Map();
  for (const selection of selections) {
    const group = groupMap.get(selection.groupId);
    if (!group) throw badInput("Một nhóm tùy chọn không áp dụng cho món này.");
    selectedByGroup.set(selection.groupId, [
      ...(selectedByGroup.get(selection.groupId) || []),
      selection.optionId,
    ]);
  }

  groups.forEach((group) => {
    validateGroupSelection(group, selectedByGroup.get(String(group._id)) || []);
  });

  const snapshots = [];
  for (const [groupId, optionIds] of selectedByGroup.entries()) {
    const group = groupMap.get(groupId);
    const uniqueOptionIds = [...new Set(optionIds)];
    if (uniqueOptionIds.length !== optionIds.length) {
      throw badInput(`Tùy chọn trong ${group.name} bị trùng lặp.`);
    }

    for (const optionId of uniqueOptionIds) {
      const option = (group.options || []).find(
        (candidate) => String(candidate?._id || candidate?.id) === optionId,
      );
      if (!option || option.isActive === false) {
        throw badInput(`Một lựa chọn trong ${group.name} hiện không khả dụng.`);
      }
      const rule = option.priceRule?.rule || "DELTA";
      const amount = Number(option.priceRule?.amount || 0);
      if (!["DELTA", "SET"].includes(rule) || !Number.isFinite(amount)) {
        throw badInput(`Giá của lựa chọn ${option.name} không hợp lệ.`);
      }
      if (rule === "SET" && amount < 0) {
        throw badInput(`Giá của lựa chọn ${option.name} không hợp lệ.`);
      }

      snapshots.push({
        groupId: group._id,
        groupName: group.name,
        optionId: option._id || option.id,
        optionName: option.name,
        priceRule: { rule, amount },
        inventoryRule: normalizeInventoryRule(option.inventoryRule),
      });
    }
  }

  if (snapshots.filter((modifier) => modifier.priceRule.rule === "SET").length > 1) {
    throw badInput("Chỉ có thể chọn một tùy chọn đặt lại giá món.");
  }
  if (
    snapshots.filter(
      (modifier) => modifier.inventoryRule.rule === "MULTIPLY_BASE_RECIPE",
    ).length > 1
  ) {
    throw badInput("Chỉ có thể chọn một tùy chọn thay đổi định lượng món.");
  }

  const normalizedBasePrice = Number(basePrice || 0);
  const setPrice = snapshots.find((modifier) => modifier.priceRule.rule === "SET")
    ?.priceRule?.amount;
  const delta = snapshots
    .filter((modifier) => modifier.priceRule.rule === "DELTA")
    .reduce((sum, modifier) => sum + Number(modifier.priceRule.amount || 0), 0);
  const unitPrice = Math.max(
    0,
    Number(setPrice == null ? normalizedBasePrice : setPrice) + delta,
  );

  return {
    selectedModifiers: snapshots.map(({ groupId, optionId }) => ({ groupId, optionId })),
    modifiers: snapshots,
    modifiersPrice: unitPrice - normalizedBasePrice,
    unitPrice,
    selectionKey: buildCustomerModifierSelectionKey(snapshots),
  };
}
