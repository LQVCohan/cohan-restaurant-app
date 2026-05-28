const MAX_SIGNAL_ITEMS = 60;
const BEHAVIOR_SCORE_CAP = 3;
const INTERACTION_TYPES = new Set(["view", "click", "order_intent"]);

const DEFAULT_SIGNALS = Object.freeze({
  viewedItems: [],
  clickedItems: [],
  restaurantCounts: {},
  categoryCounts: {},
  itemCounts: {},
  updatedAt: null,
});

const getSafeStorage = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const testKey = "cohan:foryou:behavior:test";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
};

const normalizeId = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const normalizeCountMap = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.entries(value).reduce((acc, [key, count]) => {
    const normalizedKey = normalizeId(key);
    const normalizedCount = Number(count || 0);
    if (normalizedKey && normalizedCount > 0) acc[normalizedKey] = normalizedCount;
    return acc;
  }, {});
};

const normalizeStoredItem = (item) => {
  const id = normalizeId(item?.id);
  if (!id) return null;
  return {
    id,
    name: String(item?.name || "").trim() || null,
    restaurantId: normalizeId(item?.restaurantId),
    restaurantName: String(item?.restaurantName || "").trim() || null,
    categoryId: normalizeId(item?.categoryId),
    type: INTERACTION_TYPES.has(item?.type) ? item.type : "view",
    at: Number(item?.at || 0) || Date.now(),
  };
};

const normalizeSignals = (signals) => {
  if (!signals || typeof signals !== "object") return { ...DEFAULT_SIGNALS };
  return {
    viewedItems: (Array.isArray(signals.viewedItems) ? signals.viewedItems : [])
      .map(normalizeStoredItem)
      .filter(Boolean)
      .slice(0, MAX_SIGNAL_ITEMS),
    clickedItems: (Array.isArray(signals.clickedItems) ? signals.clickedItems : [])
      .map(normalizeStoredItem)
      .filter(Boolean)
      .slice(0, MAX_SIGNAL_ITEMS),
    restaurantCounts: normalizeCountMap(signals.restaurantCounts),
    categoryCounts: normalizeCountMap(signals.categoryCounts),
    itemCounts: normalizeCountMap(signals.itemCounts),
    updatedAt: signals.updatedAt || null,
  };
};

const increment = (counts, key, amount = 1) => {
  const normalizedKey = normalizeId(key);
  if (!normalizedKey) return counts;
  return {
    ...counts,
    [normalizedKey]: Number(counts?.[normalizedKey] || 0) + amount,
  };
};

const capRecentItems = (items) => items.slice(0, MAX_SIGNAL_ITEMS);

const buildSignalItem = (item, type) => {
  const id = normalizeId(item?.id || item?.dishId || item?.menuItemId);
  if (!id) return null;
  return {
    id,
    name: String(item?.name || "").trim() || null,
    restaurantId: normalizeId(item?.restaurantId),
    restaurantName: String(item?.restaurantName || "").trim() || null,
    categoryId: normalizeId(item?.categoryId),
    type,
    at: Date.now(),
  };
};

export { MAX_SIGNAL_ITEMS };

export const getForYouBehaviorStorageKey = (userId) => `cohan:foryou:behavior:${userId || "guest"}`;

export const readForYouBehaviorSignals = (userId) => {
  const storage = getSafeStorage();
  if (!storage) return { ...DEFAULT_SIGNALS };

  try {
    const raw = storage.getItem(getForYouBehaviorStorageKey(userId));
    if (!raw) return { ...DEFAULT_SIGNALS };
    return normalizeSignals(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SIGNALS };
  }
};

export const clearForYouBehaviorSignals = (userId) => {
  const storage = getSafeStorage();
  if (!storage) return { ...DEFAULT_SIGNALS };

  try {
    storage.removeItem(getForYouBehaviorStorageKey(userId));
  } catch {
    // keep FOR YOU resilient
  }

  return { ...DEFAULT_SIGNALS };
};

export const recordForYouItemInteraction = (userId, item, type = "view") => {
  const interactionType = INTERACTION_TYPES.has(type) ? type : "view";
  const signalItem = buildSignalItem(item, interactionType);
  if (!signalItem) return readForYouBehaviorSignals(userId);

  const storage = getSafeStorage();
  const currentSignals = readForYouBehaviorSignals(userId);
  const weight = interactionType === "order_intent" ? 2 : 1;
  const nextSignals = normalizeSignals({
    ...currentSignals,
    viewedItems: capRecentItems(
      interactionType === "view"
        ? [signalItem, ...currentSignals.viewedItems]
        : currentSignals.viewedItems,
    ),
    clickedItems: capRecentItems(
      interactionType === "click" || interactionType === "order_intent"
        ? [signalItem, ...currentSignals.clickedItems]
        : currentSignals.clickedItems,
    ),
    restaurantCounts: increment(currentSignals.restaurantCounts, signalItem.restaurantId, weight),
    categoryCounts: increment(currentSignals.categoryCounts, signalItem.categoryId, weight),
    itemCounts: increment(currentSignals.itemCounts, signalItem.id, weight),
    updatedAt: new Date().toISOString(),
  });

  if (!storage) return nextSignals;

  try {
    storage.setItem(getForYouBehaviorStorageKey(userId), JSON.stringify(nextSignals));
  } catch {
    // Keep FOR YOU resilient when storage quota or privacy settings block writes.
  }

  return nextSignals;
};

export const hasForYouBehaviorSignals = (signals) => {
  const safeSignals = normalizeSignals(signals);
  return Boolean(
    safeSignals.viewedItems.length ||
      safeSignals.clickedItems.length ||
      Object.keys(safeSignals.restaurantCounts).length ||
      Object.keys(safeSignals.categoryCounts).length ||
      Object.keys(safeSignals.itemCounts).length,
  );
};

export const getForYouBehaviorScore = (item, signals) => {
  const safeSignals = normalizeSignals(signals);
  if (!hasForYouBehaviorSignals(safeSignals)) return 0;

  const itemId = normalizeId(item?.id || item?.dishId || item?.menuItemId);
  const restaurantId = normalizeId(item?.restaurantId);
  const categoryId = normalizeId(item?.categoryId);
  let score = 0;

  const recentInteractions = [...safeSignals.clickedItems, ...safeSignals.viewedItems].slice(0, MAX_SIGNAL_ITEMS);
  if (itemId && recentInteractions.some((entry) => String(entry.id) === itemId)) score += 2;
  if (restaurantId && Number(safeSignals.restaurantCounts[restaurantId] || 0) > 0) score += 1;
  if (categoryId && Number(safeSignals.categoryCounts[categoryId] || 0) > 0) score += 1;

  return Math.min(BEHAVIOR_SCORE_CAP, score);
};

export const getForYouBehaviorReasons = (item, signals) => {
  const safeSignals = normalizeSignals(signals);
  if (!hasForYouBehaviorSignals(safeSignals)) return [];

  const itemId = normalizeId(item?.id || item?.dishId || item?.menuItemId);
  const restaurantId = normalizeId(item?.restaurantId);
  const categoryId = normalizeId(item?.categoryId);
  const recentInteractions = [...safeSignals.clickedItems, ...safeSignals.viewedItems].slice(0, MAX_SIGNAL_ITEMS);
  const reasons = [];

  if (itemId && recentInteractions.some((entry) => String(entry.id) === itemId)) {
    reasons.push("Dựa trên món bạn đã xem gần đây");
  }
  if (restaurantId && Number(safeSignals.restaurantCounts[restaurantId] || 0) > 0) {
    reasons.push("Bạn hay xem món từ nhà hàng này");
  }
  if (categoryId && Number(safeSignals.categoryCounts[categoryId] || 0) > 0) {
    reasons.push("Bạn đã quan tâm món tương tự gần đây");
  }

  return reasons;
};
