const DEFAULT_VARIANT = "default";

const numberValue = (value) => {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
};

const getPopularityScore = (item) => {
  const explicit = numberValue(item?.popularityScore);
  if (explicit) return explicit;
  const rateScore = Math.min(5, Math.max(0, numberValue(item?.rate)));
  const orderCounterScore = Math.min(5, Math.log10(Math.max(0, numberValue(item?.orderCounter)) + 1));
  return rateScore + orderCounterScore;
};

export const getForYouReasonType = (item) => {
  if (item?.foodPreferenceMeta?.hasAllergyWarning) return "allergy_warning";
  if (item?.foodPreferenceMeta?.isRecommended || numberValue(item?.foodPreferenceMeta?.score) > 0) return "preference";
  if (numberValue(item?.orderHistoryScore) > 0 || numberValue(item?.behaviorScore) > 0 || numberValue(item?.foodPreferenceMeta?.behaviorScore) > 0) return "behavior";
  return "popular";
};

export const getForYouRankScore = (item) => {
  if (item?.foodPreferenceMeta?.hasAllergyWarning) return Number.NEGATIVE_INFINITY;
  const preferenceScore = numberValue(item?.foodPreferenceMeta?.score ?? item?.preferenceScore);
  const orderHistoryScore = numberValue(item?.orderHistoryScore);
  const behaviorScore = numberValue(item?.behaviorScore ?? item?.foodPreferenceMeta?.behaviorScore);
  const popularityScore = getPopularityScore(item);
  return preferenceScore * 100 + orderHistoryScore * 20 + behaviorScore * 10 + popularityScore;
};

export const sortForYouItems = (items = [], options = {}) => {
  const rankingVariant = options.rankingVariant || DEFAULT_VARIANT;
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    if (a?.foodPreferenceMeta?.hasAllergyWarning !== b?.foodPreferenceMeta?.hasAllergyWarning) {
      return a?.foodPreferenceMeta?.hasAllergyWarning ? 1 : -1;
    }
    if (rankingVariant === DEFAULT_VARIANT) {
      const preferenceDelta = numberValue(b?.foodPreferenceMeta?.score ?? b?.preferenceScore) - numberValue(a?.foodPreferenceMeta?.score ?? a?.preferenceScore);
      if (preferenceDelta) return preferenceDelta;
      const orderHistoryDelta = numberValue(b?.orderHistoryScore) - numberValue(a?.orderHistoryScore);
      if (orderHistoryDelta) return orderHistoryDelta;
      const behaviorDelta = numberValue(b?.behaviorScore ?? b?.foodPreferenceMeta?.behaviorScore) - numberValue(a?.behaviorScore ?? a?.foodPreferenceMeta?.behaviorScore);
      if (behaviorDelta) return behaviorDelta;
    }
    const rankDelta = getForYouRankScore(b) - getForYouRankScore(a);
    if (rankDelta) return rankDelta;
    if (numberValue(b?.rate) !== numberValue(a?.rate)) return numberValue(b?.rate) - numberValue(a?.rate);
    if (numberValue(b?.orderCounter) !== numberValue(a?.orderCounter)) return numberValue(b?.orderCounter) - numberValue(a?.orderCounter);
    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });
};
