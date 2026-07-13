import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const tableRefSchema = new Schema(
  {
    tableId: { type: Types.ObjectId, ref: "Table", required: true },
    tableCode: { type: String, required: true, trim: true },
    statusBefore: { type: String, default: "available" },
    sessionId: { type: Types.ObjectId, ref: "Order", default: null },
  },
  { _id: false },
);

const wholeOrderMoveSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: "Order", required: true },
    originalTableId: { type: Types.ObjectId, ref: "Table", required: true },
    originalTableCode: { type: String, required: true },
    originalParentOrderId: { type: Types.ObjectId, ref: "Order", default: null },
    originalRootOrderId: { type: Types.ObjectId, ref: "Order", default: null },
    originalParentOrderCode: { type: String, default: null },
    originalOrderKind: { type: String, default: "order_batch" },
    originalSplitStatus: { type: String, default: "none" },
    originalClientMeta: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const sourceOrderSnapshotSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: "Order", required: true },
    originalSplitStatus: { type: String, default: "none" },
    originalClientMeta: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const itemMoveSchema = new Schema(
  {
    sourceOrderId: { type: Types.ObjectId, ref: "Order", required: true },
    sourceOrderCode: { type: String, required: true },
    sourceItemId: { type: Types.ObjectId, required: true },
    targetOrderId: { type: Types.ObjectId, ref: "Order", required: true },
    targetOrderCode: { type: String, required: true },
    targetItemId: { type: Types.ObjectId, required: true },
    originalIndex: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const TableOrderSplitSessionSchema = new Schema(
  {
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "reverted"],
      default: "active",
      index: true,
    },
    source: { type: tableRefSchema, required: true },
    target: { type: tableRefSchema, required: true },
    wholeOrderMoves: { type: [wholeOrderMoveSchema], default: [] },
    sourceOrderSnapshots: { type: [sourceOrderSnapshotSchema], default: [] },
    itemMoves: { type: [itemMoveSchema], default: [] },
    createdTargetOrderIds: [{ type: Types.ObjectId, ref: "Order" }],
    createdBy: { type: Types.ObjectId, ref: "User", default: null },
    revertedBy: { type: Types.ObjectId, ref: "User", default: null },
    revertedAt: { type: Date, default: null },
    revertReason: { type: String, default: null },
    cleanupAt: { type: Date, default: null },
  },
  { timestamps: true },
);

TableOrderSplitSessionSchema.index({
  restaurantId: 1,
  status: 1,
  "source.tableId": 1,
});
TableOrderSplitSessionSchema.index({
  restaurantId: 1,
  status: 1,
  "target.tableId": 1,
});
TableOrderSplitSessionSchema.index(
  { cleanupAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { cleanupAt: { $type: "date" } },
  },
);

export default mongoose.model(
  "TableOrderSplitSession",
  TableOrderSplitSessionSchema,
);
