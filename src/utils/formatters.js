export const formatPrice = (price) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
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
