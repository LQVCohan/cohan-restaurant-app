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

const formatDateFallback = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const AVATAR_COLORS = [
  "#536c61",
  "#126d61",
  "#6f8f7a",
  "#8b6f47",
  "#3d6a8c",
  "#8b5f5a",
  "#5f6f8b",
  "#7a6a53",
];

const getAvatarColorFallback = (value = "") => {
  const text = String(value || "Nhân viên").trim();
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
installGlobalFormatter("getAvatarColor", getAvatarColorFallback);
installGlobalFormatter("formatDate", formatDateFallback);

export {
  formatPercentFallback as formatPercent,
  scoreTextFallback as scoreText,
  getAvatarColorFallback as getAvatarColor,
  formatDateFallback as formatDate,
};
