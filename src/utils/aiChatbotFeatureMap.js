import {
  STAFF_OPERATIONAL_ROLES,
  STAFF_SHARED_ROLES,
  resolveUserRoleName,
} from "@/utils/frontendRoleAccess";

const MANAGER_FEATURE_ROLES = ["admin", "manager", "hr", "accountant"];
const CUSTOMER_NAV_ROLES = ["customer", "admin", "manager"];

export const AI_CHATBOT_FEATURE_MAP = [
  { key: "home", label: "Home", path: "/", intent: "navigation", description: "Trang chủ để khám phá nhà hàng, ưu đãi và lối tắt chính." },
  { key: "restaurant-detail", label: "Restaurant detail", path: "/restaurant/:restaurantId", intent: "navigation", description: "Trang chi tiết nhà hàng, thông tin mở cửa, đánh giá và thực đơn." },
  { key: "menu", label: "Menu", path: "/cus-menu", intent: "menu", description: "Trang menu để lọc món, xem giá và chọn món." },
  { key: "food-detail", label: "Food detail", path: "/food/:menuItemId", intent: "menu", description: "Trang chi tiết món ăn, tùy chọn khẩu phần và thêm vào giỏ." },
  { key: "cart", label: "Cart", path: "", actionType: "openCart", intent: "cart", description: "Giỏ hàng mở bằng drawer/event trong CustomerLayout, không phải route URL riêng.", allowedRoles: CUSTOMER_NAV_ROLES },
  { key: "checkout", label: "Checkout", path: "/checkout", intent: "checkout", description: "Trang thanh toán/xác nhận đơn sau khi kiểm tra giỏ hàng.", allowedRoles: CUSTOMER_NAV_ROLES },
  { key: "orders", label: "Orders", path: "/orders", intent: "orderHelp", description: "Trang đơn hàng của người dùng hiện tại.", allowedRoles: CUSTOMER_NAV_ROLES },
  { key: "reservations", label: "Reservations / table booking", path: "/restaurant/:restaurantId/layout", intent: "reservationHelp", description: "Khu vực đặt bàn, xem sơ đồ bàn và lịch giữ chỗ." },
  { key: "profile", label: "Profile/account", path: "/profile", intent: "profileHelp", description: "Trang hồ sơ/tài khoản của người dùng hiện tại." },
  { key: "manager-dashboard", label: "Manager dashboard", path: "/manager", intent: "managerFeatureHelp", description: "Dashboard quản lý vận hành nhà hàng.", managerOnly: true, allowedRoles: MANAGER_FEATURE_ROLES },
  { key: "staff-schedule", label: "Staff/schedule", path: "/staff/schedule", intent: "managerFeatureHelp", description: "Lịch làm việc/ca làm của nhân sự trên route staff thực tế.", allowedRoles: STAFF_SHARED_ROLES },
  { key: "storage-inventory", label: "Storage/inventory", path: "/manager#inventory", intent: "managerFeatureHelp", description: "Kho, tồn nguyên liệu và kiểm kê trong ManagerLayout.", managerOnly: true, allowedRoles: ["admin", "manager"] },
  { key: "ai-chatbot-manager", label: "AI chatbot manager tools", path: "/manager#ai-chatbot-knowledge", intent: "managerFeatureHelp", description: "Cấu hình tri thức, phân tích và an toàn chatbot trong ManagerLayout.", managerOnly: true, allowedRoles: MANAGER_FEATURE_ROLES },
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

export const getAiChatbotFeatureMatches = ({ pathname = "", restaurantId = "", selectedMenuItem = null, userRole = "" } = {}) => {
  const path = String(pathname || "").toLowerCase();
  const role = normalizeRole(userRole);
  const menuItemId = selectedMenuItem?.id || selectedMenuItem?.menuItemId || "";
  return AI_CHATBOT_FEATURE_MAP
    .filter((entry) => canUseFeature(entry, role))
    .filter((entry) => {
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
      if (entry.managerOnly) return path.includes("manager") || path.includes("dashboard") || path.includes("storage") || path.includes("inventory") || path.includes("schedule") || path.includes("ai-chatbot");
      return false;
    })
    .map((entry) => ({ ...entry, path: fillPath(entry.path, { restaurantId, menuItemId }) }))
    .slice(0, 6);
};

export const __aiChatbotFeatureMapTestables = {
  canUseFeature,
  fillPath,
  normalizeRole,
  MANAGER_FEATURE_ROLES,
  STAFF_OPERATIONAL_ROLES,
};
