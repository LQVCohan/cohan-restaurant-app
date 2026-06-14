import {
  STAFF_OPERATIONAL_ROLES,
  STAFF_SHARED_ROLES,
  resolveUserRoleName,
} from "@/utils/frontendRoleAccess";

const MANAGER_FEATURE_ROLES = ["admin", "manager", "hr", "accountant"];
const CUSTOMER_NAV_ROLES = ["customer", "admin", "manager"];

const normalizeText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();

const isManagerHelpQuery = (query = "") => {
  const q = normalizeText(query);
  return /\b(giup gi|co the giup|ban co the giup|dieu huong|huong dan|lam duoc gi|quan ly o dau|mo giup|di toi|vao trang|mo trang)\b/.test(q);
};

export const AI_CHATBOT_FEATURE_MAP = [
  {
    key: "home",
    label: "Trang chủ",
    path: "/",
    intent: "navigation",
    description: "Khám phá nhà hàng, ưu đãi và các lối tắt chính.",
    aliases: ["trang chu", "home", "bat dau"],
  },
  {
    key: "restaurant-detail",
    label: "Thông tin nhà hàng",
    path: "/restaurant/:restaurantId",
    intent: "navigation",
    description: "Xem thông tin mở cửa, địa chỉ, đánh giá và thực đơn nhà hàng.",
    aliases: ["nha hang", "chi tiet nha hang", "mo cua", "dia chi nha hang"],
  },
  {
    key: "menu",
    label: "Xem thực đơn",
    path: "/cus-menu",
    intent: "menu",
    description: "Xem món ăn, giá và các lựa chọn đang bán.",
    aliases: ["menu", "thuc don", "tim mon an", "xem mon", "mon an", "do an", "gia mon"],
  },
  {
    key: "food-detail",
    label: "Chi tiết món ăn",
    path: "/food/:menuItemId",
    intent: "menu",
    description: "Xem chi tiết món, tùy chọn khẩu phần và thêm vào giỏ.",
    aliases: ["chi tiet mon", "xem mon nay", "khau phan", "tuy chon mon", "them vao gio"],
  },
  {
    key: "cart",
    label: "Giỏ hàng của tôi",
    path: "",
    actionType: "openCart",
    intent: "cart",
    description: "Mở giỏ hàng hiện tại.",
    allowedRoles: CUSTOMER_NAV_ROLES,
    aliases: ["gio hang", "gio hang dau", "cart", "mo gio", "xem gio hang"],
  },
  {
    key: "checkout",
    label: "Thanh toán",
    path: "/checkout",
    intent: "checkout",
    description: "Xác nhận đơn hàng sau khi kiểm tra giỏ.",
    allowedRoles: CUSTOMER_NAV_ROLES,
    aliases: ["thanh toan", "checkout", "xac nhan don", "tra tien", "dat mon"],
  },
  {
    key: "orders",
    label: "Đơn hàng của tôi",
    path: "/orders",
    intent: "orderHelp",
    description: "Xem trạng thái và lịch sử đơn hàng.",
    allowedRoles: CUSTOMER_NAV_ROLES,
    aliases: ["don hang", "xem don hang", "ma don", "kiem tra don", "lich su don"],
  },
  {
    key: "reservations",
    label: "Đặt bàn",
    path: "/restaurant/:restaurantId/layout",
    intent: "reservationHelp",
    description: "Xem sơ đồ bàn và giữ chỗ.",
    aliases: ["dat ban", "lam sao dat ban", "dat ban o dau", "giu cho", "dat cho", "ban trong", "so do ban", "reservation", "booking"],
  },
  {
    key: "profile",
    label: "Hồ sơ của tôi",
    path: "/profile",
    intent: "profileHelp",
    description: "Xem thông tin tài khoản của bạn.",
    aliases: ["tai khoan", "ho so", "profile", "toi la ai", "dang nhap", "thong tin cua toi"],
  },
  {
    key: "manager-dashboard",
    label: "Dashboard quản lý",
    path: "/manager",
    intent: "managerFeatureHelp",
    description: "Tổng quan vận hành nhà hàng.",
    managerOnly: true,
    allowedRoles: MANAGER_FEATURE_ROLES,
    aliases: ["quan ly", "dashboard", "bao cao", "doanh thu", "trang quan ly", "dashboard quan ly"],
  },
  {
    key: "staff-schedule",
    label: "Lịch làm việc",
    path: "/staff/schedule",
    intent: "managerFeatureHelp",
    description: "Xem lịch làm việc và ca trực.",
    allowedRoles: STAFF_SHARED_ROLES,
    aliases: ["lich nhan vien", "lich lam", "ca lam", "schedule", "nhan su"],
  },
  {
    key: "storage-inventory",
    label: "Kho nguyên liệu",
    path: "/manager#inventory",
    intent: "managerFeatureHelp",
    description: "Theo dõi tồn kho, nguyên liệu và kiểm kê.",
    managerOnly: true,
    allowedRoles: ["admin", "manager"],
    aliases: ["kho", "ton kho", "inventory", "nguyen lieu", "kiem ke", "quan ly kho"],
  },
  {
    key: "ai-chatbot-manager",
    label: "Quản lý Chatbot AI",
    path: "/manager#ai-chatbot-knowledge",
    intent: "managerFeatureHelp",
    description: "Quản lý tri thức, phân tích và an toàn chatbot.",
    managerOnly: true,
    allowedRoles: MANAGER_FEATURE_ROLES,
    aliases: ["quan ly chatbot", "ai chatbot", "chatbot manager", "tri thuc chatbot", "phan tich chatbot"],
  },
];

const normalizeRole = (value) => resolveUserRoleName(value) || String(value || "").trim().toLowerCase();

export const getAiChatbotUserRole = (userOrRole) => normalizeRole(userOrRole) || "";

const fillPath = (path = "", { restaurantId, menuItemId } = {}) =>
  String(path || "")
    .replace(":restaurantId", encodeURIComponent(restaurantId || ""))
    .replace(":menuItemId", encodeURIComponent(menuItemId || ""));

const canUseFeature = (entry, role) => {
  if (!role) return !entry.managerOnly && !entry.allowedRoles;
  if (entry.allowedRoles?.length) return entry.allowedRoles.includes(role);
  if (entry.managerOnly) return MANAGER_FEATURE_ROLES.includes(role);
  return true;
};

const pathMatchesEntry = (entry, path, menuItemId) => {
  if (entry.key === "home") return path === "/" || path === "";
  if (entry.key === "restaurant-detail") return path.startsWith("/restaurant/") && !path.endsWith("/layout");
  if (entry.key === "reservations") return path.includes("/layout") || path.includes("reservation");
  if (entry.key === "menu") return path.includes("menu") || path.includes("restaurant");
  if (entry.key === "food-detail") return path.startsWith("/food/") || Boolean(menuItemId);
  if (entry.key === "cart") return path.includes("cart");
  if (entry.key === "checkout") return path.includes("checkout");
  if (entry.key === "orders") return path.includes("order");
  if (entry.key === "profile") return path.includes("profile") || path.includes("account");
  if (entry.key === "staff-schedule") return path.startsWith("/staff/schedule") || path.includes("schedule");
  if (entry.key === "manager-dashboard") return path === "/manager" || path === "/manager#dashboard";
  if (entry.key === "storage-inventory") return path.includes("inventory") || path.includes("storage");
  if (entry.key === "ai-chatbot-manager") return path.includes("ai-chatbot");
  return false;
};

const queryScoreEntry = (entry, query) => {
  const q = normalizeText(query);
  if (!q) return 0;
  const haystacks = [entry.key, entry.label, entry.intent, entry.description, ...(entry.aliases || [])].map(normalizeText);
  let score = haystacks.reduce((sum, text) => sum + (text && (q.includes(text) || text.includes(q)) ? 3 : 0), 0);
  const queryTokens = q.split(/[^a-z0-9]+/).filter((token) => token.length >= 2);
  for (const token of queryTokens) {
    if (haystacks.some((text) => text.includes(token))) score += 1;
  }
  return score;
};

export const getAiChatbotFeatureMatches = ({ pathname = "", restaurantId = "", selectedMenuItem = null, userRole = "", query = "" } = {}) => {
  const path = String(pathname || "").toLowerCase();
  const role = normalizeRole(userRole);
  const menuItemId = selectedMenuItem?.id || selectedMenuItem?.menuItemId || "";
  const helpQuery = isManagerHelpQuery(query);
  const isManagerShell = path === "/manager" || path === "/manager#dashboard";
  const accessibleEntries = AI_CHATBOT_FEATURE_MAP.filter((entry) => canUseFeature(entry, role));

  if (isManagerShell && !query) {
    return accessibleEntries
      .filter((entry) => entry.managerOnly || entry.key === "staff-schedule")
      .map((entry) => ({ ...entry, path: fillPath(entry.path, { restaurantId, menuItemId }) }))
      .slice(0, 6);
  }

  return accessibleEntries
    .map((entry) => {
      const queryScore = queryScoreEntry(entry, query);
      const pathScore = pathMatchesEntry(entry, path, menuItemId) ? 5 : 0;
      const managerShellScore = entry.managerOnly && isManagerShell ? 2 : 0;
      const shouldUsePathScore = entry.managerOnly || queryScore > 0;
      const managerHelpScore = entry.managerOnly && helpQuery ? 4 : 0;
      return {
        entry,
        score: queryScore + managerHelpScore + managerShellScore + (shouldUsePathScore ? pathScore : 0),
      };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => ({ ...entry, path: fillPath(entry.path, { restaurantId, menuItemId }) }))
    .slice(0, 6);
};

export const __aiChatbotFeatureMapTestables = {
  canUseFeature,
  fillPath,
  normalizeRole,
  normalizeText,
  queryScoreEntry,
  pathMatchesEntry,
  MANAGER_FEATURE_ROLES,
  STAFF_OPERATIONAL_ROLES,
};