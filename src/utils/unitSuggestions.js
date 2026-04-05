const UNIT_SUGGESTIONS = [
  {
    keywords: ["fish", "ca", "salmon", "tuna", "shrimp", "tom", "muc"],
    baseUnit: "kg",
    options: ["kg", "g", "piece"],
  },
  {
    keywords: ["rice", "gao", "bột", "bot", "flour", "sugar", "duong", "muoi", "salt", "bun", "pho", "noodle"],
    baseUnit: "g",
    options: ["g", "kg", "pack"],
  },
  {
    keywords: ["oil", "dau", "nuoc", "sauce", "sot", "milk", "sua"],
    baseUnit: "ml",
    options: ["ml", "l", "tbsp", "tsp", "bottle"],
  },
  {
    keywords: ["egg", "trung", "lemon", "chanh", "onion", "hanh"],
    baseUnit: "piece",
    options: ["piece", "unit", "pack"],
  },
  {
    keywords: ["beer", "bia", "cola", "soft drink"],
    baseUnit: "can",
    options: ["can", "bottle", "pack"],
  },
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
  const normalized = normalize(name);
  const matched = UNIT_SUGGESTIONS.find((item) =>
    item.keywords.some((kw) => normalized.includes(normalize(kw))),
  );
  if (matched?.options?.length) {
    return matched.options;
  }

  const base = suggestBaseUnitByIngredientName(name);
  if (base === "g" || base === "kg") {
    return [...UNIT_GROUPS.weight, "piece", "pack"];
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
    ...UNIT_GROUPS.count,
    "ml",
    "l",
  ];
}
