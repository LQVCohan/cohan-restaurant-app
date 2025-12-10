import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema } = mongoose;

// Bộ status code chuẩn cho tracking payment
const PaymentStatusCodeEnum = [
  "SUCCESS",
  "PENDING",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CANCELED",
];

/**
 * OrderTracking
 * CHỈ dành cho đơn hàng giao từ xa (orderType = "delivery").
 * Đơn ăn tại chỗ (dine_in) đã có statusTimeline trong Order.
 */
const OrderTrackingSchema = BaseSchemaModel({
  // Liên kết đơn hàng
  orderId: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  orderCode: {
    type: String,
    required: true,
  },
  restaurantId: {
    type: Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },

  // Loại sự kiện
  eventType: {
    type: String,
    required: true,
    enum: [
      "status_changed",
      "item_status_changed",
      "items_updated",
      "payment_updated",
      "shipping_updated",
      "print",
      "note_added",
      "refund",
      "system_adjustment",
      "other",
    ],
    default: "other",
  },

  // Thay đổi trạng thái đơn
  statusFrom: { type: String },
  statusTo: { type: String },

  // Thay đổi trạng thái món
  itemId: { type: Schema.Types.ObjectId },
  itemName: { type: String },
  itemStatusFrom: { type: String },
  itemStatusTo: { type: String },

  // PAYMENT: giữ nguyên status gốc + thêm status code chuẩn hoá
  paymentStatusRawFrom: { type: String }, // ví dụ: paid, pending, failed, refunded,...
  paymentStatusRawTo: { type: String },

  paymentStatusCodeFrom: {
    type: String,
    enum: PaymentStatusCodeEnum,
  },
  paymentStatusCodeTo: {
    type: String,
    enum: PaymentStatusCodeEnum,
  },

  paymentChange: {
    methodFrom: { type: String },
    methodTo: { type: String },
    paidAmountFrom: { type: Number },
    paidAmountTo: { type: Number },
  },

  // SHIPPING / GIAO HÀNG
  shippingStatusFrom: { type: String },
  shippingStatusTo: { type: String },
  shippingCheckpoint: {
    status: { type: String }, // vd: driver_assigned, delivering, delivered,...
    description: { type: String },
    location: {
      lat: Number,
      lng: Number,
      address: String,
    },
    externalRef: String, // mã vận đơn bên thứ 3
    eta: { type: Date },
  },

  // Actor: ai thực hiện
  actor: {
    type: {
      type: String,
      enum: ["user", "customer", "system", "third_party"],
      default: "user",
    },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    name: { type: String }, // snapshot tên tại thời điểm đó
  },

  // Kênh thực hiện
  channel: {
    type: String,
    enum: [
      "pos",
      "waiter_app",
      "kitchen_display",
      "customer_app",
      "web_portal",
      "integration",
      "system",
      "other",
    ],
    default: "pos",
  },

  clientMeta: {
    ip: { type: String },
    userAgent: { type: String },
    deviceId: { type: String },
    appVersion: { type: String },
  },

  // Snapshot trạng thái đơn tại thời điểm event
  snapshot: {
    currentStatus: { type: String },
    orderType: { type: String }, // chủ yếu: "delivery"
    tableCode: { type: String },
    guestCount: { type: Number },

    totals: {
      subtotal: { type: Number },
      discount: { type: Number },
      tax: { type: Number },
      service: { type: Number },
      shippingFee: { type: Number },
      grandTotal: { type: Number },
    },

    payment: {
      method: { type: String },

      // Status gốc trong Order.payment.status
      rawStatus: { type: String },

      // Status chuẩn hoá cho FE/filter
      statusCode: {
        type: String,
        enum: PaymentStatusCodeEnum,
      },

      paidAmount: { type: Number },
      changeAmount: { type: Number },
      currency: { type: String },
    },

    shipping: {
      fullName: String,
      phone: String,
      address: String,
      distance: Number,
      deliveryMethod: String,
      deliveryTime: String,
      scheduleDate: String,
      scheduleTime: String,
    },
  },

  note: { type: String },

  // metadata linh hoạt (payload 3rd-party, diff chi tiết, v.v.)
  meta: {
    type: Schema.Types.Mixed,
  },
});

// Indexes
OrderTrackingSchema.index({ orderId: 1, createdAt: -1 });
OrderTrackingSchema.index({ restaurantId: 1, orderCode: 1, createdAt: -1 });
OrderTrackingSchema.index({ eventType: 1, createdAt: -1 });
OrderTrackingSchema.index({ "actor.userId": 1, createdAt: -1 });
OrderTrackingSchema.index({ "actor.customerId": 1, createdAt: -1 });
OrderTrackingSchema.index({ channel: 1, createdAt: -1 });

export default mongoose.model("OrderTracking", OrderTrackingSchema);
