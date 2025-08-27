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
