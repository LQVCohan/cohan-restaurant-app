export function normalizeHomeCategoryName(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function aggregateGlobalHomeCategories({
  countRows = [],
  categories = [],
  limit = 6,
} = {}) {
  const countByCategoryId = new Map(
    countRows.map((row) => [String(row?._id), Number(row?.menuItemCount) || 0]),
  );

  const grouped = new Map();
  const orderedCategories = [...categories].sort((a, b) => {
    const orderDiff = Number(a?.order || 0) - Number(b?.order || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });

  for (const category of orderedCategories) {
    const categoryId = String(category?._id || category?.id || "");
    const key = normalizeHomeCategoryName(category?.name);
    const count = countByCategoryId.get(categoryId) || 0;
    if (!categoryId || !key || count <= 0) continue;

    const current = grouped.get(key);
    if (current) {
      current.menuItemCount += count;
      continue;
    }

    grouped.set(key, {
      ...category,
      id: category.id || categoryId,
      _id: category._id || categoryId,
      menuItemCount: count,
    });
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 6, 1), 50);
  return [...grouped.values()]
    .sort((a, b) => {
      const countDiff = Number(b.menuItemCount || 0) - Number(a.menuItemCount || 0);
      if (countDiff !== 0) return countDiff;
      const orderDiff = Number(a.order || 0) - Number(b.order || 0);
      if (orderDiff !== 0) return orderDiff;
      return String(a.name || "").localeCompare(String(b.name || ""), "vi");
    })
    .slice(0, safeLimit);
}
