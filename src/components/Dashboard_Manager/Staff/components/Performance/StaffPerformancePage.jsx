import React, { useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardEdit,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  UserRoundCheck,
  X,
} from "lucide-react";
import useStaffPerformance from "../../../../../hooks/useStaffPerformance";
import "./StaffPerformancePage.scss";
import { getPerformanceActionErrorMessage } from "@/utils/payrollPerformanceErrorMessages";

const SCORE_LEVELS = {
  excellent: {
    label: "Xuất sắc",
    className: "excellent",
    description:
      "Phù hợp cho ca quan trọng, ca cao điểm hoặc ca cần kinh nghiệm.",
  },
  good: {
    label: "Tốt",
    className: "good",
    description: "Có thể ưu tiên khi xếp lịch vận hành thường ngày.",
  },
  average: {
    label: "Ổn định",
    className: "average",
    description: "Phù hợp với ca thông thường, cần tiếp tục theo dõi.",
  },
  needs_attention: {
    label: "Cần theo dõi",
    className: "attention",
    description: "Nên hạn chế xếp ca quan trọng một mình.",
  },
  poor: {
    label: "Rủi ro cao",
    className: "poor",
    description: "Cần quản lý/HR xem lại trước khi ưu tiên xếp lịch.",
  },
};

const COMPONENT_META = {
  productivity: {
    label: "Năng suất",
    icon: TrendingUp,
    description:
      "Khối lượng xử lý trong kỳ so với mặt bằng nhân viên cùng nhà hàng.",
  },
  punctuality: {
    label: "Đúng giờ",
    icon: CalendarDays,
    description: "Đi trễ, về sớm, vắng mặt và tổng số phút vi phạm.",
  },
  quality: {
    label: "Chất lượng",
    icon: Award,
    description: "Đánh giá chất lượng phục vụ/vận hành hiện có.",
  },
  managerReview: {
    label: "Đánh giá quản lý",
    icon: ClipboardEdit,
    description:
      "Đánh giá định kỳ từ manager/HR về thái độ, kỹ năng và phối hợp.",
  },
  compliance: {
    label: "Tuân thủ",
    icon: ShieldCheck,
    description: "Mức độ tuân thủ quy trình, ít chỉnh công và ít vi phạm.",
  },
};



export const PERFORMANCE_FORMULA_ITEMS = [
  { key: "productivity", label: "Năng suất", weight: 25 },
  { key: "punctuality", label: "Đúng giờ", weight: 25 },
  { key: "quality", label: "Chất lượng", weight: 20 },
  { key: "managerReview", label: "Đánh giá quản lý", weight: 20 },
  { key: "compliance", label: "Tuân thủ", weight: 10 },
];
const toDateInput = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const getMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    periodStart: toDateInput(start),
    periodEnd: toDateInput(end),
  };
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
};

const getScoreLevel = (score) => {
  const n = Number(score || 0);
  if (n >= 90) return SCORE_LEVELS.excellent;
  if (n >= 80) return SCORE_LEVELS.good;
  if (n >= 65) return SCORE_LEVELS.average;
  if (n >= 50) return SCORE_LEVELS.needs_attention;
  return SCORE_LEVELS.poor;
};

const getAvatarColor = (name = "?") => {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return colors[name.length % colors.length];
};

const scoreText = (value) => `${Math.round(Number(value || 0))}/100`;
const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;
const formatContributionScore = (value) => {
  const n = Number(value || 0);
  return `${Math.round(n * 100) / 100}`;
};
const ADJUSTMENT_TOLERANCE = 0.01;
const GET_STAFF_PERFORMANCE_ADJUSTMENT_HISTORY = gql`
  query StaffPerformanceAdjustmentHistory(
    $adjustmentInput: StaffPerformanceScoreAdjustmentFilterInput!
    $appealFilter: PerformanceIncidentAppealFilterInput!
  ) {
    staffPerformanceScoreAdjustments(input: $adjustmentInput) {
      id
      incidentId
      scoreDelta
      previousScore
      newScore
      reason
      note
      createdAt
    }
    performanceIncidentAppeals(filter: $appealFilter) {
      id
      incidentId
      reason
      status
      scoreReversalId
      scoreReversedAt
      scoreReversalDelta
      scoreReversalNote
      reviewedAt
      createdAt
    }
  }
`;

export const resolveComponentWeight = (component, defaultWeight) => {
  const componentWeight = Number(component?.weight);
  if (Number.isFinite(componentWeight)) return componentWeight;
  return Number(defaultWeight) || 0;
};

export const getWeightedContribution = (score, weight) => {
  const safeScore = Number(score);
  const safeWeight = Number(weight);
  if (!Number.isFinite(safeScore) || !Number.isFinite(safeWeight)) return 0;
  return (safeScore * safeWeight) / 100;
};

export const calculateFormulaScore = (snapshot = {}) =>
  PERFORMANCE_FORMULA_ITEMS.reduce((total, item) => {
    const component = snapshot?.[item.key];
    const componentWeight = resolveComponentWeight(component, item.weight);
    return total + getWeightedContribution(component?.score, componentWeight);
  }, 0);

export const shouldDisplayAdjustment = (delta, tolerance = ADJUSTMENT_TOLERANCE) =>
  Math.abs(Number(delta) || 0) >= tolerance;

export const formatDelta = (value) => {
  const delta = Number(value) || 0;
  const absText = formatContributionScore(Math.abs(delta));
  return `${delta >= 0 ? "+" : "-"}${absText}`;
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

export const resolveEffectivePerformanceRestaurantId = (selectedRestaurant) => {
  if (selectedRestaurant === null || selectedRestaurant === undefined) return null;
  const normalizedValue = String(selectedRestaurant).trim();
  if (!normalizedValue || normalizedValue.toLowerCase() === "all") return null;
  return normalizedValue;
};

export const buildPerformanceOverview = (rows = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const withTrend = safeRows.filter((row) => Number.isFinite(row?.trendDelta));

  return {
    topImproved: withTrend
      .filter((row) => row.trendDelta > 0)
      .sort((a, b) => b.trendDelta - a.trendDelta)
      .slice(0, 3),
    topDeclined: withTrend
      .filter((row) => row.trendDelta < 0)
      .sort((a, b) => a.trendDelta - b.trendDelta)
      .slice(0, 3),
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

export const buildAdjustmentHistoryItems = (adjustments = [], appeals = []) =>
  [
    ...(adjustments || []).map((item) => ({
      id: `adj-${item.id}`,
      type: "incident",
      scoreDelta: Number(item.scoreDelta || 0),
      previousScore: item.previousScore,
      newScore: item.newScore,
      reason: item.reason || item.note || "Incident điều chỉnh điểm",
      createdAt: item.createdAt || null,
    })),
    ...(appeals || [])
      .filter((appeal) => appeal?.status === "accepted" && Number(appeal?.scoreReversalDelta || 0) !== 0)
      .map((appeal) => ({
        id: `apl-${appeal.id}`,
        type: "appeal",
        scoreDelta: Number(appeal.scoreReversalDelta || 0),
        previousScore: null,
        newScore: null,
        reason: appeal.scoreReversalNote || appeal.reason || "Appeal được chấp nhận",
        createdAt: appeal.scoreReversedAt || appeal.reviewedAt || appeal.createdAt || null,
      })),
  ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

const safeFactorNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
export const formatCustomerRating = (factors = {}) => {
  const staffRateCount = safeFactorNumber(factors?.staffRateCount, 0);
  if (staffRateCount <= 0) {
    return {
      hasRating: false,
      label: "Chưa có đánh giá khách hàng",
      hint: "Đánh giá khách hàng không tự động thay đổi điểm hiệu suất. Quản lý có thể dùng thông tin này để cân nhắc khi nhập đánh giá.",
    };
  }

  const staffRate = safeFactorNumber(factors?.staffRate, 0);
  const customerRatingScore = safeFactorNumber(
    factors?.customerRatingScore,
    staffRate * 20,
  );
  const normalizedRate = Math.round(staffRate * 100) / 100;
  const normalizedScore = Math.round(customerRatingScore * 100) / 100;

  return {
    hasRating: true,
    label: `Đánh giá khách hàng: ${normalizedRate}/5 (${staffRateCount} lượt)`,
    hint: `Quy đổi tham khảo: ${normalizedScore}/100`,
  };
};
export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
export const escapeCsvValue = (value) => {
  const normalizedValue = value === null || value === undefined ? "" : String(value);
  const shouldPrefixFormulaGuard =
    typeof value === "string" && /^[=+\-@]/.test(normalizedValue.trimStart());
  const safeValue = shouldPrefixFormulaGuard ? `'${normalizedValue}` : normalizedValue;
  if (!/[",\n\r]/.test(safeValue)) return safeValue;
  return `"${safeValue.replaceAll('"', '""')}"`;
};
const CSV_EMPTY_VALUE = "--";
export const buildPerformanceOverviewCsvBlobContent = (rows = []) =>
  `\uFEFF${buildPerformanceOverviewCsvContent(rows)}`;
export const buildPerformanceOverviewCsvRows = (rows = []) =>
  rows.map((row) => {
    const employee = row?.employee || {};
    const snapshot = row?.snapshot || {};
    const previousSnapshot = row?.previousSnapshot || null;
    const customerRating = formatCustomerRating(snapshot?.factors);
    const customerRatingCount = Number(snapshot?.factors?.staffRateCount);
    const note = customerRating?.hasRating ? "Rating khách hàng chỉ tham khảo" : "";
    return [
      employee.code || snapshot.employeeCode || CSV_EMPTY_VALUE,
      employee.name || snapshot.employeeName || CSV_EMPTY_VALUE,
      employee.role || snapshot.employeeRole || CSV_EMPTY_VALUE,
      row?.score ?? snapshot.finalPerformanceScore ?? CSV_EMPTY_VALUE,
      row?.level?.label || snapshot.performanceLevel || CSV_EMPTY_VALUE,
      previousSnapshot?.finalPerformanceScore ?? CSV_EMPTY_VALUE,
      row?.trendDelta ?? CSV_EMPTY_VALUE,
      previousSnapshot ? "Có" : "Không",
      customerRating?.hasRating ? customerRating.label : CSV_EMPTY_VALUE,
      Number.isFinite(customerRatingCount) ? customerRatingCount : CSV_EMPTY_VALUE,
      note,
    ];
  });
export const buildPerformanceOverviewCsvContent = (rows = []) => {
  const header = [
    "Mã nhân viên",
    "Tên nhân viên",
    "Vai trò",
    "Điểm kỳ này",
    "Mức kỳ này",
    "Điểm kỳ trước",
    "Chênh lệch",
    "Có dữ liệu kỳ trước",
    "Đánh giá khách hàng",
    "Số lượt đánh giá khách hàng",
    "Ghi chú",
  ];
  const csvRows = buildPerformanceOverviewCsvRows(rows);
  return [header, ...csvRows]
    .map((line) => line.map(escapeCsvValue).join(","))
    .join("\n");
};
export const buildPerformanceReportData = ({
  snapshot = {},
  previousSnapshot = null,
  employee = null,
  adjustmentHistory = [],
  restaurantName = "Nhà hàng hiện tại",
} = {}) => {
  const formulaScore = calculateFormulaScore(snapshot);
  const finalPerformanceScore = Number(snapshot?.finalPerformanceScore || 0);
  const adjustmentDelta = finalPerformanceScore - formulaScore;
  const customerRating = formatCustomerRating(snapshot?.factors);
  const employeeName = snapshot?.employeeName || employee?.fullName || employee?.name || "Nhân viên";
  const periodLabel = `${formatDate(snapshot?.periodStart)} - ${formatDate(snapshot?.periodEnd)}`;
  const performanceLevel = getScoreLevel(snapshot?.finalPerformanceScore || 0)?.label || "--";
  const previousScore = Number(previousSnapshot?.finalPerformanceScore);
  const hasPreviousSnapshot = Number.isFinite(previousScore);
  const previousLevel = hasPreviousSnapshot ? getScoreLevel(previousScore)?.label || "--" : "--";
  const formulaBreakdown = PERFORMANCE_FORMULA_ITEMS.map((item) => {
    const component = snapshot?.[item.key];
    const score = Number(component?.score || 0);
    const weight = resolveComponentWeight(component, item.weight);
    return {
      label: item.label,
      score,
      weight,
      contribution: getWeightedContribution(score, weight),
    };
  });
  const hasCustomWeight = formulaBreakdown.some((item, idx) => item.weight !== PERFORMANCE_FORMULA_ITEMS[idx].weight);
  const snapshotUpdatedAt = snapshot?.updatedAt || snapshot?.calculatedAt || null;

  return {
    employeeName,
    periodLabel,
    restaurantName,
    finalPerformanceScore,
    performanceLevel,
    previousScore: hasPreviousSnapshot ? previousScore : null,
    previousLevel,
    trendText: formatTrendDelta(finalPerformanceScore, previousSnapshot?.finalPerformanceScore),
    hasPreviousSnapshot,
    formulaScore,
    adjustmentDelta,
    hasAdjustment: shouldDisplayAdjustment(adjustmentDelta),
    formulaBreakdown,
    hasCustomWeight,
    customerRating,
    snapshotUpdatedAt,
    adjustmentHistory,
  };
};
export const buildPerformanceReportHtml = (reportData) => `
      <html><head><title>Báo cáo hiệu suất - ${escapeHtml(reportData.employeeName)}</title></head><body>
      <h2>Báo cáo hiệu suất nhân viên</h2>
      <p><strong>Tên nhân viên:</strong> ${escapeHtml(reportData.employeeName)}</p>
      <p><strong>Kỳ đánh giá:</strong> ${escapeHtml(reportData.periodLabel)}</p>
      <p><strong>Nhà hàng:</strong> ${escapeHtml(reportData.restaurantName)}</p>
      <p><strong>Điểm cuối:</strong> ${scoreText(reportData.finalPerformanceScore)}</p>
      <p><strong>Xếp loại:</strong> ${escapeHtml(reportData.performanceLevel)}</p>
      <h3>Công thức tính điểm</h3>
      <p>productivity 25% · punctuality 25% · quality 20% · managerReview 20% · compliance 10%</p>
      <p><em>${reportData.hasCustomWeight ? "Dùng weight thực tế từ snapshot." : "Dùng weight mặc định."}</em></p>
      <table border="1" cellspacing="0" cellpadding="6"><tr><th>Thành phần</th><th>Điểm</th><th>Trọng số</th><th>Đóng góp</th></tr>
      ${reportData.formulaBreakdown.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${scoreText(item.score)}</td><td>${formatPercent(item.weight)}</td><td>${formatContributionScore(item.contribution)}</td></tr>`).join("")}
      </table>
      <h3>Tổng hợp điểm</h3>
      <p>Điểm theo công thức: ${formatContributionScore(reportData.formulaScore)}</p>
      <p>Điều chỉnh incident/appeal: ${reportData.hasAdjustment ? `${formatDelta(reportData.adjustmentDelta)} điểm` : "Không có điều chỉnh"}</p>
      <p>Điểm cuối: ${scoreText(reportData.finalPerformanceScore)}</p>
      <h3>So sánh kỳ trước</h3>
      ${reportData.hasPreviousSnapshot ? `
      <p>Điểm kỳ này: ${scoreText(reportData.finalPerformanceScore)}</p>
      <p>Điểm kỳ trước: ${scoreText(reportData.previousScore)}</p>
      <p>Chênh lệch: ${escapeHtml(reportData.trendText)}</p>
      <p>Level kỳ này / kỳ trước: ${escapeHtml(reportData.performanceLevel)} / ${escapeHtml(reportData.previousLevel)}</p>
      ` : "<p>Chưa có dữ liệu kỳ trước.</p>"}
      <h3>Đánh giá khách hàng</h3>
      <p>${escapeHtml(reportData.customerRating.label)}</p>
      ${reportData.customerRating.hasRating ? `<p>${escapeHtml(reportData.customerRating.hint)}</p>` : ""}
      <p><em>Đánh giá khách hàng chỉ là dữ liệu tham khảo cho quản lý.</em></p>
      <p><em>Dữ liệu này được cập nhật vào kỳ đánh giá khi tính lại hiệu suất.</em></p>
      ${reportData.snapshotUpdatedAt ? `<p><em>Snapshot cập nhật lần cuối: ${escapeHtml(formatDate(reportData.snapshotUpdatedAt))}</em></p>` : ""}
      <h3>Lịch sử điều chỉnh điểm</h3>
      ${reportData.adjustmentHistory.length === 0 ? "<p>Không có điều chỉnh điểm.</p>" : `<ul>${reportData.adjustmentHistory.map((item) => `<li>${formatDelta(item.scoreDelta)} điểm · ${escapeHtml(item.reason)} · ${escapeHtml(formatDate(item.createdAt))}${Number.isFinite(Number(item.previousScore)) && Number.isFinite(Number(item.newScore)) ? ` · ${formatContributionScore(item.previousScore)} → ${formatContributionScore(item.newScore)}` : ""}</li>`).join("")}</ul>`}
      </body></html>`;
export const openPerformanceReportPrintWindow = () => {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (printWindow) {
    printWindow.opener = null;
  }
  return printWindow;
};

const buildSnapshotByEmployee = (snapshots = []) =>
  snapshots.reduce((acc, snapshot) => {
    acc[String(snapshot.employeeId)] = snapshot;
    return acc;
  }, {});

const getRestaurantName = (restaurantList, restaurantId) =>
  restaurantList.find((item) => String(item.id) === String(restaurantId))
    ?.name || "Nhà hàng hiện tại";

const ReviewModal = ({
  isOpen,
  employee,
  snapshot,
  restaurantId,
  periodStart,
  periodEnd,
  onClose,
  onSubmit,
  submitting,
}) => {
  const [form, setForm] = useState({
    managerRatingScore: 75,
    attitudeScore: 75,
    teamworkScore: 75,
    skillScore: 75,
    note: "",
  });

  React.useEffect(() => {
    if (!isOpen) return;
    setForm({
      managerRatingScore: 75,
      attitudeScore: 75,
      teamworkScore: 75,
      skillScore: 75,
      note: "",
    });
  }, [isOpen, employee?.id]);

  if (!isOpen || !employee) return null;
  const customerRating = formatCustomerRating(snapshot?.factors);

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === "note" ? value : Number(value),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    await onSubmit({
      employeeId: employee.id,
      restaurantId,
      periodStart: `${periodStart}T00:00:00.000Z`,
      periodEnd: `${periodEnd}T23:59:59.999Z`,
      managerRatingScore: Number(form.managerRatingScore),
      attitudeScore: Number(form.attitudeScore),
      teamworkScore: Number(form.teamworkScore),
      skillScore: Number(form.skillScore),
      note: form.note.trim(),
    });
  };

  return (
    <div className="performance-modal-overlay" onMouseDown={onClose}>
      <div
        className="performance-review-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>Đánh giá hiệu suất quản lý</h3>
            <p>
              {employee.name} · {formatDate(periodStart)} -{" "}
              {formatDate(periodEnd)}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="review-form" onSubmit={handleSubmit}>
          <div className="factor-box">
            <strong>Tham khảo đánh giá khách hàng</strong>
            <div className="factor-grid">
              <span>{customerRating.label}</span>
              {customerRating.hasRating ? <span>{customerRating.hint}</span> : null}
            </div>
            {!customerRating.hasRating ? <p>{customerRating.hint}</p> : null}
          </div>
          {[
            {
              key: "managerRatingScore",
              label: "Đánh giá tổng quan",
              help: "Mức độ hoàn thành công việc và độ phù hợp vận hành.",
            },
            {
              key: "attitudeScore",
              label: "Thái độ",
              help: "Tinh thần phục vụ, trách nhiệm, thái độ với khách và đồng đội.",
            },
            {
              key: "teamworkScore",
              label: "Phối hợp đội nhóm",
              help: "Khả năng hỗ trợ ca, phối hợp bếp/phục vụ/quầy.",
            },
            {
              key: "skillScore",
              label: "Kỹ năng",
              help: "Kỹ năng chuyên môn theo role: server, cashier, cook, bartender...",
            },
          ].map((field) => (
            <label key={field.key} className="review-score-field">
              <div className="field-copy">
                <strong>{field.label}</strong>
                <span>{field.help}</span>
              </div>
              <div className="field-control">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={form[field.key]}
                  onChange={(event) =>
                    updateField(field.key, event.target.value)
                  }
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form[field.key]}
                  onChange={(event) =>
                    updateField(field.key, event.target.value)
                  }
                />
              </div>
            </label>
          ))}

          <label className="review-note-field">
            <strong>Ghi chú đánh giá</strong>
            <textarea
              value={form.note}
              onChange={(event) => updateField("note", event.target.value)}
              placeholder="VD: Làm tốt ca cao điểm, phối hợp tốt, cần cải thiện tốc độ xử lý..."
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu đánh giá"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PerformanceDetailPanel = ({ snapshot, previousSnapshot, employee, onClose }) => {
  if (!snapshot && !employee) return null;

  const level = getScoreLevel(snapshot?.finalPerformanceScore || 0);
  const previousScore = Number(previousSnapshot?.finalPerformanceScore);
  const hasPreviousSnapshot = Number.isFinite(previousScore);
  const previousLevel = hasPreviousSnapshot ? getScoreLevel(previousScore) : null;
  const customerRating = formatCustomerRating(snapshot?.factors);
  const formulaScore = calculateFormulaScore(snapshot);
  const finalPerformanceScore = Number(snapshot?.finalPerformanceScore || 0);
  const adjustmentDelta = finalPerformanceScore - formulaScore;
  const hasAdjustment = shouldDisplayAdjustment(adjustmentDelta);
  const employeeId = snapshot?.employeeId || employee?.id;
  const restaurantId = snapshot?.restaurantId || employee?.restaurantForStaff;
  const periodStart = snapshot?.periodStart;
  const periodEnd = snapshot?.periodEnd;
  const snapshotUpdatedAt = snapshot?.updatedAt || snapshot?.calculatedAt || null;
  const { data: historyData } = useQuery(GET_STAFF_PERFORMANCE_ADJUSTMENT_HISTORY, {
    skip: !snapshot || !employeeId || !restaurantId || !periodStart || !periodEnd,
    variables: {
      adjustmentInput: { restaurantId, employeeId, fromDate: periodStart, toDate: periodEnd },
      appealFilter: { restaurantId, employeeId, fromDate: periodStart, toDate: periodEnd },
    },
    fetchPolicy: "cache-and-network",
  });
  const adjustmentHistory = useMemo(
    () =>
      buildAdjustmentHistoryItems(
        historyData?.staffPerformanceScoreAdjustments || [],
        historyData?.performanceIncidentAppeals || [],
      ),
    [historyData?.staffPerformanceScoreAdjustments, historyData?.performanceIncidentAppeals],
  );
  const handlePrintReport = () => {
    if (!snapshot) return;
    const reportData = buildPerformanceReportData({
      snapshot,
      previousSnapshot,
      employee,
      adjustmentHistory,
      restaurantName: snapshot?.restaurantName || employee?.restaurantName || "Nhà hàng hiện tại",
    });
    const html = buildPerformanceReportHtml(reportData);
    const printWindow = openPerformanceReportPrintWindow();
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <aside className="performance-detail-panel">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Chi tiết hiệu suất</span>
          <h3>{snapshot?.employeeName || employee?.name || "Nhân viên"}</h3>
          <p>
            {snapshot
              ? `${formatDate(snapshot.periodStart)} - ${formatDate(snapshot.periodEnd)}`
              : "Chưa có snapshot hiệu suất cho kỳ này."}
          </p>
        </div>
        <div className="detail-header-actions">
          {snapshot ? <button type="button" className="print-btn" onClick={handlePrintReport}>Xuất báo cáo</button> : null}
          <button type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      {snapshot ? (
        <>
          <div className={`detail-score-card ${level.className}`}>
            <strong>{scoreText(snapshot.finalPerformanceScore)}</strong>
            <span>{level.label}</span>
            <p>{level.description}</p>
          </div>

          <div className="score-formula-card">
            <strong>So sánh kỳ trước</strong>
            {hasPreviousSnapshot ? (
              <ul>
                <li>
                  <span>Điểm kỳ này</span>
                  <strong>{scoreText(finalPerformanceScore)}</strong>
                </li>
                <li>
                  <span>Điểm kỳ trước</span>
                  <strong>{scoreText(previousScore)}</strong>
                </li>
                <li>
                  <span>Chênh lệch</span>
                  <strong>{formatTrendDelta(finalPerformanceScore, previousScore)}</strong>
                </li>
                <li>
                  <span>Level kỳ này / kỳ trước</span>
                  <strong>{level.label} / {previousLevel?.label || "--"}</strong>
                </li>
              </ul>
            ) : (
              <p>Chưa có dữ liệu kỳ trước.</p>
            )}
          </div>

          <div className="component-list">
            {Object.entries(COMPONENT_META).map(([key, meta]) => {
              const item = snapshot[key];
              const Icon = meta.icon;

              return (
                <div className="component-item" key={key}>
                  <div className="component-title">
                    <Icon size={17} />
                    <div>
                      <strong>{meta.label}</strong>
                      <span>{meta.description}</span>
                    </div>
                  </div>
                  <div className="component-score">
                    <strong>{scoreText(item?.score)}</strong>
                    <span>Tỷ trọng {item?.weight || 0}%</span>
                  </div>
                  {item?.note ? <p>{item.note}</p> : null}
                </div>
              );
            })}
          </div>

          <div className="score-formula-card">
            <strong>Breakdown điểm theo trọng số</strong>
            <ul>
              {PERFORMANCE_FORMULA_ITEMS.map((item) => {
                const component = snapshot?.[item.key];
                const componentScore = component?.score;
                const componentWeight = resolveComponentWeight(component, item.weight);
                const contribution = getWeightedContribution(
                  componentScore,
                  componentWeight,
                );
                return (
                  <li key={item.key}>
                    <span>
                      {item.label}: {scoreText(componentScore)} × {formatPercent(componentWeight)}
                    </span>
                    <strong>{formatContributionScore(contribution)} điểm</strong>
                  </li>
                );
              })}
              <li className="total">
                <span>Điểm theo công thức</span>
                <strong>{formatContributionScore(formulaScore)} điểm</strong>
              </li>
              {hasAdjustment ? (
                <li>
                  <span>Điều chỉnh incident/appeal</span>
                  <strong>{formatDelta(adjustmentDelta)} điểm</strong>
                </li>
              ) : (
                <li>
                  <span>Điều chỉnh incident/appeal</span>
                  <strong>Không có điều chỉnh</strong>
                </li>
              )}
              <li className="total">
                <span>Điểm cuối</span>
                <strong>{scoreText(finalPerformanceScore)}</strong>
              </li>
            </ul>
          </div>

          <div className="factor-box">
            <strong>Dữ liệu đầu vào</strong>
            <div className="factor-grid">
              <span>Order xử lý: {snapshot.factors?.orderCount ?? 0}</span>
              <span>Ca làm: {snapshot.factors?.shiftsCount ?? 0}</span>
              <span>Đi trễ: {snapshot.factors?.lateEvents ?? 0}</span>
              <span>Về sớm: {snapshot.factors?.earlyEvents ?? 0}</span>
              <span>Vắng: {snapshot.factors?.absenceEvents ?? 0}</span>
              <span>Chỉnh công: {snapshot.factors?.correctionsCount ?? 0}</span>
            </div>
            <div className="factor-grid">
              <span>{customerRating.label}</span>
              {customerRating.hasRating ? <span>{customerRating.hint}</span> : null}
            </div>
            <p className="formula-note">
              Đánh giá khách hàng chỉ là dữ liệu tham khảo cho quản lý.
            </p>
            <p className="formula-note">
              Dữ liệu này được cập nhật vào kỳ đánh giá khi tính lại hiệu suất.
            </p>
            {snapshotUpdatedAt ? (
              <p className="formula-note">
                Snapshot cập nhật lần cuối: {formatDate(snapshotUpdatedAt)}
              </p>
            ) : null}
          </div>
          <div className="adjustment-history-card">
            <strong>Lịch sử điều chỉnh điểm</strong>
            {adjustmentHistory.length === 0 ? (
              <p>Không có điều chỉnh điểm.</p>
            ) : (
              <ul>
                {adjustmentHistory.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{formatDelta(item.scoreDelta)} điểm</strong>
                      <span>{item.reason}</span>
                      <small>{formatDate(item.createdAt)}</small>
                    </div>
                    {Number.isFinite(Number(item.previousScore)) && Number.isFinite(Number(item.newScore)) ? (
                      <em>
                        {formatContributionScore(item.previousScore)} → {formatContributionScore(item.newScore)}
                      </em>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="empty-detail">
          Chưa có dữ liệu hiệu suất. Hãy bấm “Tính lại hiệu suất kỳ này” hoặc
          tính riêng nhân viên này.
        </div>
      )}
    </aside>
  );
};

const StaffPerformancePage = ({
  employees = [],
  selectedRestaurant = "all",
  restaurantList = [],
  searchQuery = "",
}) => {
  const defaultRange = useMemo(() => getMonthRange(), []);
  const [periodStart, setPeriodStart] = useState(defaultRange.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultRange.periodEnd);
  const [localSearch, setLocalSearch] = useState(searchQuery || "");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [showAllNeedsAttention, setShowAllNeedsAttention] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [reviewEmployee, setReviewEmployee] = useState(null);

  const effectiveRestaurantId = resolveEffectivePerformanceRestaurantId(selectedRestaurant);
  const hasSpecificRestaurantSelected = Boolean(effectiveRestaurantId);
  const [selectedPreviousSnapshot, setSelectedPreviousSnapshot] = useState(null);

  useEffect(() => {
    if (hasSpecificRestaurantSelected) return;
    setSelectedSnapshot(null);
    setSelectedEmployee(null);
    setSelectedPreviousSnapshot(null);
    setReviewEmployee(null);
  }, [effectiveRestaurantId, hasSpecificRestaurantSelected]);

  const {
    snapshots,
    loading,
    error,
    upsertStaffPerformanceReview,
    recalculateStaffPerformanceSnapshots,
    reviewState,
    recalculateState,
  } = useStaffPerformance({
    restaurantId: effectiveRestaurantId,
    periodStart,
    periodEnd,
    skip: !hasSpecificRestaurantSelected,
  });

  const snapshotByEmployee = useMemo(
    () => buildSnapshotByEmployee(snapshots),
    [snapshots],
  );

  const previousPeriod = useMemo(() => resolvePreviousPeriod(periodStart, periodEnd), [periodEnd, periodStart]);
  const { snapshots: previousSnapshots } = useStaffPerformance({
    restaurantId: previousPeriod ? effectiveRestaurantId : undefined,
    periodStart: previousPeriod?.periodStart,
    periodEnd: previousPeriod?.periodEnd,
    skip: !hasSpecificRestaurantSelected || !previousPeriod,
  });
  const previousSnapshotByEmployee = useMemo(
    () => buildPreviousSnapshotMap(previousSnapshots, periodStart),
    [periodStart, previousSnapshots],
  );

  const rows = useMemo(() => {
    const needle = String(localSearch || "")
      .trim()
      .toLowerCase();

    return employees
      .filter((employee) => {
        if (!needle) return true;
        return (
          String(employee.name || "")
            .toLowerCase()
            .includes(needle) ||
          String(employee.code || "")
            .toLowerCase()
            .includes(needle) ||
          String(employee.role || "")
            .toLowerCase()
            .includes(needle)
        );
      })
      .map((employee) => {
        const snapshot = snapshotByEmployee[String(employee.id)] || null;
        const score = snapshot?.finalPerformanceScore || null;
        const level = snapshot ? getScoreLevel(score) : null;

        const previousSnapshot = previousSnapshotByEmployee[String(employee.id)] || null;
        return {
          employee,
          snapshot,
          previousSnapshot,
          score,
          level,
          trendDelta: resolveTrendDelta(score, previousSnapshot?.finalPerformanceScore),
          trendText: formatTrendDelta(score, previousSnapshot?.finalPerformanceScore),
        };
      })
      .filter((row) => {
        if (selectedLevel === "all") return true;
        if (selectedLevel === "missing") return !row.snapshot;
        return row.snapshot?.performanceLevel === selectedLevel;
      })
      .sort((a, b) => Number(b.score || -1) - Number(a.score || -1));
  }, [employees, localSearch, previousSnapshotByEmployee, selectedLevel, snapshotByEmployee]);

  const stats = useMemo(() => {
    const scoredRows = rows.filter((row) => row.snapshot);
    const avg =
      scoredRows.reduce(
        (sum, row) => sum + Number(row.snapshot.finalPerformanceScore || 0),
        0,
      ) / (scoredRows.length || 1);

    return {
      total: rows.length,
      generated: scoredRows.length,
      averageScore: Math.round(avg),
      excellentOrGood: scoredRows.filter(
        (row) =>
          row.snapshot.performanceLevel === "excellent" ||
          row.snapshot.performanceLevel === "good",
      ).length,
      needsAttention: scoredRows.filter(
        (row) =>
          row.snapshot.performanceLevel === "needs_attention" ||
          row.snapshot.performanceLevel === "poor",
      ).length,
      missing: rows.length - scoredRows.length,
    };
  }, [rows]);

  const overview = useMemo(() => buildPerformanceOverview(rows), [rows]);
  const needsAttentionVisibleRows = useMemo(
    () => resolveNeedsAttentionVisibleRows(overview.needsAttention, showAllNeedsAttention, 5),
    [overview.needsAttention, showAllNeedsAttention],
  );
  const remainingNeedsAttentionCount = Math.max(
    0,
    overview.needsAttention.length - needsAttentionVisibleRows.length,
  );

  const renderOverviewItems = (list, emptyText) => {
    if (!list.length) {
      return <p className="overview-empty">{emptyText}</p>;
    }

    return (
      <ul>
        {list.map((row) => {
          const displayName =
            row.employee?.name || row.snapshot?.employeeName || "Nhân viên";
          const currentScore = Number.isFinite(Number(row.score)) ? scoreText(row.score) : "--";
          const levelLabel = row.level?.label || "Chưa có mức";
          const trendLabel =
            row.trendDelta === null
              ? "Chưa có dữ liệu so sánh kỳ trước"
              : `${row.trendDelta > 0 ? "+" : ""}${formatContributionScore(row.trendDelta)} điểm`;

          const isClickable = Boolean(row.snapshot || row.employee);
          const missingSnapshotHint = row.snapshot
            ? null
            : "Chưa có snapshot kỳ này";

          return (
            <li key={row.employee?.id || `${displayName}-${trendLabel}`}>
              <button
                type="button"
                className="overview-item-button"
                onClick={() => openDetail(row)}
                aria-label={`Xem chi tiết hiệu suất của ${displayName}`}
                disabled={!isClickable}
                title={!isClickable ? missingSnapshotHint : undefined}
              >
                <strong>{displayName}</strong>
                <span>Điểm: {currentScore}</span>
                <span>Chênh lệch: {trendLabel}</span>
                <span>Mức: {levelLabel}</span>
                {!isClickable && missingSnapshotHint ? (
                  <span className="overview-item-hint">{missingSnapshotHint}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const handleRecalculateAll = async () => {
    if (!effectiveRestaurantId) {
      alert("Vui lòng chọn một nhà hàng cụ thể trước khi tính hiệu suất.");
      return;
    }

    const confirmed = window.confirm(
      "Tính lại hiệu suất cho toàn bộ nhân viên trong kỳ này?",
    );
    if (!confirmed) return;

    try {
      await recalculateStaffPerformanceSnapshots({
        variables: {
          input: {
            restaurantId: effectiveRestaurantId,
            periodStart: `${periodStart}T00:00:00.000Z`,
            periodEnd: `${periodEnd}T23:59:59.999Z`,
          },
        },
      });
      alert("Đã tính lại hiệu suất kỳ này.");
    } catch (err) {
      alert(getPerformanceActionErrorMessage(err, `Không thể tính hiệu suất: ${err.message}`));
    }
  };

  const handleRecalculateOne = async (employee) => {
    if (!effectiveRestaurantId || !employee?.id) return;

    try {
      await recalculateStaffPerformanceSnapshots({
        variables: {
          input: {
            restaurantId: effectiveRestaurantId,
            employeeId: employee.id,
            periodStart: `${periodStart}T00:00:00.000Z`,
            periodEnd: `${periodEnd}T23:59:59.999Z`,
          },
        },
      });
    } catch (err) {
      alert(getPerformanceActionErrorMessage(err, `Không thể tính hiệu suất nhân viên: ${err.message}`));
    }
  };

  const handleSubmitReview = async (input) => {
    if (!effectiveRestaurantId) return;
    try {
      await upsertStaffPerformanceReview({ variables: { input } });

      await recalculateStaffPerformanceSnapshots({
        variables: {
          input: {
            restaurantId: input.restaurantId,
            employeeId: input.employeeId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
          },
        },
      });

      setReviewEmployee(null);
      alert("Đã lưu đánh giá và tính lại hiệu suất nhân viên.");
    } catch (err) {
      alert(
        getPerformanceActionErrorMessage(
          err,
          `Không thể lưu đánh giá hiệu suất: ${err?.message || "Lỗi không xác định"}`,
        ),
      );
    }
  };

  const handleExportCsv = () => {
    if (!hasSpecificRestaurantSelected) return;
    const csvContent = buildPerformanceOverviewCsvBlobContent(rows);
    const filename = `staff-performance-overview-${periodStart}-${periodEnd}.csv`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(blobUrl);
  };

  const openDetail = (row) => {
    if (!hasSpecificRestaurantSelected) return;
    setSelectedSnapshot(row.snapshot);
    setSelectedPreviousSnapshot(row.previousSnapshot);
    setSelectedEmployee(row.employee);
  };

  const openReviewModal = (employee) => {
    if (!hasSpecificRestaurantSelected) return;
    setReviewEmployee(employee);
  };

  return (
    <div className="staff-performance-page">
      <section className="performance-hero">
        <div>
          <span className="eyebrow">Staff Performance</span>
          <h2>Hiệu suất nhân viên</h2>
          <p>
            Tổng hợp năng suất, đúng giờ, chất lượng, đánh giá quản lý và tuân
            thủ để phục vụ xếp lịch, đánh giá nội bộ và quản trị nhân sự.
          </p>
        </div>

        <div className="hero-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setPeriodStart(defaultRange.periodStart);
              setPeriodEnd(defaultRange.periodEnd);
            }}
          >
            Kỳ hiện tại
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportCsv}
            disabled={!hasSpecificRestaurantSelected}
          >
            Xuất CSV
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleRecalculateAll}
            disabled={recalculateState.loading || !effectiveRestaurantId}
          >
            <RefreshCw size={16} />
            {recalculateState.loading
              ? "Đang tính..."
              : "Tính lại hiệu suất kỳ này"}
          </button>
        </div>
      </section>

      <details className="performance-formula-panel">
        <summary>Cách tính điểm hiệu suất</summary>
        <p>Điểm hiệu suất = tổng điểm thành phần theo trọng số:</p>
        <ul>
          {PERFORMANCE_FORMULA_ITEMS.map((item) => (
            <li key={item.key}>
              {item.label}: {formatPercent(item.weight)}
            </li>
          ))}
        </ul>
        <pre>{`finalScore =
productivity * 25%
+ punctuality * 25%
+ quality * 20%
+ managerReview * 20%
+ compliance * 10%`}</pre>
        <p className="formula-note">
          Đánh giá khách hàng không tự động thay đổi điểm hiệu suất. Quản lý có
          thể dùng thông tin này để cân nhắc khi nhập đánh giá.
        </p>
      </details>

      <section className="performance-controls">
        <div className="control-group">
          <label>
            Từ ngày
            <input
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
            />
          </label>
          <label>
            Nhà hàng
            <input
              value={
                effectiveRestaurantId
                  ? getRestaurantName(restaurantList, effectiveRestaurantId)
                  : "Chưa chọn nhà hàng"
              }
              readOnly
            />
          </label>
        </div>

        <div className="control-group right">
          <label className="search-control">
            <Search size={16} />
            <input
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              placeholder="Tìm nhân viên, mã NV, vai trò..."
            />
          </label>

          <select
            value={selectedLevel}
            onChange={(event) => setSelectedLevel(event.target.value)}
          >
            <option value="all">Tất cả mức hiệu suất</option>
            <option value="excellent">Xuất sắc</option>
            <option value="good">Tốt</option>
            <option value="average">Ổn định</option>
            <option value="needs_attention">Cần theo dõi</option>
            <option value="poor">Rủi ro cao</option>
            <option value="missing">Chưa có dữ liệu</option>
          </select>
        </div>
      </section>

      <section className="performance-kpis">
        <div className="kpi-card">
          <UserRoundCheck size={20} />
          <div>
            <span>Nhân viên hiển thị</span>
            <strong>{stats.total}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <BarChart3 size={20} />
          <div>
            <span>Đã có snapshot</span>
            <strong>{stats.generated}</strong>
          </div>
        </div>
        <div className="kpi-card good">
          <Star size={20} />
          <div>
            <span>Điểm trung bình</span>
            <strong>{scoreText(stats.averageScore)}</strong>
          </div>
        </div>
        <div className="kpi-card excellent">
          <CheckCircle2 size={20} />
          <div>
            <span>Tốt / Xuất sắc</span>
            <strong>{stats.excellentOrGood}</strong>
          </div>
        </div>
        <div className="kpi-card attention">
          <ShieldCheck size={20} />
          <div>
            <span>Cần theo dõi</span>
            <strong>{stats.needsAttention}</strong>
          </div>
        </div>
      </section>

      {!hasSpecificRestaurantSelected ? (
        <div className="performance-empty-state" role="status">
          Vui lòng chọn một nhà hàng cụ thể để xem hiệu suất nhân viên.
        </div>
      ) : null}

      {hasSpecificRestaurantSelected ? (
      <section className="performance-overview">
        <article className="overview-card">
          <h3>Tăng nhiều nhất</h3>
          {renderOverviewItems(
            overview.topImproved,
            overview.noPreviousDataCount === rows.length && rows.length > 0
              ? "Chưa có dữ liệu so sánh kỳ trước"
              : "Chưa có nhân viên tăng điểm",
          )}
        </article>
        <article className="overview-card">
          <h3>Giảm nhiều nhất</h3>
          {renderOverviewItems(
            overview.topDeclined,
            overview.noPreviousDataCount === rows.length && rows.length > 0
              ? "Chưa có dữ liệu so sánh kỳ trước"
              : "Không có nhân viên giảm điểm",
          )}
        </article>
        <article className="overview-card">
          <h3>Cần chú ý</h3>
          {renderOverviewItems(needsAttentionVisibleRows, "Không có nhân viên cần chú ý")}
          {overview.needsAttention.length > 5 ? (
            <button
              type="button"
              className="overview-toggle"
              onClick={() => setShowAllNeedsAttention((prev) => !prev)}
            >
              {showAllNeedsAttention
                ? "Thu gọn"
                : `Xem thêm ${remainingNeedsAttentionCount} nhân viên`}
            </button>
          ) : null}
        </article>
      </section>
      ) : null}

      {hasSpecificRestaurantSelected && error ? (
        <div className="performance-error">
          Không tải được dữ liệu hiệu suất: {error.message}
        </div>
      ) : null}

      {hasSpecificRestaurantSelected ? (
      <section className="performance-layout">
        <div className="performance-table-card">
          <div className="table-header">
            <div>
              <h3>Bảng hiệu suất kỳ này</h3>
              <p>
                Điểm này là dữ liệu đầu vào cho thuật toán gợi ý nhân viên khi
                xếp lịch.
              </p>
            </div>
            {loading ? <span className="loading-pill">Đang tải...</span> : null}
          </div>

          <div className="performance-table-wrap">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Điểm tổng</th>
                  <th>Mức</th>
                  <th>Năng suất</th>
                  <th>Đúng giờ</th>
                  <th>Quản lý</th>
                  <th>Tuân thủ</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-row">
                      Không có nhân viên phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : null}

                {rows.map((row) => {
                  const { employee, snapshot, level } = row;
                  const displayName =
                    employee.name || snapshot?.employeeName || "Nhân viên";

                  return (
                    <tr
                      key={employee.id}
                      className={!snapshot ? "missing-snapshot" : ""}
                      onClick={() => openDetail(row)}
                    >
                      <td>
                        <div className="employee-cell">
                          <div
                            className="avatar"
                            style={{
                              backgroundImage: employee.avatar
                                ? `url(${employee.avatar})`
                                : "none",
                              backgroundColor: !employee.avatar
                                ? getAvatarColor(displayName)
                                : "transparent",
                            }}
                          >
                            {!employee.avatar && displayName.charAt(0)}
                          </div>
                          <div>
                            <strong>{displayName}</strong>
                            <span>
                              {employee.code || "--"} · {employee.role || "--"}
                            </span>
                            <span className="trend-text">{row.trendText}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        {snapshot ? (
                          <strong className="total-score">
                            {scoreText(snapshot.finalPerformanceScore)}
                          </strong>
                        ) : (
                          <span className="muted">Chưa tính</span>
                        )}
                      </td>

                      <td>
                        {snapshot ? (
                          <span className={`level-badge ${level.className}`}>
                            {level.label}
                          </span>
                        ) : (
                          <span className="level-badge missing">
                            Thiếu dữ liệu
                          </span>
                        )}
                      </td>

                      <td>
                        {snapshot
                          ? scoreText(snapshot.productivity?.score)
                          : "--"}
                      </td>
                      <td>
                        {snapshot
                          ? scoreText(snapshot.punctuality?.score)
                          : "--"}
                      </td>
                      <td>
                        {snapshot
                          ? scoreText(snapshot.managerReview?.score)
                          : "--"}
                      </td>
                      <td>
                        {snapshot
                          ? scoreText(snapshot.compliance?.score)
                          : "--"}
                      </td>

                      <td
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="row-action"
                          onClick={() => openReviewModal(employee)}
                        >
                          Đánh giá
                        </button>
                        <button
                          type="button"
                          className="row-action ghost"
                          onClick={() => handleRecalculateOne(employee)}
                          disabled={recalculateState.loading}
                        >
                          Tính lại
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <PerformanceDetailPanel
          snapshot={selectedSnapshot}
          employee={selectedEmployee}
          previousSnapshot={selectedPreviousSnapshot}
          onClose={() => {
            setSelectedSnapshot(null);
            setSelectedPreviousSnapshot(null);
            setSelectedEmployee(null);
          }}
        />
      </section>
      ) : null}

      <ReviewModal
        isOpen={Boolean(reviewEmployee)}
        employee={reviewEmployee}
        snapshot={snapshotByEmployee[String(reviewEmployee?.id)] || null}
        restaurantId={effectiveRestaurantId}
        periodStart={periodStart}
        periodEnd={periodEnd}
        onClose={() => setReviewEmployee(null)}
        onSubmit={handleSubmitReview}
        submitting={reviewState.loading || recalculateState.loading}
      />
    </div>
  );
};

export default StaffPerformancePage;
