import mongoose from "mongoose";
import process from "process";
import dotenv from "dotenv";
import { Permission } from "../models/index.js";

dotenv.config();
await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });

export const permissions = [
  ["system.manage", "Quản trị hệ thống", "system", "Toàn quyền quản trị hệ thống"],
  ["system.read", "Xem tổng quan hệ thống", "system", "Xem trang tổng quan hệ thống"],
  ["config.read", "Xem cấu hình", "system", "Xem cấu hình hệ thống"],
  ["config.write", "Chỉnh sửa cấu hình", "system", "Thay đổi cấu hình hệ thống"],
  ["role.read", "Xem role", "system", "Xem danh sách và chi tiết role"],
  ["role.write", "Quản lý role", "system", "Tạo, sửa, xóa role"],
  ["role.assign", "Gán role", "system", "Gán hoặc thu hồi role người dùng"],
  ["permission.read", "Xem permission", "system", "Xem danh mục quyền"],
  ["permission.write", "Quản lý permission", "system", "Tạo, sửa, xóa permission"],
  ["log.read", "Xem nhật ký", "system", "Xem event log và audit log"],
  ["restaurant.read", "Xem nhà hàng", "restaurant", "Xem thông tin nhà hàng"],
  ["restaurant.write", "Quản lý nhà hàng", "restaurant", "Tạo, sửa, xóa nhà hàng"],
  ["dashboard.read", "Xem dashboard", "dashboard", "Xem dashboard phân tích"],
  ["report.read", "Xem báo cáo", "report", "Xem báo cáo tổng hợp"],
  ["report.export", "Xuất báo cáo", "report", "Xuất báo cáo"],
  ["menu.read", "Xem menu", "menu", "Xem danh sách món"],
  ["menu.write", "Quản lý menu", "menu", "Thêm, sửa, xóa món ăn"],
  ["order.read", "Xem đơn hàng", "order", "Xem danh sách đơn hàng"],
  ["order.create", "Tạo đơn hàng", "order", "Tạo đơn hàng mới"],
  ["order.update", "Cập nhật đơn hàng", "order", "Cập nhật trạng thái đơn hàng"],
  ["order.write", "Quản lý đơn hàng", "order", "Toàn quyền thao tác đơn hàng"],
  ["order.cancel", "Hủy đơn hàng", "order", "Hủy đơn hàng"],
  ["payment.read", "Xem thanh toán", "payment", "Xem lịch sử thanh toán"],
  ["payment.write", "Xử lý thanh toán", "payment", "Tạo và xác nhận thanh toán"],
  ["staff.read", "Xem nhân viên", "staff", "Xem danh sách nhân viên"],
  ["staff.write", "Quản lý nhân viên", "staff", "Thêm, sửa, vô hiệu hóa nhân viên"],
  ["shift.read", "Xem ca làm", "shift", "Xem lịch ca làm"],
  ["shift.manage", "Quản lý ca làm", "shift", "Sắp xếp và điều chỉnh ca làm"],
  ["kitchen.read", "Xem bếp", "kitchen", "Xem món đang chế biến"],
  ["kitchen.write", "Quản lý bếp", "kitchen", "Cập nhật trạng thái món trong bếp"],
  ["table.read", "Xem bàn", "table", "Xem sơ đồ và trạng thái bàn"],
  ["cleaning.read", "Xem vệ sinh", "cleaning", "Xem nhiệm vụ dọn dẹp"],
  ["delivery.read", "Xem giao hàng", "delivery", "Xem danh sách đơn giao hàng"],
  ["delivery.update", "Cập nhật giao hàng", "delivery", "Cập nhật trạng thái giao hàng"],
  ["profile.update", "Cập nhật hồ sơ", "customer", "Khách hàng cập nhật hồ sơ"],
  ["address.read", "Xem địa chỉ", "customer", "Xem địa chỉ giao hàng"],
  ["address.write", "Quản lý địa chỉ", "customer", "Thêm, sửa, xóa địa chỉ"],
  ["favorite.read", "Xem yêu thích", "customer", "Xem danh sách yêu thích"],
  ["favorite.write", "Quản lý yêu thích", "customer", "Thêm, xóa yêu thích"],
  ["cart.read", "Xem giỏ hàng", "customer", "Xem giỏ hàng"],
  ["cart.write", "Cập nhật giỏ hàng", "customer", "Thêm, sửa, xóa món trong giỏ"],
  ["reservation.create", "Tạo đặt bàn", "reservation", "Khách tạo đặt bàn"],
  ["reservation.read", "Xem đặt bàn", "reservation", "Nhân viên xem đặt bàn"],
  ["review.create", "Tạo đánh giá", "customer", "Khách hàng tạo đánh giá"],
  ["review.read", "Xem đánh giá", "customer", "Xem danh sách đánh giá"],
  ["loyalty.read", "Xem điểm tích lũy", "customer", "Xem điểm thưởng"],
  ["notification.read", "Xem thông báo", "customer", "Xem thông báo"],
].map(([code, name, group, description]) => {
  const [resource, action] = code.split(".");
  return { code, resource, action, group, name, description, isSystem: true, isActive: true };
});

async function run() {
  for (const payload of permissions) {
    await Permission.findOneAndUpdate(
      { code: payload.code },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(`✓ permission: ${payload.code}`);
  }
  await mongoose.disconnect();
  console.log("🏁 Done seeding permissions");
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
