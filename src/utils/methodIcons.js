// Chuẩn hoá chuỗi tiếng Việt -> key tra cứu
export function normalizeKey(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "") // bỏ khoảng trắng/ký tự đặc biệt
    .trim();
}

// Bảng map icon theo key đã chuẩn hoá
const METHOD_ICON_MAP = {
  // phổ biến
  nuong: "🔥",
  chien: "🍳",
  xao: "🥘",
  luoc: "🍲",
  hap: "🫕",
  om: "🍲",
  kho: "🍛",
  nuongthan: "🔥",
  nuongmuoiot: "🌶️🔥",
  sot: "🧂",
  phoMai: "🧀",

  pho: "🍜",
  cay: "🌶️",
  khongcay: "🚫🌶️",
  itcay: "🫑",
  // english
  grilled: "🔥",
  fried: "🍳",
  stirfried: "🥘",
  boiled: "🍲",
  steamed: "🫕",
  roasted: "🔥",
  baked: "🥐",
  sauce: "🧂",
};

export function getMethodIcon(name) {
  const key = normalizeKey(name);
  return METHOD_ICON_MAP[key] || "🍽️"; // fallback
}
