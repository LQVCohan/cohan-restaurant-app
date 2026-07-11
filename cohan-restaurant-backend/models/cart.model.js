import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
import { computeCartTotalAmount } from "./cartDerivedFields.js";

const { Schema, Types } = mongoose;

const CartModifierIngredientLineSchema = new Schema(
  {
    ingredientId: {
      type: Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    qty: { type: Number, default: 0 },
    unit: { type: String, trim: true },
    wastePct: { type: Number, default: 0 },
  },
  { _id: false },
);

const CartModifierSnapshotSchema = new Schema(
  {
    groupId: {
      type: Types.ObjectId,
      ref: "ModifierGroup",
      required: true,
    },
    groupName: { type: String, trim: true },
    optionId: { type: Types.ObjectId, required: true },
    optionName: { type: String, trim: true },
    priceRule: {
      rule: {
        type: String,
        enum: ["DELTA", "SET"],
        default: "DELTA",
      },
      amount: { type: Number, default: 0 },
    },
    inventoryRule: {
      rule: {
        type: String,
        enum: [
          "NONE",
          "ADD_INGREDIENTS",
          "REPLACE_INGREDIENTS",
          "MULTIPLY_BASE_RECIPE",
        ],
        default: "NONE",
      },
      ingredientLines: {
        type: [CartModifierIngredientLineSchema],
        default: [],
      },
      baseRecipeMultiplier: { type: Number, default: null },
      note: { type: String, trim: true },
    },
  },
  { _id: false },
);

const CartItemSchema = new Schema(
  {
    itemType: {
      type: String,
      enum: ["MENU_ITEM", "COMBO", "SUPPLY"],
      default: "MENU_ITEM",
      index: true,
    },
    menuItemId: {
      type: Types.ObjectId,
      ref: "MenuItem",
      required: false,
    },
    supplyId: {
      type: Types.ObjectId,
      ref: "Supply",
      required: false,
    },
    comboId: { type: Types.ObjectId, ref: "Combo" },
    comboSnapshot: { type: Schema.Types.Mixed, default: null },
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },

    name: { type: String, trim: true },
    price: { type: Number, default: 0, min: 0 },
    modifiersPrice: { type: Number, default: 0 },
    quantity: { type: Number, default: 1, min: 1 },

    thumbImage: { type: String, trim: true },
    note: { type: String, trim: true },

    servingKey: { type: String, trim: true },
    servingName: { type: String, trim: true },
    modifiers: { type: [CartModifierSnapshotSchema], default: [] },
    modifierSelectionKey: { type: String, trim: true, default: "" },

    serviceAt: { type: Date, default: null, index: true },
    holdExpiresAt: { type: Date, index: true },
    holdStatus: {
      type: String,
      enum: [
        "active",
        "released",
        "ordered",
        "checkout_pending",
        "expired",
      ],
      default: "active",
    },
  },
  { _id: true },
);

const CartSchema = BaseSchemaModel({
  userId: {
    type: Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  status: {
    type: String,
    enum: ["active", "checked_out", "abandoned"],
    default: "active",
    index: true,
  },

  restaurantId: {
    type: Types.ObjectId,
    ref: "Restaurant",
    default: null,
    index: true,
  },

  totalAmount: { type: Number, default: 0, min: 0 },
  lastActivityAt: { type: Date, default: null, index: true },

  items: {
    type: [CartItemSchema],
    default: [],
  },

  abuse: {
    timeoutReleaseCount: { type: Number, default: 0 },
    exitReleaseCount: { type: Number, default: 0 },
    warningCount: { type: Number, default: 0 },
    blockedUntil: { type: Date },
    lastViolationAt: { type: Date },
  },
});

CartSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
    name: "uniq_active_cart_per_user",
  },
);

CartSchema.virtual("totalQuantity").get(function totalQuantity() {
  if (!Array.isArray(this.items)) return 0;
  return this.items.reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0),
    0,
  );
});

CartSchema.virtual("totalPrice").get(function totalPrice() {
  if (!Array.isArray(this.items)) return 0;
  return computeCartTotalAmount(this.items);
});

CartSchema.index({ status: 1, "items.holdExpiresAt": 1 });

export const Cart = mongoose.models.Cart || mongoose.model("Cart", CartSchema);
export default Cart;
