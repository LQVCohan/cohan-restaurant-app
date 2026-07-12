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

export const DEFAULT_PERFORMANCE_LEVEL_THRESHOLDS = Object.freeze({
  excellentMin: 90,
  goodMin: 80,
  averageMin: 65,
  needsAttentionMin: 50,
});

let activePerformanceLevelThresholds = {
  ...DEFAULT_PERFORMANCE_LEVEL_THRESHOLDS,
};

const normalizeThresholds = (value = {}) => {
  const next = {
    ...DEFAULT_PERFORMANCE_LEVEL_THRESHOLDS,
    ...(value || {}),
  };
  const numbers = Object.values(next).map(Number);
  const valid =
    numbers.every(
      (item) => Number.isInteger(item) && item >= 1 && item <= 100,
    ) &&
    Number(next.excellentMin) > Number(next.goodMin) &&
    Number(next.goodMin) > Number(next.averageMin) &&
    Number(next.averageMin) > Number(next.needsAttentionMin);

  if (!valid) return { ...DEFAULT_PERFORMANCE_LEVEL_THRESHOLDS };
  return Object.fromEntries(
    Object.entries(next).map(([key, item]) => [key, Number(item)]),
  );
};

export const setPerformanceLevelThresholds = (value) => {
  activePerformanceLevelThresholds = normalizeThresholds(value);
  return { ...activePerformanceLevelThresholds };
};

export const resetPerformanceLevelThresholds = () =>
  setPerformanceLevelThresholds(DEFAULT_PERFORMANCE_LEVEL_THRESHOLDS);

const PERFORMANCE_SCORE_LEVELS = {
  excellent: {
    label: "Xuất sắc",
    className: "excellent",
    description: "Phù hợp cho ca quan trọng, ca cao điểm hoặc ca cần kinh nghiệm.",
  },
  good: {
    label: "Tốt",
    className: "good",
    description: "Có thể ưu tiên khi xếp lịch vận hành thường ngày.",
  },
  average: {
    label: "Trung bình",
    className: "average",
    description: "Phù hợp với ca thông thường, cần tiếp tục theo dõi.",
  },
  needs_attention: {
    label: "Cần chú ý",
    className: "attention",
    description: "Nên hạn chế xếp ca quan trọng một mình.",
  },
  poor: {
    label: "Kém",
    className: "poor",
    description: "Cần quản lý/HR xem lại trước khi ưu tiên xếp lịch.",
  },
};

const getScoreLevelFallback = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return PERFORMANCE_SCORE_LEVELS.needs_attention;
  if (score >= activePerformanceLevelThresholds.excellentMin) {
    return PERFORMANCE_SCORE_LEVELS.excellent;
  }
  if (score >= activePerformanceLevelThresholds.goodMin) {
    return PERFORMANCE_SCORE_LEVELS.good;
  }
  if (score >= activePerformanceLevelThresholds.averageMin) {
    return PERFORMANCE_SCORE_LEVELS.average;
  }
  if (score >= activePerformanceLevelThresholds.needsAttentionMin) {
    return PERFORMANCE_SCORE_LEVELS.needs_attention;
  }
  return PERFORMANCE_SCORE_LEVELS.poor;
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
installGlobalFormatter("getScoreLevel", getScoreLevelFallback);

export {
  formatPercentFallback as formatPercent,
  scoreTextFallback as scoreText,
  getAvatarColorFallback as getAvatarColor,
  formatDateFallback as formatDate,
  getScoreLevelFallback as getScoreLevel,
};
