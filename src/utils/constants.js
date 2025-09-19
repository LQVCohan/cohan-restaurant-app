export const CATEGORIES = {
  appetizer: { key: "appetizer", name: "Khai vị", emoji: "🥗", icon: "🥗" },
  main: { key: "main", name: "Món chính", emoji: "🍖", icon: "🍜" },
  dessert: { key: "dessert", name: "Tráng miệng", emoji: "🍰", icon: "🍮" },
  beverage: { key: "beverage", name: "Đồ uống", emoji: "🥤", icon: "☕" },
};

export const STATUSES = {
  available: { key: "available", name: "Có sẵn", color: "success" },
  unavailable: { key: "unavailable", name: "Hết món", color: "danger" },
  limited: { key: "limited", name: "Có hạn", color: "warning" },
  stock: { key: "stock", name: "Tồn kho", color: "info" },
};

export const VIEW_MODES = {
  GRID: "grid",
  LIST: "list",
};

export const PRICE_ADJUSTMENT_TYPES = {
  PERCENT: "percent",
  AMOUNT: "amount",
};

export const PRICE_DIRECTIONS = {
  INCREASE: "increase",
  DECREASE: "decrease",
};

export const FOODHUB_DESIGN_TOKENS = {
  colors: {
    primary: "#0284c7",
    primaryHover: "#0369a1",
    primaryLight: "#f0f9ff",
    text: "#0c4a6e",
    gray: "#6b7280",
    background: "#f1f5f9",
    border: "#e2e8f0",
    white: "#ffffff",
  },
  spacing: ["0.25rem", "0.5rem", "1rem", "1.5rem", "2rem"],
  borderRadius: "1rem",
  shadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  font: "Inter",
};

export const RESTAURANTS = {
  "hcm-center": "🏢 FoodHub Trung Tâm HCM",
  "hcm-district7": "🌆 FoodHub Quận 7",
  "hcm-thuduc": "🏙️ FoodHub Thủ Đức",
  "hanoi-center": "🏛️ FoodHub Trung Tâm Hà Nội",
  "hanoi-caugiay": "🌸 FoodHub Cầu Giấy",
  "danang-center": "🌊 FoodHub Trung Tâm Đà Nẵng",
};

export const PROMOTION_TYPES = {
  percentage: "Giảm %",
  fixed: "Giảm tiền",
  bogo: "Mua 1 tặng 1",
  combo: "Combo",
  freeship: "Miễn ship",
};

export const STATUS_TYPES = {
  active: "Đang hoạt động",
  scheduled: "Đã lên lịch",
  expired: "Đã hết hạn",
  draft: "Bản nháp",
};

export const TARGET_AUDIENCE = {
  all: "Tất cả KH",
  new: "KH mới",
  vip: "KH VIP",
  birthday: "Sinh nhật",
  inactive: "KH cũ",
};
