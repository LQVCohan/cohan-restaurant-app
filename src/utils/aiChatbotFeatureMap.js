export const AI_CHATBOT_FEATURE_MAP = [
  { key: "home", label: "Home", path: "/", intent: "navigation", description: "Trang chủ để khám phá nhà hàng, ưu đãi và lối tắt chính." },
  { key: "restaurant-detail", label: "Restaurant detail", path: "/restaurant/:restaurantId", intent: "navigation", description: "Trang chi tiết nhà hàng, thông tin mở cửa, đánh giá và thực đơn." },
  { key: "menu", label: "Menu", path: "/cus-menu", intent: "menu", description: "Trang menu để lọc món, xem giá và chọn món." },
  { key: "food-detail", label: "Food detail", path: "/food/:menuItemId", intent: "menu", description: "Trang chi tiết món ăn, tùy chọn khẩu phần và thêm vào giỏ." },
  { key: "cart", label: "Cart", path: "/cart", intent: "cart", description: "Giỏ hàng để xem món đã chọn trước khi checkout." },
  { key: "checkout", label: "Checkout", path: "/checkout", intent: "checkout", description: "Trang thanh toán/xác nhận đơn sau khi kiểm tra giỏ hàng." },
  { key: "orders", label: "Orders", path: "/orders", intent: "orderHelp", description: "Trang đơn hàng của người dùng hiện tại." },
  { key: "reservations", label: "Reservations / table booking", path: "/restaurant/:restaurantId/layout", intent: "reservationHelp", description: "Khu vực đặt bàn, xem sơ đồ bàn và lịch giữ chỗ." },
  { key: "profile", label: "Profile/account", path: "/profile", intent: "profileHelp", description: "Trang hồ sơ/tài khoản của người dùng hiện tại." },
  { key: "manager-dashboard", label: "Manager dashboard", path: "/manager", intent: "managerFeatureHelp", description: "Dashboard quản lý vận hành nhà hàng.", managerOnly: true },
  { key: "staff-schedule", label: "Staff/schedule", path: "/manager/staff/schedule", intent: "managerFeatureHelp", description: "Lịch làm việc, ca làm và nhân sự.", managerOnly: true },
  { key: "storage-inventory", label: "Storage/inventory", path: "/manager/storage", intent: "managerFeatureHelp", description: "Kho, tồn nguyên liệu và kiểm kê.", managerOnly: true },
  { key: "ai-chatbot-manager", label: "AI chatbot manager tools", path: "/manager/customer/ai-chatbot", intent: "managerFeatureHelp", description: "Cấu hình tri thức, phân tích và an toàn chatbot.", managerOnly: true },
];

const fillPath = (path, { restaurantId, menuItemId } = {}) =>
  path
    .replace(":restaurantId", encodeURIComponent(restaurantId || ""))
    .replace(":menuItemId", encodeURIComponent(menuItemId || ""));

export const getAiChatbotFeatureMatches = ({ pathname = "", restaurantId = "", selectedMenuItem = null, userRole = "" } = {}) => {
  const path = String(pathname || "").toLowerCase();
  const role = String(userRole || "").toLowerCase();
  const isManager = ["admin", "manager", "hr", "accountant"].includes(role);
  const menuItemId = selectedMenuItem?.id || selectedMenuItem?.menuItemId || "";
  return AI_CHATBOT_FEATURE_MAP
    .filter((entry) => !entry.managerOnly || isManager)
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
      if (entry.managerOnly) return path.includes("manager") || path.includes("dashboard") || path.includes("storage") || path.includes("schedule");
      return false;
    })
    .map((entry) => ({ ...entry, path: fillPath(entry.path, { restaurantId, menuItemId }) }))
    .slice(0, 6);
};
