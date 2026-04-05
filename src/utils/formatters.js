import { formatCurrencyAmount } from "./currency";

export const formatPrice = (price, options = {}) => {
  const currency = options?.currency || "VND";
  return formatCurrencyAmount(price, currency, options);
};
export const formatQuantity = (quantity, unit) => {
  return unit === "kg" ? `${quantity}${unit}` : `${quantity} ${unit}`;
};
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
export const formatNumber = (number, decimals = 1) => {
  return Number(number).toFixed(decimals);
};

export const getSupplyCategoryName = (category) => {
  const categories = {
    beverage: "Đồ uống",
    cleaning: "Vệ sinh",
    packaging: "Đóng gói",
    utensil: "Dụng cụ",
  };
  return categories[category] || category;
};
export const getDisplayPrice = (item) => {
  if (!item.cookingMethods || item.cookingMethods.length === 0) {
    return formatPrice(item.price);
  }

  const prices = item.cookingMethods.map((method) => method.price);
  const uniquePrices = [...new Set(prices)];

  if (uniquePrices.length === 1) {
    return formatPrice(uniquePrices[0]);
  } else {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    return `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;
  }
};

export const getCategoryText = (category) => {
  const categoryMap = {
    appetizer: "Khai vị",
    main: "Món chính",
    dessert: "Tráng miệng",
    beverage: "Đồ uống",
  };
  return categoryMap[category] || category;
};

export const getStatusText = (status) => {
  const statusMap = {
    available: "Có sẵn",
    unavailable: "Hết món",
    limited: "Có hạn",
    stock: "Tồn kho",
  };
  return statusMap[status] || status;
};

export const getCategoryIcon = (category) => {
  const iconMap = {
    appetizer: "🥗",
    main: "🍖",
    dessert: "🍰",
    beverage: "🥤",
  };
  return iconMap[category] || "🍽️";
};

export const getCategoryEmoji = (category) => {
  const emojiMap = {
    appetizer: "🥗",
    main: "🍜",
    dessert: "🍮",
    beverage: "☕",
  };
  return emojiMap[category] || "🍽️";
};
export function formatAddress(addr) {
  if (!addr || typeof addr !== "object") return "";
  const parts = [
    addr.line1,
    addr.line2,
    addr.ward,
    addr.district,
    addr.city,
    addr.country,
  ].filter(Boolean);
  return parts.join(", ");
}

export function safeArray(a) {
  return Array.isArray(a) ? a : [];
}

export function safeNumber(n, fallback = 0) {
  return typeof n === "number" ? n : fallback;
}

export function safeString(s, fallback = "") {
  return typeof s === "string" ? s : fallback;
}
export const getCategoryName = (category) => {
  const categories = {
    meat: "Thịt cá",
    vegetable: "Rau củ",
    spice: "Gia vị",
    dairy: "Sữa & trứng",
    grain: "Ngũ cốc",
  };
  return categories[category] || category;
};
export const formatCurrency = (amount, currency = "VND", options = {}) =>
  formatCurrencyAmount(amount, currency, options);

export const formatDateTime = (date, time) => {
  return `${formatDate(date)} lúc ${time}`;
};
