import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
import ShippingSchema from "./order-shipping.model.js";
const OrderItemSchema = new mongoose.Schema({
  dishId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuItem",
    required: true,
  },
  menuId: { type: mongoose.Schema.Types.ObjectId, ref: "Menu", required: true },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },

  name: { type: String, required: true },
  unit: { type: String, default: "phần" },
  image: { type: String },
  proofImages: [{ type: String }],
  price: { type: Number, required: true, min: 0 },
  modifiersPrice: { type: Number, default: 0, min: 0 },

  method: { type: String },
  methodDelta: { type: Number, default: 0 },
  description: { type: String },

  quantity: { type: Number, required: true, min: 0.01 },

  modifiers: [
    {
      optionId: { type: mongoose.Schema.Types.ObjectId, ref: "ModifierOption" },
      optionName: { type: String },
      price: { type: Number, default: 0, min: 0 },
    },
  ],

  lineSubtotal: { type: Number, default: 0 },
  cancelReason: { type: String },

  status: {
    type: String,
    default: "pending",
    enum: ["pending", "preparing", "ready", "served", "cancelled", "returned"],
  },

  recipeId: { type: mongoose.Schema.Types.ObjectId, ref: "Recipe" },
  note: { type: String },
});

const OrderSchema = BaseSchemaModel({
  orderCode: { type: String, required: true },
  dailySequence: { type: Number },

  tableCode: { type: String },
  tableName: { type: String },
  guestCount: { type: Number, default: 1 },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation" },
  parentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },

  orderType: {
    type: String,
    required: true,
    enum: ["dine_in", "takeaway", "delivery"],
    default: "dine_in",
  },

  shipping: ShippingSchema,
  items: [OrderItemSchema],

  totals: {
    subtotal: { type: Number, required: true, min: 0 },

    discount: { type: Number, default: 0, min: 0 },
    discountReason: { type: String },
    voucherCode: { type: String },
    promotionId: { type: mongoose.Schema.Types.ObjectId, ref: "Promotion" },

    tax: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0 },

    service: { type: Number, required: true, min: 0 },
    serviceRate: { type: Number, default: 0 },

    shippingFee: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
  },

  payment: {
    method: { type: String, default: "cash" },
    provider: { type: String },
    transactionId: { type: String },
    status: {
      type: String,
      enum: ["paid", "pending", "failed", "refunded", "partially_refunded"],
      default: "pending",
    },
    paidAmount: { type: Number, default: 0 },
    changeAmount: { type: Number, default: 0 },
    currency: { type: String, default: "VND" },
    paidAt: { type: Date },
  },

  printStatus: {
    isPrinted: { type: Boolean, default: false },
    chefPrinted: { type: Boolean, default: false },
    printedAt: Date,
  },

  statusTimeline: [
    {
      status: {
        type: String,
        enum: [
          "draft",
          "pending",
          "confirmed",
          "customer_attached",
          "preparing",
          "ready",
          "served",
          "completed",
          "cancelled",
          "failed",
        ],
      },
      at: { type: Date, default: Date.now },
      byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      note: { type: String },
    },
  ],

  currentStatus: { type: String, default: "confirmed" },
  note: { type: String },
});
OrderSchema.methods.calculateTotals = function () {
  let subtotal = 0;

  this.items.forEach((item) => {
    const modifiersPrice = item.modifiers.reduce(
      (acc, mod) => acc + (mod.price || 0),
      0
    );
    item.modifiersPrice = modifiersPrice;

    const unitPrice = item.price + modifiersPrice + (item.methodDelta || 0);
    item.lineSubtotal = unitPrice * item.quantity;

    if (!["cancelled", "returned"].includes(item.status)) {
      subtotal += item.lineSubtotal;
    }
  });

  this.totals.subtotal = subtotal;

  const serviceRate = this.totals.serviceRate || 0;
  const taxRate = this.totals.taxRate || 0;
  const discount = this.totals.discount || 0;
  const shippingFee = this.totals.shippingFee || this.shipping.shippingFee || 0;

  this.totals.service = Math.round(subtotal * serviceRate);

  const amountBeforeTax = Math.max(
    0,
    this.totals.subtotal + this.totals.service - discount
  );

  this.totals.tax = Math.round(amountBeforeTax * taxRate);

  this.totals.grandTotal = Math.round(
    amountBeforeTax + this.totals.tax + shippingFee
  );

  return this;
};

OrderSchema.pre("save", function (next) {
  if (
    this.isModified("items") ||
    this.isModified("totals") ||
    this.isModified("shipping")
  ) {
    this.calculateTotals();
  }
  next();
});
OrderSchema.index({ restaurantId: 1, orderCode: 1 }, { unique: true });
OrderSchema.index({ restaurantId: 1, currentStatus: 1, createdAt: -1 });
OrderSchema.index({ "payment.transactionId": 1 });
OrderSchema.index({ "shipping.phone": 1 });

export default mongoose.model("Order", OrderSchema);
