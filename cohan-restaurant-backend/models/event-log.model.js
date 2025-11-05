// cohan-restaurant-backend/models/event-log.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

// Gợi ý enum: bạn có thể thêm/bớt tuỳ dự án
export const EventVerbs = Object.freeze([
  // Table
  "table.create",
  "table.update",
  "table.move",
  "table.swap_codes",
  "table.merge",
  "table.split",

  // Order
  "order.create",
  "order.update",
  "order.add_item",
  "order.remove_item",
  "order.submit",
  "order.cancel",
  "order.pay",
  "order.refund",

  // Invoice
  "invoice.create",
  "invoice.print",
  "invoice.void",

  // Payment
  "payment.create",
  "payment.capture",
  "payment.refund",

  // System
  "system.info",
  "system.warn",
  "system.error",
]);

export const EventSources = Object.freeze([
  "pos",
  "api",
  "cron",
  "import",
  "sync",
  "web",
  "mobile",
]);

const ParticipantRefSchema = new Schema(
  {
    kind: { type: String },
    id: { type: Types.ObjectId },
    code: { type: String },
  },
  { _id: false }
);

const EventLogSchema = BaseSchemaModel(
  {
    // Bối cảnh
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", index: true },
    floorId: { type: Types.ObjectId, ref: "Floor" },
    tableId: { type: Types.ObjectId, ref: "Table", index: true },
    orderId: { type: Types.ObjectId, ref: "Order", index: true },

    // Ai làm?
    actorUserId: { type: Types.ObjectId, ref: "User" },
    customerProfileId: { type: Types.ObjectId, ref: "CustomerProfile" },

    // Thao tác gì?
    verb: {
      type: String,
      required: true,
      // Nếu muốn siết chặt, dùng enum: EventVerbs
      // enum: EventVerbs,
      index: true,
    },

    // Đối tượng chính bị tác động
    object: ParticipantRefSchema,

    // Đối tượng đích (nếu có, ví dụ đổi/gộp)
    target: ParticipantRefSchema,

    // Nguồn & thiết bị
    source: { type: String, default: "pos" /* enum: EventSources */ },
    ip: { type: String },
    userAgent: { type: String },

    // Trace & nhóm thao tác
    sessionId: { type: String },
    correlationId: { type: String }, // gom nhiều log trong 1 flow

    // Kết quả & dữ liệu đi kèm
    status: {
      type: String,
      enum: ["success", "failed", "info"],
      default: "success",
      index: true,
    },
    meta: { type: Schema.Types.Mixed }, // payload thêm
    diff: { type: Schema.Types.Mixed }, // delta trước/sau (nếu có)

    // Thời điểm
    at: { type: Date, default: Date.now, index: true },
  },
  {
    // BaseSchemaModel đã set timestamps/virtuals/leanVirtuals
  }
);

// ── Indexes hữu ích cho truy vấn thực tế ───────────────────────────────────────
EventLogSchema.index({ restaurantId: 1, verb: 1, at: -1 });
EventLogSchema.index({ restaurantId: 1, status: 1, at: -1 });
EventLogSchema.index({ verb: 1, status: 1, at: -1 });
EventLogSchema.index({ correlationId: 1, at: 1 });
EventLogSchema.index({ sessionId: 1, at: 1 });
EventLogSchema.index({ "object.kind": 1, "object.id": 1, at: -1 });
EventLogSchema.index({ "target.kind": 1, "target.id": 1, at: -1 });

// Text index để search nhanh theo code/verb
EventLogSchema.index({
  "object.code": "text",
  "target.code": "text",
  verb: "text",
});

// ── Hooks: chuẩn hoá verb/source (lowercase), có thể thêm mapping tại đây ─────
EventLogSchema.pre("validate", function (next) {
  if (this.verb) this.verb = String(this.verb).toLowerCase();
  if (this.source) this.source = String(this.source).toLowerCase();
  // Nếu thiếu 'at' thì dùng createdAt
  if (!this.at) this.at = this.createdAt || new Date();
  next();
});

// ── Helper tĩnh để ghi log nhanh ──────────────────────────────────────────────
// Ví dụ dùng:
// await EventLog.log({
//   restaurantId, verb: "order.pay", orderId,
//   object: { kind: "Order", id: orderId },
//   meta: { amount: 100000, method: "cash" },
//   correlationId: ctx?.requestId,
//   actorUserId: ctx?.user?.id
// }, { session });
EventLogSchema.statics.log = function (payload, opts = {}) {
  // Cho phép truyền verb viết hoa/chấm – đã có hook lower-case
  const doc = {
    source: "pos",
    status: "success",
    at: new Date(),
    ...payload,
  };
  return this.create([doc], opts).then((r) => r?.[0]);
};

// Guard khi reload (dev/hot-reload)
const EventLog =
  mongoose.models.EventLog || mongoose.model("EventLog", EventLogSchema);

export default EventLog;
