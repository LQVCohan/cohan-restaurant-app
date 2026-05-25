const ALLERGY_KEYWORDS = {
  seafood: ["hải sản", "tôm", "cua", "ghẹ", "sò", "ốc", "nghêu", "mực"],
  peanut: ["đậu phộng", "lạc", "bơ đậu phộng", "peanut"],
  milk: ["sữa", "phô mai", "cheese", "lactose", "kem", "bơ"],
  egg: ["trứng", "egg", "mayonnaise", "mayo"],
  gluten: ["gluten", "bột mì", "bánh mì", "mì", "pasta", "bread"],
};

const DIET_POSITIVE_KEYWORDS = {
  vegan: ["chay", "thuần chay", "vegan", "rau", "salad", "đậu hũ", "tofu"],
  keto: ["keto", "low carb", "ít tinh bột", "salad", "protein"],
  halal: ["halal"],
  omni: [],
};

const DIET_NEGATIVE_KEYWORDS = {
  vegan: ["thịt", "bò", "heo", "gà", "cá", "tôm", "cua", "trứng", "sữa", "phô mai"],
  halal: ["heo", "thịt heo", "pork", "rượu", "alcohol"],
  keto: ["cơm", "bún", "phở", "mì", "bánh mì", "khoai", "đường"],
  omni: [],
};

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function buildHaystack(item) {
  const labels = Array.isArray(item?.labels) ? item.labels.join(" ") : "";
  return normalizeText([item?.name, item?.description, labels].filter(Boolean).join(" "));
}

function uniqueMatches(haystack, keywords = []) {
  return [...new Set(keywords.filter((keyword) => haystack.includes(normalizeText(keyword))))];
}

export function analyzeMenuItemForFoodPreferences(item, preferences) {
  const safePreferences = preferences || {};
  const diet = safePreferences?.diet || "omni";
  const allergies = Array.isArray(safePreferences?.allergies) ? safePreferences.allergies : [];
  const haystack = buildHaystack(item);

  let score = 0;
  const reasons = [];

  const matchedAllergies = allergies.filter((allergyId) => {
    const allergyMatches = uniqueMatches(haystack, ALLERGY_KEYWORDS[allergyId] || []);
    return allergyMatches.length > 0;
  });

  const hasAllergyWarning = matchedAllergies.length > 0;
  if (hasAllergyWarning) {
    score -= matchedAllergies.length * 4;
  }

  const positiveMatches = uniqueMatches(haystack, DIET_POSITIVE_KEYWORDS[diet] || []);
  const negativeMatches = uniqueMatches(haystack, DIET_NEGATIVE_KEYWORDS[diet] || []);

  if (positiveMatches.length > 0) {
    score += positiveMatches.length * 2;
    reasons.push(`Khớp khẩu vị: ${positiveMatches.join(", ")}`);
  }

  if (negativeMatches.length > 0) {
    score -= negativeMatches.length * 2;
    reasons.push(`Có thành phần có thể không phù hợp: ${negativeMatches.join(", ")}`);
  }

  score += Math.min(Number(item?.rate || 0), 5) * 0.2;
  score += Math.min(Number(item?.orderCounter || 0), 50) * 0.02;

  const warningReason = hasAllergyWarning
    ? `Món có thể chứa thành phần dị ứng: ${matchedAllergies.join(", ")}. Vui lòng kiểm tra lại với nhà hàng trước khi đặt.`
    : "";

  const isRecommended = score >= 2 && !hasAllergyWarning;

  return {
    score,
    isRecommended,
    hasAllergyWarning,
    matchedAllergies,
    reasons,
    warningReason,
  };
}

export function sortMenuItemsByFoodPreference(items, preferences) {
  return [...(items || [])].sort((a, b) => {
    const metaA = a?.foodPreferenceMeta || analyzeMenuItemForFoodPreferences(a, preferences);
    const metaB = b?.foodPreferenceMeta || analyzeMenuItemForFoodPreferences(b, preferences);

    if (metaA.hasAllergyWarning !== metaB.hasAllergyWarning) {
      return metaA.hasAllergyWarning ? 1 : -1;
    }

    if (metaA.isRecommended !== metaB.isRecommended) {
      return metaA.isRecommended ? -1 : 1;
    }

    if (metaB.score !== metaA.score) {
      return metaB.score - metaA.score;
    }

    if (Number(b?.rate || 0) !== Number(a?.rate || 0)) {
      return Number(b?.rate || 0) - Number(a?.rate || 0);
    }

    if (Number(b?.orderCounter || 0) !== Number(a?.orderCounter || 0)) {
      return Number(b?.orderCounter || 0) - Number(a?.orderCounter || 0);
    }

    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });
}
