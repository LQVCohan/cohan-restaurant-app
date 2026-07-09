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
import {
  PERFORMANCE_FORMULA_ITEMS,
  calculateFormulaScore,
  formatContributionScore,
  getWeightedContribution,
  resolveComponentWeight,
} from "./utils/performanceFormula";
import { formatCustomerRating } from "./utils/performanceCustomerRating";
import {
  buildPerformanceOverview,
  buildPreviousSnapshotMap,
  formatTrendDelta,
  resolveNeedsAttentionVisibleRows,
  resolvePreviousPeriod,
  resolveTrendDelta,
} from "./utils/performanceTrend";
import {
  buildPerformanceOverviewCsvBlobContent,
  buildPerformanceOverviewCsvContent,
  buildPerformanceOverviewCsvRows,
  escapeCsvValue,
} from "./utils/performanceCsv";
import {
  buildPerformanceReportData,
  buildPerformanceReportHtml,
  escapeHtml,
  formatMinutesDuration,
  openPerformanceReportPrintWindow,
} from "./utils/performanceReport";


export {
  PERFORMANCE_FORMULA_ITEMS,
  calculateFormulaScore,
  formatContributionScore,
  getWeightedContribution,
  resolveComponentWeight,
  formatCustomerRating,
  resolvePreviousPeriod,
  buildPreviousSnapshotMap,
  formatTrendDelta,
  resolveTrendDelta,
  buildPerformanceOverview,
  resolveNeedsAttentionVisibleRows,
  escapeCsvValue,
  buildPerformanceOverviewCsvRows,
  buildPerformanceOverviewCsvContent,
  buildPerformanceOverviewCsvBlobContent,
  escapeHtml,
  formatMinutesDuration,
  buildPerformanceReportData,
  buildPerformanceReportHtml,
  openPerformanceReportPrintWindow,
};

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



const ADJUSTMENT_TOLERANCE = 0.01;
const CSV_EMPTY_VALUE = "--";
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

export const resolveEffectivePerformanceRestaurantId = (selectedRestaurant) => {
  if (selectedRestaurant === null || selectedRestaurant === undefined) return null;
  const normalizedValue = String(selectedRestaurant).trim();
  if (!normalizedValue || normalizedValue.toLowerCase() === "all") return null;
  return normalizedValue;
};

export const buildAdjustmentHistoryItems = (adjustments = [], appeals = []) =>
  [
    ...(adjustments || []).map((item) => ({
      id: `adj-${item.id}`,
      type: "incident",
      status: "applied",
      scoreDelta: Number(item.scoreDelta || 0),
      previousScore: item.previousScore,
      newScore: item.newScore,
      reason: item.reason || "Incident điều chỉnh điểm",
      managerNote: item.note || null,
      createdAt: item.createdAt || null,
    })),
    ...(appeals || []).map((appeal) => ({
        id: `apl-${appeal.id}`,
        type: "appeal",
        status: appeal?.status || "submitted",
        scoreDelta: Number(appeal?.scoreReversalDelta || 0),
        previousScore: null,
        newScore: null,
        reason: appeal.scoreReversalNote || appeal.reason || "Khiếu nại hiệu suất",
        appealReason: appeal.reason || null,
        decisionReason: appeal.scoreReversalNote || null,
        createdAt: appeal.scoreReversedAt || appeal.reviewedAt || appeal.createdAt || null,
      })),
  ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

export const shouldDisplayAdjustment = (delta, tolerance = ADJUSTMENT_TOLERANCE) =>
  Math.abs(Number(delta) || 0) >= tolerance;

export const formatDelta = (value) => {
  const delta = Number(value) || 0;
  const absText = formatContributionScore(Math.abs(delta));
  return `${delta >= 0 ? "+" : "-"}${absText}`;
};
const formatMetricNumber = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;
const formatMetricRate = (value) => {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return "--";
  return `${Math.round(rate * 1000) / 10}%`;
};
const formatMetricMinutes = (value) =>
  Number.isFinite(Number(value)) ? `${Number(value)} phút` : "--";
const resolveCashierMetrics = (snapshot) => snapshot?.factors?.cashierMetrics || null;
const hasCashierMetrics = (snapshot, qualityEvidence) =>
  Boolean(
    (qualityEvidence?.roleGroup === "cashier")
      || Number(qualityEvidence?.cashierOperationalPenalty || 0) > 0
      || resolveCashierMetrics(snapshot),
  );
const QUALITY_ROLE_LABELS = {
  order_staff: "Nhân viên order/phục vụ",
  cashier: "Thu ngân",
  head_chef: "Bếp chính",
  assistant_chef: "Phụ bếp",
  other: "Khác",
};
const STATUS_BADGES = {
  pending: "Chờ xem xét",
  eligible: "Đủ điều kiện trừ điểm",
  applied: "Đã áp dụng điểm",
  waived: "Đã bỏ qua",
  reversed: "Đã hoàn điểm",
  submitted: "Đã gửi khiếu nại",
  accepted: "Khiếu nại được chấp nhận",
  rejected: "Khiếu nại bị từ chối",
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
  const restaurantId = snapshot?.restaurantId || "";
  const periodStart = snapshot?.periodStart;
  const periodEnd = snapshot?.periodEnd;
  const snapshotUpdatedAt = snapshot?.updatedAt || snapshot?.calculatedAt || null;
  const kitchenMetrics = snapshot?.factors?.kitchenMetrics;
  const qualityEvidence = snapshot?.factors?.qualityEvidence;
  const cashierMetrics = resolveCashierMetrics(snapshot);
  const hasKitchenMetrics = Number(kitchenMetrics?.totalItems || 0) > 0;
  const shouldShowCashierMetrics = hasCashierMetrics(snapshot, qualityEvidence);
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
  const incidentAdjustmentDelta = useMemo(
    () => (historyData?.staffPerformanceScoreAdjustments || []).reduce((sum, item) => sum + (Number(item?.scoreDelta) || 0), 0),
    [historyData?.staffPerformanceScoreAdjustments],
  );
  const appealReversalDelta = useMemo(
    () => (historyData?.performanceIncidentAppeals || [])
      .filter((appeal) => appeal?.status === "accepted")
      .reduce((sum, appeal) => sum + (Number(appeal?.scoreReversalDelta) || 0), 0),
    [historyData?.performanceIncidentAppeals],
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
            <strong>Giải thích điểm cuối</strong>
            <ul>
              <li><span>Điểm cuối</span><strong>{scoreText(finalPerformanceScore)}</strong></li>
              <li><span>Mức hiệu suất</span><strong>{level.label}</strong></li>
              <li><span>Điểm theo công thức nền</span><strong>{formatContributionScore(formulaScore)}</strong></li>
              <li><span>Delta trừ do incident</span><strong>{formatDelta(incidentAdjustmentDelta)}</strong></li>
              <li><span>Delta hoàn từ appeal</span><strong>{formatDelta(appealReversalDelta)}</strong></li>
              <li><span>Delta điều chỉnh cuối</span><strong>{hasAdjustment ? formatDelta(adjustmentDelta) : "0"}</strong></li>
              <li className="total"><span>Final score = Base formula score + Final adjustment delta</span><strong>{scoreText(finalPerformanceScore)}</strong></li>
            </ul>
            {adjustmentDelta < 0 ? <p className="formula-note warning-note">Điểm cuối đã bao gồm điểm trừ từ sự cố đã được quản lý xác nhận.</p> : null}
            {appealReversalDelta > 0 ? <p className="formula-note success-note">Điểm cuối đã bao gồm điểm hoàn từ khiếu nại được chấp nhận.</p> : null}
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
              <span>
                Số order tham khảo: {snapshot.factors?.orderCount ?? 0}
              </span>
              <span>
                Mốc order tham khảo trong kỳ: {snapshot.factors?.peerMaxOrderCount ?? "--"}
              </span>
              <span>
                Thời lượng ca được phân công:{" "}
                {formatMinutesDuration(snapshot.factors?.scheduledMinutes)}
              </span>
              <span>
                Thời lượng làm thực tế:{" "}
                {formatMinutesDuration(snapshot.factors?.actualWorkedMinutes)}
              </span>
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
            {snapshot.factors?.productivitySource === "shift_completion" ? (
              <p className="formula-note">
                Năng suất dựa trên tỷ lệ hoàn thành ca được phân công, không dựa trực tiếp vào số order.
              </p>
            ) : null}
            {snapshot.factors?.insufficientData === true ? (
              <p className="formula-note">
                <strong>Không đủ dữ liệu hiệu suất trong kỳ.</strong>{" "}
                Nhân viên không có ca làm, chấm công, order, đánh giá hoặc dữ liệu điều chỉnh trong kỳ nên không chấm theo điểm trung lập.
              </p>
            ) : null}
            {snapshot.factors?.hasManagerReview === false &&
            snapshot.factors?.insufficientData !== true ? (
              <p className="formula-note">
                Thiếu đánh giá quản lý; Quality và Manager Review đang dùng điểm trung lập.
              </p>
            ) : null}
            <p className="formula-note">
              Dữ liệu này được cập nhật vào kỳ đánh giá khi tính lại hiệu suất.
            </p>
            {snapshotUpdatedAt ? (
              <p className="formula-note">
                Snapshot cập nhật lần cuối: {formatDate(snapshotUpdatedAt)}
              </p>
            ) : null}
          </div>
          {hasKitchenMetrics ? (
            <div className="factor-box kitchen-metrics-card">
              <strong>Dữ liệu bếp/bar tham khảo</strong>
              <div className="factor-grid kitchen-metrics-grid">
                <span>Tổng work items liên quan: {formatMetricNumber(kitchenMetrics?.totalItems)}</span>
                <span>Bếp / Bar: {formatMetricNumber(kitchenMetrics?.kitchenItems)} / {formatMetricNumber(kitchenMetrics?.barItems)}</span>
                <span>Đúng giờ / Trễ / Rất trễ: {formatMetricNumber(kitchenMetrics?.onTimeItems)} / {formatMetricNumber(kitchenMetrics?.lateItems)} / {formatMetricNumber(kitchenMetrics?.veryLateItems)}</span>
                <span>Hủy / Trả / Không nhận: {formatMetricNumber(kitchenMetrics?.cancelledItems)} / {formatMetricNumber(kitchenMetrics?.returnedItems)} / {formatMetricNumber(kitchenMetrics?.unacceptedItems)}</span>
                <span>Đầu bếp chính: {formatMetricNumber(kitchenMetrics?.headChefItems)}</span>
                <span>Phụ bếp: {formatMetricNumber(kitchenMetrics?.assistantItems)}</span>
                <span>Đội bếp: {formatMetricNumber(kitchenMetrics?.teamItems)}</span>
                <span>Bar lead: {formatMetricNumber(kitchenMetrics?.barLeadItems)}</span>
                <span>Bar staff: {formatMetricNumber(kitchenMetrics?.barStaffItems)}</span>
                <span>TB thời gian hoàn thành món: {formatMetricMinutes(kitchenMetrics?.avgPrepMinutes)}</span>
                {formatMetricNumber(kitchenMetrics?.noRosterItems) > 0 ? (
                  <span className="kitchen-metrics-warning">
                    Chưa gắn được roster bếp/bar: {formatMetricNumber(kitchenMetrics?.noRosterItems)}
                  </span>
                ) : null}
              </div>
              {formatMetricNumber(kitchenMetrics?.noRosterItems) > 0 ? (
                <p className="formula-note kitchen-metrics-note">
                  Có món chưa xác định được đội bếp/bar theo lịch tại thời điểm vào bếp.
                </p>
              ) : null}
              {snapshot?.factors?.unacceptedAuditRefreshed === true ? (
                <p className="formula-note kitchen-metrics-note">
                  Đã cập nhật kiểm tra món chưa nhận trước khi tính lại hiệu suất.
                </p>
              ) : null}
              {formatMetricNumber(snapshot?.factors?.unacceptedAuditModifiedCount) > 0 ? (
                <p className="formula-note kitchen-metrics-note">
                  Món chưa nhận mới được đánh dấu: {formatMetricNumber(snapshot?.factors?.unacceptedAuditModifiedCount)}
                </p>
              ) : null}
              <p className="formula-note kitchen-metrics-note">
                {(Number(kitchenMetrics?.totalItems || 0) > 0 && Number(qualityEvidence?.kitchenPenalty || 0) > 0)
                  ? "Dữ liệu bếp/bar được dùng làm bằng chứng điều chỉnh nhẹ điểm Quality theo vai trò."
                  : "Dữ liệu bếp/bar dùng để tham khảo vận hành, chưa tạo điều chỉnh Quality trong kỳ này."}
              </p>
            </div>
          ) : null}
          {qualityEvidence ? (
            <div className="factor-box">
              <strong>Cơ sở điểm Quality</strong>
              <div className="factor-grid">
                <span>Nhóm vai trò: {QUALITY_ROLE_LABELS[qualityEvidence?.roleGroup] || QUALITY_ROLE_LABELS.other}</span>
                <span>Điểm kỹ năng nền: {qualityEvidence?.baseSkillScore ?? 75}</span>
                <span>Trừ phản hồi khách hàng: {qualityEvidence?.customerPenalty ?? 0}</span>
                <span>Trừ vận hành bếp/bar: {qualityEvidence?.kitchenPenalty ?? 0}</span>
                {(qualityEvidence?.roleGroup === "cashier" || Number(qualityEvidence?.cashierOperationalPenalty || 0) > 0) ? (
                  <span>Trừ nghiệp vụ thu ngân: {qualityEvidence?.cashierOperationalPenalty ?? 0}</span>
                ) : null}
                <span>Tổng trừ: {qualityEvidence?.totalPenalty ?? 0}</span>
                <span>Điểm Quality cuối: {qualityEvidence?.finalQualityScore ?? snapshot?.quality?.score ?? 0}</span>
                <span>Nguồn dữ liệu: {qualityEvidence?.evidenceSource || "--"}</span>
              </div>
              <p className="formula-note">
                {Number(qualityEvidence?.totalPenalty || 0) > 0
                  ? "Quality đã được điều chỉnh nhẹ theo dữ liệu phù hợp vai trò."
                  : "Không có điều chỉnh trừ điểm từ dữ liệu vai trò trong kỳ."}
              </p>
              <p className="formula-note">{qualityEvidence?.note}</p>
            </div>
          ) : null}
          {shouldShowCashierMetrics ? (
            <div className="factor-box cashier-metrics-card">
              <strong>Dữ liệu nghiệp vụ thu ngân</strong>
              <div className="factor-grid cashier-metrics-grid">
                <span>Giao dịch xử lý: {cashierMetrics?.totalHandledPayments ?? "--"}</span>
                <span>Sai bill: {cashierMetrics?.wrongBillIssues ?? "--"}</span>
                <span>Lỗi thanh toán: {formatMetricNumber(cashierMetrics?.paymentErrors)}</span>
                <span>Refund do thao tác thu ngân: {formatMetricNumber(cashierMetrics?.cashierRefunds)}</span>
                <span>Yêu cầu thanh toán xử lý chậm: {formatMetricNumber(cashierMetrics?.latePaymentRequests)}</span>
                <span>Giảm giá không hợp lệ: {formatMetricNumber(cashierMetrics?.unauthorizedDiscounts)}</span>
                <span>Tổng trừ nghiệp vụ thu ngân: {formatMetricNumber(cashierMetrics?.operationalPenalty)}</span>
                {Number(cashierMetrics?.cashVarianceRate || 0) > 0
                  ? <span>Tỷ lệ lệch tiền mặt: {formatMetricRate(cashierMetrics?.cashVarianceRate)}</span>
                  : <span>Tỷ lệ lệch tiền mặt: Chưa có dữ liệu chốt quỹ</span>}
                <span>Trừ theo nghiệp vụ thu ngân (Quality): {formatMetricNumber(qualityEvidence?.cashierOperationalPenalty)}</span>
                <span>Có bằng chứng nghiệp vụ thu ngân: {qualityEvidence?.hasCashierOperationalEvidence ? "Có" : "Không"}</span>
              </div>
              {Number(qualityEvidence?.cashierOperationalPenalty || 0) > 0 ? (
                <p className="formula-note cashier-metrics-note">
                  Điểm Quality của thu ngân đã được điều chỉnh theo lỗi nghiệp vụ có thể quy trách nhiệm, ví dụ sai bill, lỗi thanh toán, refund do thao tác sai, xử lý yêu cầu thanh toán chậm hoặc giảm giá không hợp lệ.
                </p>
              ) : null}
              {Number(cashierMetrics?.operationalPenalty || 0) === 0 ? (
                <p className="formula-note cashier-metrics-note">
                  Không có lỗi nghiệp vụ thu ngân có thể quy trách nhiệm trong kỳ.
                </p>
              ) : null}
              {Number(cashierMetrics?.cashVarianceRate || 0) === 0 ? (
                <p className="formula-note cashier-metrics-note">
                  Dữ liệu lệch tiền mặt chưa được tính vì chưa có reconciliation/chốt quỹ thu ngân.
                </p>
              ) : null}
            </div>
          ) : null}
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
                      <span className="status-badge">{STATUS_BADGES[item.status] || "Chờ xem xét"}</span>
                      <span>Lý do: {item.reason || "--"}</span>
                      {item.managerNote ? <span>Ghi chú quản lý: {item.managerNote}</span> : null}
                      {item.appealReason ? <span>Lý do khiếu nại: {item.appealReason}</span> : null}
                      {item.decisionReason ? <span>Lý do quyết định: {item.decisionReason}</span> : null}
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
          Chưa có dữ liệu hiệu suất. Hãy bấm “Tính lại hiệu suất kỳ này” để quản lý tạo snapshot mới, hoặc
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
            <option value="average">Trung bình</option>
            <option value="needs_attention">Cần chú ý</option>
            <option value="poor">Kém</option>
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
            <span>Cần chú ý</span>
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
            {loading ? <span className="loading-pill">Đang tải dữ liệu...</span> : null}
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
                {!loading && rows.length > 0 && stats.generated === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-row">
                      Chưa có snapshot hiệu suất trong kỳ. Quản lý vui lòng bấm “Tính lại hiệu suất kỳ này” để tạo dữ liệu demo.
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
