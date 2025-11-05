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

// Đảm bảo mỗi nhà hàng không bị trùng tên Supply
SupplySchema.index({ restaurantId: 1, name: 1 }, { unique: true });

export default mongoose.model("Supply", SupplySchema);
