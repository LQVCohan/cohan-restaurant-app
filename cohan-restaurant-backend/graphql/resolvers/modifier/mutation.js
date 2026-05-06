// src/graphql/resolvers/modifier/mutation.js
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

// ===== helpers =====
const isValidId = (v) => mongoose.isValidObjectId(v);
const toId = (v) => new mongoose.Types.ObjectId(v);

function badRequest(message) {
  throw new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

function normalizeDupKey(err) {
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    const fieldText = fields.length ? fields.join(", ") : "unique field";
    return new GraphQLError(`Duplicate ${fieldText}`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return err;
}

/**
 * Chuẩn hoá & validate input group theo model mới
 * Model fields kỳ vọng:
 * - restaurantId, name, groupType, coverage, menuItemIds
 * - selectionType, required, minSelected, maxSelected
 * - options[]: { name, isDefault, isActive, priceRule{rule,amount}, inventoryRule{rule,ingredientLines,baseRecipeMultiplier,note} }
 */
function normalizeAndValidateGroupInput(input, { isUpdate = false } = {}) {
  if (!input || typeof input !== "object") badRequest("input is required");

  const out = {};

  // restaurantId (create bắt buộc)
  if (!isUpdate) {
    if (!isValidId(input.restaurantId)) badRequest("Invalid restaurantId");
    out.restaurantId = toId(input.restaurantId);
  } else if (input.restaurantId !== undefined) {
    if (!isValidId(input.restaurantId)) badRequest("Invalid restaurantId");
    out.restaurantId = toId(input.restaurantId);
  }

  // name
  if (!isUpdate || input.name !== undefined) {
    const name = String(input.name || "").trim();
    if (!name) badRequest("name is required");
    out.name = name;
  }

  // groupType
  if (!isUpdate || input.groupType !== undefined) {
    const groupType = String(input.groupType || "").trim();
    const ok = ["SIZE", "TOPPING", "PREPARATION", "CUSTOM"].includes(groupType);
    if (!ok) badRequest("groupType must be SIZE|TOPPING|PREPARATION|CUSTOM");
    out.groupType = groupType;
  }

  // coverage
  if (!isUpdate || input.coverage !== undefined) {
    const coverage = String(input.coverage || "").trim();
    const ok = ["GLOBAL", "ITEMS"].includes(coverage);
    if (!ok) badRequest("coverage must be GLOBAL|ITEMS");
    out.coverage = coverage;
  }

  // menuItemIds
  if (!isUpdate || input.menuItemIds !== undefined) {
    const raw = Array.isArray(input.menuItemIds) ? input.menuItemIds : [];
    const unique = [...new Set(raw.map(String))];

    for (const id of unique) {
      if (!isValidId(id)) badRequest(`Invalid menuItemId: ${id}`);
    }
    out.menuItemIds = unique.map(toId);
  }

  // selectionType
  if (!isUpdate || input.selectionType !== undefined) {
    const selectionType = String(input.selectionType || "").trim();
    if (!["single", "multiple"].includes(selectionType)) {
      badRequest("selectionType must be single|multiple");
    }
    out.selectionType = selectionType;
  }

  // required
  if (!isUpdate || input.required !== undefined) {
    out.required = !!input.required;
  }

  // minSelected/maxSelected
  if (!isUpdate || input.minSelected !== undefined) {
    const v = input.minSelected == null ? 0 : Number(input.minSelected);
    if (!Number.isFinite(v) || v < 0) badRequest("minSelected must be >= 0");
    out.minSelected = Math.floor(v);
  }

  if (!isUpdate || input.maxSelected !== undefined) {
    const v = input.maxSelected == null ? null : Number(input.maxSelected);
    if (v != null && (!Number.isFinite(v) || v < 1))
      badRequest("maxSelected must be >= 1");
    out.maxSelected = v == null ? undefined : Math.floor(v);
  }

  // note/isActive
  if (!isUpdate || input.note !== undefined) out.note = input.note ?? undefined;
  if (!isUpdate || input.isActive !== undefined)
    out.isActive = input.isActive ?? true;

  // options
  if (!isUpdate || input.options !== undefined) {
    if (!Array.isArray(input.options) || input.options.length === 0) {
      badRequest("options must have at least 1 option");
    }
    out.options = input.options.map(normalizeAndValidateOptionInput);
    normalizeSingleDefault(out);
  }

  // ---- cross-field normalize & validate ----

  // coverage rule
  const cov = out.coverage ?? input.coverage; // update case: may not set
  const ids = out.menuItemIds ?? input.menuItemIds;

  // nếu update mà không gửi coverage/menuItemIds thì không kiểm tra ở đây
  if (cov === "GLOBAL") {
    if (Array.isArray(ids) && ids.length > 0)
      badRequest("coverage=GLOBAL must not have menuItemIds");
  }
  if (cov === "ITEMS") {
    if (!Array.isArray(ids) || ids.length === 0)
      badRequest("coverage=ITEMS requires menuItemIds");
  }

  // selection constraints
  const sel = out.selectionType ?? input.selectionType;
  const req = out.required ?? input.required;

  if (sel === "single") {
    out.maxSelected = 1;
    out.minSelected = req ? 1 : 0;
  } else if (sel === "multiple") {
    const min = out.minSelected ?? 0;
    const max = out.maxSelected;

    if (req && min < 1) out.minSelected = 1;
    if (max != null && max < (out.minSelected ?? 0)) {
      badRequest("maxSelected must be >= minSelected");
    }
  }

  return out;
}

function normalizeAndValidateOptionInput(opt) {
  if (!opt || typeof opt !== "object") badRequest("Invalid option");

  const name = String(opt.name || "").trim();
  if (!name) badRequest("Option.name is required");

  // priceRule
  const priceRule = opt.priceRule || {};
  const priceRuleType = String(priceRule.rule || "").trim();
  if (!["DELTA", "SET"].includes(priceRuleType)) {
    badRequest(`Option "${name}": priceRule.rule must be DELTA|SET`);
  }
  const priceAmount = Number(priceRule.amount ?? 0);
  if (!Number.isFinite(priceAmount))
    badRequest(`Option "${name}": priceRule.amount invalid`);
  if (priceRuleType === "SET" && priceAmount < 0)
    badRequest(`Option "${name}": SET price cannot be negative`);

  // inventoryRule
  const inventoryRule = opt.inventoryRule || {};
  const invType = String(inventoryRule.rule || "").trim();
  if (
    ![
      "NONE",
      "ADD_INGREDIENTS",
      "REPLACE_INGREDIENTS",
      "MULTIPLY_BASE_RECIPE",
    ].includes(invType)
  ) {
    badRequest(
      `Option "${name}": inventoryRule.rule must be NONE|ADD_INGREDIENTS|REPLACE_INGREDIENTS|MULTIPLY_BASE_RECIPE`
    );
  }

  const ingredientLines = Array.isArray(inventoryRule.ingredientLines)
    ? inventoryRule.ingredientLines
    : [];
  const baseRecipeMultiplier = inventoryRule.baseRecipeMultiplier;

  if (invType === "MULTIPLY_BASE_RECIPE") {
    const f = Number(baseRecipeMultiplier);
    if (!Number.isFinite(f) || f <= 0)
      badRequest(`Option "${name}": baseRecipeMultiplier must be > 0`);
    if (ingredientLines.length > 0)
      badRequest(
        `Option "${name}": ingredientLines not allowed for MULTIPLY_BASE_RECIPE`
      );
  }

  if (invType === "ADD_INGREDIENTS" || invType === "REPLACE_INGREDIENTS") {
    if (baseRecipeMultiplier != null)
      badRequest(
        `Option "${name}": baseRecipeMultiplier only for MULTIPLY_BASE_RECIPE`
      );
    for (const line of ingredientLines) {
      if (!isValidId(line?.ingredientId))
        badRequest(`Option "${name}": invalid ingredientId`);
      const qty = Number(line?.qty);
      if (!Number.isFinite(qty) || qty <= 0)
        badRequest(`Option "${name}": qty must be > 0`);
      const unit = String(line?.unit || "").trim();
      if (!unit) badRequest(`Option "${name}": unit is required`);
      const wastePct = Number(line?.wastePct ?? 0);
      if (!Number.isFinite(wastePct) || wastePct < 0 || wastePct > 100)
        badRequest(`Option "${name}": wastePct 0..100`);
    }
  }

  if (invType === "NONE") {
    if (baseRecipeMultiplier != null)
      badRequest(`Option "${name}": baseRecipeMultiplier not allowed for NONE`);
    if (ingredientLines.length > 0)
      badRequest(`Option "${name}": ingredientLines not allowed for NONE`);
  }

  return {
    name,
    isDefault: !!opt.isDefault,
    isActive: opt.isActive ?? true,

    priceRule: { rule: priceRuleType, amount: priceAmount },

    inventoryRule: {
      rule: invType,
      ingredientLines:
        invType === "ADD_INGREDIENTS" || invType === "REPLACE_INGREDIENTS"
          ? ingredientLines.map((l) => ({
              ingredientId: toId(l.ingredientId),
              qty: Number(l.qty),
              unit: String(l.unit),
              wastePct: Number(l.wastePct ?? 0),
            }))
          : [],
      baseRecipeMultiplier:
        invType === "MULTIPLY_BASE_RECIPE"
          ? Number(baseRecipeMultiplier)
          : undefined,
      note: inventoryRule.note ?? undefined,
    },
  };
}

/**
 * Nếu selectionType=single: đảm bảo chỉ 1 default
 * Nếu required=true & single: auto set default nếu chưa có
 */
function normalizeSingleDefault(groupPatch) {
  const { selectionType, required, options } = groupPatch;
  if (!Array.isArray(options) || options.length === 0) return;

  if (selectionType === "single") {
    let found = false;
    for (const o of options) {
      if (o.isDefault && !found) found = true;
      else if (o.isDefault && found) o.isDefault = false;
    }
    if (required && !found) options[0].isDefault = true;
  } else {
    // multiple: vẫn không cho >1 default để tránh UI/logic mơ hồ
    let found = false;
    for (const o of options) {
      if (o.isDefault && !found) found = true;
      else if (o.isDefault && found) o.isDefault = false;
    }
  }
}

async function assertMenuItemsExist({ restaurantId, menuItemIds }) {
  if (!menuItemIds?.length) return;
  const count = await MenuItem.countDocuments({
    restaurantId: toId(restaurantId),
    _id: { $in: menuItemIds.map(toId) },
  });
  if (count !== menuItemIds.length)
    badRequest("Some menuItemIds do not exist in this restaurant");
}

async function assertIngredientsExistFromOptions(options) {
  const ids = new Set();
  for (const o of options || []) {
    const r = o?.inventoryRule?.rule;
    if (r === "ADD_INGREDIENTS" || r === "REPLACE_INGREDIENTS") {
      for (const l of o.inventoryRule.ingredientLines || []) {
        ids.add(String(l.ingredientId));
      }
    }
  }
  const list = [...ids];
  if (!list.length) return;

  const count = await Ingredient.countDocuments({
    _id: { $in: list.map(toId) },
  });
  if (count !== list.length)
    badRequest("Some ingredientIds in option inventoryRule do not exist");
}

// ===== mutations =====
export const ModifierMutation = {
  // ============ Group CRUD ============

  createModifierGroup: async (_, { input }, ctx) => {
    const { user } = ctx || {};
    try {
      requireRole(user, ["admin", "manager"]);

      const patch = normalizeAndValidateGroupInput(input, { isUpdate: false });
      await requireRestaurantAccess(ctx, patch.restaurantId);

      // validate cross-collection
      if (patch.coverage === "ITEMS") {
        await assertMenuItemsExist({
          restaurantId: patch.restaurantId,
          menuItemIds: (patch.menuItemIds || []).map(String),
        });
      }
      await assertIngredientsExistFromOptions(patch.options);

      const created = await ModifierGroup.create(patch);
      return await ModifierGroup.findById(created._id).lean({ virtuals: true });
    } catch (err) {
      console.error("❌ createModifierGroup error:", err);
      const e = normalizeDupKey(err);
      throw e instanceof GraphQLError
        ? e
        : new GraphQLError(e.message || "Failed to create modifier group", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },

  updateModifierGroup: async (_, { input }, ctx) => {
    const { user } = ctx || {};
    try {
      requireRole(user, ["admin", "manager"]);

      const { id, ...rest } = input || {};
      if (!isValidId(id)) badRequest("Invalid id");

      const doc = await ModifierGroup.findById(id);
      if (!doc) throw new GraphQLError("ModifierGroup not found");
      await requireRestaurantAccess(ctx, doc.restaurantId);

      // merge current + patch để validate ràng buộc chéo chắc chắn
      const merged = {
        restaurantId: doc.restaurantId,
        name: rest.name ?? doc.name,
        groupType: rest.groupType ?? doc.groupType,
        coverage: rest.coverage ?? doc.coverage,
        menuItemIds: rest.menuItemIds ?? doc.menuItemIds,
        selectionType: rest.selectionType ?? doc.selectionType,
        required: rest.required ?? doc.required,
        minSelected: rest.minSelected ?? doc.minSelected,
        maxSelected: rest.maxSelected ?? doc.maxSelected,
        options: rest.options ?? doc.options,
        note: rest.note ?? doc.note,
        isActive: rest.isActive ?? doc.isActive,
      };
      merged.restaurantId = doc.restaurantId;

      const patch = normalizeAndValidateGroupInput(merged, { isUpdate: true });

      // validate cross-collection
      if ((patch.coverage ?? merged.coverage) === "ITEMS") {
        const ids = (patch.menuItemIds ?? merged.menuItemIds ?? []).map(String);
        await assertMenuItemsExist({
          restaurantId: merged.restaurantId,
          menuItemIds: ids,
        });
      }

      const options = patch.options ?? merged.options;
      await assertIngredientsExistFromOptions(options);

      Object.assign(doc, patch);
      await doc.save();

      return await ModifierGroup.findById(doc._id).lean({ virtuals: true });
    } catch (err) {
      console.error("❌ updateModifierGroup error:", err);
      const e = normalizeDupKey(err);
      throw e instanceof GraphQLError
        ? e
        : new GraphQLError(e.message || "Failed to update modifier group", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },

  deleteModifierGroup: async (_, { id }, ctx) => {
    const { user } = ctx || {};
    try {
      requireRole(user, ["admin"]);

      if (!isValidId(id)) badRequest("Invalid id");
      const existing = await ModifierGroup.findById(id).select({ restaurantId: 1 }).lean();
      if (!existing) return true;
      await requireRestaurantAccess(ctx, existing.restaurantId);

      // professional: chặn xoá nếu đã xuất hiện trong Order
      // (nếu bạn chưa có Order model trong index.js thì bỏ import Order ở trên)
      const usedInOrders = await Order?.exists?.({
        "items.modifiers.groupId": toId(id),
      });
      if (usedInOrders) {
        throw new GraphQLError("Cannot delete: group already used in orders", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      await ModifierGroup.findByIdAndDelete(id);
      return true;
    } catch (err) {
      console.error("❌ deleteModifierGroup error:", err);
      throw err instanceof GraphQLError
        ? err
        : new GraphQLError(err.message || "Failed to delete modifier group", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },

  // ============ Option CRUD (clean, đúng model mới) ============

  addModifierOption: async (_, { groupId, option }, ctx) => {
    const { user } = ctx || {};
    try {
      requireRole(user, ["admin", "manager"]);

      if (!isValidId(groupId)) badRequest("Invalid groupId");
      const g = await ModifierGroup.findById(groupId);
      if (!g) throw new GraphQLError("ModifierGroup not found");
      await requireRestaurantAccess(ctx, g.restaurantId);

      const normalizedOption = normalizeAndValidateOptionInput(option);
      await assertIngredientsExistFromOptions([normalizedOption]);

      // single => chỉ 1 default
      if (g.selectionType === "single" && normalizedOption.isDefault) {
        g.options.forEach((o) => (o.isDefault = false));
      }

      g.options.push(normalizedOption);

      // nếu single+required mà chưa có default => auto set default option đầu
      if (g.selectionType === "single" && g.required) {
        const anyDefault = g.options.some((o) => o.isDefault);
        if (!anyDefault && g.options.length) g.options[0].isDefault = true;
      }

      await g.save();
      return await ModifierGroup.findById(g._id).lean({ virtuals: true });
    } catch (err) {
      console.error("❌ addModifierOption error:", err);
      throw err instanceof GraphQLError
        ? err
        : new GraphQLError(err.message || "Failed to add option", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },

  updateModifierOption: async (_, { groupId, optionId, option }, ctx) => {
    const { user } = ctx || {};
    try {
      requireRole(user, ["admin", "manager"]);

      if (!isValidId(groupId)) badRequest("Invalid groupId");
      if (!isValidId(optionId)) badRequest("Invalid optionId");

      const g = await ModifierGroup.findById(groupId);
      if (!g) throw new GraphQLError("ModifierGroup not found");
      await requireRestaurantAccess(ctx, g.restaurantId);

      const idx = g.options.findIndex(
        (o) => String(o._id) === String(optionId)
      );
      if (idx === -1) throw new GraphQLError("Option not found");

      // build merged option then validate (no fallback)
      const current = g.options[idx].toObject
        ? g.options[idx].toObject()
        : g.options[idx];

      const merged = {
        name: option.name ?? current.name,
        isDefault: option.isDefault ?? current.isDefault,
        isActive: option.isActive ?? current.isActive,
        priceRule: option.priceRule ?? current.priceRule,
        inventoryRule: option.inventoryRule ?? current.inventoryRule,
      };

      const normalized = normalizeAndValidateOptionInput(merged);
      await assertIngredientsExistFromOptions([normalized]);

      // single default handling
      if (g.selectionType === "single" && normalized.isDefault) {
        g.options.forEach((o) => (o.isDefault = false));
      }

      g.options[idx].name = normalized.name;
      g.options[idx].isDefault = normalized.isDefault;
      g.options[idx].isActive = normalized.isActive;
      g.options[idx].priceRule = normalized.priceRule;
      g.options[idx].inventoryRule = normalized.inventoryRule;

      if (g.selectionType === "single" && g.required) {
        const anyDefault = g.options.some((o) => o.isDefault);
        if (!anyDefault && g.options.length) g.options[0].isDefault = true;
      }

      await g.save();
      return await ModifierGroup.findById(g._id).lean({ virtuals: true });
    } catch (err) {
      console.error("❌ updateModifierOption error:", err);
      throw err instanceof GraphQLError
        ? err
        : new GraphQLError(err.message || "Failed to update option", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },

  removeModifierOption: async (_, { groupId, optionId }, ctx) => {
    const { user } = ctx || {};
    try {
      requireRole(user, ["admin", "manager"]);

      if (!isValidId(groupId)) badRequest("Invalid groupId");
      if (!isValidId(optionId)) badRequest("Invalid optionId");

      const g = await ModifierGroup.findById(groupId);
      if (!g) throw new GraphQLError("ModifierGroup not found");
      await requireRestaurantAccess(ctx, g.restaurantId);

      g.options = (g.options || []).filter(
        (o) => String(o._id) !== String(optionId)
      );

      if (g.selectionType === "single" && g.required) {
        const anyDefault = g.options.some((o) => o.isDefault);
        if (!anyDefault && g.options.length) g.options[0].isDefault = true;
      }

      await g.save();
      return await ModifierGroup.findById(g._id).lean({ virtuals: true });
    } catch (err) {
      console.error("❌ removeModifierOption error:", err);
      throw err instanceof GraphQLError
        ? err
        : new GraphQLError(err.message || "Failed to remove option", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
    }
  },
};
