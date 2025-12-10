// src/models/order-shipping.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * LocationSchema
 * Dùng chung cho các loại vị trí: khách, nhà hàng, địa chỉ giao…
 */
const LocationSchema = new Schema(
  {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String },
  },
  { _id: false }
);

/**
 * DriverLocationSchema
 * Chi tiết hơn cho vị trí tài xế (phục vụ real-time tracking)
 */
const DriverLocationSchema = new Schema(
  {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String },

    // Độ chính xác GPS (mét)
    accuracy: { type: Number },

    // Tốc độ di chuyển hiện tại (km/h hoặc m/s tuỳ cách bạn sử dụng)
    speed: { type: Number },

    // Hướng di chuyển (0–359 độ)
    bearing: { type: Number },

    // Thời điểm cập nhật vị trí này
    updatedAt: { type: Date },
  },
  { _id: false }
);

/**
 * Enum trạng thái giao hàng
 * Giúp FE hiển thị rõ flow giống GrabFood, ShopeeFood…
 */
export const DELIVERY_STATUS = [
  "pending", // Đơn mới tạo, chưa assign tài xế
  "driver_assigned", // Đã có tài xế nhận
  "driver_arriving", // Tài xế đang tới quán
  "picked_up", // Đã lấy hàng
  "delivering", // Đang giao
  "arrived", // Tới cửa
  "delivered", // Giao thành công
  "cancelled", // Hủy giao
  "failed", // Giao thất bại (không liên lạc được, sai địa chỉ...)
];

/**
 * ShippingSchema
 * Subdocument dùng trong OrderSchema.shipping
 */
const ShippingSchema = new Schema(
  {
    /* ───────── THÔNG TIN CƠ BẢN ───────── */

    fullName: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String },

    note: { type: String },

    // Giữ nguyên field location cũ để không phá data (thường là location giao hàng)
    location: LocationSchema,

    // Tổng quãng đường (km) ước tính từ quán -> khách
    distance: { type: Number },

    // Phí ship (nếu có)
    shippingFee: { type: Number, default: 0 },

    // Cách thức giao hàng: "ship_now", "schedule", "grab", "internal_driver",...
    deliveryMethod: { type: String },

    // Thời gian giao mong muốn (hiển thị cho người dùng, ví dụ "ASAP", "Trong vòng 30'")
    deliveryTime: { type: String },

    // Đơn hẹn giờ: ngày & giờ cụ thể
    scheduleDate: { type: String }, // "YYYY-MM-DD"
    scheduleTime: { type: String }, // "HH:mm"

    /* ───────── VỊ TRÍ ───────── */

    // Vị trí khách hàng (nếu tách riêng với location)
    customerLocation: LocationSchema,

    // Vị trí nhà hàng (snapshot tại thời điểm tạo đơn, phòng khi sau này đổi địa chỉ)
    restaurantLocation: LocationSchema,

    // Vị trí tài xế hiện tại (real-time)
    driverLocation: DriverLocationSchema,

    /* ───────── THÔNG TIN TÀI XẾ ───────── */

    driverName: { type: String },
    driverPhone: { type: String },
    driverAvatar: { type: String },
    driverVehiclePlate: { type: String },

    /* ───────── TRẠNG THÁI GIAO HÀNG ───────── */

    deliveryStatus: {
      type: String,
      enum: DELIVERY_STATUS,
      default: "pending",
    },

    // Thời lượng ước tính (phút) từ khi bắt đầu giao → đến nơi
    duration: { type: Number }, // đơn vị phút (hoặc tuỳ bạn thống nhất)

    // Thời điểm dự kiến đến nơi (ETA)
    eta: { type: Date },

    /* ───────── TÍCH HỢP BÊN THỨ 3 ───────── */

    // Mã vận đơn/Tracking code của Grab/Ahamove/Logistics khác
    externalTrackingCode: { type: String },
  },
  { _id: false }
);

export default ShippingSchema;
