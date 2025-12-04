// src/utils/unitConversion.js
export function toBaseQty(displayQty, displayUnit, baseUnit) {
  const q = Number(displayQty) || 0;
  if (!displayUnit || !baseUnit) return q;

  // kg <-> g
  if (baseUnit === "kg") {
    if (displayUnit === "g") return q / 1000; // 100 g -> 0.1 kg
    if (displayUnit === "kg") return q; // đã là kg
  }

  // l <-> ml
  if (baseUnit === "l") {
    if (displayUnit === "ml") return q / 1000; // 100 ml -> 0.1 l
    if (displayUnit === "l") return q;
  }

  // các đơn vị khác: không động vào
  return q;
}

// Dùng khi load từ server lên UI (muốn hiển thị theo g/ml)
export function fromBaseQty(baseQty, displayUnit, baseUnit) {
  const q = Number(baseQty) || 0;
  if (!displayUnit || !baseUnit) return q;

  if (baseUnit === "kg") {
    if (displayUnit === "g") return q * 1000;
    if (displayUnit === "kg") return q;
  }

  if (baseUnit === "l") {
    if (displayUnit === "ml") return q * 1000;
    if (displayUnit === "l") return q;
  }

  return q;
}
