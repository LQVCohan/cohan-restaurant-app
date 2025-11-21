// scripts/seedPermissions.js
import mongoose from "mongoose";
import { Permission } from "../models/index.js";
import process from "process";
import dotenv from "dotenv";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB,
});

/**
 * Danh sách permission gốc trong hệ thống
 * code sẽ = `${resource}.${action}` (trừ khi ghi rõ code "*")
 */
const permissions = [
  // =========================
  // SYSTEM / ADMIN
  // =========================
  {
    name: "Xem tổng quan hệ thống",
    resource: "system",
    action: "read",
    group: "system",
    description: "Xem trang tổng quan, dashboard hệ thống",
  },
  {
    name: "Quản trị hệ thống",
    resource: "system",
    action: "manage",
    group: "system",
    description: "Thực hiện các thao tác quản trị cấp cao",
  },
  {
    name: "Xem cấu hình",
    resource: "config",
    action: "read",
    group: "system",
    description: "Xem cấu hình hệ thống",
  },
  {
    name: "Chỉnh sửa cấu hình",
    resource: "config",
    action: "write",
    group: "system",
    description: "Thay đổi cấu hình hệ thống",
  },
  {
    name: "Xem danh sách role",
    resource: "role",
    action: "read",
    group: "system",
    description: "Xem danh sách và thông tin role",
  },
  {
    name: "Quản lý role",
    resource: "role",
    action: "write",
    group: "system",
    description: "Tạo, sửa, xóa role",
  },
  {
    name: "Gán role cho người dùng",
    resource: "role",
    action: "assign",
    group: "system",
    description: "Gán / thu hồi role của người dùng",
  },
  {
    name: "Xem permission",
    resource: "permission",
    action: "read",
    group: "system",
    description: "Xem danh sách permission",
  },
  {
    name: "Quản lý permission",
    resource: "permission",
    action: "write",
    group: "system",
    description: "Tạo, sửa, xóa permission",
  },
  {
    name: "Xem nhật ký hệ thống",
    resource: "log",
    action: "read",
    group: "system",
    description: "Xem event log, audit log hệ thống",
  },
  {
    name: "Xem báo cáo",
    resource: "report",
    action: "read",
    group: "system",
    description: "Xem báo cáo tổng hợp",
  },
  {
    name: "Xuất báo cáo",
    resource: "report",
    action: "export",
    group: "system",
    description: "Xuất file báo cáo (Excel/PDF...)",
  },
  {
    name: "Xem dashboard",
    resource: "dashboard",
    action: "read",
    group: "system",
    description: "Xem dashboard phân tích",
  },

  // =========================
  // RESTAURANT
  // =========================
  {
    name: "Xem nhà hàng",
    resource: "restaurant",
    action: "read",
    group: "restaurant",
    description: "Xem thông tin nhà hàng",
  },
  {
    name: "Chỉnh sửa nhà hàng",
    resource: "restaurant",
    action: "write",
    group: "restaurant",
    description: "Tạo / sửa / xoá nhà hàng",
  },

  // =========================
  // MENU
  // =========================
  {
    name: "Xem menu",
    resource: "menu",
    action: "read",
    group: "menu",
    description: "Xem danh sách món",
  },
  {
    name: "Quản lý menu",
    resource: "menu",
    action: "write",
    group: "menu",
    description: "Thêm / sửa / xóa món ăn và danh mục",
  },

  // =========================
  // ORDER
  // =========================
  {
    name: "Xem đơn hàng",
    resource: "order",
    action: "read",
    group: "order",
    description: "Xem danh sách đơn hàng",
  },
  {
    name: "Tạo đơn hàng",
    resource: "order",
    action: "create",
    group: "order",
    description: "Tạo đơn hàng mới",
  },
  {
    name: "Cập nhật đơn hàng",
    resource: "order",
    action: "update",
    group: "order",
    description: "Cập nhật trạng thái / nội dung đơn hàng",
  },
  {
    name: "Quản lý đơn hàng",
    resource: "order",
    action: "write",
    group: "order",
    description: "Toàn quyền thao tác với đơn hàng",
  },
  {
    name: "Hủy đơn hàng",
    resource: "order",
    action: "cancel",
    group: "order",
    description: "Hủy đơn hàng (theo quy định cho phép)",
  },

  // =========================
  // USER / CUSTOMER PROFILE
  // =========================
  {
    name: "Xem người dùng",
    resource: "user",
    action: "read",
    group: "user",
    description: "Xem thông tin người dùng",
  },
  {
    name: "Quyền tự thao tác tài khoản",
    resource: "user",
    action: "self",
    group: "user",
    description: "Người dùng tự xem/sửa thông tin cá nhân",
  },
  {
    name: "Cập nhật hồ sơ cá nhân",
    resource: "profile",
    action: "update",
    group: "customer",
    description: "Khách hàng cập nhật thông tin hồ sơ",
  },
  {
    name: "Xem địa chỉ giao hàng",
    resource: "address",
    action: "read",
    group: "customer",
    description: "Xem danh sách địa chỉ giao hàng của khách",
  },
  {
    name: "Quản lý địa chỉ giao hàng",
    resource: "address",
    action: "write",
    group: "customer",
    description: "Thêm / sửa / xóa địa chỉ giao hàng",
  },
  {
    name: "Xem danh sách yêu thích",
    resource: "favorite",
    action: "read",
    group: "customer",
    description: "Xem món / nhà hàng yêu thích",
  },
  {
    name: "Quản lý danh sách yêu thích",
    resource: "favorite",
    action: "write",
    group: "customer",
    description: "Thêm / xóa món / nhà hàng yêu thích",
  },
  {
    name: "Xem giỏ hàng",
    resource: "cart",
    action: "read",
    group: "customer",
    description: "Xem nội dung giỏ hàng",
  },
  {
    name: "Cập nhật giỏ hàng",
    resource: "cart",
    action: "write",
    group: "customer",
    description: "Thêm / xóa / sửa món trong giỏ hàng",
  },
  {
    name: "Tạo đánh giá",
    resource: "review",
    action: "create",
    group: "customer",
    description: "Khách hàng tạo đánh giá cho món / nhà hàng",
  },
  {
    name: "Xem đánh giá",
    resource: "review",
    action: "read",
    group: "customer",
    description: "Xem danh sách đánh giá",
  },
  {
    name: "Xem điểm tích lũy",
    resource: "loyalty",
    action: "read",
    group: "customer",
    description: "Xem điểm thưởng và hạng thành viên",
  },
  {
    name: "Xem thông báo",
    resource: "notification",
    action: "read",
    group: "customer",
    description: "Xem thông báo khuyến mãi, đơn hàng, hệ thống",
  },

  // =========================
  // RESERVATION
  // =========================
  {
    name: "Tạo đặt bàn",
    resource: "reservation",
    action: "create",
    group: "reservation",
    description: "Khách tạo đặt bàn",
  },
  {
    name: "Xem đặt bàn",
    resource: "reservation",
    action: "read",
    group: "reservation",
    description: "Nhân viên xem / xử lý yêu cầu đặt bàn",
  },

  // =========================
  // SHIFT / CA LÀM
  // =========================
  {
    name: "Xem ca làm",
    resource: "shift",
    action: "read",
    group: "shift",
    description: "Xem lịch ca làm",
  },
  {
    name: "Quản lý ca làm",
    resource: "shift",
    action: "manage",
    group: "shift",
    description: "Sắp xếp, điều chỉnh ca làm",
  },

  // =========================
  // KITCHEN
  // =========================
  {
    name: "Xem bếp",
    resource: "kitchen",
    action: "read",
    group: "kitchen",
    description: "Xem danh sách món đang chế biến",
  },
  {
    name: "Quản lý bếp",
    resource: "kitchen",
    action: "write",
    group: "kitchen",
    description: "Cập nhật trạng thái món trong bếp",
  },

  // =========================
  // TABLE
  // =========================
  {
    name: "Xem bàn",
    resource: "table",
    action: "read",
    group: "table",
    description: "Xem sơ đồ / trạng thái bàn",
  },

  // =========================
  // CLEANING
  // =========================
  {
    name: "Xem công việc vệ sinh",
    resource: "cleaning",
    action: "read",
    group: "cleaning",
    description: "Xem nhiệm vụ và trạng thái dọn dẹp",
  },

  // =========================
  // DELIVERY
  // =========================
  {
    name: "Xem giao hàng",
    resource: "delivery",
    action: "read",
    group: "delivery",
    description: "Xem danh sách đơn giao hàng",
  },
  {
    name: "Cập nhật giao hàng",
    resource: "delivery",
    action: "update",
    group: "delivery",
    description: "Cập nhật trạng thái giao hàng",
  },

  // =========================
  // PAYMENT
  // =========================
  {
    name: "Xem thanh toán",
    resource: "payment",
    action: "read",
    group: "payment",
    description: "Xem lịch sử thanh toán",
  },
  {
    name: "Xử lý thanh toán",
    resource: "payment",
    action: "write",
    group: "payment",
    description: "Tạo / xác nhận thanh toán",
  },

  // =========================
  // STAFF / HR
  // =========================
  {
    name: "Xem nhân viên",
    resource: "staff",
    action: "read",
    group: "staff",
    description: "Xem danh sách nhân viên",
  },
  {
    name: "Quản lý nhân viên",
    resource: "staff",
    action: "write",
    group: "staff",
    description: "Thêm / sửa / vô hiệu hóa nhân viên",
  },
];

async function run() {
  for (const p of permissions) {
    // giống logic PermissionMutation: chuẩn hoá + auto code nếu cần
    const payload = {
      ...p,
      code:
        p.code ||
        `${(p.resource || "").toLowerCase()}.${(p.action || "").toLowerCase()}`,
      action: p.action?.toLowerCase(),
      resource: p.resource?.toLowerCase(),
      group: p.group?.toLowerCase(),
    };

    if (!payload.code) {
      console.log(`⚠️  Skip permission without code/resource+action:`, p);
      continue;
    }

    const exists = await Permission.findOne({ code: payload.code }).lean();
    if (exists) {
      console.log(`= Skip (exists): ${payload.code}`);
      continue;
    }

    await Permission.create(payload);
    console.log(`+ Created permission: ${payload.code}`);
  }

  await mongoose.disconnect();
  console.log("🏁 Done seeding permissions");
}

run().catch((e) => {
  console.error(e);
  mongoose.disconnect();
});
