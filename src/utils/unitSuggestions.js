const UNIT_SUGGESTIONS = [
  { keywords: ["rice", "gao", "bột", "bot", "flour", "sugar", "duong", "muoi", "salt"], baseUnit: "g" },
  { keywords: ["oil", "dau", "nuoc", "sauce", "sot", "milk", "sua"], baseUnit: "ml" },
  { keywords: ["egg", "trung", "lemon", "chanh", "onion", "hanh"], baseUnit: "piece" },
  { keywords: ["beer", "bia", "cola", "soft drink"], baseUnit: "can" },
];

const UNIT_GROUPS = {
  weight: ["g", "kg"],
  volume: ["ml", "l"],
  count: ["piece", "unit"],
  package: ["pack", "bottle", "can"],
  spoon: ["tbsp", "tsp"],
};

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

export function suggestUnitOptionsByIngredientName(name) {
  const base = suggestBaseUnitByIngredientName(name);

  if (base === "g" || base === "kg") {
    return [...UNIT_GROUPS.weight, ...UNIT_GROUPS.package];
  }
  if (base === "ml" || base === "l") {
    return [...UNIT_GROUPS.volume, ...UNIT_GROUPS.package, ...UNIT_GROUPS.spoon];
  }
  if (base === "piece" || base === "unit") {
    return [...UNIT_GROUPS.count, ...UNIT_GROUPS.package];
  }
  if (base === "can" || base === "bottle" || base === "pack") {
    return [...UNIT_GROUPS.package, ...UNIT_GROUPS.count];
  }

  return [
    ...UNIT_GROUPS.weight,
    ...UNIT_GROUPS.volume,
    ...UNIT_GROUPS.count,
    ...UNIT_GROUPS.package,
  ];
}
