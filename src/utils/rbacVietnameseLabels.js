const GROUP_LABELS = {
  "ai-chatbot": "Trợ lý AI",
  cleaning: "Vệ sinh",
  customer: "Khách hàng",
  dashboard: "Tổng quan",
  delivery: "Giao hàng",
  inventory: "Kho hàng",
  kitchen: "Bếp",
  menu: "Thực đơn",
  order: "Đơn hàng",
  payment: "Thanh toán",
  promotion: "Khuyến mãi",
  report: "Báo cáo",
  restaurant: "Nhà hàng",
  review: "Đánh giá",
  reservation: "Đặt bàn",
  shift: "Ca làm",
  staff: "Nhân viên",
  system: "Quản trị hệ thống",
  table: "Bàn & khu vực",
  user: "Người dùng",
};

const PERMISSION_LABELS = {
  "system.manage": "Toàn quyền hệ thống",
  "system.read": "Xem tổng quan hệ thống",
  "config.read": "Xem cấu hình",
  "config.write": "Chỉnh sửa cấu hình",
  "role.read": "Xem vai trò",
  "role.write": "Quản lý vai trò",
  "role.assign": "Gán vai trò",
  "permission.read": "Xem danh mục quyền",
  "permission.write": "Quản lý quyền hạn",
  "log.read": "Xem nhật ký hệ thống",
  "backup.read": "Xem sao lưu cấu hình",
  "backup.write": "Quản lý checklist sao lưu",
  "backup.export": "Xuất snapshot cấu hình",
  "backup.import": "Nhập snapshot cấu hình",

  "restaurant.read": "Xem nhà hàng",
  "restaurant.write": "Quản lý nhà hàng",
  "restaurant.manage": "Quản lý nhà hàng",
  "restaurant.update": "Cập nhật nhà hàng",

  "dashboard.read": "Xem dashboard",
  "report.read": "Xem báo cáo",
  "report.export": "Xuất báo cáo",

  "ai.chatbot.read": "Xem trợ lý AI",
  "ai.chatbot.write": "Quản lý trợ lý AI",
  "ai.chatbot.moderate": "Kiểm duyệt trợ lý AI",
  "ai.chatbot.evaluate": "Đánh giá chất lượng AI",
  "ai.chatbot.handoff": "Xử lý chuyển tiếp AI",
  "ai.chatbot.analytics.read": "Xem phân tích AI",

  "menu.read": "Xem thực đơn",
  "menu.write": "Quản lý thực đơn",
  "menu.manage": "Quản lý thực đơn",
  "menu.create": "Tạo thực đơn",
  "menu.update": "Cập nhật thực đơn",
  "menu.delete": "Xóa thực đơn",
  "menu.copy": "Sao chép thực đơn",
  "menu.item.create": "Tạo món",
  "menu.item.update": "Cập nhật món",
  "menu.item.delete": "Xóa món",
  "menu.price.update": "Cập nhật giá món",
  "menu.category.manage": "Quản lý danh mục món",
  "menu.group.manage": "Quản lý nhóm thực đơn",
  "menu.inventory.sync": "Đồng bộ tồn kho món",
  "menu.audit.read": "Xem lịch sử thực đơn",

  "order.read": "Xem đơn hàng",
  "order.create": "Tạo đơn hàng",
  "order.update": "Cập nhật đơn hàng",
  "order.write": "Quản lý đơn hàng",
  "order.manage": "Quản lý đơn hàng",
  "order.cancel": "Hủy đơn hàng",

  "payment.read": "Xem thanh toán",
  "payment.write": "Xử lý thanh toán",

  "staff.read": "Xem nhân viên",
  "staff.write": "Quản lý nhân viên",
  "attendance.read": "Xem chấm công",
  "attendance.write": "Quản lý chấm công",
  "payroll.read": "Xem bảng lương",
  "payroll.write": "Quản lý bảng lương",
  "payroll.validate": "Kiểm tra bảng lương",
  "payroll.period.create": "Tạo kỳ lương",
  "payroll.period.recalculate": "Tính lại kỳ lương",
  "payroll.period.finalize": "Chốt kỳ lương",
  "payroll.period.lock": "Khóa kỳ lương",
  "payroll.payment.record": "Ghi nhận chi trả lương",
  "payroll.export": "Xuất bảng lương",
  "performance.read": "Xem hiệu suất",
  "performance.write": "Quản lý hiệu suất",

  "customer.read": "Xem khách hàng CRM",
  "customer.update": "Cập nhật khách hàng CRM",
  "profile.update": "Cập nhật hồ sơ",
  "address.read": "Xem địa chỉ",
  "address.write": "Quản lý địa chỉ",
  "favorite.read": "Xem yêu thích",
  "favorite.write": "Quản lý yêu thích",
  "cart.read": "Xem giỏ hàng",
  "cart.write": "Cập nhật giỏ hàng",
  "loyalty.read": "Xem điểm tích lũy",
  "notification.read": "Xem thông báo",

  "inventory.read": "Xem tồn kho",
  "inventory.write": "Quản lý tồn kho",
  "stock.read": "Xem nhập xuất kho",
  "stock.write": "Quản lý nhập xuất kho",
  "supplier.read": "Xem nhà cung cấp",
  "supplier.write": "Quản lý nhà cung cấp",

  "promotion.read": "Xem khuyến mãi",
  "promotion.write": "Quản lý khuyến mãi",
  "coupon.read": "Xem coupon",
  "coupon.write": "Quản lý coupon",

  "shift.read": "Xem ca làm",
  "shift.manage": "Quản lý ca làm",
  "kitchen.read": "Xem bếp",
  "kitchen.write": "Quản lý bếp",
  "table.read": "Xem bàn",
  "table.write": "Quản lý bàn",
  "cleaning.read": "Xem vệ sinh",
  "delivery.read": "Xem giao hàng",
  "delivery.update": "Cập nhật giao hàng",

  "reservation.create": "Tạo đặt bàn",
  "reservation.read": "Xem đặt bàn",
  "reservation.update": "Cập nhật đặt bàn",
  "reservation.cancel": "Hủy đặt bàn",

  "review.create": "Tạo đánh giá",
  "review.read": "Xem đánh giá",
  "review.write": "Viết đánh giá",
  "review.reply": "Phản hồi đánh giá",
  "review.moderate": "Kiểm duyệt đánh giá",
  "review.delete": "Xóa hoặc ẩn đánh giá",
  "review.report.read": "Xem báo cáo đánh giá",
  "review.report.resolve": "Xử lý báo cáo đánh giá",
  "review.export": "Xuất đánh giá",
  "review.analytics.read": "Xem phân tích đánh giá",
};

const ROLE_LABELS = {
  accountant: "Kế toán",
  admin: "Quản trị viên",
  bartender: "Nhân viên pha chế",
  captain: "Ca trưởng",
  cashier: "Thu ngân",
  chef: "Bếp trưởng",
  cleaner: "Tạp vụ",
  cook: "Đầu bếp",
  customer: "Khách hàng",
  host: "Đón khách",
  hr: "Nhân sự",
  kitchen_helper: "Phụ bếp",
  manager: "Quản lý nhà hàng",
  server: "Phục vụ",
  staff: "Nhân viên",
  storekeeper: "Thủ kho",
  supervisor: "Giám sát",
};

const STATIC_TEXT_REPLACEMENTS = {
  "An toàn truy cập": "Kiểm soát truy cập",
  "Thiết lập vai trò, phạm vi thao tác và lịch sử thay đổi cho từng nhà hàng.":
    "Quản lý ai được xem, chỉnh sửa và thao tác từng nghiệp vụ trong nhà hàng.",
  "Phạm vi theo nhà hàng": "Áp dụng theo nhà hàng",
  "Kiểm tra trước khi lưu": "Kiểm tra quyền trước khi lưu",
  "Lưu lại lịch sử thay đổi": "Ghi nhận lịch sử thay đổi",
  "Danh mục quyền hạn": "Danh mục quyền theo nghiệp vụ",
  "Các quyền được gom theo nghiệp vụ để quản lý phạm vi truy cập rõ ràng hơn.":
    "Tất cả quyền được nhóm theo nghiệp vụ để dễ tìm, dễ kiểm soát và tránh cấp nhầm quyền.",
  "Chi tiết quyền của vai trò": "Tổng hợp quyền của vai trò",
  "Hiển thị quyền được kế thừa, quyền gán riêng và kết quả cuối cùng.":
    "Xem quyền kế thừa, quyền gán riêng và quyền thực tế nhân viên sẽ có.",
  "Quyền sau cùng": "Quyền thực tế",
  "Bảng quyền": "Danh mục nghiệp vụ",
  "Quyền đang áp dụng": "Quyền thực tế",
  "Bộ vai trò": "Danh sách vai trò",
  "Tên rút gọn": "Mã vai trò",
  "Nhóm kế thừa": "Kế thừa từ",
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const normalizeGroupKey = (value) => String(value || "").trim().toLowerCase();

const extractPermissionCode = (value) => {
  const match = String(value || "").match(/\b[a-z]+(?:\.[a-z]+)+(?:\.[a-z]+)?\b/i);
  return match?.[0]?.toLowerCase() || "";
};

const replaceTextPreservingOuterSpace = (node, nextText) => {
  if (!node || typeof nextText !== "string") return;
  const current = node.nodeValue || "";
  const trimmed = current.trim();
  if (!trimmed || trimmed === nextText) return;
  node.nodeValue = current.replace(trimmed, nextText);
};

const setElementText = (element, nextText) => {
  if (!element || !nextText) return;
  if (element.textContent?.trim() === nextText) return;
  element.textContent = nextText;
};

function mapRoleName(value) {
  const key = normalizeKey(value);
  return ROLE_LABELS[key] || null;
}

function applyStaticCopy(page) {
  const walker = document.createTreeWalker(page, window.NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, textarea")) return window.NodeFilter.FILTER_REJECT;
      const text = node.nodeValue?.trim();
      return text && STATIC_TEXT_REPLACEMENTS[text]
        ? window.NodeFilter.FILTER_ACCEPT
        : window.NodeFilter.FILTER_REJECT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => replaceTextPreservingOuterSpace(node, STATIC_TEXT_REPLACEMENTS[node.nodeValue.trim()]));
}

function applyGroupLabels(page) {
  page.querySelectorAll(".rbac-permission-group__title h4").forEach((heading) => {
    const mapped = GROUP_LABELS[normalizeGroupKey(heading.textContent)];
    if (mapped) setElementText(heading, mapped);
  });
}

function applyPermissionLabels(page) {
  page.querySelectorAll(".rbac-chip, .rbac-checkbox-row").forEach((row) => {
    const meta = row.querySelector("small");
    const code = extractPermissionCode(meta?.textContent);
    if (!code) return;

    const label = PERMISSION_LABELS[code];
    if (label) setElementText(row.querySelector("strong"), label);
    if (meta) setElementText(meta, `Mã quyền: ${code}`);
  });
}

function applyRoleLabels(page) {
  page.querySelectorAll(".rbac-role-row").forEach((row) => {
    const meta = row.querySelector(".rbac-role-row__meta")?.textContent || "";
    const slug = meta.replace(/^(Tên rút gọn|Mã vai trò):\s*/i, "").trim();
    const mapped = mapRoleName(slug) || mapRoleName(row.querySelector("strong")?.textContent);
    if (mapped) setElementText(row.querySelector(".rbac-role-row__top strong"), mapped);
  });

  page.querySelectorAll(".rbac-selected-role h4, .rbac-assignment-step small, .rbac-assignment-preview__summary strong, option").forEach((element) => {
    const mapped = mapRoleName(element.textContent);
    if (mapped) setElementText(element, mapped);
  });
}

function applyRbacVietnameseLabels() {
  const page = document.querySelector(".rbac-page");
  if (!page) return;

  applyStaticCopy(page);
  applyGroupLabels(page);
  applyPermissionLabels(page);
  applyRoleLabels(page);
}

export function installRbacVietnameseLabels() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      applyRbacVietnameseLabels();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();
}
