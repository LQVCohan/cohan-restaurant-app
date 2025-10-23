// src/models/stockMovement.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

export const MovementTypeEnum = [
  "inbound", // nhập kho (nhận hàng)
  "outbound", // xuất kho (bán, hủy, dùng nội bộ)
  "adjustment", // điều chỉnh kiểm kê
  "transfer", // điều chuyển (nếu cần sử dụng, meta có thể chứa toWarehouseId)
];

const StockMovementSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Warehouse",
    required: true,
    index: true,
  },

  // === HỖ TRỢ HAI LOẠI ĐỐI TƯỢNG: Ingredient hoặc Supply ===
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ingredient",
    required: false,
    index: true,
  },
  supplyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supply",
    required: false,
    index: true,
  },

  type: { type: String, enum: MovementTypeEnum, required: true, index: true },
  qty: { type: Number, required: true }, // +/- theo baseUnit của item (ingredient baseUnit hoặc unit của supply)
  reason: { type: String }, // ví dụ: "order:ORD-001", "receive:PO-2025-0001", "adjust:inventory"
  meta: { type: Object, default: {} }, // tuỳ biến: { lot, costPerBaseUnit, toWarehouseId, byUserId, ... }
});

// RÀNG BUỘC: Phải có 1 và chỉ 1 trong hai trường: ingredientId hoặc supplyId
StockMovementSchema.pre("validate", function (next) {
  const hasIngredient = !!this.ingredientId;
  const hasSupply = !!this.supplyId;

  if (hasIngredient === hasSupply) {
    // cả 2 true hoặc cả 2 false -> không hợp lệ
    return next(
      new Error(
        "StockMovement phải có duy nhất một trong hai: ingredientId hoặc supplyId."
      )
    );
  }
  next();
});

// Chỉ mục phục vụ truy vấn nhanh theo từng loại
StockMovementSchema.index({
  restaurantId: 1,
  warehouseId: 1,
  ingredientId: 1,
  createdAt: -1,
});
StockMovementSchema.index({
  restaurantId: 1,
  warehouseId: 1,
  supplyId: 1,
  createdAt: -1,
});
StockMovementSchema.index({ restaurantId: 1, type: 1, createdAt: -1 });

export default mongoose.model("StockMovement", StockMovementSchema);
