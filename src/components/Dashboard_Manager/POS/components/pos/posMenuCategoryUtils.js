export const POS_ALL_CATEGORY_KEY = "all";

const toFiniteOrder = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER;
};

export function buildPosCategoryTabs(categories = []) {
  const seen = new Set();
  const rows = (Array.isArray(categories) ? categories : [])
    .filter((category) => {
      const id = category?.id || category?._id;
      const name = String(category?.name || "").trim();
      const count = Number(category?.menuItemCount || 0);
      if (!id || !name || category?.isActive === false || count <= 0) {
        return false;
      }
      const key = String(id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const orderDiff = toFiniteOrder(left?.order) - toFiniteOrder(right?.order);
      if (orderDiff !== 0) return orderDiff;
      return String(left?.name || "").localeCompare(
        String(right?.name || ""),
        "vi",
      );
    })
    .map((category) => ({
      key: String(category.id || category._id),
      label: String(category.name).trim(),
      count: Number(category.menuItemCount || 0),
    }));

  return [{ key: POS_ALL_CATEGORY_KEY, label: "Tất cả" }, ...rows];
}

export function filterPosMenuByCategory(items = [], categoryKey = "all") {
  const source = Array.isArray(items) ? items : [];
  const normalizedKey = String(categoryKey || POS_ALL_CATEGORY_KEY);
  if (normalizedKey === POS_ALL_CATEGORY_KEY) return source;

  return source.filter(
    (item) => String(item?.categoryId || "") === normalizedKey,
  );
}

export function hasPosCategory(categoryTabs = [], categoryKey = "all") {
  const normalizedKey = String(categoryKey || POS_ALL_CATEGORY_KEY);
  return (Array.isArray(categoryTabs) ? categoryTabs : []).some(
    (category) => String(category?.key || "") === normalizedKey,
  );
}
