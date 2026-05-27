const REASON_MAP = {
  diet_match: "Phù hợp chế độ ăn của bạn",
  taste_match: "Phù hợp khẩu vị bạn chọn",
  allergy_warning: "Cần kiểm tra dị ứng trước khi đặt",
  fallback_popular: "Món phổ biến được nhiều khách chọn",
};

const normalizeReason = (reason = "") => {
  const raw = String(reason || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("dị ứng") || raw.includes("allergy")) return REASON_MAP.allergy_warning;
  if (raw.includes("chế độ ăn") || raw.includes("diet")) return REASON_MAP.diet_match;
  if (raw.includes("khẩu vị") || raw.includes("taste")) return REASON_MAP.taste_match;
  if (raw.includes("phổ biến") || raw.includes("popular")) return REASON_MAP.fallback_popular;
  return "";
};

export const getFoodPreferenceDisplayReasons = (foodPreferenceMeta) => {
  if (!foodPreferenceMeta || typeof foodPreferenceMeta !== "object") return [];

  const reasons = [];
  const pushReason = (text) => {
    if (!text || reasons.includes(text) || reasons.length >= 2) return;
    reasons.push(text);
  };

  (foodPreferenceMeta.reasons || []).forEach((reason) => {
    pushReason(normalizeReason(reason));
  });

  if (foodPreferenceMeta.hasAllergyWarning) pushReason(REASON_MAP.allergy_warning);
  if (foodPreferenceMeta.isRecommended) {
    pushReason(REASON_MAP.taste_match);
    pushReason(REASON_MAP.diet_match);
  }

  const isFallbackPopular = !foodPreferenceMeta.isRecommended && !foodPreferenceMeta.hasAllergyWarning;
  if (isFallbackPopular) pushReason(REASON_MAP.fallback_popular);

  return reasons.slice(0, 2);
};
