const ORDER_HISTORY_SCORE_CAP = 4;
const RECENT_ORDER_DAYS = 90;
const RECENT_ORDER_MS = RECENT_ORDER_DAYS * 24 * 60 * 60 * 1000;

const normalizeId = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const getOrderItemId = (entry) => normalizeId(
  entry?.menuItemId || entry?.itemId || entry?.dishId || entry?.id,
);

export const normalizeForYouOrderHistoryRecords = (records = [], now = Date.now()) => {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      const createdAtMs = new Date(record?.createdAt || record?.orderedAt || 0).getTime();
      const itemId = getOrderItemId(record);
      if (!itemId || !Number.isFinite(createdAtMs) || now - createdAtMs > RECENT_ORDER_MS) return null;
      return {
        itemId,
        restaurantId: normalizeId(record?.restaurantId),
        categoryId: normalizeId(record?.categoryId),
        createdAt: new Date(createdAtMs).toISOString(),
      };
    })
    .filter(Boolean);
};

export const buildForYouOrderHistorySignals = (records = [], now = Date.now()) => {
  const normalizedRecords = normalizeForYouOrderHistoryRecords(records, now);
  return normalizedRecords.reduce(
    (acc, record) => {
      acc.itemIds.add(record.itemId);
      if (record.restaurantId) acc.restaurantIds.add(record.restaurantId);
      if (record.categoryId) acc.categoryIds.add(record.categoryId);
      return acc;
    },
    { records: normalizedRecords, itemIds: new Set(), restaurantIds: new Set(), categoryIds: new Set() },
  );
};

export const getForYouOrderHistoryScore = (item, signals) => {
  if (!item || !signals) return 0;
  const itemId = normalizeId(item?.id || item?.menuItemId || item?.dishId);
  const restaurantId = normalizeId(item?.restaurantId);
  const categoryId = normalizeId(item?.categoryId);
  let score = 0;
  if (itemId && signals.itemIds?.has(itemId)) score += 3;
  if (restaurantId && signals.restaurantIds?.has(restaurantId)) score += 1;
  if (categoryId && signals.categoryIds?.has(categoryId)) score += 1;
  return Math.min(ORDER_HISTORY_SCORE_CAP, score);
};

export const attachForYouOrderHistoryScores = (items = [], orderHistoryRecords = []) => {
  const signals = buildForYouOrderHistorySignals(orderHistoryRecords);
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    orderHistoryScore: getForYouOrderHistoryScore(item, signals),
  }));
};
