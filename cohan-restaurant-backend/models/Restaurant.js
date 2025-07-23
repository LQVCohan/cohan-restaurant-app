// models/Restaurant.js
import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, default: "/default-restaurant.png" }, // Ảnh đại diện nhà hàng
  coverImage: { type: String, default: "/default-cover.png" }, // Ảnh bìa (giống trang cá nhân Facebook)
  description: { type: String, default: "" }, // Mô tả nhà hàng
  managerName: { type: String, default: "" }, // Tên quản lý
  phone: { type: String, required: true },
  address: { type: String, required: true },
  openingHours: { type: String, required: true }, // Giờ mở cửa, ví dụ: "08:00 - 22:00"
  signatureDishes: [{ type: String }], // Mảng món chủ đạo
  promotions: { type: String, default: "" }, // Chương trình khuyến mãi (có thể mở rộng thành mảng nếu cần)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

restaurantSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Restaurant", restaurantSchema);
