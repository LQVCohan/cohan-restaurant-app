import mongoose from "mongoose";
import process from "process";
import { pathToFileURL } from "url";
import dotenv from "dotenv";
import { Permission } from "../models/index.js";

dotenv.config();

export const permissions = [
  ["system.manage", "Quản trị toàn hệ thống", "system", "Thực hiện mọi thao tác quản trị hệ thống"],
  ["system.read", "Xem tổng quan hệ thống", "system", "Xem số liệu và trạng thái tổng quan của hệ thống"],
  ["config.read", "Xem cấu hình hệ thống", "system", "Xem các thiết lập hệ thống"],
  ["config.write", "Cập nhật cấu hình hệ thống", "system", "Thay đổi các thiết lập hệ thống"],
  ["role.read", "Xem vai trò", "system", "Xem danh sách và chi tiết vai trò"],
  ["role.write", "Quản lý vai trò", "system", "Tạo, sửa và xóa vai trò"],
  ["role.assign", "Gán vai trò", "system", "Gán hoặc thu hồi vai trò của người dùng"],
  ["permission.read", "Xem danh mục quyền", "system", "Xem danh sách và chi tiết quyền"],
  ["permission.write", "Quản lý danh mục quyền", "system", "Tạo, sửa và xóa quyền"],
  ["log.read", "Xem nhật ký hệ thống", "system", "Xem nhật ký hoạt động và nhật ký kiểm tra"],
  ["backup.read", "Xem trạng thái sao lưu", "system", "Xem mức sẵn sàng, lịch sử và nội dung dự kiến của bản sao cấu hình"],
  ["backup.write", "Quản lý quy trình sao lưu", "system", "Tạo và cập nhật phiên sao lưu cùng danh sách kiểm tra an toàn"],
  ["backup.export", "Xuất bản sao cấu hình", "system", "Tạo tệp sao lưu cấu hình nhà hàng"],
  ["backup.import", "Khôi phục bản sao cấu hình", "system", "Kiểm tra trước và khôi phục bản sao cấu hình nhà hàng"],

  ["admin.sensitive.customer_contact.read", "Xem thông tin liên hệ khách hàng", "admin-security", "Cho phép quản trị viên hệ thống xem email và số điện thoại khách hàng khi có lý do và nhật ký kiểm tra"],
  ["admin.sensitive.staff_internal.read", "Xem dữ liệu nội bộ nhân sự", "admin-security", "Cho phép quản trị viên hệ thống xem hồ sơ nội bộ nhân sự khi có lý do và nhật ký kiểm tra"],
  ["admin.sensitive.finance.read", "Xem dữ liệu tài chính nhạy cảm", "admin-security", "Cho phép quản trị viên hệ thống xem dữ liệu tài chính khi có lý do và nhật ký kiểm tra"],
  ["admin.sensitive.payroll.read", "Xem dữ liệu lương nhạy cảm", "admin-security", "Cho phép quản trị viên hệ thống xem dữ liệu lương khi có lý do và nhật ký kiểm tra"],
  ["admin.sensitive.wallet.read", "Xem số dư ví khách hàng", "admin-security", "Cho phép quản trị viên hệ thống xem ví và số dư khi có lý do và nhật ký kiểm tra"],
  ["admin.sensitive.payment.read", "Xem dữ liệu thanh toán nhạy cảm", "admin-security", "Cho phép quản trị viên hệ thống xem dữ liệu thanh toán khi có lý do và nhật ký kiểm tra"],
  ["admin.sensitive.tenant_data.write", "Cập nhật dữ liệu nội bộ nhà hàng", "admin-security", "Cho phép quản trị viên hệ thống sửa dữ liệu nội bộ nhạy cảm khi có lý do và nhật ký kiểm tra"],
  ["admin.audit.read", "Xem nhật ký bảo mật quản trị", "admin-security", "Xem nhật ký kiểm tra các thao tác quản trị nhạy cảm"],

  ["restaurant.read", "Xem thông tin nhà hàng", "restaurant", "Xem hồ sơ và thông tin vận hành của nhà hàng"],
  ["restaurant.write", "Quản lý thông tin nhà hàng", "restaurant", "Tạo, sửa và xóa nhà hàng"],
  ["dashboard.read", "Xem tổng quan vận hành", "dashboard", "Xem bảng tổng quan và số liệu phân tích"],
  ["report.read", "Xem báo cáo", "report", "Xem các báo cáo tổng hợp"],
  ["report.export", "Xuất báo cáo", "report", "Xuất dữ liệu báo cáo"],
  ["print.read", "Xem cấu hình in", "print", "Xem máy in, mẫu in và hàng đợi in"],
  ["print.write", "Quản lý cấu hình in", "print", "Tạo và cập nhật cấu hình máy in cùng mẫu in"],

  ["ai.chatbot.read", "Xem trợ lý AI", "ai-chatbot", "Xem dữ liệu và cấu hình trợ lý AI"],
  ["ai.chatbot.write", "Quản lý trợ lý AI", "ai-chatbot", "Cấu hình trợ lý AI và quản lý kho tri thức"],
  ["ai.chatbot.moderate", "Kiểm duyệt nội dung trợ lý AI", "ai-chatbot", "Duyệt đề xuất, phản hồi và quy tắc an toàn"],
  ["ai.chatbot.evaluate", "Đánh giá chất lượng trợ lý AI", "ai-chatbot", "Chạy bộ đánh giá và quản lý tình huống kiểm thử"],
  ["ai.chatbot.handoff", "Tiếp nhận hội thoại cần hỗ trợ", "ai-chatbot", "Xử lý yêu cầu chuyển cuộc trò chuyện từ trợ lý AI sang nhân viên"],
  ["ai.chatbot.analytics.read", "Xem báo cáo trợ lý AI", "ai-chatbot", "Xem số liệu sử dụng và chất lượng của trợ lý AI"],

  ["menu.read", "Xem thực đơn", "menu", "Xem danh sách món ăn và thực đơn"],
  ["menu.write", "Quản lý thực đơn", "menu", "Thực hiện các thao tác ghi tổng quát trên thực đơn để tương thích vai trò cũ"],
  ["menu.create", "Tạo thực đơn", "menu", "Tạo thực đơn theo khung giờ"],
  ["menu.update", "Cập nhật thực đơn", "menu", "Sửa thông tin, hình ảnh và trạng thái thực đơn"],
  ["menu.delete", "Xóa thực đơn", "menu", "Xóa thực đơn theo quy tắc của hệ thống"],
  ["menu.copy", "Sao chép thực đơn", "menu", "Sao chép thực đơn cùng món ăn và công thức"],
  ["menu.item.create", "Tạo món ăn", "menu", "Thêm món ăn mới vào thực đơn"],
  ["menu.item.update", "Cập nhật món ăn", "menu", "Sửa thông tin, hình ảnh, công thức và trạng thái món ăn"],
  ["menu.item.delete", "Xóa món ăn", "menu", "Xóa món ăn khỏi thực đơn"],
  ["menu.price.update", "Cập nhật giá món ăn", "menu", "Cập nhật giá một hoặc nhiều món ăn"],
  ["menu.category.manage", "Quản lý danh mục món", "menu", "Tạo, sửa và xóa danh mục món"],
  ["menu.group.manage", "Quản lý nhóm thực đơn", "menu", "Tạo, sửa và xóa nhóm thực đơn"],
  ["menu.inventory.sync", "Đồng bộ món với tồn kho", "menu", "Đồng bộ trạng thái còn hàng của món theo tồn kho"],
  ["menu.audit.read", "Xem lịch sử thay đổi thực đơn", "menu", "Xem nhật ký thay đổi thực đơn và món ăn"],

  ["order.read", "Xem đơn hàng", "order", "Xem danh sách và chi tiết đơn hàng"],
  ["order.create", "Tạo đơn hàng", "order", "Tạo đơn hàng mới"],
  ["order.update", "Cập nhật đơn hàng", "order", "Cập nhật thông tin và trạng thái đơn hàng"],
  ["order.write", "Quản lý đơn hàng", "order", "Thực hiện mọi thao tác nghiệp vụ trên đơn hàng"],
  ["order.cancel", "Hủy đơn hàng", "order", "Hủy đơn hàng theo quy định"],
  ["payment.read", "Xem thanh toán", "payment", "Xem lịch sử và trạng thái thanh toán"],
  ["payment.write", "Xử lý thanh toán", "payment", "Tạo và xác nhận thanh toán"],

  ["finance.read", "Xem dữ liệu tài chính", "finance", "Xem số liệu thu chi và công nợ"],
  ["finance.write", "Quản lý dữ liệu tài chính", "finance", "Tạo và cập nhật nghiệp vụ tài chính"],
  ["finance.export", "Xuất dữ liệu tài chính", "finance", "Xuất báo cáo tài chính"],
  ["transaction.read", "Xem giao dịch", "finance", "Xem giao dịch thanh toán và hoàn tiền"],
  ["transaction.write", "Quản lý giao dịch", "finance", "Điều chỉnh và cập nhật giao dịch"],
  ["reconciliation.read", "Xem đối soát", "finance", "Xem dữ liệu đối soát thanh toán"],
  ["reconciliation.write", "Quản lý đối soát", "finance", "Cập nhật trạng thái đối soát"],
  ["refund.read", "Xem yêu cầu hoàn tiền", "finance", "Xem dữ liệu và trạng thái hoàn tiền"],
  ["refund.write", "Xử lý hoàn tiền", "finance", "Tạo và duyệt hoàn tiền"],

  ["staff.read", "Xem nhân viên", "staff", "Xem danh sách và hồ sơ nhân viên"],
  ["staff.write", "Quản lý nhân viên", "staff", "Thêm, sửa và vô hiệu hóa nhân viên"],
  ["customer.read", "Xem khách hàng", "customer", "Xem danh sách và thông tin khách hàng"],
  ["customer.update", "Cập nhật thông tin khách hàng", "customer", "Cập nhật ghi chú nội bộ và thông tin quản lý khách hàng"],
  ["inventory.read", "Xem tồn kho", "inventory", "Xem danh sách nguyên liệu và hàng tồn kho"],
  ["inventory.write", "Quản lý tồn kho", "inventory", "Tạo, sửa và xóa dữ liệu nguyên liệu cùng tồn kho"],
  ["stock.read", "Xem nhập xuất kho", "inventory", "Xem số lượng và lịch sử nhập xuất kho"],
  ["stock.write", "Quản lý nhập xuất kho", "inventory", "Tạo và điều chỉnh phiếu nhập xuất kho"],
  ["supplier.read", "Xem nhà cung cấp", "inventory", "Xem danh sách và thông tin nhà cung cấp"],
  ["supplier.write", "Quản lý nhà cung cấp", "inventory", "Tạo, sửa và xóa nhà cung cấp"],
  ["promotion.read", "Xem chương trình khuyến mãi", "promotion", "Xem danh sách chương trình khuyến mãi"],
  ["promotion.write", "Quản lý chương trình khuyến mãi", "promotion", "Tạo, sửa và xóa chương trình khuyến mãi"],
  ["coupon.read", "Xem mã giảm giá", "promotion", "Xem danh sách mã giảm giá"],
  ["coupon.write", "Quản lý mã giảm giá", "promotion", "Tạo, sửa và xóa mã giảm giá"],

  ["attendance.read", "Xem chấm công", "staff", "Xem dữ liệu chấm công nhân viên"],
  ["attendance.write", "Quản lý chấm công", "staff", "Tạo và điều chỉnh dữ liệu chấm công"],
  ["payroll.read", "Xem bảng lương", "staff", "Xem bảng lương và kỳ lương"],
  ["payroll.write", "Quản lý bảng lương", "staff", "Tạo, tính và cập nhật bảng lương"],
  ["performance.read", "Xem hiệu suất nhân viên", "staff", "Xem kết quả đánh giá hiệu suất nhân viên"],
  ["performance.write", "Quản lý hiệu suất nhân viên", "staff", "Cập nhật điểm và đánh giá hiệu suất nhân viên"],
  ["shift.read", "Xem ca làm", "shift", "Xem lịch ca làm"],
  ["shift.manage", "Quản lý ca làm", "shift", "Sắp xếp và điều chỉnh ca làm"],
  ["kitchen.read", "Xem hoạt động bếp", "kitchen", "Xem các món đang được chế biến"],
  ["kitchen.write", "Cập nhật trạng thái món trong bếp", "kitchen", "Cập nhật tiến độ chế biến món ăn"],
  ["table.read", "Xem bàn và khu vực", "table", "Xem sơ đồ, khu vực và trạng thái bàn"],
  ["table.write", "Quản lý bàn và khu vực", "table", "Tạo, sửa, xóa và cập nhật trạng thái bàn"],
  ["cleaning.read", "Xem nhiệm vụ vệ sinh", "cleaning", "Xem danh sách nhiệm vụ vệ sinh"],
  ["delivery.read", "Xem đơn giao hàng", "delivery", "Xem danh sách đơn giao hàng"],
  ["delivery.update", "Cập nhật trạng thái giao hàng", "delivery", "Cập nhật trạng thái giao hàng"],

  ["profile.update", "Cập nhật hồ sơ cá nhân", "customer", "Cập nhật thông tin hồ sơ cá nhân"],
  ["address.read", "Xem địa chỉ", "customer", "Xem danh sách địa chỉ giao hàng"],
  ["address.write", "Quản lý địa chỉ", "customer", "Thêm, sửa và xóa địa chỉ"],
  ["favorite.read", "Xem danh sách yêu thích", "customer", "Xem các nhà hàng và món ăn yêu thích"],
  ["favorite.write", "Quản lý danh sách yêu thích", "customer", "Thêm hoặc xóa nội dung yêu thích"],
  ["cart.read", "Xem giỏ hàng", "customer", "Xem nội dung giỏ hàng"],
  ["cart.write", "Cập nhật giỏ hàng", "customer", "Thêm, sửa và xóa món ăn trong giỏ hàng"],
  ["reservation.create", "Tạo yêu cầu đặt bàn", "reservation", "Tạo yêu cầu đặt bàn mới"],
  ["reservation.read", "Xem yêu cầu đặt bàn", "reservation", "Xem danh sách và chi tiết đặt bàn"],
  ["reservation.update", "Cập nhật yêu cầu đặt bàn", "reservation", "Cập nhật trạng thái và thông tin đặt bàn"],
  ["reservation.cancel", "Hủy yêu cầu đặt bàn", "reservation", "Hủy yêu cầu đặt bàn"],
  ["review.create", "Tạo đánh giá", "customer", "Tạo đánh giá mới"],
  ["review.read", "Xem đánh giá", "customer", "Xem danh sách và nội dung đánh giá"],
  ["review.write", "Cập nhật đánh giá", "review", "Tạo hoặc cập nhật đánh giá của khách hàng"],
  ["review.reply", "Phản hồi đánh giá", "review", "Đăng phản hồi chính thức của nhà hàng"],
  ["review.moderate", "Kiểm duyệt đánh giá", "review", "Duyệt, ẩn, từ chối và cập nhật trạng thái đánh giá"],
  ["review.delete", "Ẩn hoặc xóa đánh giá", "review", "Ẩn mềm hoặc xóa đánh giá theo chính sách"],
  ["review.report.read", "Xem báo cáo vi phạm đánh giá", "review", "Xem hàng đợi báo cáo vi phạm đánh giá"],
  ["review.report.resolve", "Xử lý báo cáo vi phạm đánh giá", "review", "Đánh dấu báo cáo đã xử lý hoặc từ chối"],
  ["review.export", "Xuất dữ liệu đánh giá", "review", "Xuất dữ liệu đánh giá ra tệp"],
  ["review.analytics.read", "Xem báo cáo phân tích đánh giá", "review", "Xem số liệu, hàng đợi và thời hạn xử lý đánh giá"],
  ["loyalty.read", "Xem điểm thành viên", "customer", "Xem số điểm và lịch sử tích lũy"],
  ["notification.read", "Xem thông báo", "customer", "Xem danh sách thông báo"],
].map(([code, name, group, description]) => {
  const [resource, ...rest] = code.split(".");
  const action = rest.join(".");
  return { code, resource, action, group, name, description, isSystem: true, isActive: true };
});

export async function run() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });
  for (const payload of permissions) {
    await Permission.findOneAndUpdate(
      { code: payload.code },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(`✓ permission: ${payload.code}`);
  }
  await mongoose.disconnect();
  console.log("🏁 Đã cập nhật danh mục quyền");
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  run().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}
