// src/models/cart.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
import { computeCartTotalAmount } from "./cartDerivedFields.js";

const { Schema, Types } = mongoose;

const CartItemSchema = new Schema(
  {
    itemType: { type: String, enum: ["MENU_ITEM", "COMBO"], default: "MENU_ITEM", index: true },
    menuItemId: {
      type: Types.ObjectId,
      ref: "MenuItem",
      required: false,
    },
    comboId: { type: Types.ObjectId, ref: "Combo" },
    comboSnapshot: { type: Schema.Types.Mixed, default: null },
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },

    // Mirror theo FE hook/state
    name: { type: String, trim: true }, // tên món tại thời điểm thêm
    price: { type: Number, default: 0, min: 0 }, // đơn giá tại thời điểm thêm
    quantity: { type: Number, default: 1, min: 1 },

    thumbImage: { type: String, trim: true },
    note: { type: String, trim: true },

    // Serving variant (nếu có)
    servingKey: { type: String, trim: true }, // vd: "portion" | "byWeight"
    servingName: { type: String, trim: true }, // vd: "1 phần", "100g"

    holdExpiresAt: { type: Date, index: true },
    holdStatus: { type: String, enum: ["active", "released", "ordered"], default: "active" },
  },
  { _id: true }
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

  // Denormalized convenience field for single-restaurant carts. When a cart
  // contains items from multiple restaurants, item.restaurantId remains the
  // source of truth and this field is intentionally null.
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

// Một user chỉ có 1 cart active; các cart lịch sử vẫn được giữ lại.
CartSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
    name: "uniq_active_cart_per_user",
  },
);

// Tổng số lượng
CartSchema.virtual("totalQuantity").get(function () {
  if (!Array.isArray(this.items)) return 0;
  return this.items.reduce((sum, i) => sum + (Number(i?.quantity) || 0), 0);
});

// Tổng tiền
CartSchema.virtual("totalPrice").get(function () {
  if (!Array.isArray(this.items)) return 0;
  return computeCartTotalAmount(this.items);
});

CartSchema.index({ status: 1, "items.holdExpiresAt": 1 });

export const Cart = mongoose.models.Cart || mongoose.model("Cart", CartSchema);

export default Cart;
