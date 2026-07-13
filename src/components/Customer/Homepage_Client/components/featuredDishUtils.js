import { canCustomerOrderMenuItem } from "../../../../utils/menuItemAvailability";

const VALID_TIME_SLOTS = new Set([
  "breakfast",
  "lunch",
  "dinner",
  "late_night",
]);

export const normalizeFeaturedDishName = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const buildRestaurantNameMap = (publicRestaurants) => {
  const edges = Array.isArray(publicRestaurants?.edges)
    ? publicRestaurants.edges
    : [];
  return new Map(
    edges
      .map((edge) => edge?.node)
      .filter((restaurant) => restaurant?.id && restaurant?.name)
      .map((restaurant) => [String(restaurant.id), restaurant.name]),
  );
};

export const hasSellableFeaturedDishPrice = (dish = {}) => {
  const variants = Array.isArray(dish?.servingVariants)
    ? dish.servingVariants
    : [];
  if (variants.length) {
    return variants.some((variant) => {
      const price = Number(variant?.price);
      return Number.isFinite(price) && price >= 0;
    });
  }

  const basePrice = Number(dish?.basePrice);
  return Number.isFinite(basePrice) && basePrice > 0;
};

export const getFeaturedDishCandidateLimit = (displayLimit = 8) => {
  const safeDisplayLimit = Math.min(Math.max(Number(displayLimit) || 8, 1), 24);
  return Math.min(Math.max(safeDisplayLimit * 4, 24), 64);
};

const enrichDish = (dish, restaurantNameById) => {
  const restaurantId = String(dish?.restaurantId || "");
  return {
    ...dish,
    restaurantName:
      dish?.restaurantName ||
      restaurantNameById.get(restaurantId) ||
      "Nhà hàng",
  };
};

export const selectFeaturedDishes = (
  dishes,
  {
    limit = 8,
    restaurantNameById = new Map(),
    maxPerRestaurant = 2,
  } = {},
) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 24);
  const safePerRestaurant = Math.max(Number(maxPerRestaurant) || 2, 1);
  const candidates = (Array.isArray(dishes) ? dishes : [])
    .filter(
      (dish) =>
        dish?.id &&
        dish?.restaurantId &&
        normalizeFeaturedDishName(dish?.name) &&
        canCustomerOrderMenuItem(dish) &&
        hasSellableFeaturedDishPrice(dish),
    )
    .map((dish) => enrichDish(dish, restaurantNameById));

  const selected = [];
  const selectedIds = new Set();
  const selectedNames = new Set();
  const restaurantCounts = new Map();

  const trySelect = (dish, enforceRestaurantCap) => {
    const id = String(dish.id);
    const restaurantId = String(dish.restaurantId);
    const normalizedName = normalizeFeaturedDishName(dish.name);
    if (selectedIds.has(id) || selectedNames.has(normalizedName)) return;

    const restaurantCount = restaurantCounts.get(restaurantId) || 0;
    if (enforceRestaurantCap && restaurantCount >= safePerRestaurant) return;

    selected.push(dish);
    selectedIds.add(id);
    selectedNames.add(normalizedName);
    restaurantCounts.set(restaurantId, restaurantCount + 1);
  };

  for (const dish of candidates) {
    trySelect(dish, true);
    if (selected.length >= safeLimit) return selected;
  }

  for (const dish of candidates) {
    trySelect(dish, false);
    if (selected.length >= safeLimit) break;
  }

  return selected;
};

export const resolveFeaturedDishRating = (dish = {}) => {
  const rate = Number(dish?.rate);
  if (Number.isFinite(rate) && rate > 0) return rate;

  const point = Number(dish?.point);
  if (Number.isFinite(point) && point > 0) return point;

  return null;
};

export const buildFeaturedMenuPath = (timeSlot) => {
  if (!VALID_TIME_SLOTS.has(String(timeSlot || ""))) return "/cus-menu";
  const params = new URLSearchParams({ timeSlot: String(timeSlot) });
  return `/cus-menu?${params.toString()}`;
};
