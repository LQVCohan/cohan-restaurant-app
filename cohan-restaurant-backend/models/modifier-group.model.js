// src/models/modifier-group.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
import { UnitEnum } from "./ingredient.model.js";

const { Schema } = mongoose;

/**
 * ModifierGroup = 1 nhóm tuỳ chọn (Size / Topping / Chế biến...)
 * ModifierOption = 1 lựa chọn trong nhóm (Size L / Thêm bò / Không cay...)
 *
 * Mục tiêu model:
 * - Đọc field là hiểu ngay ý nghĩa (không dùng tên mơ hồ như "effect")
 * - Không fallback, không legacy
 * - Hỗ trợ: giá tăng/giảm hoặc set giá, và (tuỳ chọn) ảnh hưởng đến trừ kho nguyên liệu
 */

/** Nhóm tuỳ chọn theo nghiệp vụ */
export const ModifierGroupTypeEnum = [
  "SIZE",
  "TOPPING",
  "PREPARATION",
  "CUSTOM",
];

/** Độ phủ áp dụng */
export const ModifierCoverageEnum = ["GLOBAL", "ITEMS"];

/** Cách tính giá của option */
export const ModifierPriceRuleEnum = ["DELTA", "SET"];

/** Quy tắc trừ kho (nguyên liệu) của option */
export const InventoryRuleEnum = [
  "NONE",
  "ADD_INGREDIENTS",
  "REPLACE_INGREDIENTS",
  "MULTIPLY_BASE_RECIPE",
];

/**
 * 1 dòng nguyên liệu dùng cho trừ kho (giống Recipe)
 * - qty + unit: số lượng theo đơn vị line
 * - wastePct: % hao hụt
 */
const InventoryIngredientLineSchema = new Schema(
  {
    ingredientId: {
      type: Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    qty: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: UnitEnum, required: true },
    wastePct: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

/**
 * Quy tắc giá cho option:
 * - DELTA: cộng/trừ vào giá món (amount có thể âm)
 * - SET: set lại giá món (amount >= 0)
 */
const ModifierPriceRuleSchema = new Schema(
  {
    rule: {
      type: String,
      enum: ModifierPriceRuleEnum,
      required: true,
      default: "DELTA",
    },
    amount: { type: Number, required: true, default: 0 }, // VND
  },
  { _id: false }
);

/**
 * Quy tắc tồn kho cho option:
 * - NONE: không ảnh hưởng nguyên liệu
 * - ADD_INGREDIENTS: thêm nguyên liệu (topping thêm bò 100g)
 * - REPLACE_INGREDIENTS: thay nguyên liệu (ít đường: thay sugar -> sweetener)
 * - MULTIPLY_BASE_RECIPE: nhân toàn bộ công thức gốc (size L x1.2)
 */
const ModifierInventoryRuleSchema = new Schema(
  {
    rule: {
      type: String,
      enum: InventoryRuleEnum,
      required: true,
      default: "NONE",
    },

    // dùng cho ADD_INGREDIENTS / REPLACE_INGREDIENTS
    ingredientLines: { type: [InventoryIngredientLineSchema], default: [] },

    // dùng cho MULTIPLY_BASE_RECIPE
    baseRecipeMultiplier: { type: Number, min: 0.000001 },

    note: { type: String },
  },
  { _id: false }
);

/**
 * 1 lựa chọn trong nhóm modifier
 * Ví dụ: "Size L", "Thêm bò", "Không cay"
 */
const ModifierOptionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },

    priceRule: {
      type: ModifierPriceRuleSchema,
      required: true,
      default: () => ({ rule: "DELTA", amount: 0 }),
    },

    inventoryRule: {
      type: ModifierInventoryRuleSchema,
      required: true,
      default: () => ({ rule: "NONE", ingredientLines: [] }),
    },

    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

ModifierOptionSchema.virtual("id").get(function () {
  return this._id ? String(this._id) : null;
});

/**
 * Nhóm modifier
 * - GLOBAL: áp dụng cho toàn bộ món (menuItemIds phải rỗng)
 * - ITEMS: áp dụng cho 1 danh sách món (menuItemIds bắt buộc có)
 */
const ModifierGroupSchema = BaseSchemaModel({
  restaurantId: {
    type: Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },

  name: { type: String, required: true, trim: true },

  groupType: {
    type: String,
    enum: ModifierGroupTypeEnum,
    required: true,
    default: "CUSTOM",
    index: true,
  },

  coverage: {
    type: String,
    enum: ModifierCoverageEnum,
    required: true,
    default: "ITEMS",
    index: true,
  },

  // chỉ dùng khi coverage=ITEMS
  menuItemIds: {
    type: [Schema.Types.ObjectId],
    ref: "MenuItem",
    default: [],
    index: true,
  },

  selectionType: {
    type: String,
    enum: ["single", "multiple"],
    required: true,
    default: "multiple",
  },
  required: { type: Boolean, default: false },

  // giới hạn chọn chuyên nghiệp
  minSelected: { type: Number, default: 0, min: 0 },
  maxSelected: { type: Number, min: 1 },

  options: { type: [ModifierOptionSchema], default: [] },

  note: { type: String },
  isActive: { type: Boolean, default: true },
});

// tên group trong 1 nhà hàng là duy nhất
ModifierGroupSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

ModifierGroupSchema.pre("validate", function (next) {
  const options = Array.isArray(this.options) ? this.options : [];

  // 1) coverage rules
  if (this.coverage === "GLOBAL") {
    if ((this.menuItemIds || []).length > 0) {
      return next(new Error("coverage=GLOBAL must not have menuItemIds"));
    }
  } else {
    if ((this.menuItemIds || []).length === 0) {
      return next(new Error("coverage=ITEMS requires menuItemIds"));
    }
  }

  // 2) chỉ 1 option default
  const defaults = options.filter((o) => o?.isDefault);
  if (defaults.length > 1)
    return next(new Error("Only one option can be isDefault=true"));

  // 3) required & selection constraint
  if (this.selectionType === "single") {
    this.maxSelected = 1;
    this.minSelected = this.required ? 1 : 0;
  } else {
    if (this.required && (this.minSelected || 0) < 1) this.minSelected = 1;
    if (this.maxSelected != null && this.maxSelected < this.minSelected) {
      return next(new Error("maxSelected must be >= minSelected"));
    }
  }

  // 4) validate each option rules
  for (const opt of options) {
    if (!opt) continue;

    // price rule
    const priceRule = opt.priceRule?.rule;
    const priceAmount = Number(opt.priceRule?.amount);
    if (!ModifierPriceRuleEnum.includes(priceRule)) {
      return next(new Error(`Invalid priceRule.rule in option "${opt.name}"`));
    }
    if (!Number.isFinite(priceAmount)) {
      return next(
        new Error(`Invalid priceRule.amount in option "${opt.name}"`)
      );
    }
    if (priceRule === "SET" && priceAmount < 0) {
      return next(
        new Error(`priceRule SET cannot be negative in option "${opt.name}"`)
      );
    }

    // inventory rule
    const invRule = opt.inventoryRule?.rule;
    if (!InventoryRuleEnum.includes(invRule)) {
      return next(
        new Error(`Invalid inventoryRule.rule in option "${opt.name}"`)
      );
    }

    const lines = opt.inventoryRule?.ingredientLines || [];
    const multiplier = opt.inventoryRule?.baseRecipeMultiplier;

    if (invRule === "MULTIPLY_BASE_RECIPE") {
      const f = Number(multiplier);
      if (!Number.isFinite(f) || f <= 0) {
        return next(
          new Error(`Option "${opt.name}": baseRecipeMultiplier must be > 0`)
        );
      }
      if (lines.length > 0) {
        return next(
          new Error(
            `Option "${opt.name}": ingredientLines not allowed for MULTIPLY_BASE_RECIPE`
          )
        );
      }
    }

    if (invRule === "ADD_INGREDIENTS" || invRule === "REPLACE_INGREDIENTS") {
      if (multiplier != null) {
        return next(
          new Error(
            `Option "${opt.name}": baseRecipeMultiplier only for MULTIPLY_BASE_RECIPE`
          )
        );
      }
      for (const l of lines) {
        if (!l.ingredientId)
          return next(new Error(`Option "${opt.name}": missing ingredientId`));
        if (!l.unit)
          return next(new Error(`Option "${opt.name}": missing unit`));
        if (!(Number(l.qty) > 0))
          return next(new Error(`Option "${opt.name}": qty must be > 0`));
      }
    }

    if (invRule === "NONE") {
      if (multiplier != null)
        return next(
          new Error(`Option "${opt.name}": multiplier not allowed for NONE`)
        );
      if (lines.length > 0)
        return next(
          new Error(
            `Option "${opt.name}": ingredientLines not allowed for NONE`
          )
        );
    }
  }

  next();
});

export const ModifierGroup =
  mongoose.models.ModifierGroup ||
  mongoose.model("ModifierGroup", ModifierGroupSchema);

export default ModifierGroup;
