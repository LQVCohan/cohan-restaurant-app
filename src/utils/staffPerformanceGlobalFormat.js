const formatPercentFallback = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const normalized = Math.abs(number) <= 1 ? number * 100 : number;
  const rounded = Math.round(normalized * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
};

if (typeof globalThis !== "undefined" && typeof globalThis.formatPercent !== "function") {
  Object.defineProperty(globalThis, "formatPercent", {
    value: formatPercentFallback,
    configurable: true,
    writable: true,
  });
}

export { formatPercentFallback as formatPercent };
