import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
import ShippingSchema from "./order-shipping.model.js";
import { UnitEnum } from "./ingredient.model.js";

const { Schema } = mongoose;

const OrderStatusEnum = [
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
];

const ItemStatusEnum = [
  "pending",
  "preparing",
  "ready",
  "served",
  "cancelled",
  "returned",
];

const PriorityEnum = ["LOW", "MEDIUM", "HIGH"];

const OrderKindEnum = ["table_session", "order_batch", "split_bill"];

const SessionStatusEnum = [
  "open",
  "dining",
  "ready_to_pay",
  "closed",
  "cancelled",
];

const KitchenStatusEnum = [
  "draft",
  "pending",
  "confirmed",
  "customer_attached",
  "preparing",
  "ready",
  "served",
  "cancelled",
  "failed",
];

const OrderPaymentStatusEnum = [
  "unpaid",
  "payment_requested",
  "partial",
  "paid",
  "failed",
  "refunded",
  "partially_refunded",
];
const CustomerOrderPublicStatusEnum = [
  "ORDER_RECEIVED",
  "CONFIRMED",
  "PREPARING",
  "PARTIALLY_READY",
  "READY_TO_SERVE",
  "SERVED",
  "WAITING_FOR_PAYMENT",
  "PAID",
  "CANCELLED",
  "ISSUE_REPORTED",
];

const SplitStatusEnum = ["none", "root", "root_hidden", "partial"];

const ModifierPriceRuleEnum = ["DELTA", "SET"];
const ModifierInventoryRuleEnum = [
  "NONE",
  "ADD_INGREDIENTS",
  "REPLACE_INGREDIENTS",
  "MULTIPLY_BASE_RECIPE",
];

const ServingVariantSnapshotSchema = new Schema(
  {
    key: { type: String, trim: true },
    name: { type: String, trim: true },
    mode: { type: String, enum: ["PORTION", "BY_WEIGHT"] },
    price: { type: Number, min: 0 },
    sellQty: { type: Number, min: 0.000001 },
    sellUnit: { type: String, enum: ["portion", "g", "kg"] },
  },
  { _id: false },
);

const IngredientSnapshotLineSchema = new Schema(
  {
    ingredientId: {
      type: Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
      index: true,
    },
    name: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: UnitEnum, required: true },
    baseUnitQuantity: { type: Number, required: true, min: 0 },
    costPerBaseUnit: { type: Number, min: 0 },
    totalCost: { type: Number, min: 0 },
  },
  { _id: false },
);

const ModifierPriceRuleSnapshotSchema = new Schema(
  {
    rule: { type: String, enum: ModifierPriceRuleEnum, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false },
);

const ModifierInventoryIngredientLineSnapshotSchema = new Schema(
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
  { _id: false },
);

const ModifierInventoryRuleSnapshotSchema = new Schema(
  {
    rule: { type: String, enum: ModifierInventoryRuleEnum, required: true },
    ingredientLines: {
      type: [ModifierInventoryIngredientLineSnapshotSchema],
      default: [],
    },
    baseRecipeMultiplier: { type: Number, min: 0.000001 },
    note: { type: String },
  },
  { _id: false },
);

const OrderModifierSnapshotSchema = new Schema(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "ModifierGroup",
      required: true,
      index: true,
    },
    groupName: { type: String, required: true, trim: true },
    optionId: { type: Schema.Types.ObjectId, required: true, index: true },
    optionName: { type: String, required: true, trim: true },
    priceRule: { type: ModifierPriceRuleSnapshotSchema, required: true },
    inventoryRule: {
      type: ModifierInventoryRuleSnapshotSchema,
      required: true,
    },
  },
  { _id: false },
);

const OrderItemSchema = new Schema(
  {
    itemType: { type: String, enum: ["MENU_ITEM", "COMBO"], default: "MENU_ITEM" },
    comboId: { type: Schema.Types.ObjectId, ref: "Combo" },
    comboSnapshot: { type: Schema.Types.Mixed, default: null },
    dishId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    menuId: { type: Schema.Types.ObjectId, ref: "Menu", required: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    unit: { type: String, default: "portion" },
    image: { type: String },
    proofImages: [{ type: String }],
    servingKey: { type: String, required: true, trim: true, index: true },
    servingVariant: { type: ServingVariantSnapshotSchema, required: true },
    quantity: { type: Number, required: true, min: 0.000001 },
    weightGrams: { type: Number, min: 1 },
    modifiers: { type: [OrderModifierSnapshotSchema], default: [] },
    baseUnitPrice: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    modifiersPricePerUnit: { type: Number, default: 0 },
    lineSubtotal: { type: Number, default: 0, min: 0 },
    ingredientsSnapshot: { type: [IngredientSnapshotLineSchema], default: [] },
    note: { type: String },
    priority: { type: String, enum: PriorityEnum, default: "MEDIUM" },
    status: { type: String, default: "pending", enum: ItemStatusEnum },
    originalQuantity: {
      type: Number,
      min: 0,
      default: null,
    },
    cancelledQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    returnedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    voidRequests: [
      {
        requestId: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          min: 1,
          required: true,
        },
        reason: {
          type: String,
          trim: true,
          required: true,
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        requestedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        reviewedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        reviewedAt: {
          type: Date,
          default: null,
        },
        reviewNote: {
          type: String,
          trim: true,
          default: "",
        },
      },
    ],
    returnRequests: [
      {
        requestId: { type: String, required: true },
        quantity: { type: Number, min: 1, required: true },
        reason: { type: String, trim: true, required: true },
        refundMode: {
          type: String,
          enum: ["none", "remove_from_bill", "refund_after_payment"],
          default: "none",
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        requestedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        requestedAt: { type: Date, default: Date.now },
        reviewedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        reviewedAt: { type: Date, default: null },
        reviewNote: { type: String, trim: true, default: "" },
      },
    ],
  },
  { timestamps: false },
);

const OrderSchema = BaseSchemaModel({
  orderCode: { type: String, required: true },
  trackingCode: { type: String, default: null },
  trackingToken: { type: String, default: null },
  trackingUrl: { type: String, default: null },
  trackingQrPayload: { type: String, default: null },
  trackingQrGeneratedAt: { type: Date, default: null },
  trackingQrRevokedAt: { type: Date, default: null },
  publicStatus: {
    type: String,
    enum: CustomerOrderPublicStatusEnum,
    default: "ORDER_RECEIVED",
  },
  statusHistory: {
    type: [
      {
        _id: false,
        status: { type: String, required: true },
        displayMessage: { type: String, required: true },
        changedAt: { type: Date, required: true },
        changedByRole: {
          type: String,
          enum: ["CUSTOMER", "STAFF", "KITCHEN", "CASHIER", "SYSTEM"],
          default: "SYSTEM",
        },
        metadata: { type: Schema.Types.Mixed, default: null },
      },
    ],
    default: [],
  },
  estimatedReadyAt: { type: Date, default: null },
  estimatedDeliveryAt: { type: Date, default: null },
  customerVisibleNote: { type: String, default: null },
  lastCustomerNotifiedAt: { type: Date, default: null },
  lastCustomerStaffCallAt: { type: Date, default: null },
  lastCustomerPaymentRequestAt: { type: Date, default: null },
  customerRequests: {
    type: [
      {
        _id: false,
        requestId: { type: String, required: true },
        type: {
          type: String,
          enum: ["STAFF_CALL", "PAYMENT_REQUEST"],
          required: true,
        },
        status: {
          type: String,
          enum: ["PENDING", "ACKNOWLEDGED", "RESOLVED", "CANCELLED"],
          default: "PENDING",
        },
        message: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
        acknowledgedAt: { type: Date, default: null },
        resolvedAt: { type: Date, default: null },
        acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        source: {
          type: String,
          enum: ["CUSTOMER_TRACKING"],
          default: "CUSTOMER_TRACKING",
        },
      },
    ],
    default: [],
  },
  parentOrderCode: { type: String, index: true },
  orderKind: {
    type: String,
    enum: OrderKindEnum,
    default: "order_batch",
    index: true,
  },
  parentOrderId: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    default: null,
    index: true,
  },
  rootOrderId: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    default: null,
    index: true,
  },
  splitStatus: {
    type: String,
    enum: SplitStatusEnum,
    default: "none",
    index: true,
  },
  sessionStatus: {
    type: String,
    enum: SessionStatusEnum,
    default: "open",
    index: true,
  },
  kitchenStatus: {
    type: String,
    enum: KitchenStatusEnum,
    default: "pending",
    index: true,
  },
  orderPaymentStatus: {
    type: String,
    enum: OrderPaymentStatusEnum,
    default: "unpaid",
    index: true,
  },
  activeSessionKey: {
    type: String,
    default: null,
  },
  openedAt: {
    type: Date,
    default: null,
  },
  closedAt: {
    type: Date,
    default: null,
  },
  dailySequence: { type: Number },
  tableId: { type: Schema.Types.ObjectId, ref: "Table" },
  tableCode: { type: String, index: true },
  tableName: { type: String },
  guestCount: { type: Number, default: 1, min: 1 },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  restaurantId: {
    type: Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  reservationId: { type: Schema.Types.ObjectId, ref: "Reservation" },
  orderType: {
    type: String,
    required: true,
    enum: ["dine_in", "takeaway", "delivery"],
    default: "dine_in",
  },
  shipping: ShippingSchema,
  items: { type: [OrderItemSchema], default: [] },
  totals: {
    subtotal: { type: Number, required: true, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountReason: { type: String },
    voucherCode: { type: String },
    promotionId: { type: Schema.Types.ObjectId, ref: "Promotion" },
    tax: { type: Number, required: true, default: 0, min: 0 },
    taxRate: { type: Number, default: 0 },
    service: { type: Number, required: true, default: 0, min: 0 },
    serviceRate: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, default: 0, min: 0 },
  },
  payment: {
    method: { type: String, default: "cash" },
    provider: { type: String },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      index: true,
    },
    txnRef: { type: String },
    status: {
      type: String,
      enum: [
        "payment_requested",
        "paid",
        "pending",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      default: "pending",
    },
    paidAmount: { type: Number, default: 0, min: 0 },
    changeAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "VND" },
    requestedAt: { type: Date },
    requestSource: { type: String },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    requestNote: { type: String },
    requestClearedAt: { type: Date },
    requestClearReason: { type: String },
    paidAt: { type: Date },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  printStatus: {
    isPrinted: { type: Boolean, default: false },
    chefPrinted: { type: Boolean, default: false },
    printedAt: Date,
  },
  statusTimeline: [
    {
      status: { type: String, enum: OrderStatusEnum, required: true },
      at: { type: Date, default: Date.now },
      byUserId: { type: Schema.Types.ObjectId, ref: "User" },
      note: { type: String },
    },
  ],
  currentStatus: { type: String, default: "confirmed", enum: OrderStatusEnum },
  priority: { type: String, enum: PriorityEnum, default: "MEDIUM" },
  note: { type: String },
  clientMeta: { type: Schema.Types.Mixed },
});

function qtyForPricing(item) {
  const mode = item?.servingVariant?.mode;
  if (mode === "PORTION") return Number(item.quantity || 0);

  const grams = Number(item.weightGrams || 0);
  const sellQty = Number(item?.servingVariant?.sellQty || 1);
  const sellUnit = item?.servingVariant?.sellUnit || "kg";
  const soldAmount = sellUnit === "g" ? grams : grams / 1000;
  return soldAmount / sellQty;
}

function normalizePriorityLevel(value) {
  const key = String(value || "").toUpperCase();
  if (PriorityEnum.includes(key)) return key;
  return "MEDIUM";
}

function deriveOrderPriorityFromItems(items = []) {
  let next = "LOW";
  let hasAnyActiveItem = false;

  for (const item of items || []) {
    if (["cancelled", "returned"].includes(item?.status)) continue;
    hasAnyActiveItem = true;
    const p = normalizePriorityLevel(item?.priority);
    if (p === "HIGH") return "HIGH";
    if (p === "MEDIUM") next = "MEDIUM";
  }

  return hasAnyActiveItem ? next : "MEDIUM";
}

OrderSchema.methods.calculateTotals = function () {
  let subtotal = 0;

  for (const item of this.items || []) {
    item.priority = normalizePriorityLevel(item.priority);
    const q = qtyForPricing(item);
    item.modifiersPricePerUnit =
      Number(item.unitPrice) - Number(item.baseUnitPrice);
    item.lineSubtotal = Math.max(0, Number(item.unitPrice) * q);

    if (!["cancelled", "returned"].includes(item.status)) {
      subtotal += item.lineSubtotal;
    }
  }

  this.totals.subtotal = Math.round(subtotal);

  const serviceRate = Number(this.totals.serviceRate || 0);
  const taxRate = Number(this.totals.taxRate || 0);
  const discount = Number(this.totals.discount || 0);
  const shippingFee = Number(this.totals.shippingFee || 0);

  this.totals.service = Math.round(subtotal * serviceRate);

  const beforeTax = Math.max(
    0,
    this.totals.subtotal + this.totals.service - discount,
  );

  this.totals.tax = Math.round(beforeTax * taxRate);
  this.totals.grandTotal = Math.round(
    beforeTax + this.totals.tax + shippingFee,
  );
  this.priority = deriveOrderPriorityFromItems(this.items || []);

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

OrderSchema.index({ restaurantId: 1, orderCode: 1 });
OrderSchema.index({ restaurantId: 1, tableCode: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, currentStatus: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, parentOrderCode: 1, createdAt: -1 });
OrderSchema.index({
  restaurantId: 1,
  tableId: 1,
  orderKind: 1,
  sessionStatus: 1,
  createdAt: -1,
});
OrderSchema.index({
  restaurantId: 1,
  parentOrderId: 1,
  orderKind: 1,
  createdAt: 1,
});
OrderSchema.index({
  restaurantId: 1,
  rootOrderId: 1,
  splitStatus: 1,
  createdAt: 1,
});
OrderSchema.index({
  restaurantId: 1,
  orderKind: 1,
  orderPaymentStatus: 1,
  createdAt: -1,
});

OrderSchema.index(
  { trackingCode: 1 },
  {
    unique: true,
    partialFilterExpression: { trackingCode: { $type: "string" } },
    name: "unique_order_tracking_code",
  },
);
OrderSchema.index(
  { trackingToken: 1 },
  {
    unique: true,
    partialFilterExpression: { trackingToken: { $type: "string" } },
    name: "unique_order_tracking_token",
  },
);
OrderSchema.index(
  { activeSessionKey: 1 },
  {
    unique: true,
    name: "unique_active_table_session_key",
    partialFilterExpression: {
      activeSessionKey: { $type: "string" },
    },
  },
);

OrderSchema.index({
  restaurantId: 1,
  "items.ingredientsSnapshot.ingredientId": 1,
  createdAt: -1,
});

OrderSchema.index({
  restaurantId: 1,
  "items.modifiers.groupId": 1,
  createdAt: -1,
});
OrderSchema.index({
  restaurantId: 1,
  "items.modifiers.optionId": 1,
  createdAt: -1,
});

export default mongoose.model("Order", OrderSchema);
