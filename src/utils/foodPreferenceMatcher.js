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

const SPICE_LEVELS = ["Không", "Vừa", "Nồng", "Rất cay"];
const SUGAR_LEVELS = [0, 30, 50, 70, 100];

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
const hasMetadataArray = (a) => Array.isArray(a) && a.some((x) => String(x || "").trim());

export function hasMeaningfulFoodPreferences(preferences) {
  const habits = preferences?.habits || {};
  return (
    (preferences?.diet && preferences.diet !== "omni") ||
    (Array.isArray(preferences?.allergies) && preferences.allergies.length > 0) ||
    habits?.noOnion === true ||
    habits?.noCilantro === true ||
    Number(habits?.sugar ?? 100) !== 100 ||
    String(habits?.spice ?? "Vừa") !== "Vừa"
  );
}

export function analyzeMenuItemForFoodPreferences(item, preferences) {
  const safePreferences = preferences || {};
  const diet = safePreferences?.diet || "omni";
  const allergies = Array.isArray(safePreferences?.allergies) ? safePreferences.allergies : [];
  const haystack = buildHaystack(item);
  const reasons = [];
  let preferenceScore = 0;

  const itemAllergenTags = hasMetadataArray(item?.allergenTags) ? [...new Set(item.allergenTags.map((x) => String(x).trim()))] : [];
  const itemDietTags = hasMetadataArray(item?.dietTags) ? [...new Set(item.dietTags.map((x) => String(x).trim()))] : [];
  const hasTasteMetadata = !!item?.tasteProfile;

  let matchedAllergies = [];
  if (itemAllergenTags.length > 0) {
    matchedAllergies = allergies.filter((id) => itemAllergenTags.includes(id));
  } else {
    matchedAllergies = allergies.filter((id) => uniqueMatches(haystack, ALLERGY_KEYWORDS[id] || []).length > 0);
  }

  const hasAllergyWarning = matchedAllergies.length > 0;
  if (hasAllergyWarning) preferenceScore -= matchedAllergies.length * 4;

  let hasPreferenceMatch = false;
  if (diet !== "omni") {
    if (itemDietTags.length > 0) {
      if (itemDietTags.includes(diet)) {
        preferenceScore += 3;
        hasPreferenceMatch = true;
        reasons.push(`Phù hợp chế độ ăn: ${diet}`);
      }
    } else {
      const positiveMatches = uniqueMatches(haystack, DIET_POSITIVE_KEYWORDS[diet] || []);
      const negativeMatches = uniqueMatches(haystack, DIET_NEGATIVE_KEYWORDS[diet] || []);
      if (positiveMatches.length > 0) {
        preferenceScore += positiveMatches.length * 2;
        hasPreferenceMatch = true;
        reasons.push(`Khớp khẩu vị: ${positiveMatches.join(", ")}`);
      }
      if (negativeMatches.length > 0) {
        preferenceScore -= negativeMatches.length * 2;
        reasons.push(`Có thành phần có thể không phù hợp: ${negativeMatches.join(", ")}`);
      }
    }
  }

  if (hasTasteMetadata) {
    const taste = item.tasteProfile || {};
    const userHabits = safePreferences?.habits || {};
    if (userHabits.noOnion && taste.containsOnion) {
      preferenceScore -= 1;
      reasons.push("Có hành - có thể không hợp khẩu vị của bạn");
    }
    if (userHabits.noCilantro && taste.containsCilantro) {
      preferenceScore -= 1;
      reasons.push("Có ngò - có thể không hợp khẩu vị của bạn");
    }
    const userSpiceIdx = Math.max(0, SPICE_LEVELS.indexOf(String(userHabits?.spice || "Vừa")));
    const itemSpiceIdx = Math.max(0, SPICE_LEVELS.indexOf(String(taste.spice || "Vừa")));
    if (itemSpiceIdx > userSpiceIdx) {
      preferenceScore -= 1;
      reasons.push("Mức cay có thể cao hơn khẩu vị của bạn");
    }
    const userSugar = SUGAR_LEVELS.includes(Number(userHabits?.sugar))
      ? Number(userHabits?.sugar)
      : 100;
    const itemSugar = SUGAR_LEVELS.includes(Number(taste.sugar)) ? Number(taste.sugar) : 100;
    if (itemSugar > userSugar) {
      preferenceScore -= 1;
      reasons.push("Mức đường có thể cao hơn khẩu vị của bạn");
    }
  }

  const warningReason = hasAllergyWarning
    ? `Món có thể chứa thành phần dị ứng: ${matchedAllergies.join(", ")}. Vui lòng kiểm tra lại với nhà hàng trước khi đặt.`
    : "";

  const isRecommended = hasMeaningfulFoodPreferences(safePreferences) && hasPreferenceMatch && preferenceScore >= 2 && !hasAllergyWarning;
  return {
    score: preferenceScore,
    isRecommended,
    hasAllergyWarning,
    matchedAllergies,
    reasons,
    warningReason,
    source: itemAllergenTags.length || itemDietTags.length || hasTasteMetadata ? "metadata" : "keyword",
  };
}

export function sortMenuItemsByFoodPreference(items, preferences) {
  if (!hasMeaningfulFoodPreferences(preferences)) return [...(items || [])];
  return [...(items || [])].sort((a, b) => {
    const metaA = a?.foodPreferenceMeta || analyzeMenuItemForFoodPreferences(a, preferences);
    const metaB = b?.foodPreferenceMeta || analyzeMenuItemForFoodPreferences(b, preferences);
    if (metaA.hasAllergyWarning !== metaB.hasAllergyWarning) return metaA.hasAllergyWarning ? 1 : -1;
    if (metaA.isRecommended !== metaB.isRecommended) return metaA.isRecommended ? -1 : 1;
    if (metaB.score !== metaA.score) return metaB.score - metaA.score;
    if (Number(b?.rate || 0) !== Number(a?.rate || 0)) return Number(b?.rate || 0) - Number(a?.rate || 0);
    if (Number(b?.orderCounter || 0) !== Number(a?.orderCounter || 0)) return Number(b?.orderCounter || 0) - Number(a?.orderCounter || 0);
    return String(a?.name || "").localeCompare(String(b?.name || ""), "vi");
  });
}
