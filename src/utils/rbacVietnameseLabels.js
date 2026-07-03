export const RBAC_GROUP_LABELS = Object.freeze({
  "admin-security": "Bảo mật quản trị",
  "ai-chatbot": "Trợ lý AI",
  cleaning: "Vệ sinh",
  customer: "Khách hàng",
  dashboard: "Tổng quan",
  delivery: "Giao hàng",
  finance: "Tài chính & đối soát",
  inventory: "Kho hàng",
  kitchen: "Bếp",
  menu: "Thực đơn",
  order: "Đơn hàng",
  payment: "Thanh toán",
  print: "In ấn",
  promotion: "Khuyến mãi",
  report: "Báo cáo",
  reservation: "Đặt bàn",
  restaurant: "Nhà hàng",
  review: "Đánh giá",
  shift: "Ca làm",
  staff: "Nhân sự",
  system: "Quản trị hệ thống",
  table: "Bàn & khu vực",
  user: "Người dùng",
});

export const RBAC_PERMISSION_LABELS = Object.freeze({
  "system.manage": "Quản trị toàn hệ thống",
  "system.read": "Xem tổng quan hệ thống",
  "config.read": "Xem cấu hình hệ thống",
  "config.write": "Cập nhật cấu hình hệ thống",
  "role.read": "Xem vai trò",
  "role.write": "Quản lý vai trò",
  "role.assign": "Gán vai trò",
  "permission.read": "Xem danh mục quyền",
  "permission.write": "Quản lý danh mục quyền",
  "log.read": "Xem nhật ký hệ thống",
  "backup.read": "Xem trạng thái sao lưu",
  "backup.write": "Quản lý quy trình sao lưu",
  "backup.export": "Xuất bản sao cấu hình",
  "backup.import": "Khôi phục bản sao cấu hình",

  "admin.sensitive.customer_contact.read": "Xem thông tin liên hệ khách hàng",
  "admin.sensitive.staff_internal.read": "Xem dữ liệu nội bộ nhân sự",
  "admin.sensitive.finance.read": "Xem dữ liệu tài chính nhạy cảm",
  "admin.sensitive.payroll.read": "Xem dữ liệu lương nhạy cảm",
  "admin.sensitive.wallet.read": "Xem số dư ví khách hàng",
  "admin.sensitive.payment.read": "Xem dữ liệu thanh toán nhạy cảm",
  "admin.sensitive.tenant_data.write": "Cập nhật dữ liệu nội bộ nhà hàng",
  "admin.audit.read": "Xem nhật ký bảo mật quản trị",

  "restaurant.read": "Xem thông tin nhà hàng",
  "restaurant.write": "Quản lý thông tin nhà hàng",
  "restaurant.manage": "Quản lý thông tin nhà hàng",
  "restaurant.update": "Cập nhật thông tin nhà hàng",
  "dashboard.read": "Xem tổng quan vận hành",
  "report.read": "Xem báo cáo",
  "report.export": "Xuất báo cáo",
  "print.read": "Xem cấu hình in",
  "print.write": "Quản lý cấu hình in",

  "ai.chatbot.read": "Xem trợ lý AI",
  "ai.chatbot.write": "Quản lý trợ lý AI",
  "ai.chatbot.moderate": "Kiểm duyệt nội dung trợ lý AI",
  "ai.chatbot.evaluate": "Đánh giá chất lượng trợ lý AI",
  "ai.chatbot.handoff": "Tiếp nhận hội thoại cần hỗ trợ",
  "ai.chatbot.analytics.read": "Xem báo cáo trợ lý AI",

  "menu.read": "Xem thực đơn",
  "menu.write": "Quản lý thực đơn",
  "menu.manage": "Quản lý thực đơn",
  "menu.create": "Tạo thực đơn",
  "menu.update": "Cập nhật thực đơn",
  "menu.delete": "Xóa thực đơn",
  "menu.copy": "Sao chép thực đơn",
  "menu.item.create": "Tạo món ăn",
  "menu.item.update": "Cập nhật món ăn",
  "menu.item.delete": "Xóa món ăn",
  "menu.price.update": "Cập nhật giá món ăn",
  "menu.category.manage": "Quản lý danh mục món",
  "menu.group.manage": "Quản lý nhóm thực đơn",
  "menu.inventory.sync": "Đồng bộ món với tồn kho",
  "menu.audit.read": "Xem lịch sử thay đổi thực đơn",

  "order.read": "Xem đơn hàng",
  "order.create": "Tạo đơn hàng",
  "order.update": "Cập nhật đơn hàng",
  "order.write": "Quản lý đơn hàng",
  "order.manage": "Quản lý đơn hàng",
  "order.cancel": "Hủy đơn hàng",
  "payment.read": "Xem thanh toán",
  "payment.write": "Xử lý thanh toán",

  "finance.read": "Xem dữ liệu tài chính",
  "finance.write": "Quản lý dữ liệu tài chính",
  "finance.export": "Xuất dữ liệu tài chính",
  "transaction.read": "Xem giao dịch",
  "transaction.write": "Quản lý giao dịch",
  "reconciliation.read": "Xem đối soát",
  "reconciliation.write": "Quản lý đối soát",
  "refund.read": "Xem yêu cầu hoàn tiền",
  "refund.write": "Xử lý hoàn tiền",

  "staff.read": "Xem nhân viên",
  "staff.write": "Quản lý nhân viên",
  "attendance.read": "Xem chấm công",
  "attendance.write": "Quản lý chấm công",
  "payroll.read": "Xem bảng lương",
  "payroll.write": "Quản lý bảng lương",
  "payroll.validate": "Kiểm tra bảng lương",
  "payroll.settings.update": "Cập nhật thiết lập bảng lương",
  "payroll.period.create": "Tạo kỳ lương",
  "payroll.period.recalculate": "Tính lại kỳ lương",
  "payroll.period.finalize": "Chốt kỳ lương",
  "payroll.period.lock": "Khóa kỳ lương",
  "payroll.period.markpaid": "Đánh dấu đã trả lương",
  "payroll.payment.record": "Ghi nhận chi trả lương",
  "payroll.payout.execute": "Thực hiện chi trả lương",
  "payroll.adjustment.write": "Điều chỉnh bảng lương",
  "payroll.payslip.self": "Xem phiếu lương cá nhân",
  "payroll.export": "Xuất bảng lương",
  "performance.read": "Xem hiệu suất nhân viên",
  "performance.write": "Quản lý hiệu suất nhân viên",

  "customer.read": "Xem khách hàng",
  "customer.update": "Cập nhật thông tin khách hàng",
  "profile.update": "Cập nhật hồ sơ cá nhân",
  "address.read": "Xem địa chỉ",
  "address.write": "Quản lý địa chỉ",
  "favorite.read": "Xem danh sách yêu thích",
  "favorite.write": "Quản lý danh sách yêu thích",
  "cart.read": "Xem giỏ hàng",
  "cart.write": "Cập nhật giỏ hàng",
  "loyalty.read": "Xem điểm thành viên",
  "notification.read": "Xem thông báo",

  "inventory.read": "Xem tồn kho",
  "inventory.write": "Quản lý tồn kho",
  "stock.read": "Xem nhập xuất kho",
  "stock.write": "Quản lý nhập xuất kho",
  "supplier.read": "Xem nhà cung cấp",
  "supplier.write": "Quản lý nhà cung cấp",
  "promotion.read": "Xem chương trình khuyến mãi",
  "promotion.write": "Quản lý chương trình khuyến mãi",
  "coupon.read": "Xem mã giảm giá",
  "coupon.write": "Quản lý mã giảm giá",

  "shift.read": "Xem ca làm",
  "shift.manage": "Quản lý ca làm",
  "kitchen.read": "Xem hoạt động bếp",
  "kitchen.write": "Cập nhật trạng thái món trong bếp",
  "table.read": "Xem bàn và khu vực",
  "table.write": "Quản lý bàn và khu vực",
  "cleaning.read": "Xem nhiệm vụ vệ sinh",
  "delivery.read": "Xem đơn giao hàng",
  "delivery.update": "Cập nhật trạng thái giao hàng",

  "reservation.create": "Tạo yêu cầu đặt bàn",
  "reservation.read": "Xem yêu cầu đặt bàn",
  "reservation.update": "Cập nhật yêu cầu đặt bàn",
  "reservation.cancel": "Hủy yêu cầu đặt bàn",
  "review.create": "Tạo đánh giá",
  "review.read": "Xem đánh giá",
  "review.write": "Cập nhật đánh giá",
  "review.reply": "Phản hồi đánh giá",
  "review.moderate": "Kiểm duyệt đánh giá",
  "review.delete": "Ẩn hoặc xóa đánh giá",
  "review.report.read": "Xem báo cáo vi phạm đánh giá",
  "review.report.resolve": "Xử lý báo cáo vi phạm đánh giá",
  "review.export": "Xuất dữ liệu đánh giá",
  "review.analytics.read": "Xem báo cáo phân tích đánh giá",
});

export const RBAC_ROLE_LABELS = Object.freeze({
  accountant: "Kế toán",
  admin: "Quản trị viên hệ thống",
  bartender: "Nhân viên pha chế",
  captain: "Ca trưởng",
  cashier: "Thu ngân",
  chef: "Bếp trưởng",
  cleaner: "Nhân viên vệ sinh",
  cook: "Đầu bếp",
  customer: "Khách hàng",
  host: "Nhân viên đón khách",
  hr: "Nhân sự",
  kitchen_helper: "Phụ bếp",
  manager: "Quản lý nhà hàng",
  server: "Nhân viên phục vụ",
  staff: "Nhân viên",
  storekeeper: "Thủ kho",
  supervisor: "Giám sát",
});

const STATIC_TEXT_REPLACEMENTS = Object.freeze({
  "An toàn truy cập": "Kiểm soát truy cập",
  "Thiết lập vai trò, phạm vi thao tác và lịch sử thay đổi cho từng nhà hàng.":
    "Quản lý người được xem, chỉnh sửa và thực hiện từng nghiệp vụ trong nhà hàng.",
  "Phạm vi theo nhà hàng": "Áp dụng theo nhà hàng",
  "Kiểm tra trước khi lưu": "Kiểm tra quyền trước khi lưu",
  "Lưu lại lịch sử thay đổi": "Ghi nhận lịch sử thay đổi",
  "Bảng quyền": "Danh mục nghiệp vụ",
  "Danh mục quyền hạn": "Danh mục quyền theo nghiệp vụ",
  "Các quyền được gom theo nghiệp vụ để quản lý phạm vi truy cập rõ ràng hơn.":
    "Toàn bộ quyền có thể gán được nhóm theo nghiệp vụ để dễ tìm và tránh cấp nhầm.",
  "Quyền đang áp dụng": "Quyền thực tế",
  "Chi tiết quyền của vai trò": "Quyền của vai trò",
  "Hiển thị quyền được kế thừa, quyền gán riêng và kết quả cuối cùng.":
    "Xem quyền kế thừa, quyền cấp trực tiếp và quyền thực tế nhân viên sẽ có.",
  "Quyền gán riêng": "Quyền cấp trực tiếp",
  "Quyền sau cùng": "Quyền thực tế",
  "Bộ vai trò": "Danh sách vai trò",
  "Thiết lập vai trò": "Cấu hình vai trò",
  "Đặt tên vai trò, chọn nhóm kế thừa và phạm vi thao tác được phép.":
    "Đặt tên, chọn vai trò kế thừa và các quyền cần cấp.",
  "Tên rút gọn": "Mã vai trò",
  "Nhóm kế thừa": "Kế thừa từ",
  "Phạm vi thao tác": "Quyền được cấp",
  "Chọn những thao tác nhân viên được phép thực hiện.":
    "Chọn các quyền cần cấp trực tiếp cho vai trò này.",
  "Cấp quyền nhân viên": "Phân quyền theo vai trò",
});

const normalize = (value) => String(value || "").trim().toLowerCase();
const normalizeRoleKey = (value) => normalize(value).replace(/[\s-]+/g, "_");
const GROUP_LABEL_VALUES = new Set(Object.values(RBAC_GROUP_LABELS));
const ROLE_LABEL_VALUES = new Set(Object.values(RBAC_ROLE_LABELS));

const extractPermissionCode = (value) => {
  const match = String(value || "").match(/\b[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+\b/i);
  return normalize(match?.[0]);
};

export function getRbacGroupLabel(value) {
  const current = String(value || "").trim();
  if (!current || GROUP_LABEL_VALUES.has(current)) return current || "Nhóm khác";
  return RBAC_GROUP_LABELS[normalize(current)] || "Nhóm khác";
}

export function getRbacPermissionLabel(permissionOrCode) {
  const permission = typeof permissionOrCode === "object" && permissionOrCode !== null
    ? permissionOrCode
    : { code: permissionOrCode };
  const code = normalize(permission.code || permission.permissionCode);
  return RBAC_PERMISSION_LABELS[code]
    || permission.name
    || permission.description
    || code
    || "Quyền chưa đặt tên";
}

export function getRbacPermissionMeta(permissionOrCode) {
  const permission = typeof permissionOrCode === "object" && permissionOrCode !== null
    ? permissionOrCode
    : { code: permissionOrCode };
  const code = normalize(
    permission.code
      || permission.permissionCode
      || [permission.resource, permission.action].filter(Boolean).join("."),
  );
  return code ? `Mã quyền: ${code}` : "";
}

export function getRbacRoleLabel(roleOrValue) {
  const role = typeof roleOrValue === "object" && roleOrValue !== null
    ? roleOrValue
    : { name: roleOrValue };
  const candidates = [role.slug, role.name];
  for (const candidate of candidates) {
    const current = String(candidate || "").trim();
    if (ROLE_LABEL_VALUES.has(current)) return current;
    const mapped = RBAC_ROLE_LABELS[normalizeRoleKey(current)];
    if (mapped) return mapped;
  }
  return role.name || role.slug || "Chưa có vai trò";
}

const setElementText = (element, nextText) => {
  if (!element || !nextText || element.textContent?.trim() === nextText) return 0;
  element.textContent = nextText;
  return 1;
};

function applyStaticCopy(page) {
  const walker = document.createTreeWalker(page, window.NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, textarea")) return window.NodeFilter.FILTER_REJECT;
      return STATIC_TEXT_REPLACEMENTS[node.nodeValue?.trim()]
        ? window.NodeFilter.FILTER_ACCEPT
        : window.NodeFilter.FILTER_REJECT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let changes = 0;
  for (const node of nodes) {
    const current = node.nodeValue || "";
    const trimmed = current.trim();
    const replacement = STATIC_TEXT_REPLACEMENTS[trimmed];
    if (!replacement || trimmed === replacement) continue;
    node.nodeValue = current.replace(trimmed, replacement);
    changes += 1;
  }
  return changes;
}

export function applyRbacVietnameseLabels(root = document) {
  const page = root?.matches?.(".rbac-page") ? root : root?.querySelector?.(".rbac-page");
  if (!page) return 0;

  let changes = applyStaticCopy(page);

  page.querySelectorAll(".rbac-permission-group__title h4, .rbac-permission-checklist fieldset legend")
    .forEach((element) => {
      changes += setElementText(element, getRbacGroupLabel(element.textContent));
    });

  page.querySelectorAll(".rbac-chip, .rbac-checkbox-row").forEach((row) => {
    const meta = row.querySelector("small");
    const code = extractPermissionCode(meta?.textContent);
    if (!code) return;
    changes += setElementText(row.querySelector("strong"), getRbacPermissionLabel(code));
    changes += setElementText(meta, getRbacPermissionMeta(code));
  });

  page.querySelectorAll(".rbac-role-row").forEach((row) => {
    const meta = row.querySelector(".rbac-role-row__meta");
    const rawMeta = meta?.textContent || "";
    const slug = rawMeta.replace(/^(Tên rút gọn|Mã vai trò):\s*/i, "").trim();
    const heading = row.querySelector(".rbac-role-row__top strong");
    changes += setElementText(heading, getRbacRoleLabel(slug || heading?.textContent));
    if (meta && slug && /^(Tên rút gọn|Mã vai trò):/i.test(rawMeta)) {
      changes += setElementText(meta, `Mã vai trò: ${slug}`);
    }
  });

  page.querySelectorAll(
    ".rbac-selected-role h4, .rbac-assignment-step small, .rbac-assignment-preview__summary strong, option",
  ).forEach((element) => {
    const mapped = getRbacRoleLabel(element.textContent);
    if (mapped !== element.textContent?.trim()) changes += setElementText(element, mapped);
  });

  return changes;
}

let observer = null;
let frameId = 0;

export function installRbacVietnameseLabels() {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  const schedule = () => {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      applyRbacVietnameseLabels();
    });
  };

  if (!observer) {
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  schedule();

  return () => {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    observer?.disconnect();
    observer = null;
  };
}
