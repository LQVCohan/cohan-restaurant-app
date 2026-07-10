import process from "process";
import {
  __testables as coreTestables,
  handleRestaurantChatbotMessage as handleCoreRestaurantChatbotMessage,
} from "./restaurantChatbotCore.service.js";
import { DEFAULT_GEMINI_MODEL } from "./geminiClient.service.js";

const enforceGeminiProviderPolicy = () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  process.env.AI_PROVIDER = "gemini";
  process.env.AI_FALLBACK_PROVIDER = "local";
  process.env.GEMINI_MODEL = DEFAULT_GEMINI_MODEL;
  process.env.AI_CHATBOT_MODEL = DEFAULT_GEMINI_MODEL;
};

const normalizePathname = (pathname = "") =>
  String(pathname || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";

const normalizeText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();

const ROLE_MANAGER_LIKE = new Set(["admin", "manager", "hr", "accountant"]);
const ROLE_STAFF_SHARED = new Set([
  "admin",
  "manager",
  "hr",
  "staff",
  "server",
  "supervisor",
  "host",
  "cashier",
  "chef",
  "cook",
  "kitchen_helper",
  "cleaner",
  "shipper",
  "storekeeper",
  "bartender",
]);
const ROLE_STAFF_ORDER = new Set([
  "admin",
  "manager",
  "server",
  "host",
  "cashier",
  "supervisor",
]);
const ROLE_STAFF_KITCHEN = new Set([
  "admin",
  "manager",
  "chef",
  "cook",
  "kitchen_helper",
  "bartender",
]);
const ROLE_CUSTOMER_NAV = new Set(["customer", "admin", "manager"]);
const ROLE_CUSTOMER_ONLY = new Set(["customer"]);

const getAuthenticatedRole = (user) => {
  if (!user || typeof user !== "object") return "guest";
  const role =
    user.roleName ||
    user.roleSlug ||
    user.userType ||
    (typeof user.role === "string"
      ? user.role
      : user.role?.slug ||
        user.role?.name ||
        user.role?.parentRole?.slug ||
        user.role?.parentRole?.name) ||
    "guest";
  return String(role).trim().toLowerCase() || "guest";
};

const CUSTOMER_PAGE_RULES = [
  { key: "home", label: "Trang chủ", match: (path) => path === "/", description: "Khám phá nhà hàng, ưu đãi và các lối tắt chính." },
  { key: "contact", label: "Trung tâm hỗ trợ", match: (path) => path === "/contact", description: "Gửi yêu cầu hỗ trợ hoặc liên hệ nhân viên." },
  { key: "search", label: "Tìm kiếm", match: (path) => path === "/search", description: "Tìm nhà hàng, món ăn và nội dung trong ứng dụng." },
  { key: "account-verification", label: "Xác minh tài khoản", match: (path) => /^\/verify-(?:email|phone|account)(?:\/confirm)?$/.test(path), description: "Hoàn tất xác minh email, số điện thoại hoặc tài khoản." },
  { key: "public-order-tracking", label: "Theo dõi đơn công khai", match: (path) => /^\/track-order\/[^/]+$/.test(path), description: "Theo dõi đơn bằng mã theo dõi công khai." },
  { key: "for-you", label: "Gợi ý cho tôi", match: (path) => path === "/for-you", description: "Xem món và nhà hàng được gợi ý theo sở thích." },
  { key: "cart", label: "Giỏ hàng", match: (path) => path === "/cart", description: "Kiểm tra món, số lượng, tùy chọn và ghi chú trước khi thanh toán." },
  { key: "wallet", label: "Ví của tôi", match: (path) => path === "/wallet", description: "Xem số dư và lịch sử giao dịch của tài khoản." },
  { key: "orders", label: "Đơn hàng của tôi", match: (path) => path === "/orders", description: "Xem danh sách, trạng thái và lịch sử đơn hàng." },
  { key: "order-tracking", label: "Theo dõi giao hàng", match: (path) => /^\/track-delivery\/[^/]+$/.test(path), description: "Xem tiến trình xử lý và giao đơn hiện tại." },
  { key: "restaurants", label: "Danh sách nhà hàng", match: (path) => path === "/restaurants", description: "Lọc và chọn nhà hàng phù hợp." },
  { key: "combos", label: "Combo ưu đãi", match: (path) => path === "/combos", description: "Xem và chọn combo món đang được bán." },
  { key: "table-booking", label: "Sơ đồ bàn", match: (path) => /^\/restaurant\/[^/]+\/layout$/.test(path), description: "Chọn ngày, giờ, số người và bàn còn trống để đặt chỗ." },
  { key: "restaurant-detail", label: "Thông tin nhà hàng", match: (path) => /^\/restaurant\/[^/]+$/.test(path), description: "Xem thông tin, thực đơn, đánh giá, ưu đãi và mở luồng đặt bàn." },
  { key: "scan-table", label: "Quét QR bàn", match: (path) => path === "/scan-table", description: "Quét mã QR tại bàn để mở đúng phiên phục vụ." },
  { key: "table-session", label: "Phiên phục vụ tại bàn", match: (path) => /^\/table\/[^/]+\/[^/]+$/.test(path), description: "Xem bàn hiện tại và thao tác gọi món trong phiên tại bàn." },
  { key: "vr-table", label: "Xem bàn 360°", match: (path) => /^\/vr\/table\/[^/]+$/.test(path), description: "Quan sát không gian xung quanh bàn bằng chế độ 360°." },
  { key: "menu", label: "Thực đơn", match: (path) => path === "/cus-menu", description: "Duyệt danh mục và chọn món muốn đặt." },
  { key: "checkout", label: "Thanh toán", match: (path) => path === "/checkout", description: "Kiểm tra thông tin nhận hàng, ưu đãi, phương thức thanh toán và xác nhận đơn." },
  { key: "food-detail", label: "Chi tiết món ăn", match: (path) => /^\/food\/[^/]+$/.test(path), description: "Chọn khẩu phần, tùy chọn, số lượng và thêm món vào giỏ." },
  { key: "coupons", label: "Kho Coupon", match: (path) => /^\/coupons(?:\/[^/]+)?$/.test(path), description: "Xem điều kiện và chọn mã giảm giá phù hợp." },
  { key: "favorites", label: "Yêu thích", match: (path) => /^\/favorites(?:\/[^/]+)?$/.test(path), description: "Xem lại món hoặc nhà hàng đã lưu." },
  { key: "address-book", label: "Sổ địa chỉ", match: (path) => /^\/address-book(?:\/[^/]+)?$/.test(path), description: "Thêm, sửa hoặc chọn địa chỉ nhận hàng." },
  { key: "help-center", label: "Trợ giúp tài khoản", match: (path) => /^\/help-center(?:\/[^/]+)?$/.test(path), description: "Xem hướng dẫn và các lựa chọn hỗ trợ tài khoản." },
  { key: "notifications", label: "Thông báo", match: (path) => path === "/notifications", description: "Xem thông báo về tài khoản, đơn hàng và đặt bàn." },
  { key: "profile", label: "Hồ sơ của tôi", match: (path) => path === "/profile", description: "Xem và cập nhật thông tin tài khoản được phép chỉnh sửa." },
];

const STAFF_PAGE_RULES = [
  { key: "staff-dashboard", label: "Tổng quan nhân viên", match: (path) => path === "/staff" || path === "/staff/dashboard", description: "Xem công việc, ca làm và thông tin vận hành dành cho nhân viên." },
  { key: "staff-orders", label: "Xử lý đơn hàng", match: (path) => path === "/staff/orders", description: "Tiếp nhận và xử lý đơn hàng theo quyền được giao." },
  { key: "staff-reservation-changes", label: "Yêu cầu đổi đặt bàn", match: (path) => path === "/staff/reservation-changes", description: "Xem và xử lý yêu cầu thay đổi đặt bàn." },
  { key: "staff-kitchen", label: "Màn hình bếp", match: (path) => path === "/staff/kitchen", description: "Theo dõi và cập nhật tiến độ chế biến." },
  { key: "staff-performance", label: "Hiệu suất làm việc", match: (path) => path === "/staff/performance", description: "Xem chỉ số và kết quả làm việc cá nhân." },
  { key: "staff-schedule", label: "Lịch làm việc", match: (path) => path === "/staff/schedule", description: "Xem lịch làm việc và ca trực." },
  { key: "staff-attendance", label: "Chấm công", match: (path) => path === "/staff/attendance", description: "Xem và thực hiện tác vụ chấm công được cho phép." },
  { key: "staff-leave", label: "Đơn nghỉ phép", match: (path) => path === "/staff/leave", description: "Tạo và theo dõi đơn xin nghỉ phép." },
  { key: "staff-profile", label: "Hồ sơ nhân viên", match: (path) => path === "/staff/profile", description: "Xem thông tin hồ sơ nhân viên." },
  { key: "staff-notifications", label: "Thông báo nhân viên", match: (path) => path === "/staff/notifications", description: "Xem thông báo liên quan đến công việc." },
  { key: "staff-contacts", label: "Liên lạc nội bộ", match: (path) => path === "/staff/contacts", description: "Trao đổi và liên hệ với đồng nghiệp." },
  { key: "staff-ai-handoff", label: "Hỗ trợ khách từ chatbot", match: (path) => path === "/staff/ai-handoff", description: "Tiếp nhận các cuộc trò chuyện được chatbot chuyển cho nhân viên." },
  { key: "staff-payslips", label: "Phiếu lương", match: (path) => path === "/staff/payslips", description: "Xem phiếu lương của tài khoản nhân viên." },
  { key: "staff-settings", label: "Cài đặt nhân viên", match: (path) => path === "/staff/settings", description: "Điều chỉnh các thiết lập cá nhân được cho phép." },
];

const APP_PAGE_RULES = [...CUSTOMER_PAGE_RULES, ...STAFF_PAGE_RULES];

const STAFF_NAVIGATION_FEATURES = [
  { key: "staff-dashboard", label: "Mở tổng quan", href: "/staff/dashboard", roles: ROLE_STAFF_SHARED, aliases: ["tong quan", "dashboard nhan vien", "trang nhan vien"] },
  { key: "staff-orders", label: "Mở xử lý đơn", href: "/staff/orders", roles: ROLE_STAFF_ORDER, aliases: ["don hang", "xu ly don", "nhan don", "goi mon tai ban"] },
  { key: "staff-reservation-changes", label: "Mở yêu cầu đổi đặt bàn", href: "/staff/reservation-changes", roles: ROLE_STAFF_ORDER, aliases: ["doi dat ban", "thay doi dat ban", "yeu cau dat ban", "reservation change"] },
  { key: "staff-kitchen", label: "Mở màn hình bếp", href: "/staff/kitchen", roles: ROLE_STAFF_KITCHEN, aliases: ["bep", "man hinh bep", "che bien", "mon dang nau"] },
  { key: "staff-performance", label: "Mở hiệu suất", href: "/staff/performance", roles: ROLE_STAFF_SHARED, aliases: ["hieu suat", "kpi", "ket qua lam viec"] },
  { key: "staff-schedule", label: "Mở lịch làm việc", href: "/staff/schedule", roles: ROLE_STAFF_SHARED, aliases: ["lich lam", "lich lam viec", "ca lam", "ca truc"] },
  { key: "staff-attendance", label: "Mở chấm công", href: "/staff/attendance", roles: ROLE_STAFF_SHARED, aliases: ["cham cong", "diem danh", "check in", "check out"] },
  { key: "staff-leave", label: "Mở đơn nghỉ phép", href: "/staff/leave", roles: ROLE_STAFF_SHARED, aliases: ["nghi phep", "xin nghi", "don nghi", "nghi lam"] },
  { key: "staff-profile", label: "Mở hồ sơ nhân viên", href: "/staff/profile", roles: ROLE_STAFF_SHARED, aliases: ["ho so nhan vien", "thong tin nhan vien", "profile nhan vien"] },
  { key: "staff-notifications", label: "Mở thông báo", href: "/staff/notifications", roles: ROLE_STAFF_SHARED, aliases: ["thong bao", "tin moi", "canh bao"] },
  { key: "staff-contacts", label: "Mở liên lạc nội bộ", href: "/staff/contacts", roles: ROLE_STAFF_SHARED, aliases: ["lien lac", "dong nghiep", "noi bo", "danh ba"] },
  { key: "staff-ai-handoff", label: "Mở hỗ trợ khách", href: "/staff/ai-handoff", roles: ROLE_STAFF_SHARED, aliases: ["ho tro khach", "chatbot chuyen", "ai handoff", "tra loi khach"] },
  { key: "staff-payslips", label: "Mở phiếu lương", href: "/staff/payslips", roles: ROLE_STAFF_SHARED, aliases: ["phieu luong", "bang luong", "luong cua toi"] },
  { key: "staff-settings", label: "Mở cài đặt", href: "/staff/settings", roles: ROLE_STAFF_SHARED, aliases: ["cai dat nhan vien", "thiet lap nhan vien", "settings nhan vien"] },
];

const CUSTOMER_NAVIGATION_FEATURES = [
  { key: "restaurants", label: "Chọn nhà hàng", href: "/restaurants", roles: null, aliases: ["nha hang", "chon nha hang", "danh sach nha hang"] },
  { key: "menu", label: "Xem thực đơn", href: "/cus-menu", roles: null, aliases: ["menu", "thuc don", "xem mon", "tim mon"] },
  { key: "cart", label: "Mở giỏ hàng", href: "", type: "openCart", roles: ROLE_CUSTOMER_NAV, aliases: ["gio hang", "mo gio", "xem gio"] },
  { key: "orders", label: "Mở đơn hàng", href: "/orders", roles: ROLE_CUSTOMER_NAV, aliases: ["don hang cua toi", "lich su don", "kiem tra don"] },
  { key: "coupons", label: "Mở kho Coupon", href: "/coupons", roles: ROLE_CUSTOMER_NAV, aliases: ["coupon", "voucher", "ma giam gia", "uu dai"] },
  { key: "profile", label: "Mở hồ sơ", href: "/profile", roles: ROLE_CUSTOMER_NAV, aliases: ["ho so", "tai khoan", "thong tin cua toi"] },
  { key: "checkout", label: "Đi tới thanh toán", href: "/checkout", roles: ROLE_CUSTOMER_ONLY, aliases: ["thanh toan", "xac nhan don", "tra tien"] },
  { key: "wallet", label: "Mở ví", href: "/wallet", roles: ROLE_CUSTOMER_ONLY, aliases: ["vi cua toi", "so du", "lich su vi"] },
  { key: "combos", label: "Xem combo", href: "/combos", roles: null, aliases: ["combo", "set mon", "goi mon"] },
  { key: "search", label: "Mở tìm kiếm", href: "/search", roles: null, aliases: ["tim kiem", "tim nhanh", "search"] },
  { key: "contact", label: "Liên hệ hỗ trợ", href: "/contact", roles: null, aliases: ["lien he", "ho tro", "gap nhan vien"] },
];

const decodePathPart = (value = "") => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const resolveCustomerPage = (pathname = "") => {
  const path = normalizePathname(pathname);
  const rule = APP_PAGE_RULES.find((item) => item.match(path));
  if (!rule) return null;
  const { match, ...page } = rule;
  return { ...page, pathname: path };
};

const extractRestaurantIdFromCustomerPath = (pathname = "") => {
  const path = normalizePathname(pathname);
  const match =
    path.match(/^\/restaurant\/([^/]+)(?:\/layout)?$/) ||
    path.match(/^\/coupons\/([^/]+)$/) ||
    path.match(/^\/table\/([^/]+)\/[^/]+$/);
  return match?.[1] ? decodePathPart(match[1]) : "";
};

const extractMenuItemIdFromCustomerPath = (pathname = "") => {
  const match = normalizePathname(pathname).match(/^\/food\/([^/]+)$/);
  return match?.[1] ? decodePathPart(match[1]) : "";
};

const buildCurrentPageFeature = (page) => page ? {
  key: `current-page-${page.key}`,
  label: `Trang hiện tại: ${page.label}`,
  path: page.pathname,
  actionType: "link",
  intent: "navigation",
  description: `Đây là trang người dùng đang đứng. ${page.description} Khi trả lời câu hỏi hướng dẫn, hãy bắt đầu từ thao tác có thể làm ngay trên trang này và bỏ qua các bước điều hướng đã hoàn thành.`,
} : null;

const removeCurrentPageAction = (response, page) => {
  if (!page || !Array.isArray(response?.actions)) return response;
  const key = `current-page-${page.key}`;
  const label = `Trang hiện tại: ${page.label}`;
  const actions = response.actions.filter(
    (action) => action?.icon !== key && action?.label !== label,
  );
  return actions.length === response.actions.length
    ? response
    : { ...response, actions };
};

const canUseActionPathForRole = (href = "", role = "guest") => {
  if (!String(href || "").startsWith("/")) return true;
  const path = normalizePathname(href);
  if (path.startsWith("/admin")) return role === "admin";
  if (path.startsWith("/manager")) return ROLE_MANAGER_LIKE.has(role);
  if (path === "/staff/orders" || path === "/staff/reservation-changes") {
    return ROLE_STAFF_ORDER.has(role);
  }
  if (path === "/staff/kitchen") return ROLE_STAFF_KITCHEN.has(role);
  if (path === "/staff" || path.startsWith("/staff/")) {
    return ROLE_STAFF_SHARED.has(role);
  }
  return true;
};

const filterRoleAwareActions = (response, user) => {
  if (!Array.isArray(response?.actions)) return response;
  const role = getAuthenticatedRole(user);
  const actions = response.actions.filter((action) =>
    canUseActionPathForRole(action?.href, role),
  );
  return actions.length === response.actions.length
    ? response
    : { ...response, actions };
};

const enrichPageAwareOptions = (options = {}) => {
  const pathname = options?.pageContext?.pathname || options?.pageContext?.route || "";
  const page = resolveCustomerPage(pathname);
  if (!page) return { options, page: null };

  const pageContext = { ...(options.pageContext || {}), pathname: page.pathname };
  const restaurantId =
    options.restaurantId ||
    pageContext.restaurantId ||
    extractRestaurantIdFromCustomerPath(page.pathname);
  const menuItemId = extractMenuItemIdFromCustomerPath(page.pathname);

  if (restaurantId && !pageContext.restaurantId) pageContext.restaurantId = restaurantId;
  if (menuItemId && !pageContext.selectedMenuItem?.id && !pageContext.selectedMenuItem?.menuItemId) {
    pageContext.selectedMenuItem = {
      ...(pageContext.selectedMenuItem || {}),
      id: menuItemId,
      restaurantId: pageContext.restaurantId || null,
    };
  }

  const currentPageFeature = buildCurrentPageFeature(page);
  const featureMatches = Array.isArray(pageContext.featureMatches)
    ? pageContext.featureMatches
    : [];
  pageContext.featureMatches = [
    currentPageFeature,
    ...featureMatches.filter(
      (entry) => !String(entry?.key || "").startsWith("current-page-"),
    ),
  ].slice(0, 12);

  return {
    page,
    options: {
      ...options,
      ...(restaurantId && !options.restaurantId ? { restaurantId } : {}),
      pageContext,
    },
  };
};

const isHowToQuestion = (message = "") =>
  /(?:làm sao|lam sao|cách|cach|hướng dẫn|huong dan|ở đâu|o dau|thế nào|the nao|dùng sao|dung sao|sử dụng|su dung|cần làm gì|can lam gi|phải làm gì|phai lam gi|tiếp theo|tiep theo)/i.test(
    String(message || ""),
  );

const isGeneralHelpQuestion = (message = "") => {
  const value = normalizeText(message);
  return /(?:ban co the.*(?:giup|lam)|giup duoc gi|giup gi|lam duoc gi|cac chuc nang|huong dan su dung|toi can lam gi|can lam gi o day|bat dau tu dau)/.test(value);
};

const isReservationHowToQuestion = (message = "") =>
  /(?:làm sao|lam sao|cách|cach|hướng dẫn|huong dan|muốn|muon|ở đâu|o dau).*(?:đặt bàn|dat ban|giữ chỗ|giu cho|đặt chỗ|dat cho)|(?:đặt bàn|dat ban|giữ chỗ|giu cho|đặt chỗ|dat cho).*(?:thế nào|the nao|làm sao|lam sao|ở đâu|o dau)/i.test(
    String(message || ""),
  );

const featureAllowedForRole = (feature, role) =>
  !feature.roles || feature.roles.has(role);

const featureMatchesMessage = (feature, normalizedMessage) =>
  feature.aliases.some((alias) => normalizedMessage.includes(alias));

const toNavigationAction = (feature, priority) => ({
  type: feature.type || "link",
  label: feature.label,
  href: feature.href,
  description: `Đi thẳng tới ${feature.label.toLowerCase()} theo quyền hiện tại.`,
  icon: feature.key,
  priority,
});

const buildRoleNavigationActions = ({ message, user, page }) => {
  const role = getAuthenticatedRole(user);
  const normalizedMessage = normalizeText(message);
  const isStaffPage = String(page?.pathname || "").startsWith("/staff");
  const useStaffFeatures =
    isStaffPage || (ROLE_STAFF_SHARED.has(role) && !ROLE_CUSTOMER_NAV.has(role));
  const features = useStaffFeatures
    ? STAFF_NAVIGATION_FEATURES
    : CUSTOMER_NAVIGATION_FEATURES;
  const allowed = features.filter((feature) => featureAllowedForRole(feature, role));
  const matched = allowed.filter((feature) =>
    featureMatchesMessage(feature, normalizedMessage),
  );
  const selected = matched.length
    ? matched
    : isGeneralHelpQuestion(message)
      ? allowed
      : [];
  return selected
    .slice(0, 6)
    .map((feature, index) => toNavigationAction(feature, index + 1));
};

const mergeRoleNavigationActions = ({ response, options, page }) => {
  const directActions = buildRoleNavigationActions({
    message: options?.message,
    user: options?.user,
    page,
  });
  if (!directActions.length) return response;

  const actions = [];
  const seen = new Set();
  for (const action of [...directActions, ...(response?.actions || [])]) {
    const key = `${action?.type || "link"}:${action?.href || action?.label || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push(action);
    if (actions.length >= 6) break;
  }
  return { ...response, actions };
};

const buildReservationPageGuidance = (pathname = "") => {
  const path = normalizePathname(pathname);

  if (path === "/restaurants") {
    return [
      "Bạn đang ở trang Danh sách nhà hàng. Để đặt bàn, tiếp tục từ đây:",
      "1. Chọn nhà hàng bạn muốn đặt trong danh sách.",
      "2. Ở trang nhà hàng, bấm “Đặt bàn” hoặc “Xem sơ đồ bàn”.",
      "3. Chọn ngày, giờ và số người.",
      "4. Chọn bàn còn trống phù hợp.",
      "5. Kiểm tra thông tin và xác nhận đặt bàn.",
      "Sau khi xác nhận, bạn có thể theo dõi trạng thái trong mục đặt bàn/đơn đặt chỗ.",
    ].join("\n");
  }

  if (/^\/restaurant\/[^/]+\/layout$/.test(path)) {
    return [
      "Bạn đang ở trang Sơ đồ bàn. Để hoàn tất đặt bàn, tiếp tục từ đây:",
      "1. Chọn ngày, giờ và số người.",
      "2. Chọn bàn còn trống phù hợp trên sơ đồ.",
      "3. Kiểm tra thông tin liên hệ và yêu cầu đặt bàn.",
      "4. Bấm xác nhận đặt bàn.",
      "Sau khi xác nhận, bạn có thể theo dõi trạng thái trong mục đặt bàn/đơn đặt chỗ.",
    ].join("\n");
  }

  if (/^\/restaurant\/[^/]+$/.test(path)) {
    return [
      "Bạn đang ở trang Thông tin nhà hàng. Để đặt bàn, tiếp tục từ đây:",
      "1. Bấm “Đặt bàn” hoặc “Xem sơ đồ bàn”.",
      "2. Chọn ngày, giờ và số người.",
      "3. Chọn bàn còn trống phù hợp.",
      "4. Kiểm tra thông tin và xác nhận đặt bàn.",
      "Sau khi xác nhận, bạn có thể theo dõi trạng thái trong mục đặt bàn/đơn đặt chỗ.",
    ].join("\n");
  }

  return "";
};

const applyPageAwareGuidance = ({ response, options, page = null }) => {
  if (isReservationHowToQuestion(options?.message)) {
    const answer = buildReservationPageGuidance(
      options?.pageContext?.pathname || options?.pageContext?.route,
    );
    if (answer) return { ...response, answer, intent: "reservationHelp" };
  }

  if (!isHowToQuestion(options?.message) || !page || !response?.answer) {
    return response;
  }

  const answer = String(response.answer).trim();
  if (/bạn đang ở trang/i.test(answer) || answer.toLowerCase().includes(page.label.toLowerCase())) {
    return response;
  }

  return {
    ...response,
    answer: `Bạn đang ở trang ${page.label}. Tiếp tục từ đây:\n${answer}`,
  };
};

export const handleRestaurantChatbotMessage = async (options = {}) => {
  enforceGeminiProviderPolicy();
  const enriched = enrichPageAwareOptions(options);
  const coreResponse = await handleCoreRestaurantChatbotMessage(enriched.options);
  const withoutCurrentPageAction = removeCurrentPageAction(
    coreResponse,
    enriched.page,
  );
  const roleFilteredResponse = filterRoleAwareActions(
    withoutCurrentPageAction,
    enriched.options.user,
  );
  const response = mergeRoleNavigationActions({
    response: roleFilteredResponse,
    options: enriched.options,
    page: enriched.page,
  });
  return applyPageAwareGuidance({
    response,
    options: enriched.options,
    page: enriched.page,
  });
};

export const __testables = {
  ...coreTestables,
  CUSTOMER_PAGE_RULES,
  STAFF_PAGE_RULES,
  APP_PAGE_RULES,
  STAFF_NAVIGATION_FEATURES,
  CUSTOMER_NAVIGATION_FEATURES,
  normalizePathname,
  normalizeText,
  getAuthenticatedRole,
  resolveCustomerPage,
  extractRestaurantIdFromCustomerPath,
  extractMenuItemIdFromCustomerPath,
  buildCurrentPageFeature,
  removeCurrentPageAction,
  canUseActionPathForRole,
  filterRoleAwareActions,
  enrichPageAwareOptions,
  isHowToQuestion,
  isGeneralHelpQuestion,
  isReservationHowToQuestion,
  buildRoleNavigationActions,
  mergeRoleNavigationActions,
  buildReservationPageGuidance,
  applyPageAwareGuidance,
  callAiProvider: async (options = {}) => {
    enforceGeminiProviderPolicy();
    return coreTestables.callAiProvider(options);
  },
};
