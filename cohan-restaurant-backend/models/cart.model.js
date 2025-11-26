// src/models/cart.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

const CartItemSchema = new Schema(
  {
    menuItemId: {
      type: Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
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

  items: {
    type: [CartItemSchema],
    default: [],
  },
});

// Một user chỉ có 1 cart active
CartSchema.index({ userId: 1, status: 1 });

// Tổng số lượng
CartSchema.virtual("totalQuantity").get(function () {
  if (!Array.isArray(this.items)) return 0;
  return this.items.reduce((sum, i) => sum + (Number(i?.quantity) || 0), 0);
});

// Tổng tiền
CartSchema.virtual("totalPrice").get(function () {
  if (!Array.isArray(this.items)) return 0;
  return this.items.reduce(
    (sum, i) => sum + (Number(i?.price) || 0) * (Number(i?.quantity) || 0),
    0
  );
});

export const Cart = mongoose.models.Cart || mongoose.model("Cart", CartSchema);

export default Cart;
