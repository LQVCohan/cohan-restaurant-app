const formatPercentFallback = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  const normalized = Math.abs(number) <= 1 ? number * 100 : number;
  const rounded = Math.round(normalized * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
};

const scoreTextFallback = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--/100";
  return `${Math.round(number)}/100`;
};

const installGlobalFormatter = (name, formatter) => {
  if (typeof globalThis === "undefined" || typeof formatter !== "function") return;
  if (typeof globalThis[name] === "function") return;
  Object.defineProperty(globalThis, name, {
    value: formatter,
    configurable: true,
    writable: true,
  });
};

installGlobalFormatter("formatPercent", formatPercentFallback);
installGlobalFormatter("scoreText", scoreTextFallback);

export { formatPercentFallback as formatPercent, scoreTextFallback as scoreText };
