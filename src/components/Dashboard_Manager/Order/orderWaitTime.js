const DEFAULT_TIME_THRESHOLDS = {
  warn: 10,
  danger: 20,
  critical: 30,
};

export const minutesSince = (createdAt, now = Date.now()) => {
  if (!createdAt) return 0;
  const d = new Date(createdAt);
  return isNaN(d.getTime())
    ? 0
    : Math.max(0, Math.floor((now - d.getTime()) / 60000));
};

const toPositiveNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

export const normalizeTimeThresholds = (settings) => {
  const warn = toPositiveNumber(settings?.warn, DEFAULT_TIME_THRESHOLDS.warn);
  const dangerRaw = toPositiveNumber(
    settings?.danger,
    DEFAULT_TIME_THRESHOLDS.danger,
  );
  const danger = dangerRaw > warn ? dangerRaw : warn + 5;
  const criticalRaw = toPositiveNumber(
    settings?.critical,
    DEFAULT_TIME_THRESHOLDS.critical,
  );
  const critical = criticalRaw > danger ? criticalRaw : danger + 5;

  return { warn, danger, critical };
};
