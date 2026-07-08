export function computeCartTotalAmount(items = []) {
  return (items || []).reduce(
    (sum, item) =>
      sum +
      ((Number(item?.price) || 0) +
        (Number(item?.modifiersPrice) || 0)) *
        (Number(item?.quantity) || 0),
    0,
  );
}

export function resolveCartRestaurantId(items = []) {
  const ids = [
    ...new Set(
      (items || [])
        .map((item) => item?.restaurantId)
        .filter(Boolean)
        .map((id) => String(id)),
    ),
  ];

  if (ids.length !== 1) return null;
  return (
    (items || []).find((item) => String(item?.restaurantId) === ids[0])
      ?.restaurantId || null
  );
}

export function applyCartDerivedFields(
  cart,
  { now = new Date(), statusWhenEmpty, statusWhenNotEmpty } = {},
) {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  cart.totalAmount = computeCartTotalAmount(items);
  cart.restaurantId = resolveCartRestaurantId(items);
  cart.lastActivityAt = now;

  if (!items.length && statusWhenEmpty) {
    cart.status = statusWhenEmpty;
  } else if (items.length && statusWhenNotEmpty) {
    cart.status = statusWhenNotEmpty;
  }

  return cart;
}
