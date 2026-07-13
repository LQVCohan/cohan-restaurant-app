export function withRestaurantCategoryIndexId(row, fallback = {}) {
  if (!row) return row;

  const resolvedId =
    row.id ??
    (row._id ? String(row._id) : null) ??
    [fallback.restaurantId ?? row.restaurantId, fallback.timeSlot ?? row.timeSlot]
      .filter(Boolean)
      .map(String)
      .join(":");

  return resolvedId ? { ...row, id: resolvedId } : row;
}
