export const slugify = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const titleCase = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

export const normalizeText = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCategoryAlias = (s) => normalizeText(s).replace(/\s+/g, "_");

const EN_CATEGORY_BY_ALIAS = {
  meat: "Meat",
  thit: "Meat",
  seafood: "Seafood",
  hai_san: "Seafood",
  vegetable: "Vegetable",
  rau_cu: "Vegetable",
  spice: "Spice",
  gia_vi: "Spice",
  starch: "Starch",
  grain: "Starch",
  tinh_bot: "Starch",
  dairy: "Dairy & Egg",
  dairy_egg: "Dairy & Egg",
  sua_trung: "Dairy & Egg",
  beverage: "Beverage",
  do_uong: "Beverage",
  drink: "Beverage",
  tissue: "Tissue & Paper",
  cleaning: "Cleaning",
  disposable: "Disposable",
  sauce: "Condiments & Packaging",
  condiments_packaging: "Condiments & Packaging",
  other: "Other",
  khac: "Other",
};

const VI_INGREDIENT_CATEGORY_BY_ALIAS = {
  meat: "Thịt",
  thit: "Thịt",
  seafood: "Hải sản",
  hai_san: "Hải sản",
  vegetable: "Rau củ",
  rau_cu: "Rau củ",
  spice: "Gia vị",
  gia_vi: "Gia vị",
  starch: "Tinh bột",
  grain: "Tinh bột",
  tinh_bot: "Tinh bột",
  dairy: "Sữa & trứng",
  dairy_egg: "Sữa & trứng",
  sua_trung: "Sữa & trứng",
  beverage: "Đồ uống",
  do_uong: "Đồ uống",
  drink: "Đồ uống",
  other: "Khác",
  khac: "Khác",
};

export const toEnglishCategoryName = (s) => {
  const alias = normalizeCategoryAlias(s);
  if (EN_CATEGORY_BY_ALIAS[alias]) return EN_CATEGORY_BY_ALIAS[alias];
  return titleCase(normalizeText(s));
};

export const toVietnameseIngredientCategoryName = (s) => {
  const value = String(s || "").trim().replace(/\s+/g, " ");
  const alias = normalizeCategoryAlias(value);
  return VI_INGREDIENT_CATEGORY_BY_ALIAS[alias] || value;
};

export const INGREDIENT_CATEGORY_RULES = [
  { name: "Meat", keywords: ["thit", "bo", "heo", "ga", "vit", "lon", "cuu", "beef", "pork", "chicken", "meat"] },
  { name: "Seafood", keywords: ["hai san", "tom", "ca", "muc", "cua", "ghe", "so", "oc", "shrimp", "fish", "seafood", "salmon"] },
  {
    name: "Vegetable",
    keywords: ["rau", "cu", "qua", "nam", "salad", "cai", "bap cai", "ca rot", "khoai", "hanh", "toi", "rau cu", "vegetable"],
  },
  { name: "Spice", keywords: ["muoi", "duong", "nuoc mam", "tuong", "tieu", "ot", "gung", "sa", "bot", "gia vi", "seasoning", "spice", "sauce"] },
  { name: "Starch", keywords: ["gao", "bun", "pho", "my", "mien", "mi", "bot mi", "flour", "rice", "noodle", "grain"] },
  { name: "Dairy & Egg", keywords: ["sua", "pho mai", "bo", "trung", "yogurt", "milk", "cheese", "butter", "egg"] },
  { name: "Beverage", keywords: ["nuoc", "tra", "cafe", "ca phe", "soda", "juice", "beer", "ruou", "drink"] },
];

export const SUPPLY_CATEGORY_RULES = [
  {
    name: "Beverage",
    keywords: ["nuoc", "coca", "pepsi", "soda", "juice", "drink", "beer", "tra", "cafe", "coffee"],
  },
  {
    name: "Tissue & Paper",
    keywords: ["khan", "giay", "tissue", "napkin", "paper", "lau tay", "toilet paper"],
  },
  {
    name: "Cleaning",
    keywords: ["ve sinh", "lau", "rua", "detergent", "soap", "clean", "bleach", "nuoc rua"],
  },
  {
    name: "Condiments & Packaging",
    keywords: ["tuong", "ot", "mayonnaise", "sauce", "muong", "hop", "pack", "dong goi", "ong hut"],
  },
  {
    name: "Disposable",
    keywords: ["ly", "cup", "dao", "muong", "nia", "fork", "spoon", "knife", "straw", "disposable"],
  },
];

export function classifyCategoryFromName({
  itemName,
  existingCategoryName,
  rules,
  fallbackCategory = "Other",
}) {
  const existingCategory = toEnglishCategoryName(existingCategoryName);
  if (existingCategory) {
    return {
      categoryName: existingCategory,
      reason: "existing_category",
      confidence: 0.96,
      matchedKeyword: null,
    };
  }

  const normalizedName = normalizeText(itemName);
  if (!normalizedName) {
    return {
      categoryName: fallbackCategory,
      reason: "fallback",
      confidence: 0.2,
      matchedKeyword: null,
    };
  }

  for (const rule of rules) {
    const hit = rule.keywords.find((keyword) => {
      const token = normalizeText(keyword);
      return token && normalizedName.includes(token);
    });
    if (hit) {
      return {
        categoryName: toEnglishCategoryName(rule.name),
        reason: "keyword_match",
        confidence: 0.85,
        matchedKeyword: hit,
      };
    }
  }

  return {
    categoryName: fallbackCategory,
    reason: "fallback",
    confidence: 0.4,
    matchedKeyword: null,
  };
}
