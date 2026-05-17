export const buildFoodDetailPath = (foodId, options = {}) => {
  if (!foodId) return "";
  const { restaurantId, timeSlot, categoryId } = options;
  const params = new URLSearchParams();
  if (restaurantId) params.set("restaurantId", String(restaurantId));
  if (timeSlot) params.set("timeSlot", String(timeSlot));
  if (categoryId) params.set("categoryId", String(categoryId));
  const query = params.toString();
  return query ? `/food/${foodId}?${query}` : `/food/${foodId}`;
};

export const buildFoodDetailState = (item, options = {}) => {
  const { restaurantId, timeSlot, categoryId, selectedVariantKey } = options;
  return {
    ...(item ? { dish: item } : {}),
    ...(restaurantId ? { restaurantId } : {}),
    ...(timeSlot ? { timeSlot } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(selectedVariantKey ? { selectedVariantKey } : {}),
  };
};
