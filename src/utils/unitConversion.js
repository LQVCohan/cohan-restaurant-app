// src/utils/unitConversion.js
const DEFAULT_CONVERSIONS = [
  { from: "kg", to: "g", ratio: 1000 },
  { from: "l", to: "ml", ratio: 1000 },
];

const UNIT_ORDER = [
  "g",
  "kg",
  "ml",
  "l",
  "unit",
  "piece",
  "pack",
  "bottle",
  "can",
  "tbsp",
  "tsp",
];

const normalizeUnit = (value) => String(value || "").trim().toLowerCase();

export const roundUnitQuantity = (value, digits = 9) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return Number.NaN;
  const factor = 10 ** digits;
  return Math.round((number + Number.EPSILON) * factor) / factor;
};

const buildConversionGraph = (conversions = []) => {
  const graph = new Map();
  const seen = new Set();

  const addEdge = (fromValue, toValue, ratioValue) => {
    const from = normalizeUnit(fromValue);
    const to = normalizeUnit(toValue);
    const ratio = Number(ratioValue);
    if (!from || !to || from === to || !Number.isFinite(ratio) || ratio <= 0) return;

    const key = `${from}:${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from).push({ to, ratio });
  };

  [...(Array.isArray(conversions) ? conversions : []), ...DEFAULT_CONVERSIONS].forEach(
    (conversion) => {
      const ratio = Number(conversion?.ratio);
      if (!Number.isFinite(ratio) || ratio <= 0) return;
      addEdge(conversion?.from, conversion?.to, ratio);
      addEdge(conversion?.to, conversion?.from, 1 / ratio);
    },
  );

  return graph;
};

export function findUnitMultiplier(fromUnit, toUnit, conversions = []) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!from || !to) return null;
  if (from === to) return 1;

  const graph = buildConversionGraph(conversions);
  const queue = [{ unit: from, multiplier: 1 }];
  const visited = new Set([from]);

  while (queue.length) {
    const current = queue.shift();
    for (const edge of graph.get(current.unit) || []) {
      if (visited.has(edge.to)) continue;
      const multiplier = current.multiplier * edge.ratio;
      if (edge.to === to) return multiplier;
      visited.add(edge.to);
      queue.push({ unit: edge.to, multiplier });
    }
  }

  return null;
}

export function toBaseQty(displayQty, displayUnit, baseUnit, conversions = []) {
  const qty = Number(displayQty);
  if (!Number.isFinite(qty)) return Number.NaN;
  const multiplier = findUnitMultiplier(displayUnit || baseUnit, baseUnit, conversions);
  return multiplier == null ? Number.NaN : roundUnitQuantity(qty * multiplier);
}

export function fromBaseQty(baseQty, displayUnit, baseUnit, conversions = []) {
  const qty = Number(baseQty);
  if (!Number.isFinite(qty)) return Number.NaN;
  const multiplier = findUnitMultiplier(baseUnit, displayUnit || baseUnit, conversions);
  return multiplier == null ? Number.NaN : roundUnitQuantity(qty * multiplier);
}

export function getConvertibleUnits(baseUnit, conversions = []) {
  const base = normalizeUnit(baseUnit);
  if (!base) return [];

  const candidates = new Set([base]);
  [...DEFAULT_CONVERSIONS, ...(Array.isArray(conversions) ? conversions : [])].forEach(
    (conversion) => {
      if (conversion?.from) candidates.add(normalizeUnit(conversion.from));
      if (conversion?.to) candidates.add(normalizeUnit(conversion.to));
    },
  );

  const units = [...candidates].filter(
    (unit) => unit && findUnitMultiplier(unit, base, conversions) != null,
  );

  return units.sort((left, right) => {
    if (left === base) return -1;
    if (right === base) return 1;
    const leftIndex = UNIT_ORDER.indexOf(left);
    const rightIndex = UNIT_ORDER.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

export function calculateStockReceipt({
  qty,
  unit,
  unitPrice,
  baseUnit,
  conversions = [],
}) {
  const quantity = Number(qty);
  const totalValue = Number(unitPrice);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Số lượng nhập phải > 0.");
  }
  if (!Number.isFinite(totalValue) || totalValue <= 0) {
    throw new Error("Giá nhập là bắt buộc và phải > 0.");
  }

  const qtyBase = toBaseQty(quantity, unit || baseUnit, baseUnit, conversions);
  if (!Number.isFinite(qtyBase) || qtyBase <= 0) {
    throw new Error(`Không thể quy đổi từ ${unit || "đơn vị nhập"} về ${baseUnit || "đơn vị gốc"}.`);
  }

  const costPerBaseUnit = totalValue / qtyBase;
  if (!Number.isFinite(costPerBaseUnit) || costPerBaseUnit <= 0) {
    throw new Error("Không thể tính giá theo đơn vị gốc.");
  }

  return {
    qtyBase,
    costPerBaseUnit,
    totalValue,
    baseUnit: normalizeUnit(baseUnit),
  };
}
