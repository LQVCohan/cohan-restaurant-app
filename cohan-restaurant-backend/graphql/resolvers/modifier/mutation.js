import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  ModifierGroup,
  MenuItem,
  Ingredient,
  Order,
} from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";
import { requireRestaurantAccess } from "../../guards.js";

const isValidId = (value) => mongoose.isValidObjectId(value);
const toId = (value) => new mongoose.Types.ObjectId(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function badRequest(message) {
  throw new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

function normalizeDupKey(error) {
  if (error?.code !== 11000) return error;
  return new GraphQLError("Tên nhóm tuỳ chọn đã tồn tại trong nhà hàng này.", {
    extensions: { code: "BAD_USER_INPUT" },
  });
}

function normalizeNullableText(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeAndValidateOptionInput(option) {
  if (!option || typeof option !== "object") badRequest("Lựa chọn không hợp lệ.");

  const name = String(option.name || "").trim();
  if (!name) badRequest("Tên lựa chọn là bắt buộc.");

  const priceRule = option.priceRule || {};
  const priceRuleType = String(priceRule.rule || "").trim();
  if (!["DELTA", "SET"].includes(priceRuleType)) {
    badRequest(`Lựa chọn "${name}": quy tắc giá không hợp lệ.`);
  }
  const priceAmount = Number(priceRule.amount ?? 0);
  if (!Number.isFinite(priceAmount)) {
    badRequest(`Lựa chọn "${name}": số tiền không hợp lệ.`);
  }
  if (priceRuleType === "SET" && priceAmount < 0) {
    badRequest(`Lựa chọn "${name}": giá đặt lại không được âm.`);
  }

  const inventoryRule = option.inventoryRule || {};
  const inventoryRuleType = String(inventoryRule.rule || "").trim();
  const inventoryRuleTypes = [
    "NONE",
    "ADD_INGREDIENTS",
    "REPLACE_INGREDIENTS",
    "MULTIPLY_BASE_RECIPE",
  ];
  if (!inventoryRuleTypes.includes(inventoryRuleType)) {
    badRequest(`Lựa chọn "${name}": quy tắc tồn kho không hợp lệ.`);
  }

  const ingredientLines = Array.isArray(inventoryRule.ingredientLines)
    ? inventoryRule.ingredientLines
    : [];
  const baseRecipeMultiplier = inventoryRule.baseRecipeMultiplier;

  if (inventoryRuleType === "MULTIPLY_BASE_RECIPE") {
    const multiplier = Number(baseRecipeMultiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      badRequest(`Lựa chọn "${name}": hệ số công thức phải lớn hơn 0.`);
    }
    if (ingredientLines.length > 0) {
      badRequest(`Lựa chọn "${name}": không thể vừa nhân công thức vừa khai báo nguyên liệu.`);
    }
  }

  if (["ADD_INGREDIENTS", "REPLACE_INGREDIENTS"].includes(inventoryRuleType)) {
    if (baseRecipeMultiplier != null) {
      badRequest(`Lựa chọn "${name}": hệ số chỉ dùng khi nhân công thức gốc.`);
    }
    for (const line of ingredientLines) {
      if (!isValidId(line?.ingredientId)) {
        badRequest(`Lựa chọn "${name}": nguyên liệu không hợp lệ.`);
      }
      const qty = Number(line?.qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        badRequest(`Lựa chọn "${name}": định lượng nguyên liệu phải lớn hơn 0.`);
      }
      const unit = String(line?.unit || "").trim();
      if (!unit) badRequest(`Lựa chọn "${name}": đơn vị nguyên liệu là bắt buộc.`);
      const wastePct = Number(line?.wastePct ?? 0);
      if (!Number.isFinite(wastePct) || wastePct < 0 || wastePct > 100) {
        badRequest(`Lựa chọn "${name}": hao hụt phải nằm trong khoảng 0–100%.`);
      }
    }
  }

  if (inventoryRuleType === "NONE") {
    if (baseRecipeMultiplier != null || ingredientLines.length > 0) {
      badRequest(`Lựa chọn "${name}": quy tắc không ảnh hưởng kho không nhận dữ liệu nguyên liệu.`);
    }
  }

  return {
    name,
    isDefault: Boolean(option.isDefault),
    isActive: option.isActive !== false,
    priceRule: { rule: priceRuleType, amount: priceAmount },
    inventoryRule: {
      rule: inventoryRuleType,
      ingredientLines: ["ADD_INGREDIENTS", "REPLACE_INGREDIENTS"].includes(
        inventoryRuleType,
      )
        ? ingredientLines.map((line) => ({
            ingredientId: toId(line.ingredientId),
            qty: Number(line.qty),
            unit: String(line.unit),
            wastePct: Number(line.wastePct ?? 0),
          }))
        : [],
      baseRecipeMultiplier:
        inventoryRuleType === "MULTIPLY_BASE_RECIPE"
          ? Number(baseRecipeMultiplier)
          : undefined,
      note: normalizeNullableText(inventoryRule.note),
    },
  };
}

function normalizeDefaultOption(groupPatch) {
  const options = groupPatch.options;
  if (!Array.isArray(options) || options.length === 0) return;

  let defaultIndex = options.findIndex((option) => option.isDefault);
  if (defaultIndex < 0 && groupPatch.selectionType === "single" && groupPatch.required) {
    defaultIndex = 0;
  }
  options.forEach((option, index) => {
    option.isDefault = index === defaultIndex;
  });
}

function normalizeAndValidateGroupInput(input, { isUpdate = false } = {}) {
  if (!input || typeof input !== "object") badRequest("Dữ liệu nhóm tuỳ chọn là bắt buộc.");
  const output = {};

  if (!isUpdate || hasOwn(input, "restaurantId")) {
    if (!isValidId(input.restaurantId)) badRequest("Nhà hàng không hợp lệ.");
    output.restaurantId = toId(input.restaurantId);
  }

  if (!isUpdate || hasOwn(input, "name")) {
    const name = String(input.name || "").trim();
    if (!name) badRequest("Tên nhóm tuỳ chọn là bắt buộc.");
    output.name = name;
  }

  if (!isUpdate || hasOwn(input, "groupType")) {
    const groupType = String(input.groupType || "").trim();
    if (!["SIZE", "TOPPING", "PREPARATION", "CUSTOM"].includes(groupType)) {
      badRequest("Loại nhóm tuỳ chọn không hợp lệ.");
    }
    output.groupType = groupType;
  }

  if (!isUpdate || hasOwn(input, "coverage")) {
    const coverage = String(input.coverage || "").trim();
    if (!["GLOBAL", "ITEMS"].includes(coverage)) {
      badRequest("Phạm vi áp dụng không hợp lệ.");
    }
    output.coverage = coverage;
  }

  if (!isUpdate || hasOwn(input, "menuItemIds")) {
    const rawIds = Array.isArray(input.menuItemIds) ? input.menuItemIds : [];
    const uniqueIds = [...new Set(rawIds.map(String))];
    uniqueIds.forEach((id) => {
      if (!isValidId(id)) badRequest(`Món ăn không hợp lệ: ${id}`);
    });
    output.menuItemIds = uniqueIds.map(toId);
  }

  if (!isUpdate || hasOwn(input, "selectionType")) {
    const selectionType = String(input.selectionType || "").trim();
    if (!["single", "multiple"].includes(selectionType)) {
      badRequest("Kiểu chọn không hợp lệ.");
    }
    output.selectionType = selectionType;
  }

  if (!isUpdate || hasOwn(input, "required")) {
    output.required = Boolean(input.required);
  }

  if (!isUpdate || hasOwn(input, "minSelected")) {
    const minimum = input.minSelected == null ? 0 : Number(input.minSelected);
    if (!Number.isFinite(minimum) || minimum < 0) {
      badRequest("Số lựa chọn tối thiểu phải từ 0 trở lên.");
    }
    output.minSelected = Math.floor(minimum);
  }

  if (!isUpdate || hasOwn(input, "maxSelected")) {
    if (input.maxSelected == null || input.maxSelected === "") {
      output.maxSelected = null;
    } else {
      const maximum = Number(input.maxSelected);
      if (!Number.isFinite(maximum) || maximum < 1) {
        badRequest("Số lựa chọn tối đa phải từ 1 trở lên.");
      }
      output.maxSelected = Math.floor(maximum);
    }
  }

  if (!isUpdate || hasOwn(input, "note")) {
    output.note = normalizeNullableText(input.note);
  }
  if (!isUpdate || hasOwn(input, "isActive")) {
    output.isActive = input.isActive !== false;
  }

  if (!isUpdate || hasOwn(input, "options")) {
    if (!Array.isArray(input.options) || input.options.length === 0) {
      badRequest("Nhóm tuỳ chọn phải có ít nhất một lựa chọn.");
    }
    output.options = input.options.map(normalizeAndValidateOptionInput);
  }

  const coverage = output.coverage ?? input.coverage;
  const menuItemIds = output.menuItemIds ?? input.menuItemIds;
  if (coverage === "GLOBAL" && Array.isArray(menuItemIds) && menuItemIds.length > 0) {
    badRequest("Nhóm áp dụng toàn menu không được chứa danh sách món.");
  }
  if (coverage === "ITEMS" && (!Array.isArray(menuItemIds) || menuItemIds.length === 0)) {
    badRequest("Nhóm áp dụng theo món phải chọn ít nhất một món.");
  }

  const selectionType = output.selectionType ?? input.selectionType;
  const required = output.required ?? input.required;
  if (selectionType === "single") {
    output.minSelected = required ? 1 : 0;
    output.maxSelected = 1;
  } else if (selectionType === "multiple") {
    const minimum = output.minSelected ?? Number(input.minSelected || 0);
    if (required && minimum < 1) output.minSelected = 1;
    const normalizedMinimum = output.minSelected ?? minimum;
    const maximum = hasOwn(output, "maxSelected")
      ? output.maxSelected
      : input.maxSelected;
    if (maximum != null && maximum < normalizedMinimum) {
      badRequest("Số lựa chọn tối đa phải lớn hơn hoặc bằng tối thiểu.");
    }
  }

  normalizeDefaultOption({
    selectionType,
    required,
    options: output.options,
  });
  return output;
}

async function assertMenuItemsExist({ restaurantId, menuItemIds }) {
  if (!menuItemIds?.length) return;
  const ids = [...new Set(menuItemIds.map(String))];
  const count = await MenuItem.countDocuments({
    restaurantId: toId(restaurantId),
    _id: { $in: ids.map(toId) },
  });
  if (count !== ids.length) {
    badRequest("Có món không tồn tại trong nhà hàng đang chọn.");
  }
}

async function assertIngredientsExistFromOptions({ restaurantId, options }) {
  const ids = new Set();
  for (const option of options || []) {
    if (!["ADD_INGREDIENTS", "REPLACE_INGREDIENTS"].includes(option?.inventoryRule?.rule)) {
      continue;
    }
    for (const line of option.inventoryRule.ingredientLines || []) {
      ids.add(String(line.ingredientId));
    }
  }
  if (!ids.size) return;

  const list = [...ids];
  const count = await Ingredient.countDocuments({
    restaurantId: toId(restaurantId),
    _id: { $in: list.map(toId) },
  });
  if (count !== list.length) {
    badRequest("Có nguyên liệu không thuộc nhà hàng đang chọn.");
  }
}

const valueOrCurrent = (patch, key, currentValue) =>
  hasOwn(patch, key) ? patch[key] : currentValue;

export const ModifierMutation = {
  createModifierGroup: async (_, { input }, ctx) => {
    try {
      requireRole(ctx?.user, ["admin", "manager"]);
      const patch = normalizeAndValidateGroupInput(input);
      await requireRestaurantAccess(ctx, patch.restaurantId);

      if (patch.coverage === "ITEMS") {
        await assertMenuItemsExist({
          restaurantId: patch.restaurantId,
          menuItemIds: patch.menuItemIds,
        });
      }
      await assertIngredientsExistFromOptions({
        restaurantId: patch.restaurantId,
        options: patch.options,
      });

      const created = await ModifierGroup.create(patch);
      return ModifierGroup.findById(created._id).lean({ virtuals: true });
    } catch (error) {
      console.error("❌ createModifierGroup error:", error);
      const normalized = normalizeDupKey(error);
      throw normalized instanceof GraphQLError
        ? normalized
        : new GraphQLError(normalized.message || "Không thể tạo nhóm tuỳ chọn.", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },

  updateModifierGroup: async (_, { input }, ctx) => {
    try {
      requireRole(ctx?.user, ["admin", "manager"]);
      const { id, ...rest } = input || {};
      if (!isValidId(id)) badRequest("Nhóm tuỳ chọn không hợp lệ.");

      const document = await ModifierGroup.findById(id);
      if (!document) throw new GraphQLError("Không tìm thấy nhóm tuỳ chọn.");
      await requireRestaurantAccess(ctx, document.restaurantId);

      const merged = {
        restaurantId: document.restaurantId,
        name: valueOrCurrent(rest, "name", document.name),
        groupType: valueOrCurrent(rest, "groupType", document.groupType),
        coverage: valueOrCurrent(rest, "coverage", document.coverage),
        menuItemIds: valueOrCurrent(rest, "menuItemIds", document.menuItemIds),
        selectionType: valueOrCurrent(rest, "selectionType", document.selectionType),
        required: valueOrCurrent(rest, "required", document.required),
        minSelected: valueOrCurrent(rest, "minSelected", document.minSelected),
        maxSelected: valueOrCurrent(rest, "maxSelected", document.maxSelected),
        options: valueOrCurrent(rest, "options", document.options),
        note: valueOrCurrent(rest, "note", document.note),
        isActive: valueOrCurrent(rest, "isActive", document.isActive),
      };
      const patch = normalizeAndValidateGroupInput(merged, { isUpdate: true });

      if (patch.coverage === "ITEMS") {
        await assertMenuItemsExist({
          restaurantId: document.restaurantId,
          menuItemIds: patch.menuItemIds,
        });
      }
      await assertIngredientsExistFromOptions({
        restaurantId: document.restaurantId,
        options: patch.options,
      });

      Object.assign(document, patch);
      await document.save();
      return ModifierGroup.findById(document._id).lean({ virtuals: true });
    } catch (error) {
      console.error("❌ updateModifierGroup error:", error);
      const normalized = normalizeDupKey(error);
      throw normalized instanceof GraphQLError
        ? normalized
        : new GraphQLError(normalized.message || "Không thể cập nhật nhóm tuỳ chọn.", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },

  deleteModifierGroup: async (_, { id }, ctx) => {
    try {
      requireRole(ctx?.user, ["admin"]);
      if (!isValidId(id)) badRequest("Nhóm tuỳ chọn không hợp lệ.");

      const existing = await ModifierGroup.findById(id)
        .select({ restaurantId: 1 })
        .lean();
      if (!existing) return true;
      await requireRestaurantAccess(ctx, existing.restaurantId);

      const usedInOrders = await Order?.exists?.({
        "items.modifiers.groupId": toId(id),
      });
      if (usedInOrders) {
        badRequest("Nhóm đã được dùng trong đơn hàng. Hãy tắt nhóm thay vì xoá.");
      }

      await ModifierGroup.findByIdAndDelete(id);
      return true;
    } catch (error) {
      console.error("❌ deleteModifierGroup error:", error);
      throw error instanceof GraphQLError
        ? error
        : new GraphQLError(error.message || "Không thể xoá nhóm tuỳ chọn.", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },

  addModifierOption: async (_, { groupId, option }, ctx) => {
    try {
      requireRole(ctx?.user, ["admin", "manager"]);
      if (!isValidId(groupId)) badRequest("Nhóm tuỳ chọn không hợp lệ.");

      const group = await ModifierGroup.findById(groupId);
      if (!group) throw new GraphQLError("Không tìm thấy nhóm tuỳ chọn.");
      await requireRestaurantAccess(ctx, group.restaurantId);

      const normalizedOption = normalizeAndValidateOptionInput(option);
      await assertIngredientsExistFromOptions({
        restaurantId: group.restaurantId,
        options: [normalizedOption],
      });

      if (normalizedOption.isDefault) {
        group.options.forEach((candidate) => {
          candidate.isDefault = false;
        });
      }
      group.options.push(normalizedOption);
      normalizeDefaultOption(group);

      await group.save();
      return ModifierGroup.findById(group._id).lean({ virtuals: true });
    } catch (error) {
      console.error("❌ addModifierOption error:", error);
      throw error instanceof GraphQLError
        ? error
        : new GraphQLError(error.message || "Không thể thêm lựa chọn.", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },

  updateModifierOption: async (_, { groupId, optionId, option }, ctx) => {
    try {
      requireRole(ctx?.user, ["admin", "manager"]);
      if (!isValidId(groupId) || !isValidId(optionId)) {
        badRequest("Nhóm hoặc lựa chọn không hợp lệ.");
      }

      const group = await ModifierGroup.findById(groupId);
      if (!group) throw new GraphQLError("Không tìm thấy nhóm tuỳ chọn.");
      await requireRestaurantAccess(ctx, group.restaurantId);

      const optionIndex = group.options.findIndex(
        (candidate) => String(candidate._id) === String(optionId),
      );
      if (optionIndex < 0) throw new GraphQLError("Không tìm thấy lựa chọn.");

      const current = group.options[optionIndex].toObject
        ? group.options[optionIndex].toObject()
        : group.options[optionIndex];
      const merged = {
        name: valueOrCurrent(option, "name", current.name),
        isDefault: valueOrCurrent(option, "isDefault", current.isDefault),
        isActive: valueOrCurrent(option, "isActive", current.isActive),
        priceRule: valueOrCurrent(option, "priceRule", current.priceRule),
        inventoryRule: valueOrCurrent(option, "inventoryRule", current.inventoryRule),
      };
      const normalizedOption = normalizeAndValidateOptionInput(merged);
      await assertIngredientsExistFromOptions({
        restaurantId: group.restaurantId,
        options: [normalizedOption],
      });

      if (normalizedOption.isDefault) {
        group.options.forEach((candidate) => {
          candidate.isDefault = false;
        });
      }
      Object.assign(group.options[optionIndex], normalizedOption);
      normalizeDefaultOption(group);

      await group.save();
      return ModifierGroup.findById(group._id).lean({ virtuals: true });
    } catch (error) {
      console.error("❌ updateModifierOption error:", error);
      throw error instanceof GraphQLError
        ? error
        : new GraphQLError(error.message || "Không thể cập nhật lựa chọn.", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },

  removeModifierOption: async (_, { groupId, optionId }, ctx) => {
    try {
      requireRole(ctx?.user, ["admin", "manager"]);
      if (!isValidId(groupId) || !isValidId(optionId)) {
        badRequest("Nhóm hoặc lựa chọn không hợp lệ.");
      }

      const group = await ModifierGroup.findById(groupId);
      if (!group) throw new GraphQLError("Không tìm thấy nhóm tuỳ chọn.");
      await requireRestaurantAccess(ctx, group.restaurantId);

      const optionIndex = group.options.findIndex(
        (candidate) => String(candidate._id) === String(optionId),
      );
      if (optionIndex < 0) throw new GraphQLError("Không tìm thấy lựa chọn.");
      if (group.options.length <= 1) {
        badRequest("Nhóm tuỳ chọn phải giữ lại ít nhất một lựa chọn.");
      }

      group.options.splice(optionIndex, 1);
      normalizeDefaultOption(group);
      await group.save();
      return ModifierGroup.findById(group._id).lean({ virtuals: true });
    } catch (error) {
      console.error("❌ removeModifierOption error:", error);
      throw error instanceof GraphQLError
        ? error
        : new GraphQLError(error.message || "Không thể xoá lựa chọn.", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },
};
