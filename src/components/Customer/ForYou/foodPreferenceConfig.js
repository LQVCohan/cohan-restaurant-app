export const DIETS = [
  { id: "omni", label: "Tiêu chuẩn", icon: "🍖", desc: "Ăn uống đa dạng" },
  { id: "vegan", label: "Thuần chay", icon: "🥗", desc: "Không thịt, trứng, sữa" },
  { id: "keto", label: "Keto / Low Carb", icon: "🥑", desc: "Ít đường & tinh bột" },
  { id: "halal", label: "Halal", icon: "🕌", desc: "Chuẩn Hồi giáo" },
];

export const ALLERGIES = [
  { id: "seafood", label: "Hải sản vỏ cứng", icon: "🦐" },
  { id: "peanut", label: "Đậu phộng", icon: "🥜" },
  { id: "milk", label: "Sữa / Lactose", icon: "🥛" },
  { id: "egg", label: "Trứng", icon: "🥚" },
  { id: "gluten", label: "Gluten", icon: "🍞" },
];

export const SUGAR_LEVELS = [0, 30, 50, 70, 100];
export const SPICE_LEVELS = ["Không", "Vừa", "Nồng", "Rất cay"];

export const DEFAULT_FOOD_PREFERENCES = {
  diet: "omni",
  allergies: [],
  habits: {
    noOnion: false,
    noCilantro: false,
    sugar: 100,
    spice: "Vừa",
    ice: true,
  },
  autoNote: "",
  updatedAt: null,
};

export function buildFoodPreferenceNote(preferences) {
  const p = normalizeFoodPreferencesFromUser({ foodPreferences: preferences });
  const notes = [];
  if (p.diet !== "omni") {
    const dietLabel = DIETS.find((d) => d.id === p.diet)?.label || p.diet;
    notes.push(`Chế độ ${dietLabel}`);
  }
  if (p.allergies.length > 0) {
    const allergyLabels = p.allergies
      .map((id) => ALLERGIES.find((a) => a.id === id)?.label)
      .filter(Boolean)
      .join(", ");
    if (allergyLabels) notes.push(`Dị ứng: ${allergyLabels}`);
  }
  if (p.habits.noOnion) notes.push("KHÔNG HÀNH");
  if (p.habits.noCilantro) notes.push("KHÔNG NGÒ");
  if (p.habits.sugar !== 100) notes.push(`${p.habits.sugar}% đường`);
  if (p.habits.spice !== "Vừa") notes.push(`Cay: ${p.habits.spice}`);
  if (!p.habits.ice) notes.push("Không đá");
  return notes.length > 0 ? notes.join(". ") : "Chưa có ghi chú đặc biệt.";
}

export function normalizeFoodPreferencesFromUser(user) {
  const fp = user?.foodPreferences || {};
  const habits = fp.habits || {};
  const diet = DIETS.some((d) => d.id === fp.diet) ? fp.diet : DEFAULT_FOOD_PREFERENCES.diet;
  const allergies = Array.isArray(fp.allergies)
    ? [...new Set(fp.allergies.filter((a) => ALLERGIES.some((item) => item.id === a)))]
    : [];
  const sugar = SUGAR_LEVELS.includes(habits.sugar) ? habits.sugar : DEFAULT_FOOD_PREFERENCES.habits.sugar;
  const spice = SPICE_LEVELS.includes(habits.spice) ? habits.spice : DEFAULT_FOOD_PREFERENCES.habits.spice;

  return {
    diet,
    allergies,
    habits: {
      noOnion: Boolean(habits.noOnion),
      noCilantro: Boolean(habits.noCilantro),
      sugar,
      spice,
      ice: typeof habits.ice === "boolean" ? habits.ice : DEFAULT_FOOD_PREFERENCES.habits.ice,
    },
    autoNote: fp.autoNote || "",
    updatedAt: fp.updatedAt || null,
  };
}
