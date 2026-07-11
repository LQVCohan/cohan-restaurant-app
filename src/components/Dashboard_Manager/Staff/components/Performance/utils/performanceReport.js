import {
  calculateFormulaScore,
  formatContributionScore,
  getWeightedContribution,
  PERFORMANCE_FORMULA_ITEMS,
  resolveComponentWeight,
} from "./performanceFormula";
import { formatCustomerRating } from "./performanceCustomerRating";
import { formatTrendDelta } from "./performanceTrend";

const scoreText = (value) => `${Math.round(Number(value || 0))}/100`;
const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;
const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
};
const QUALITY_ROLE_LABELS = {
  order_staff: "Nhân viên order/phục vụ",
  cashier: "Thu ngân",
  head_chef: "Bếp chính",
  assistant_chef: "Phụ bếp",
  other: "Khác",
};
const resolveCashierMetrics = (factors = {}) => factors?.cashierMetrics || null;
const hasCashierMetrics = (qualityEvidence = {}, cashierMetrics = null) =>
  Boolean(
    qualityEvidence?.roleGroup === "cashier" ||
    Number(qualityEvidence?.cashierOperationalPenalty || 0) > 0 ||
    cashierMetrics,
  );
export const formatMinutesDuration = (value) => {
  const totalMinutes = Number(value);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "--";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0 && minutes > 0) return `${minutes} phút`;
  if (minutes === 0) return `${hours} giờ`;
  return `${hours} giờ ${minutes} phút`;
};
const SCORE_LEVELS = {
  excellent: { label: "Xuất sắc" }, good: { label: "Tốt" }, average: { label: "Ổn định" },
  needs_attention: { label: "Cần theo dõi" }, poor: { label: "Rủi ro cao" },
};
const getScoreLevel = (score) => {
  const n = Number(score || 0);
  if (n >= 90) return SCORE_LEVELS.excellent;
  if (n >= 80) return SCORE_LEVELS.good;
  if (n >= 65) return SCORE_LEVELS.average;
  if (n >= 50) return SCORE_LEVELS.needs_attention;
  return SCORE_LEVELS.poor;
};
const ADJUSTMENT_TOLERANCE = 0.01;
const shouldDisplayAdjustment = (delta, tolerance = ADJUSTMENT_TOLERANCE) =>
  Math.abs(Number(delta) || 0) >= tolerance;
const formatDelta = (value) => {
  const delta = Number(value) || 0;
  const absText = formatContributionScore(Math.abs(delta));
  return `${delta >= 0 ? "+" : "-"}${absText}`;
};

export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const buildPerformanceReportData = ({ snapshot = {}, previousSnapshot = null, employee = null, adjustmentHistory = [], restaurantName = "Nhà hàng hiện tại" } = {}) => {
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
    return { label: item.label, score, weight, contribution: getWeightedContribution(score, weight) };
  });
  const hasCustomWeight = formulaBreakdown.some((item, idx) => item.weight !== PERFORMANCE_FORMULA_ITEMS[idx].weight);
  const snapshotUpdatedAt = snapshot?.updatedAt || snapshot?.calculatedAt || null;
  const factors = snapshot?.factors || {};
  const scheduledMinutes = factors?.scheduledMinutes;
  const actualWorkedMinutes = factors?.actualWorkedMinutes;
  const productivitySource = factors?.productivitySource || "";
  const insufficientData = factors?.insufficientData === true;
  const hasManagerReview = factors?.hasManagerReview !== false;
  const orderCount = factors?.orderCount;
  const peerMaxOrderCount = factors?.peerMaxOrderCount;
  const kitchenMetrics = factors?.kitchenMetrics || null;
  const cashierMetrics = resolveCashierMetrics(factors);
  const qualityEvidence = factors?.qualityEvidence || null;
  const incidentAdjustmentDelta = (adjustmentHistory || [])
    .filter((item) => item?.type === "incident")
    .reduce((sum, item) => sum + (Number(item?.scoreDelta) || 0), 0);
  const appealReversalDelta = (adjustmentHistory || [])
    .filter((item) => item?.type === "appeal")
    .reduce((sum, item) => sum + (Number(item?.scoreDelta) || 0), 0);

  return { employeeName, periodLabel, restaurantName, finalPerformanceScore, performanceLevel, previousScore: hasPreviousSnapshot ? previousScore : null, previousLevel, trendText: formatTrendDelta(finalPerformanceScore, previousSnapshot?.finalPerformanceScore), hasPreviousSnapshot, formulaScore, adjustmentDelta, incidentAdjustmentDelta, appealReversalDelta, hasAdjustment: shouldDisplayAdjustment(adjustmentDelta), formulaBreakdown, hasCustomWeight, customerRating, snapshotUpdatedAt, adjustmentHistory, scheduledMinutes, actualWorkedMinutes, productivitySource, insufficientData, hasManagerReview, orderCount, peerMaxOrderCount, kitchenMetrics, cashierMetrics, qualityEvidence };
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
      <p>Năng suất 25% · Đúng giờ 25% · Chất lượng 20% · Đánh giá quản lý 20% · Tuân thủ 10%</p>
      <p>Năng suất = thời lượng làm thực tế / thời lượng ca được phân công × 100; order chỉ là dữ liệu tham khảo.</p>
      <p><em>${reportData.hasCustomWeight ? "Dùng weight thực tế từ snapshot." : "Dùng weight mặc định."}</em></p>
      <table border="1" cellspacing="0" cellpadding="6"><tr><th>Thành phần</th><th>Điểm</th><th>Trọng số</th><th>Đóng góp</th></tr>
      ${reportData.formulaBreakdown.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${scoreText(item.score)}</td><td>${formatPercent(item.weight)}</td><td>${formatContributionScore(item.contribution)}</td></tr>`).join("")}
      </table>
      <h3>Tổng hợp điểm</h3>
      <p>Điểm theo công thức: ${formatContributionScore(reportData.formulaScore)}</p>
      <p>Delta trừ do incident: ${formatDelta(reportData.incidentAdjustmentDelta)}</p>
      <p>Delta hoàn từ appeal: ${formatDelta(reportData.appealReversalDelta)}</p>
      <p>Điều chỉnh incident/appeal: ${reportData.hasAdjustment ? `${formatDelta(reportData.adjustmentDelta)} điểm` : "Không có điều chỉnh"}</p>
      <p>Điểm cuối: ${scoreText(reportData.finalPerformanceScore)}</p>
      <p><em>Điểm trừ incident ngoài chấm công chỉ áp dụng sau khi quản lý xác nhận trách nhiệm và duyệt; đi trễ/về sớm/vắng mặt đã nằm trong thành phần Đúng giờ; delta dương từ appeal là hoàn điểm, không phải thưởng.</em></p>
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
      <p><em>Đánh giá khách hàng chỉ là bằng chứng Quality cho nhóm order/phục vụ và thu ngân khi đủ mẫu; không thay thế điểm quản lý.</em></p>
      <p><em>Dữ liệu này được cập nhật vào kỳ đánh giá khi tính lại hiệu suất.</em></p>
      ${reportData.snapshotUpdatedAt ? `<p><em>Snapshot cập nhật lần cuối: ${escapeHtml(formatDate(reportData.snapshotUpdatedAt))}</em></p>` : ""}
      <h3>Nguồn dữ liệu năng suất</h3>
      ${reportData.productivitySource === "shift_completion" ? `
      <p>Năng suất dựa trên tỷ lệ thời lượng làm thực tế / thời lượng ca được phân công; order chỉ dùng để tham khảo.</p>
      <p>Thời lượng ca được phân công: ${escapeHtml(formatMinutesDuration(reportData.scheduledMinutes))}</p>
      <p>Thời lượng làm thực tế: ${escapeHtml(formatMinutesDuration(reportData.actualWorkedMinutes))}</p>
      <p>Order chỉ là dữ liệu tham khảo: ${escapeHtml(reportData.orderCount ?? "--")}</p>
      ` : ""}
      ${reportData.insufficientData ? `<p><strong>Không đủ dữ liệu hiệu suất trong kỳ.</strong></p>` : ""}
      ${!reportData.insufficientData && reportData.hasManagerReview === false ? `<p><em>Thiếu đánh giá quản lý; Quality và Manager Review đang dùng điểm trung lập.</em></p>` : ""}
      ${Number(reportData.kitchenMetrics?.totalItems || 0) > 0 ? `
      <h3>Dữ liệu bếp/bar tham khảo</h3>
      <p>Tổng work items liên quan: ${escapeHtml(reportData.kitchenMetrics.totalItems ?? "--")}</p>
      <p>Bếp / Bar: ${escapeHtml(reportData.kitchenMetrics.kitchenItems ?? "--")} / ${escapeHtml(reportData.kitchenMetrics.barItems ?? "--")}</p>
      <p>Đúng giờ / Trễ / Rất trễ: ${escapeHtml(reportData.kitchenMetrics.onTimeItems ?? "--")} / ${escapeHtml(reportData.kitchenMetrics.lateItems ?? "--")} / ${escapeHtml(reportData.kitchenMetrics.veryLateItems ?? "--")}</p>
      <p>Hủy / Trả / Không nhận: ${escapeHtml(reportData.kitchenMetrics.cancelledItems ?? "--")} / ${escapeHtml(reportData.kitchenMetrics.returnedItems ?? "--")} / ${escapeHtml(reportData.kitchenMetrics.unacceptedItems ?? "--")}</p>
      <p>Vai trò: Đầu bếp chính ${escapeHtml(reportData.kitchenMetrics.headChefItems ?? "--")} · Phụ bếp ${escapeHtml(reportData.kitchenMetrics.assistantItems ?? "--")} · Bar staff ${escapeHtml(reportData.kitchenMetrics.barStaffItems ?? "--")}</p>
      ${Number(reportData.kitchenMetrics.noRosterItems || 0) > 0 ? `<p>Chưa gắn được roster bếp/bar: ${escapeHtml(reportData.kitchenMetrics.noRosterItems ?? "--")}</p>` : ""}
      <p>TB thời gian hoàn thành món: ${escapeHtml(reportData.kitchenMetrics.avgPrepMinutes ?? 0)} phút</p>
      <p><em>${Number(reportData.qualityEvidence?.kitchenPenalty || 0) > 0 ? "Dữ liệu bếp/bar được dùng làm bằng chứng điều chỉnh nhẹ điểm Quality theo vai trò." : "Dữ liệu bếp/bar dùng để tham khảo vận hành, chưa tạo điều chỉnh Quality trong kỳ này."}</em></p>
      ` : ""}
      ${reportData.qualityEvidence ? `
      <h3>Cơ sở điểm Quality</h3>
      <p>Nhóm vai trò: ${escapeHtml(QUALITY_ROLE_LABELS[reportData.qualityEvidence.roleGroup] || QUALITY_ROLE_LABELS.other)}</p>
      <p>Điểm kỹ năng nền: ${escapeHtml(reportData.qualityEvidence.baseSkillScore ?? "--")}</p>
      <p>Trừ theo bếp/bar: ${escapeHtml(reportData.qualityEvidence.kitchenPenalty ?? "--")}</p>
      <p>Trừ theo đánh giá khách hàng: ${escapeHtml(reportData.qualityEvidence.customerPenalty ?? "--")}</p>
      ${(reportData.qualityEvidence.roleGroup === "cashier" || Number(reportData.qualityEvidence.cashierOperationalPenalty || 0) > 0)
        ? `<p>Trừ theo nghiệp vụ thu ngân: ${escapeHtml(reportData.qualityEvidence.cashierOperationalPenalty ?? "--")}</p>`
        : ""}
      <p>Tổng điều chỉnh: ${escapeHtml(reportData.qualityEvidence.totalPenalty ?? "--")}</p>
      <p>Điểm Quality cuối: ${escapeHtml(reportData.qualityEvidence.finalQualityScore ?? "--")}</p>
      <p>Nguồn dữ liệu: ${escapeHtml(reportData.qualityEvidence.evidenceSource ?? "--")}</p>
      <p>${Number(reportData.qualityEvidence.totalPenalty || 0) > 0 ? "Quality đã được điều chỉnh nhẹ theo dữ liệu phù hợp vai trò." : "Không có điều chỉnh trừ điểm từ dữ liệu vai trò trong kỳ."}</p>
      <p>Ghi chú: ${escapeHtml(reportData.qualityEvidence.note ?? "--")}</p>
      ` : ""}
      ${hasCashierMetrics(reportData.qualityEvidence, reportData.cashierMetrics) ? `
      <h3>Dữ liệu nghiệp vụ thu ngân</h3>
      <p>Giao dịch xử lý: ${escapeHtml(reportData.cashierMetrics?.totalHandledPayments ?? "--")}</p>
      <p>Sai bill: ${escapeHtml(reportData.cashierMetrics?.wrongBillIssues ?? 0)}</p>
      <p>Lỗi thanh toán: ${escapeHtml(reportData.cashierMetrics?.paymentErrors ?? 0)}</p>
      <p>Refund do thao tác thu ngân: ${escapeHtml(reportData.cashierMetrics?.cashierRefunds ?? 0)}</p>
      <p>Yêu cầu thanh toán xử lý chậm: ${escapeHtml(reportData.cashierMetrics?.latePaymentRequests ?? 0)}</p>
      <p>Giảm giá không hợp lệ: ${escapeHtml(reportData.cashierMetrics?.unauthorizedDiscounts ?? 0)}</p>
      <p>Tổng trừ nghiệp vụ thu ngân: ${escapeHtml(reportData.cashierMetrics?.operationalPenalty ?? 0)}</p>
      <p>Trừ theo nghiệp vụ thu ngân (Quality): ${escapeHtml(reportData.qualityEvidence?.cashierOperationalPenalty ?? 0)}</p>
      <p>Có bằng chứng nghiệp vụ thu ngân: ${reportData.qualityEvidence?.hasCashierOperationalEvidence ? "Có" : "Không"}</p>
      <p>${Number(reportData.qualityEvidence?.cashierOperationalPenalty || 0) > 0 ? "Quality của thu ngân chỉ bị trừ theo lỗi nghiệp vụ có thể quy trách nhiệm như sai bill, lỗi thanh toán, refund do thao tác sai, xử lý yêu cầu thanh toán chậm hoặc giảm giá không hợp lệ." : "Không có lỗi nghiệp vụ thu ngân có thể quy trách nhiệm trong kỳ."}</p>
      ${Number(reportData.cashierMetrics?.cashVarianceRate || 0) === 0 ? "<p>Dữ liệu lệch tiền mặt chưa được tính vì chưa có reconciliation/chốt quỹ thu ngân.</p>" : `<p>Tỷ lệ lệch tiền mặt: ${escapeHtml(Math.round(Number(reportData.cashierMetrics?.cashVarianceRate || 0) * 1000) / 10)}%</p>`}
      ` : ""}
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
