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

const decodePathPart = (value = "") => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const resolveCustomerPage = (pathname = "") => {
  const path = normalizePathname(pathname);
  const rule = CUSTOMER_PAGE_RULES.find((item) => item.match(path));
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

const isReservationHowToQuestion = (message = "") =>
  /(?:làm sao|lam sao|cách|cach|hướng dẫn|huong dan|muốn|muon|ở đâu|o dau).*(?:đặt bàn|dat ban|giữ chỗ|giu cho|đặt chỗ|dat cho)|(?:đặt bàn|dat ban|giữ chỗ|giu cho|đặt chỗ|dat cho).*(?:thế nào|the nao|làm sao|lam sao|ở đâu|o dau)/i.test(
    String(message || ""),
  );

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
  const response = removeCurrentPageAction(
    await handleCoreRestaurantChatbotMessage(enriched.options),
    enriched.page,
  );
  return applyPageAwareGuidance({
    response,
    options: enriched.options,
    page: enriched.page,
  });
};

export const __testables = {
  ...coreTestables,
  CUSTOMER_PAGE_RULES,
  normalizePathname,
  resolveCustomerPage,
  extractRestaurantIdFromCustomerPath,
  extractMenuItemIdFromCustomerPath,
  buildCurrentPageFeature,
  removeCurrentPageAction,
  enrichPageAwareOptions,
  isHowToQuestion,
  isReservationHowToQuestion,
  buildReservationPageGuidance,
  applyPageAwareGuidance,
  callAiProvider: async (options = {}) => {
    enforceGeminiProviderPolicy();
    return coreTestables.callAiProvider(options);
  },
};