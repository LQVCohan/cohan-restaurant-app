import { formatContributionScore } from "./performanceFormula";

const toDateInput = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

export const resolvePreviousPeriod = (periodStart, periodEnd) => {
  if (!periodStart || !periodEnd) return null;
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(`${periodEnd}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;

  const isMonthlyView =
    start.getUTCDate() === 1
    && end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
    && start.getUTCFullYear() === end.getUTCFullYear()
    && start.getUTCMonth() === end.getUTCMonth();

  if (isMonthlyView) {
    const prevStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
    const prevEnd = new Date(Date.UTC(prevStart.getUTCFullYear(), prevStart.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { periodStart: toDateInput(prevStart), periodEnd: toDateInput(prevEnd) };
  }

  const durationMs = end.getTime() - start.getTime() + 1;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs + 1);
  return { periodStart: toDateInput(prevStart), periodEnd: toDateInput(prevEnd) };
};

export const buildPreviousSnapshotMap = (previousSnapshots = [], currentPeriodStart) => {
  const currentStartMs = new Date(`${currentPeriodStart}T00:00:00.000Z`).getTime();
  return (previousSnapshots || []).reduce((acc, snapshot) => {
    const employeeId = String(snapshot?.employeeId || "");
    const periodEndMs = new Date(snapshot?.periodEnd || 0).getTime();
    if (!employeeId || Number.isNaN(periodEndMs) || (Number.isFinite(currentStartMs) && periodEndMs >= currentStartMs)) {
      return acc;
    }

    const existing = acc[employeeId];
    const existingEndMs = new Date(existing?.periodEnd || 0).getTime();
    if (!existing || periodEndMs > existingEndMs) acc[employeeId] = snapshot;
    return acc;
  }, {});
};

export const formatTrendDelta = (currentScore, previousScore) => {
  const current = Number(currentScore);
  const previous = Number(previousScore);
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return "Chưa có dữ liệu kỳ trước";
  const delta = Math.round((current - previous) * 100) / 100;
  if (Math.abs(delta) < 0.01) return "Không đổi";
  const absText = formatContributionScore(Math.abs(delta));
  return `${delta > 0 ? "+" : "-"}${absText} điểm so với kỳ trước`;
};

export const resolveTrendDelta = (currentScore, previousScore) => {
  const hasCurrent = currentScore !== null && currentScore !== undefined && currentScore !== "";
  const hasPrevious = previousScore !== null && previousScore !== undefined && previousScore !== "";
  if (!hasCurrent || !hasPrevious) return null;

  const current = Number(currentScore);
  const previous = Number(previousScore);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return Math.round((current - previous) * 100) / 100;
};

export const buildPerformanceOverview = (rows = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const withTrend = safeRows.filter((row) => Number.isFinite(row?.trendDelta));

  return {
    topImproved: withTrend.filter((row) => row.trendDelta > 0).sort((a, b) => b.trendDelta - a.trendDelta).slice(0, 3),
    topDeclined: withTrend.filter((row) => row.trendDelta < 0).sort((a, b) => a.trendDelta - b.trendDelta).slice(0, 3),
    needsAttention: safeRows.filter((row) => {
      const performanceLevel = row?.snapshot?.performanceLevel;
      return performanceLevel === "needs_attention" || performanceLevel === "poor";
    }),
    noPreviousDataCount: safeRows.filter((row) => row?.trendDelta === null).length,
  };
};

export const resolveNeedsAttentionVisibleRows = (rows = [], showAll = false, limit = 5) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : 5;
  if (showAll) return safeRows;
  return safeRows.slice(0, safeLimit);
};
