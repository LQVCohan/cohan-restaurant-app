import {
  STAFF_OPERATIONAL_ROLES,
  STAFF_SHARED_ROLES,
  resolveUserRoleName,
} from "@/utils/frontendRoleAccess";

const MANAGER_FEATURE_ROLES = ["admin", "manager", "hr", "accountant"];
const CUSTOMER_NAV_ROLES = ["customer", "admin", "manager"];
const NOTIFICATION_NAV_ROLES = [...CUSTOMER_NAV_ROLES, ...STAFF_SHARED_ROLES];

const normalizeText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();

const isManagerHelpQuery = (query = "") => {
  const q = normalizeText(query);
  return /\b(giup gi|co the giup|ban co the giup|dieu huong|huong dan|lam duoc gi|quan ly|dashboard|mo giup|di toi|vao trang|mo trang)\b/.test(q);
};

const extractSearchTerm = (query = "") => {
  let value = String(query || "").trim();
  if (!value) return "";

  const normalized = normalizeText(value).trim();
  if (/^(tim kiem|tim nhanh|o tim kiem|thanh tim kiem|search)(\s+(trong app|o dau|dau))?$/.test(normalized)) return "";

  value = value
    .replace(/^(tìm kiếm|tim kiem|tìm nhanh|tim nhanh|tìm|tim|search)\s+/i, "")
    .replace(/\s+(trong app|ở đâu|o dau)$/i, "")
    .trim();

  const cleaned = normalizeText(value).trim();
  if (!cleaned || ["trong app", "o dau", "dau", "app"].includes(cleaned)) return "";
  return value.slice(0, 80);
};

const getCurrentOrderTrackingPath = (pathname = "") => {
  const match = String(pathname || "").match(/^\/track-delivery\/[^/?#]+/);
  return match?.[0] || "";
};

const getRestaurantIdFromPath = (pathname = "") => {
  const value = String(pathname || "").match(/^\/restaurant\/([^/?#]+)/)?.[1] || "";
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
    key: "contact",
    label: "Trung tâm hỗ trợ",
    path: "/contact",
    intent: "support",
    description: "Liên hệ hỗ trợ hoặc gửi yêu cầu cho hệ thống.",
    aliases: ["lien he", "ho tro", "support", "gap nhan vien", "can ho tro", "khieu nai", "phan nan"],
  },
  {
    key: "search",
    label: "Tìm kiếm",
    path: "/search",
    intent: "navigation",
    description: "Tìm kiếm nhanh nhà hàng, món ăn hoặc nội dung trong ứng dụng.",
    aliases: ["tim kiem", "search", "tim nhanh", "o tim kiem", "thanh tim kiem", "tim trong app"],
  },
  {
    key: "restaurants",
    label: "Danh sách nhà hàng",
    path: "/restaurants",
    intent: "navigation",
    description: "Tìm nhà hàng theo tên, khu vực, đánh giá và trạng thái mở cửa.",
    aliases: ["danh sach nha hang", "tim nha hang", "nha hang gan toi", "chon nha hang", "restaurants"],
  },
  {
    key: "restaurant-detail",
    label: "Thông tin nhà hàng",
    path: "/restaurant/:restaurantId",
    intent: "navigation",
    description: "Xem thông tin mở cửa, địa chỉ, đánh giá và thực đơn nhà hàng.",
    requiresRestaurantId: true,
    aliases: ["nha hang", "chi tiet nha hang", "mo cua", "dia chi nha hang"],
  },
  {
    key: "restaurant-menu",
    label: "Thực đơn nhà hàng",
    path: "/restaurant/:restaurantId#menu",
    intent: "menu",
    description: "Mở phần thực đơn của nhà hàng hiện tại.",
    requiresRestaurantId: true,
    aliases: ["thuc don nha hang", "xem thuc don nha hang", "menu nha hang", "mon cua nha hang", "xem menu nha hang"],
  },
  {
    key: "restaurant-reviews",
    label: "Đánh giá nhà hàng",
    path: "/restaurant/:restaurantId#reviews",
    intent: "navigation",
    description: "Mở phần đánh giá của nhà hàng hiện tại.",
    requiresRestaurantId: true,
    aliases: ["danh gia", "review", "reviews", "xem danh gia", "binh luan nha hang", "nhan xet nha hang"],
  },
  {
    key: "restaurant-promotions",
    label: "Khuyến mãi nhà hàng",
    path: "/restaurant/:restaurantId#promotions",
    intent: "promotion",
    description: "Mở phần khuyến mãi của nhà hàng hiện tại.",
    requiresRestaurantId: true,
    aliases: ["uu dai nha hang", "khuyen mai nha hang", "ma giam gia nha hang", "coupon nha hang", "deal nha hang"],
  },
  {
    key: "restaurant-photos",
    label: "Hình ảnh nhà hàng",
    path: "/restaurant/:restaurantId#photos",
    intent: "navigation",
    description: "Mở thư viện hình ảnh của nhà hàng hiện tại.",
    requiresRestaurantId: true,
    aliases: ["hinh anh nha hang", "anh nha hang", "photos nha hang", "photo nha hang", "khong gian nha hang", "xem anh nha hang"],
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
    key: "combos",
    label: "Combo ưu đãi",
    path: "/combos",
    intent: "menu",
    description: "Xem các combo và ưu đãi món ăn đang có trên hệ thống.",
    aliases: ["combo", "combo uu dai", "combo tiet kiem", "set mon", "goi mon", "combo cho 2 nguoi"],
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
    key: "coupons",
    label: "Kho Coupon",
    path: "/coupons",
    intent: "promotion",
    description: "Xem mã giảm giá, điều kiện áp dụng và coupon đã lưu.",
    allowedRoles: CUSTOMER_NAV_ROLES,
    aliases: ["coupon", "voucher", "ma giam gia", "uu dai", "khuyen mai", "kho coupon", "ma uu dai"],
  },
  {
    key: "wallet",
    label: "Ví của tôi",
    path: "/wallet",
    intent: "profileHelp",
    description: "Xem ví, số dư và giao dịch thanh toán của tài khoản.",
    allowedRoles: CUSTOMER_NAV_ROLES,
    aliases: ["vi", "vi cua toi", "wallet", "so du", "nap tien", "lich su vi"],
  },
  {
    key: "notifications",
    label: "Thông báo",
    path: "/notifications",
    intent: "navigation",
    description: "Xem thông báo tài khoản, đơn hàng, đặt bàn và hệ thống.",
    allowedRoles: NOTIFICATION_NAV_ROLES,
    aliases: ["thong bao", "notification", "notifications", "chuong bao", "tin moi", "canh bao"],
  },
  {
    key: "for-you",
    label: "Gợi ý cho tôi",
    path: "/for-you",
    intent: "menu",
    description: "Xem gợi ý món cá nhân hóa theo lịch sử và sở thích.",
    allowedRoles: CUSTOMER_NAV_ROLES,
    aliases: ["goi y cho toi", "for you", "mon hop voi toi", "ca nhan hoa", "de xuat mon"],
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
    key: "order-tracking",
    label: "Theo dõi giao hàng",
    path: "/track-delivery",
    intent: "orderHelp",
    description: "Mở lại trang theo dõi giao hàng của đơn hiện tại.",
    allowedRoles: CUSTOMER_NAV_ROLES,
    requiresCurrentOrderTrackingPath: true,
    aliases: ["theo doi giao hang", "track delivery", "don dang giao", "tai xe dang o dau", "vi tri tai xe", "shipper dang o dau"],
  },
  {
    key: "favorites",
    label: "Yêu thích",
    path: "/favorites",
    intent: "profileHelp",
    description: "Mở danh sách nhà hàng hoặc món đã lưu yêu thích.",
    allowedRoles: CUSTOMER_NAV_ROLES,
    aliases: ["yeu thich", "danh sach yeu thich", "mon yeu thich", "nha hang yeu thich", "da luu"],
  },
  {
    key: "address-book",
    label: "Sổ địa chỉ",
    path: "/address-book",
    intent: "profileHelp",
    description: "Quản lý địa chỉ giao hàng và thông tin nhận hàng.",
    allowedRoles: CUSTOMER_NAV_ROLES,
    aliases: ["so dia chi", "dia chi cua toi", "dia chi giao hang", "quan ly dia chi", "address book"],
  },
  {
    key: "help-center",
    label: "Trợ giúp tài khoản",
    path: "/help-center",
    intent: "support",
    description: "Mở trung tâm trợ giúp theo tài khoản hiện tại.",
    allowedRoles: CUSTOMER_NAV_ROLES,
    aliases: ["tro giup", "help center", "cau hoi thuong gap", "huong dan su dung", "can tro giup"],
  },
  {
    key: "reservations",
    label: "Đặt bàn",
    path: "/restaurant/:restaurantId/layout",
    intent: "reservationHelp",
    description: "Xem sơ đồ bàn và giữ chỗ.",
    requiresRestaurantId: true,
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
    key: "manager-personal-info",
    label: "Mở thông tin cá nhân",
    path: "/manager#restaurant-info-management",
    intent: "managerFeatureHelp",
    description: "Mở trang thông tin cá nhân và cài đặt tài khoản trong khu vực quản lý.",
    managerOnly: true,
    allowedRoles: MANAGER_FEATURE_ROLES,
    aliases: ["thong tin ca nhan", "quan ly thong tin ca nhan", "mo thong tin ca nhan", "ho so ca nhan", "thong tin tai khoan", "cai dat tai khoan"],
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

const extractRawRole = (value) => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return (
    value.roleName ||
    value.roleSlug ||
    value.userType ||
    value.role?.slug ||
    value.role?.name ||
    value.role?.parentRole?.slug ||
    value.role?.parentRole?.name ||
    ""
  );
};

const normalizeRole = (value) => {
  const resolved = resolveUserRoleName(value);
  const raw = extractRawRole(value);
  return normalizeText(resolved || raw || "").trim();
};

const roleMatches = (roles = [], role = "") => {
  const normalizedRole = normalizeRole(role);
  return roles.map(normalizeRole).includes(normalizedRole);
};

const isManagerFeatureRole = (value) => {
  const normalizedRole = normalizeRole(value);
  const rawRole = normalizeText(extractRawRole(value));
  return MANAGER_FEATURE_ROLES.includes(normalizedRole) || MANAGER_FEATURE_ROLES.includes(rawRole);
};

export const getAiChatbotUserRole = (userOrRole) => normalizeRole(userOrRole) || "";

const fillPath = (path = "", { restaurantId, menuItemId } = {}) =>
  String(path || "")
    .replace(":restaurantId", encodeURIComponent(restaurantId || ""))
    .replace(":menuItemId", encodeURIComponent(menuItemId || ""));

const buildFeaturePath = (entry, { restaurantId, menuItemId, query, pathname } = {}) => {
  const path = fillPath(entry.path, { restaurantId, menuItemId });
  if (entry.key === "order-tracking") return getCurrentOrderTrackingPath(pathname) || path;
  if (entry.key !== "search") return path;
  const term = extractSearchTerm(query);
  return term ? `${path}?q=${encodeURIComponent(term)}` : path;
};

const canUseFeature = (entry, role, { restaurantId, pathname } = {}) => {
  if (entry.requiresRestaurantId && !restaurantId) return false;
  if (entry.requiresCurrentOrderTrackingPath && !getCurrentOrderTrackingPath(pathname)) return false;
  if (!role) return !entry.managerOnly && !entry.allowedRoles;
  if (entry.allowedRoles?.length) return roleMatches(entry.allowedRoles, role);
  if (entry.managerOnly) return isManagerFeatureRole(role);
  return true;
};

const pathMatchesEntry = (entry, path, menuItemId) => {
  if (entry.key === "home") return path === "/" || path === "";
  if (entry.key === "contact") return path === "/contact";
  if (entry.key === "search") return path === "/search";
  if (entry.key === "restaurants") return path === "/restaurants";
  if (entry.key === "restaurant-detail") return path.startsWith("/restaurant/") && !path.endsWith("/layout");
  if (entry.key === "restaurant-menu") return path.startsWith("/restaurant/") && !path.endsWith("/layout");
  if (entry.key === "restaurant-reviews") return path.startsWith("/restaurant/") && !path.endsWith("/layout");
  if (entry.key === "restaurant-promotions") return path.startsWith("/restaurant/") && !path.endsWith("/layout");
  if (entry.key === "restaurant-photos") return path.startsWith("/restaurant/") && !path.endsWith("/layout");
  if (entry.key === "reservations") return path.includes("/layout") || path.includes("reservation");
  if (entry.key === "menu") return path.includes("menu") || path.includes("restaurant");
  if (entry.key === "combos") return path.includes("combo");
  if (entry.key === "coupons") return path.includes("coupon") || path.includes("voucher");
  if (entry.key === "wallet") return path.includes("wallet");
  if (entry.key === "notifications") return path.includes("notification");
  if (entry.key === "for-you") return path.includes("for-you");
  if (entry.key === "food-detail") return path.startsWith("/food/") || Boolean(menuItemId);
  if (entry.key === "cart") return path.includes("cart");
  if (entry.key === "checkout") return path.includes("checkout");
  if (entry.key === "orders") return path.includes("order");
  if (entry.key === "order-tracking") return path.startsWith("/track-delivery/");
  if (entry.key === "favorites") return path.includes("favorites");
  if (entry.key === "address-book") return path.includes("address-book");
  if (entry.key === "help-center") return path.includes("help-center");
  if (entry.key === "profile") return path.includes("profile") || path.includes("account");
  if (entry.key === "staff-schedule") return path.startsWith("/staff/schedule") || path.includes("schedule");
  if (entry.key === "manager-dashboard") return path === "/manager" || path === "/manager#dashboard";
  if (entry.key === "manager-personal-info") return path.includes("restaurant-info-management");
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

export const getAiChatbotFeatureMatches = ({
  pathname = "",
  restaurantId = "",
  selectedMenuItem = null,
  userRole = "",
  query = "",
  message = "",
} = {}) => {
  const path = String(pathname || "").toLowerCase();
  const role = normalizeRole(userRole);
  const resolvedQuery = query || message;
  const resolvedRestaurantId = restaurantId || getRestaurantIdFromPath(pathname);
  const menuItemId = selectedMenuItem?.id || selectedMenuItem?.menuItemId || "";
  const helpQuery = isManagerHelpQuery(resolvedQuery);
  const isManagerShell = path === "/manager" || path === "/manager#dashboard";

  if (isManagerShell && !resolvedQuery && isManagerFeatureRole(userRole)) {
    const managerShortcutKeys = ["manager-dashboard", "manager-personal-info", "storage-inventory", "ai-chatbot-manager", "staff-schedule"];
    return managerShortcutKeys
      .map((key) => AI_CHATBOT_FEATURE_MAP.find((entry) => entry.key === key))
      .filter(Boolean)
      .map((entry) => ({ ...entry, path: buildFeaturePath(entry, { restaurantId: resolvedRestaurantId, menuItemId, query: resolvedQuery, pathname }) }))
      .slice(0, 6);
  }

  const accessibleEntries = AI_CHATBOT_FEATURE_MAP.filter((entry) => {
    const deferManagerRoleCheck = !role && entry.managerOnly && queryScoreEntry(entry, resolvedQuery) > 0;
    return deferManagerRoleCheck || canUseFeature(entry, role, { restaurantId: resolvedRestaurantId, pathname });
  });

  return accessibleEntries
    .map((entry) => {
      const queryScore = queryScoreEntry(entry, resolvedQuery);
      const pathScore = pathMatchesEntry(entry, path, menuItemId) ? 5 : 0;
      const managerShellScore = entry.managerOnly && isManagerShell ? 2 : 0;
      const managerHelpScore = entry.managerOnly && helpQuery ? 4 : 0;
      return {
        entry,
        score: queryScore + managerHelpScore + managerShellScore + pathScore,
      };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => ({
      ...entry,
      path: buildFeaturePath(entry, {
        restaurantId: resolvedRestaurantId,
        menuItemId,
        query: resolvedQuery,
        pathname,
      }),
    }))
    .slice(0, 6);
};

export const __aiChatbotFeatureMapTestables = {
  canUseFeature,
  fillPath,
  getRestaurantIdFromPath,
  normalizeRole,
  normalizeText,
  queryScoreEntry,
  pathMatchesEntry,
  MANAGER_FEATURE_ROLES,
  STAFF_OPERATIONAL_ROLES,
};
