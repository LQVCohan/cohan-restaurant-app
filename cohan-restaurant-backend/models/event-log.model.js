// cohan-restaurant-backend/models/event-log.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Types } = mongoose;

const EventLogSchema = BaseSchemaModel(
  {
    // Bối cảnh
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", index: true },
    floorId: { type: Types.ObjectId, ref: "Floor", index: true },
    tableId: { type: Types.ObjectId, ref: "Table", index: true },
    orderId: { type: Types.ObjectId, ref: "Order", index: true },

    // Ai làm?
    actorUserId: { type: Types.ObjectId, ref: "User", index: true },
    customerProfileId: { type: Types.ObjectId, ref: "CustomerProfile" },

    // Thao tác gì?
    verb: { type: String, required: true, index: true }, // ví dụ: table.move, table.swap_codes, table.merge, table.split, order.add_item, order.pay, ...

    // Đối tượng chính bị tác động
    object: {
      kind: { type: String }, // "Table" | "Order" | ...
      id: { type: Types.ObjectId },
      code: { type: String }, // ví dụ mã bàn
    },

    // Đối tượng đích (nếu có, ví dụ đổi/gộp)
    target: {
      kind: { type: String },
      id: { type: Types.ObjectId },
      code: { type: String },
    },

    // Thêm bối cảnh thiết bị/nguồn
    source: { type: String, default: "pos" }, // "pos" | "api" | "cron" | ...
    ip: { type: String },
    userAgent: { type: String },

    // Trace & nhóm thao tác
    sessionId: { type: String },
    correlationId: { type: String, index: true }, // gom nhiều log trong 1 flow

    // Kết quả & dữ liệu đi kèm
    status: {
      type: String,
      enum: ["success", "failed", "info"],
      default: "success",
      index: true,
    },
    meta: { type: mongoose.Schema.Types.Mixed }, // payload thêm
    diff: { type: mongoose.Schema.Types.Mixed }, // delta trước/sau (nếu có)

    // Thời điểm
    at: { type: Date, default: Date.now, index: true },
  },
  {
    // BaseSchemaModel đã set timestamps + virtuals + lean virtuals
  }
);

// Các index tổng hợp hữu ích
EventLogSchema.index({ restaurantId: 1, at: -1 });
EventLogSchema.index({ restaurantId: 1, verb: 1, at: -1 });
EventLogSchema.index({ tableId: 1, at: -1 });
EventLogSchema.index({ orderId: 1, at: -1 });
EventLogSchema.index({ verb: 1, status: 1, at: -1 });

// Text index nhẹ để tìm kiếm nhanh theo code/verb
EventLogSchema.index({
  "object.code": "text",
  "target.code": "text",
  verb: "text",
});

export default mongoose.model("EventLog", EventLogSchema);
