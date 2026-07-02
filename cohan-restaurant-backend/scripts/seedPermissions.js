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
  ["backup.read", "Xem sao lưu cấu hình", "system", "Xem readiness, lịch sử và preview snapshot cấu hình"],
  ["backup.write", "Quản lý checklist sao lưu", "system", "Tạo/cập nhật backup run và checklist an toàn"],
  ["backup.export", "Xuất snapshot cấu hình", "system", "Tạo file Restaurant Configuration Snapshot"],
  ["backup.import", "Nhập snapshot cấu hình", "system", "Preview dry-run và khôi phục Restaurant Configuration Snapshot"],
  ["admin.sensitive.customer_contact.read", "Admin xem liên hệ khách hàng", "admin-security", "Cho phép Admin hệ thống xem email/số điện thoại khách hàng khi có reason và audit log"],
  ["admin.sensitive.staff_internal.read", "Admin xem dữ liệu nội bộ nhân sự", "admin-security", "Cho phép Admin hệ thống xem hồ sơ nội bộ nhân sự khi có reason và audit log"],
  ["admin.sensitive.finance.read", "Admin xem dữ liệu tài chính nhạy cảm", "admin-security", "Cho phép Admin hệ thống xem dữ liệu tài chính khi có reason và audit log"],
  ["admin.sensitive.payroll.read", "Admin xem dữ liệu lương", "admin-security", "Cho phép Admin hệ thống xem dữ liệu lương khi có reason và audit log"],
  ["admin.sensitive.wallet.read", "Admin xem dữ liệu ví", "admin-security", "Cho phép Admin hệ thống xem ví/số dư khi có reason và audit log"],
  ["admin.sensitive.payment.read", "Admin xem dữ liệu thanh toán", "admin-security", "Cho phép Admin hệ thống xem thanh toán khi có reason và audit log"],
  ["admin.sensitive.tenant_data.write", "Admin sửa dữ liệu tenant nhạy cảm", "admin-security", "Cho phép Admin hệ thống sửa dữ liệu tenant nhạy cảm khi có reason và audit log"],
  ["admin.audit.read", "Admin xem audit bảo mật", "admin-security", "Cho phép Admin hệ thống xem audit log bảo mật"],
  ["restaurant.read", "Xem nhà hàng", "restaurant", "Xem thông tin nhà hàng"],
  ["restaurant.write", "Quản lý nhà hàng", "restaurant", "Tạo, sửa, xóa nhà hàng"],
  ["dashboard.read", "Xem dashboard", "dashboard", "Xem dashboard phân tích"],
  ["report.read", "Xem báo cáo", "report", "Xem báo cáo tổng hợp"],
  ["report.export", "Xuất báo cáo", "report", "Xuất báo cáo"],
  ["print.read", "Xem cấu hình in", "print", "Xem máy in, mẫu in và hàng đợi in"],
  ["print.write", "Quản lý cấu hình in", "print", "Tạo, sửa cấu hình máy in và mẫu in"],
  ["ai.chatbot.read", "Xem AI chatbot", "ai-chatbot", "Xem dữ liệu AI chatbot"],
  ["ai.chatbot.write", "Quản lý AI chatbot", "ai-chatbot", "Cấu hình chatbot và quản lý knowledge"],
  ["ai.chatbot.moderate", "Kiểm duyệt AI chatbot", "ai-chatbot", "Duyệt suggestion, feedback, safety rule"],
  ["ai.chatbot.evaluate", "Evaluation AI chatbot", "ai-chatbot", "Chạy evaluation và quản lý test cases"],
  ["ai.chatbot.handoff", "Xử lý handoff AI chatbot", "ai-chatbot", "Xử lý yêu cầu handoff"],
  ["ai.chatbot.analytics.read", "Xem analytics AI chatbot", "ai-chatbot", "Xem analytics chatbot"],
  ["menu.read", "Xem menu", "menu", "Xem danh sách món và thực đơn"],
  ["menu.write", "Quản lý menu", "menu", "Quyền ghi tổng quát cho menu; giữ tương thích role cũ"],
  ["menu.create", "Tạo thực đơn", "menu", "Tạo thực đơn theo khung giờ"],
  ["menu.update", "Cập nhật thực đơn", "menu", "Sửa thông tin, ảnh và trạng thái thực đơn"],
  ["menu.delete", "Xóa thực đơn", "menu", "Xóa thực đơn, bao gồm force-delete khi cần"],
  ["menu.copy", "Sao chép thực đơn", "menu", "Sao chép thực đơn kèm món và recipe"],
  ["menu.item.create", "Tạo món", "menu", "Thêm món mới vào thực đơn"],
  ["menu.item.update", "Cập nhật món", "menu", "Sửa thông tin, ảnh, recipe và trạng thái món"],
  ["menu.item.delete", "Xóa món", "menu", "Xóa món khỏi thực đơn"],
  ["menu.price.update", "Cập nhật giá menu", "menu", "Cập nhật giá món và bulk price"],
  ["menu.category.manage", "Quản lý danh mục món", "menu", "Tạo, sửa, xóa danh mục món"],
  ["menu.group.manage", "Quản lý nhóm thực đơn", "menu", "Tạo, sửa, xóa nhóm thực đơn"],
  ["menu.inventory.sync", "Đồng bộ tồn kho menu", "menu", "Đồng bộ trạng thái hết hàng theo tồn kho"],
  ["menu.audit.read", "Xem lịch sử menu", "menu", "Xem audit log của menu và món"],
  ["order.read", "Xem đơn hàng", "order", "Xem danh sách đơn hàng"],
  ["order.create", "Tạo đơn hàng", "order", "Tạo đơn hàng mới"],
  ["order.update", "Cập nhật đơn hàng", "order", "Cập nhật trạng thái đơn hàng"],
  ["order.write", "Quản lý đơn hàng", "order", "Toàn quyền thao tác đơn hàng"],
  ["order.cancel", "Hủy đơn hàng", "order", "Hủy đơn hàng"],
  ["payment.read", "Xem thanh toán", "payment", "Xem lịch sử thanh toán"],
  ["payment.write", "Xử lý thanh toán", "payment", "Tạo và xác nhận thanh toán"],
  ["finance.read", "Xem tài chính", "finance", "Xem số liệu thu chi và công nợ"],
  ["finance.write", "Quản lý tài chính", "finance", "Tạo và cập nhật nghiệp vụ tài chính"],
  ["finance.export", "Xuất dữ liệu tài chính", "finance", "Xuất báo cáo tài chính"],
  ["transaction.read", "Xem giao dịch", "finance", "Xem giao dịch thanh toán và hoàn tiền"],
  ["transaction.write", "Quản lý giao dịch", "finance", "Điều chỉnh và cập nhật giao dịch"],
  ["reconciliation.read", "Xem đối soát", "finance", "Xem dữ liệu đối soát thanh toán"],
  ["reconciliation.write", "Quản lý đối soát", "finance", "Cập nhật trạng thái đối soát"],
  ["refund.read", "Xem hoàn tiền", "finance", "Xem dữ liệu hoàn tiền"],
  ["refund.write", "Xử lý hoàn tiền", "finance", "Tạo và duyệt hoàn tiền"],
  ["staff.read", "Xem nhân viên", "staff", "Xem danh sách nhân viên"],
  ["staff.write", "Quản lý nhân viên", "staff", "Thêm, sửa, vô hiệu hóa nhân viên"],
  ["customer.read", "Xem khách hàng CRM", "customer", "Xem danh sách và thông tin khách hàng CRM"],
  ["customer.update", "Cập nhật khách hàng CRM", "customer", "Cập nhật thông tin CRM hẹp như ghi chú nội bộ khách hàng"],
  ["inventory.read", "Xem tồn kho", "inventory", "Xem danh sách hàng tồn kho và nguyên liệu"],
  ["inventory.write", "Quản lý tồn kho", "inventory", "Tạo, sửa, xóa dữ liệu tồn kho và nguyên liệu"],
  ["stock.read", "Xem nhập xuất kho", "inventory", "Xem số lượng và lịch sử nhập xuất kho"],
  ["stock.write", "Quản lý nhập xuất kho", "inventory", "Tạo và điều chỉnh phiếu nhập xuất kho"],
  ["supplier.read", "Xem nhà cung cấp", "inventory", "Xem danh sách nhà cung cấp"],
  ["supplier.write", "Quản lý nhà cung cấp", "inventory", "Tạo, sửa, xóa nhà cung cấp"],
  ["promotion.read", "Xem khuyến mãi", "promotion", "Xem danh sách chương trình khuyến mãi"],
  ["promotion.write", "Quản lý khuyến mãi", "promotion", "Tạo, sửa, xóa chương trình khuyến mãi"],
  ["coupon.read", "Xem coupon", "promotion", "Xem mã giảm giá"],
  ["coupon.write", "Quản lý coupon", "promotion", "Tạo, sửa, xóa mã giảm giá"],
  ["attendance.read", "Xem chấm công", "staff", "Xem dữ liệu chấm công nhân viên"],
  ["attendance.write", "Quản lý chấm công", "staff", "Tạo và điều chỉnh dữ liệu chấm công"],
  ["payroll.read", "Xem bảng lương", "staff", "Xem bảng lương và kỳ lương"],
  ["payroll.write", "Quản lý bảng lương", "staff", "Tạo, tính và cập nhật bảng lương"],
  ["performance.read", "Xem hiệu suất", "staff", "Xem đánh giá hiệu suất nhân viên"],
  ["performance.write", "Quản lý hiệu suất", "staff", "Cập nhật điểm và đánh giá hiệu suất nhân viên"],
  ["shift.read", "Xem ca làm", "shift", "Xem lịch ca làm"],
  ["shift.manage", "Quản lý ca làm", "shift", "Sắp xếp và điều chỉnh ca làm"],
  ["kitchen.read", "Xem bếp", "kitchen", "Xem món đang chế biến"],
  ["kitchen.write", "Quản lý bếp", "kitchen", "Cập nhật trạng thái món trong bếp"],
  ["table.read", "Xem bàn", "table", "Xem sơ đồ và trạng thái bàn"],
  ["table.write", "Quản lý bàn", "table", "Tạo, sửa, xóa và cập nhật trạng thái bàn"],
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
  ["reservation.update", "Cập nhật đặt bàn", "reservation", "Cập nhật trạng thái và thông tin đặt bàn"],
  ["reservation.cancel", "Hủy đặt bàn", "reservation", "Hủy yêu cầu đặt bàn"],
  ["review.create", "Tạo đánh giá", "customer", "Khách hàng tạo đánh giá"],
  ["review.read", "Xem đánh giá", "customer", "Xem danh sách đánh giá"],
  ["review.write", "Viết đánh giá", "review", "Tạo/cập nhật đánh giá của khách hàng"],
  ["review.reply", "Phản hồi đánh giá", "review", "Nhà hàng phản hồi chính thức vào đánh giá"],
  ["review.moderate", "Kiểm duyệt đánh giá", "review", "Duyệt, ẩn, từ chối và cập nhật trạng thái đánh giá"],
  ["review.delete", "Xóa/ẩn đánh giá", "review", "Ẩn mềm hoặc xóa đánh giá theo chính sách"],
  ["review.report.read", "Xem báo cáo review", "review", "Xem hàng đợi báo cáo đánh giá"],
  ["review.report.resolve", "Xử lý báo cáo review", "review", "Đánh dấu báo cáo đánh giá đã xử lý hoặc từ chối"],
  ["review.export", "Xuất đánh giá", "review", "Xuất CSV đánh giá"],
  ["review.analytics.read", "Xem phân tích đánh giá", "review", "Xem analytics, queue và SLA đánh giá"],
  ["loyalty.read", "Xem điểm tích lũy", "customer", "Xem điểm thưởng"],
  ["notification.read", "Xem thông báo", "customer", "Xem thông báo"],
].map(([code, name, group, description]) => {
  const [resource, ...rest] = code.split(".");
  const action = rest.join(".");
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
