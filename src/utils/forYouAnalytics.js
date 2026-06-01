const FOR_YOU_ANALYTICS_STORAGE_KEY = "cohan:foryou:analytics:v1";
const MAX_FOR_YOU_ANALYTICS_EVENTS = 120;

export const FOR_YOU_ANALYTICS_EVENTS = Object.freeze({
  VIEW: "for_you_view",
  CARD_CLICK: "for_you_card_click",
  FOOD_DETAIL_VIEW: "for_you_food_detail_view",
  ADD_TO_CART_INTENT: "for_you_add_to_cart_intent",
  CLEAR_RECENT_SIGNALS: "for_you_clear_recent_signals",
  CHECKOUT_WARNING_SEEN: "for_you_checkout_warning_seen",
});

const ALLOWED_EVENTS = new Set(Object.values(FOR_YOU_ANALYTICS_EVENTS));
const ALLOWED_SOURCES = new Set(["for_you", "home_for_you", "food_detail", "checkout"]);
const ALLOWED_REASON_TYPES = new Set(["preference", "allergy_warning", "behavior", "popular"]);
const ALLOWED_PAYLOAD_KEYS = new Set([
  "userId",
  "itemId",
  "restaurantId",
  "categoryId",
  "source",
  "reasonType",
  "timestamp",
]);

const normalizeText = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const getSafeStorage = () => {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.sessionStorage || window.localStorage;
    if (!storage) return null;
    const testKey = "cohan:foryou:analytics:test";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
};

export const sanitizeForYouAnalyticsPayload = (payload = {}) => {
  const source = ALLOWED_SOURCES.has(payload?.source) ? payload.source : "for_you";
  const reasonType = ALLOWED_REASON_TYPES.has(payload?.reasonType)
    ? payload.reasonType
    : undefined;
  const timestamp = Number(payload?.timestamp || Date.now());

  const sanitized = {
    userId: normalizeText(payload?.userId),
    itemId: normalizeText(payload?.itemId || payload?.id || payload?.menuItemId || payload?.dishId),
    restaurantId: normalizeText(payload?.restaurantId),
    categoryId: normalizeText(payload?.categoryId),
    source,
    reasonType,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
  };

  return Object.fromEntries(
    Object.entries(sanitized).filter(
      ([key, value]) => ALLOWED_PAYLOAD_KEYS.has(key) && value !== null && value !== undefined && value !== "",
    ),
  );
};

export const readForYouAnalyticsEvents = () => {
  const storage = getSafeStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(FOR_YOU_ANALYTICS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((event) => ALLOWED_EVENTS.has(event?.event)) : [];
  } catch {
    return [];
  }
};

export const recordForYouAnalyticsEvent = (event, payload = {}) => {
  if (!ALLOWED_EVENTS.has(event)) return null;
  const entry = {
    event,
    payload: sanitizeForYouAnalyticsPayload(payload),
  };

  const storage = getSafeStorage();
  if (storage) {
    try {
      const nextEvents = [...readForYouAnalyticsEvents(), entry].slice(-MAX_FOR_YOU_ANALYTICS_EVENTS);
      storage.setItem(FOR_YOU_ANALYTICS_STORAGE_KEY, JSON.stringify(nextEvents));
    } catch {
      // Analytics must never break the customer flow.
    }
  }

  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    // Dev-safe breadcrumb only; sanitized payload excludes sensitive fields.
    console.debug?.("[for-you-analytics]", entry);
  }

  return entry;
};

export const getForYouAnalyticsSummary = (events = readForYouAnalyticsEvents()) => {
  const safeEvents = Array.isArray(events) ? events : [];
  return safeEvents.reduce(
    (acc, entry) => {
      if (entry?.event === FOR_YOU_ANALYTICS_EVENTS.VIEW) acc.views += 1;
      if (entry?.event === FOR_YOU_ANALYTICS_EVENTS.CARD_CLICK) acc.cardClicks += 1;
      if (entry?.event === FOR_YOU_ANALYTICS_EVENTS.ADD_TO_CART_INTENT) acc.addToCartIntents += 1;
      return acc;
    },
    { views: 0, cardClicks: 0, addToCartIntents: 0 },
  );
};

export const clearForYouAnalyticsEvents = () => {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.removeItem(FOR_YOU_ANALYTICS_STORAGE_KEY);
  } catch {
    // No-op: analytics cleanup must remain best-effort.
  }
};
