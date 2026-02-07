const DEFAULT_CATEGORY_ICON = "🍽️";

const CATEGORY_ICON_RULES = [
  { icon: "🥗", keywords: ["khai vị", "starter", "salad", "gỏi"] },
  {
    icon: "🍜",
    keywords: ["món việt", "việt", "vietnam", "phở", "bún", "hủ tiếu"],
  },
  { icon: "🍚", keywords: ["cơm", "rice", "cháo"] },
  { icon: "🍲", keywords: ["lẩu", "hotpot", "canh", "súp", "soup"] },
  { icon: "🍢", keywords: ["xiên", "skewer", "que nướng"] },
  { icon: "🍖", keywords: ["nướng", "bbq", "thịt nướng", "grill"] },
  { icon: "🥩", keywords: ["bò", "beef", "steak"] },
  { icon: "🍗", keywords: ["gà", "chicken"] },
  { icon: "🍤", keywords: ["tôm", "hải sản", "seafood", "cá", "mực"] },
  { icon: "🍣", keywords: ["sushi", "sashimi", "nhật", "japan"] },
  { icon: "🍱", keywords: ["hàn", "korea", "asia", "á", "set", "cơm hộp"] },
  { icon: "🍝", keywords: ["mì", "pasta", "spaghetti"] },
  { icon: "🍕", keywords: ["pizza"] },
  { icon: "🍔", keywords: ["fast", "burger", "sandwich"] },
  { icon: "🌮", keywords: ["mex", "taco", "burrito"] },
  { icon: "🥖", keywords: ["bánh mì", "bread", "bakery"] },
  { icon: "🧁", keywords: ["tráng miệng", "dessert", "bánh", "ngọt"] },
  { icon: "🍰", keywords: ["cake", "kem"] },
  { icon: "🥤", keywords: ["đồ uống", "uống", "drink", "nước ngọt", "soft"] },
  { icon: "☕", keywords: ["cà phê", "coffee", "trà", "tea"] },
  { icon: "🍹", keywords: ["cocktail", "mocktail", "juice", "sinh tố"] },
  { icon: "🍺", keywords: ["bia", "beer"] },
  { icon: "🍷", keywords: ["rượu", "wine"] },
  { icon: "🌱", keywords: ["chay", "vegan", "healthy", "eat clean"] },
  { icon: "👶", keywords: ["trẻ em", "kids"] },
  { icon: "👨‍👩‍👧‍👦", keywords: ["gia đình", "family", "combo"] },
  { icon: "🔥", keywords: ["đặc biệt", "best seller", "hot", "spicy", "cay"] },
  { icon: "🆕", keywords: ["mới", "new"] },
];

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const hasIconInCategoryName = (name = "") => EMOJI_REGEX.test(String(name));

export const extractIconFromCategoryName = (name = "") => {
  const text = String(name);
  const match = text.match(EMOJI_REGEX);
  return match?.[0] || null;
};

export const mapCategoryIconByName = (name = "", fallbackIcon = DEFAULT_CATEGORY_ICON) => {
  const normalized = normalizeText(name);
  if (!normalized) return fallbackIcon;

  for (const rule of CATEGORY_ICON_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(normalizeText(keyword)))) {
      return rule.icon;
    }
  }

  return fallbackIcon;
};

export const resolveCategoryIcon = (name = "", fallbackIcon = DEFAULT_CATEGORY_ICON) => {
  if (hasIconInCategoryName(name)) {
    return extractIconFromCategoryName(name) || fallbackIcon;
  }

  return mapCategoryIconByName(name, fallbackIcon);
};

export const COMMON_CATEGORY_ICONS = [
  ...new Set([DEFAULT_CATEGORY_ICON, ...CATEGORY_ICON_RULES.map((rule) => rule.icon)]),
];

export default resolveCategoryIcon;
