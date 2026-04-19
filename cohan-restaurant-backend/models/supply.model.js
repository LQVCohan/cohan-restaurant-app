import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
import { UnitEnum } from "./ingredient.model.js"; // dùng lại enum đơn vị

// Supply: vật phẩm KHÔNG phải nguyên liệu (ví dụ: nước ngọt, khăn lạnh, ống hút...)

const SupplySchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },

  name: { type: String, required: true, trim: true, index: "text" },

  sku: { type: String, trim: true },

  category: { type: String, trim: true }, // "drink", "disposable", "tissue"...

  unit: {
    type: String,
    enum: UnitEnum,
    required: true,
    default: "unit", // khác với nguyên liệu, mặc định là "unit"
  },

  costPerUnit: { type: Number, default: 0 }, // giá nhập / đơn vị

  pricePerUnit: { type: Number, default: 0 }, // giá bán / đơn vị (nếu có)

  photos: { type: [String], default: [] },

  minStock: { type: Number, default: 0 }, // ngưỡng cảnh báo

  notes: { type: String, trim: true },

  isActive: { type: Boolean, default: true },
});

// Query/index hỗ trợ lọc theo nhà hàng + tên
SupplySchema.index({ restaurantId: 1, name: 1 });
// SKU unique theo nhà hàng, cho phép để trống
SupplySchema.index(
  { restaurantId: 1, sku: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sku: { $exists: true, $type: "string", $ne: "" },
    },
  },
);

export default mongoose.model("Supply", SupplySchema);
