const UNIT_SUGGESTIONS = [
  { keywords: ["rice", "gao", "bột", "bot", "flour", "sugar", "duong", "muoi", "salt"], baseUnit: "g" },
  { keywords: ["oil", "dau", "nuoc", "sauce", "sot", "milk", "sua"], baseUnit: "ml" },
  { keywords: ["egg", "trung", "lemon", "chanh", "onion", "hanh"], baseUnit: "piece" },
  { keywords: ["beer", "bia", "cola", "soft drink"], baseUnit: "can" },
];

const normalize = (text) =>
  String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function suggestBaseUnitByIngredientName(name) {
  const normalized = normalize(name);
  if (!normalized) return null;

  for (const item of UNIT_SUGGESTIONS) {
    if (item.keywords.some((kw) => normalized.includes(normalize(kw)))) {
      return item.baseUnit;
    }
  }
  return null;
}
