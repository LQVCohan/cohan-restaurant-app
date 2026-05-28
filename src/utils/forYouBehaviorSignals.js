const MAX_SIGNAL_ITEMS = 60;
export const FOR_YOU_SIGNAL_TTL_DAYS = 30;
const SIGNAL_TTL_MS = FOR_YOU_SIGNAL_TTL_DAYS * 24 * 60 * 60 * 1000;
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
    at: Number(item?.at || 0) || 0,
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

const isRecentSignalItem = (item, now = Date.now()) => {
  const at = Number(item?.at || 0);
  if (!at) return false;
  return now - at <= SIGNAL_TTL_MS;
};

const rebuildCountMaps = ({ viewedItems = [], clickedItems = [] }) => {
  const allItems = [...viewedItems, ...clickedItems];
  return allItems.reduce(
    (acc, item) => {
      const weight = item.type === "order_intent" ? 2 : 1;
      acc.restaurantCounts = increment(acc.restaurantCounts, item.restaurantId, weight);
      acc.categoryCounts = increment(acc.categoryCounts, item.categoryId, weight);
      acc.itemCounts = increment(acc.itemCounts, item.id, weight);
      return acc;
    },
    { restaurantCounts: {}, categoryCounts: {}, itemCounts: {} },
  );
};

const normalizeSignalItems = (items, now = Date.now()) => (Array.isArray(items) ? items : [])
  .map(normalizeStoredItem)
  .filter((item) => item && isRecentSignalItem(item, now))
  .sort((a, b) => Number(b.at || 0) - Number(a.at || 0))
  .slice(0, MAX_SIGNAL_ITEMS);

const normalizeSignals = (signals, now = Date.now()) => {
  if (!signals || typeof signals !== "object") return { ...DEFAULT_SIGNALS };
  const viewedItems = normalizeSignalItems(signals.viewedItems, now);
  const clickedItems = normalizeSignalItems(signals.clickedItems, now);
  const countMaps = rebuildCountMaps({ viewedItems, clickedItems });

  return {
    viewedItems,
    clickedItems,
    ...countMaps,
    updatedAt: signals.updatedAt || null,
  };
};

const hasAnyBehaviorSignal = (signals) => Boolean(
  signals?.viewedItems?.length ||
    signals?.clickedItems?.length ||
    Object.keys(signals?.restaurantCounts || {}).length ||
    Object.keys(signals?.categoryCounts || {}).length ||
    Object.keys(signals?.itemCounts || {}).length,
);

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
    const storageKey = getForYouBehaviorStorageKey(userId);
    const raw = storage.getItem(storageKey);
    if (!raw) return { ...DEFAULT_SIGNALS };
    const nextSignals = normalizeSignals(JSON.parse(raw));
    try {
      if (!hasAnyBehaviorSignal(nextSignals)) {
        storage.removeItem(storageKey);
      } else {
        const nextRaw = JSON.stringify(nextSignals);
        if (nextRaw !== raw) storage.setItem(storageKey, nextRaw);
      }
    } catch {
      // Keep FOR YOU resilient when storage quota or privacy settings block writes.
    }
    return nextSignals;
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

export const hasForYouBehaviorSignals = (signals) => hasAnyBehaviorSignal(normalizeSignals(signals));

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
