const VI_BY_EN = {
  meat: "Thịt",
  seafood: "Hải sản",
  vegetable: "Rau củ",
  spice: "Gia vị",
  starch: "Tinh bột",
  grain: "Tinh bột",
  dairy: "Sữa & trứng",
  "dairy & egg": "Sữa & trứng",
  beverage: "Đồ uống",
  other: "Khác",
};

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export function toIngredientCategoryVi(value) {
  const key = normalize(value);
  return VI_BY_EN[key] || value || "Khác";
}
