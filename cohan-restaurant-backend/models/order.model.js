import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

// OrderItem Schema: Chứa thông tin chi tiết của từng món ăn
const OrderItemSchema = new mongoose.Schema(
  {
    dishId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true, // ID của món ăn
    },
    menuId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Menu",
      required: true, // ID của menu mà món ăn thuộc về
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true, // ID của danh mục món ăn
    },
    name: { type: String, required: true }, // Tên món ăn
    unit: { type: String, default: "phần" }, // Đơn vị tính (Phần, Kg, v.v.)
    image: { type: String }, // Hình ảnh món ăn
    price: { type: Number, required: true }, // Giá món ăn
    modifiersPrice: { type: Number, default: 0 }, // Giá của các tùy chọn bổ sung (modifiers)
    method: { type: String }, // Phương thức chế biến (nếu có)
    methodDelta: { type: Number, default: 0 }, // Biến động giá do phương thức chế biến
    description: { type: String }, // Mô tả món ăn
    quantity: { type: Number, required: true }, // Số lượng món ăn
    modifiers: [
      {
        optionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ModifierOption",
        },
        optionName: { type: String },
        price: { type: Number, default: 0 }, // Giá của tùy chọn (modifier)
      },
    ],
    lineSubtotal: { type: Number, default: 0 },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "preparing", "ready", "served", "cancelled"],
    },
    recipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
    },
    note: { type: String },
  },
  { _id: false }
);

// Order Schema: Chứa thông tin đơn hàng
const OrderSchema = BaseSchemaModel({
  orderCode: { type: String },
  tableCode: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation" },
  orderType: {
    type: String,
    required: true,
    enum: [
      "dine_in", // <-- Giá trị chuẩn cho "Tại bàn"
      "takeaway", // Mang về (Khách tự lấy)
      "delivery", // Giao hàng (Nhà hàng đi giao)
    ],
    default: "dine_in",
  },
  shipping: {
    fullName: String,
    phone: String,
    email: String,
    address: String,
    note: String,
    deliveryMethod: String,
    deliveryTime: String,
    scheduleDate: String,
    scheduleTime: String,
  },
  items: [OrderItemSchema], // Các món ăn trong đơn hàng
  totals: {
    subtotal: { type: Number, required: true },
    discount: { type: Number, required: true },
    tax: { type: Number, required: true },
    service: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
  },
  payment: {
    method: { type: String },
    status: {
      type: String,
      enum: ["paid", "pending", "failed"],
      default: "pending",
    },
    paidAmount: { type: Number, default: 0 },
    currency: { type: String, default: "VND" },
    paidAt: { type: Date },
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
        ],
      },
      at: { type: Date },
      byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      note: { type: String },
    },
  ],
  currentStatus: { type: String, default: "confirmed" },
  note: { type: String },
});
OrderSchema.index({
  restaurantId: 1,
  tableCode: 1,
  currentStatus: 1,
  createdAt: -1,
});

export default mongoose.model("Order", OrderSchema);
