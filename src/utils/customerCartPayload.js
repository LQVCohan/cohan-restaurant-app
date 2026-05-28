export const normalizeCartNote = (value) => String(value || "").trim();

export const buildMenuItemServingOptions = (item) => {
  if (!item) return [];
  const variants = item.servingVariants || [];
  if (!variants.length) {
    return [{ key: "portion", name: "Phần tiêu chuẩn", price: Number(item.basePrice) || 0 }];
  }
  const base = Number(item.basePrice) || 0;
  return variants.map((variant, idx) => ({
    key: variant.key || `variant-${idx}`,
    name: variant.name || `Tùy chọn ${idx + 1}`,
    price: Number(variant.price) || base,
  }));
};

export const buildCustomerCartPayload = ({ item, restaurant, selectedVariant, quantity, note, backendCartId, backendCartItemId, holdExpiresAt, holdStatus }) => ({
  id: `${item.id}_${selectedVariant?.key || "portion"}`,
  dishId: item.id,
  restaurantId: String(item.restaurantId || restaurant?.id || ""),
  menuId: item.menuId || null,
  categoryId: item.categoryId || null,
  variantKey: selectedVariant?.key || "portion",
  servingVariantKey: selectedVariant?.key || "portion",
  name: item.name,
  price: Number(selectedVariant?.price || item.basePrice || 0),
  image: item.thumbImage || "/default-dishes.jpg",
  method: selectedVariant?.name || "Phần tiêu chuẩn",
  quantity,
  restaurantName: restaurant?.name || null,
  backendCartId: backendCartId || null,
  backendCartItemId: backendCartItemId || null,
  holdExpiresAt: holdExpiresAt || null,
  holdStatus: holdStatus || null,
  note: normalizeCartNote(note) || null,
});
