export const resolveMenuTimeSlotAt = (
  value,
  timezone = "Asia/Ho_Chi_Minh",
) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date),
  );
  if (hour >= 5 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 22) return "dinner";
  return "late_night";
};

export const buildFoodDetailPath = (foodId, options = {}) => {
  if (!foodId) return "";
  const { restaurantId, timeSlot, categoryId, serviceAt, returnTo } = options;
  const params = new URLSearchParams();
  if (restaurantId) params.set("restaurantId", String(restaurantId));
  if (timeSlot) params.set("timeSlot", String(timeSlot));
  if (categoryId) params.set("categoryId", String(categoryId));
  if (serviceAt) params.set("serviceAt", String(serviceAt));
  if (returnTo) params.set("returnTo", String(returnTo));
  const query = params.toString();
  return query ? `/food/${foodId}?${query}` : `/food/${foodId}`;
};

export const buildFoodDetailState = (item, options = {}) => {
  const {
    restaurantId,
    timeSlot,
    categoryId,
    selectedVariantKey,
    serviceAt,
    returnTo,
  } = options;
  return {
    ...(item ? { dish: item } : {}),
    ...(restaurantId ? { restaurantId } : {}),
    ...(timeSlot ? { timeSlot } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(selectedVariantKey ? { selectedVariantKey } : {}),
    ...(serviceAt ? { serviceAt } : {}),
    ...(returnTo ? { returnTo } : {}),
  };
};
