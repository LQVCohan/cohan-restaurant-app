const REASON_MAP = {
  diet_match: "Phù hợp chế độ ăn của bạn",
  taste_match: "Phù hợp khẩu vị bạn chọn",
  allergy_warning: "Cần kiểm tra dị ứng trước khi đặt",
  fallback_popular: "Món phổ biến được nhiều khách chọn",
  behavior_recent_item: "Dựa trên món bạn đã xem gần đây",
  behavior_restaurant: "Bạn hay xem món từ nhà hàng này",
  behavior_category: "Bạn đã quan tâm món tương tự gần đây",
};

const BEHAVIOR_REASONS = new Set([
  REASON_MAP.behavior_recent_item,
  REASON_MAP.behavior_restaurant,
  REASON_MAP.behavior_category,
]);

const normalizeReason = (reason = "") => {
  const raw = String(reason || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("dị ứng") || raw.includes("allergy")) return REASON_MAP.allergy_warning;
  if (raw.includes("nhà hàng này")) return REASON_MAP.behavior_restaurant;
  if (raw.includes("món tương tự") || raw.includes("quan tâm")) return REASON_MAP.behavior_category;
  if (raw.includes("đã xem gần đây") || raw.includes("gần đây")) return REASON_MAP.behavior_recent_item;
  if (raw.includes("chế độ ăn") || raw.includes("diet")) return REASON_MAP.diet_match;
  if (raw.includes("khẩu vị") || raw.includes("taste")) return REASON_MAP.taste_match;
  if (raw.includes("phổ biến") || raw.includes("popular")) return REASON_MAP.fallback_popular;
  return "";
};

const normalizeReasonList = (reasons) => (Array.isArray(reasons) ? reasons : [])
  .map(normalizeReason)
  .filter(Boolean);

export const getFoodPreferenceDisplayReasons = (foodPreferenceMeta) => {
  if (!foodPreferenceMeta || typeof foodPreferenceMeta !== "object") return [];

  const reasons = [];
  const pushReason = (text) => {
    if (!text || reasons.includes(text) || reasons.length >= 2) return;
    reasons.push(text);
  };

  const metaReasons = normalizeReasonList(foodPreferenceMeta.reasons);
  const behaviorReasons = [
    ...normalizeReasonList(foodPreferenceMeta.behaviorReasons),
    ...metaReasons.filter((reason) => BEHAVIOR_REASONS.has(reason)),
  ];
  const preferenceReasons = metaReasons.filter(
    (reason) => reason !== REASON_MAP.allergy_warning &&
      reason !== REASON_MAP.fallback_popular &&
      !BEHAVIOR_REASONS.has(reason),
  );
  const hasFallbackPopular = metaReasons.includes(REASON_MAP.fallback_popular) ||
    (!foodPreferenceMeta.isRecommended && !foodPreferenceMeta.hasAllergyWarning);

  if (foodPreferenceMeta.hasAllergyWarning || metaReasons.includes(REASON_MAP.allergy_warning)) {
    pushReason(REASON_MAP.allergy_warning);
  }

  behaviorReasons.forEach(pushReason);
  preferenceReasons.forEach(pushReason);

  if (foodPreferenceMeta.isRecommended) {
    pushReason(REASON_MAP.taste_match);
    pushReason(REASON_MAP.diet_match);
  }

  if (hasFallbackPopular) pushReason(REASON_MAP.fallback_popular);

  return reasons.slice(0, 2);
};
