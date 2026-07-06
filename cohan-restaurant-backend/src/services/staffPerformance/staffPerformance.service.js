import mongoose from "mongoose";
import {
  AttendanceCorrectionRequest,
  Order,
  Review,
  Shift,
  Staff,
  StaffPerformanceReview,
  StaffPerformanceSnapshot,
  Timesheet,
  KitchenOrderWorkItem,
  PerformanceIncident,
  StaffPerformanceScoreAdjustment,
  StaffPerformanceScoreReversal,
} from "../../../models/index.js";
import { markUnacceptedKitchenOrderWorkItems } from "../kitchen/kitchenOrderWorkItem.service.js";

const { Types } = mongoose;

export const PERFORMANCE_WEIGHTS = {
  productivity: 25,
  punctuality: 25,
  quality: 20,
  managerReview: 20,
  compliance: 10,
};

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new Types.ObjectId(value);
}

function toValidDate(value, fieldName) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} không hợp lệ.`);
  }
  return date;
}

function toStartOfDay(value) {
  const date = toValidDate(value, "Ngày bắt đầu");
  date.setHours(0, 0, 0, 0);
  return date;
}

function toEndOfDay(value) {
  const date = toValidDate(value, "Ngày kết thúc");
  date.setHours(23, 59, 59, 999);
  return date;
}

function resolveUnacceptedAuditNow(periodEnd, currentDate = new Date()) {
  const periodEndDate = periodEnd ? new Date(periodEnd) : null;
  const current = currentDate ? new Date(currentDate) : new Date();

  if (!periodEndDate || Number.isNaN(periodEndDate.getTime())) return current;
  if (!current || Number.isNaN(current.getTime())) return periodEndDate;

  return periodEndDate.getTime() > current.getTime() ? current : periodEndDate;
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}
function normalizeTextNoAccent(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}
function safeRate(count, total) {
  const c = Number(count || 0);
  const t = Number(total || 0);
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return 0;
  return c / t;
}
function roundOneDecimal(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}
function resolveQualityRoleGroup(staff, kitchenMetrics = {}) {
  const roleText = normalizeTextNoAccent(
    [
      staff?.roleName,
      staff?.positionTitle,
      staff?.department,
      staff?.role?.slug,
      staff?.role,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const isCashierText = roleText.includes("cashier") || roleText.includes("thu ngan");
  const isOrderStaffText = ["waiter", "waitress", "server", "phuc vu", "order", "le tan", "host"].some((x) => roleText.includes(x));
  const isAssistantChefText = ["assistant chef", "kitchen helper", "phu bep"].some((x) => roleText.includes(x));
  const isHeadChefText = ["head chef", "chef", "bep truong", "dau bep chinh", "bep chinh"].some((x) => roleText.includes(x));
  const assistantItems = Number(kitchenMetrics?.assistantItems || 0);
  const headChefItems = Number(kitchenMetrics?.headChefItems || 0);
  const kitchenItems = Number(kitchenMetrics?.kitchenItems || 0);

  if (isCashierText) return "cashier";
  if (isOrderStaffText) return "order_staff";
  if (isAssistantChefText) return "assistant_chef";
  if (isHeadChefText) return "head_chef";
  if (assistantItems > 0 && headChefItems <= 0) return "assistant_chef";
  if (headChefItems > 0 && assistantItems <= 0) return "head_chef";
  if (assistantItems > 0 && headChefItems > 0) {
    return assistantItems > headChefItems ? "assistant_chef" : "head_chef";
  }
  if (kitchenItems > 0) {
    return assistantItems > headChefItems ? "assistant_chef" : "head_chef";
  }
  return "other";
}
function calculateOrderStaffQualityPenalty({ customerRatingScore, staffRateCount }) {
  if (Number(staffRateCount || 0) < 3 || Number(customerRatingScore || 0) >= 75) return 0;
  return Math.min(4, roundOneDecimal((75 - Number(customerRatingScore || 0)) * 0.12));
}
function calculateCashierQualityPenalty({ customerRatingScore, staffRateCount }) {
  if (Number(staffRateCount || 0) < 3 || Number(customerRatingScore || 0) >= 75) return 0;
  return Math.min(2.5, roundOneDecimal((75 - Number(customerRatingScore || 0)) * 0.08));
}
const CASHIER_REASON_KEYWORDS = [
  "sai hoa don",
  "tinh nham",
  "thu nham",
  "nham ban",
  "nham order",
  "in nham bill",
  "ap sai gia",
  "ap sai khuyen mai",
  "sai voucher",
  "sai discount",
  "chon sai phuong thuc",
  "xac nhan thanh toan sai",
];
const NON_CASHIER_REASON_KEYWORDS = [
  "khach doi y",
  "khach huy",
  "bep",
  "mon nguoi",
  "mon sai",
  "het mon",
  "he thong",
  "cong thanh toan",
  "provider",
  "callback",
  "momo",
  "vnpay",
];
function isCashierAttributableReason(value) {
  const text = normalizeTextNoAccent(value);
  return Boolean(text && CASHIER_REASON_KEYWORDS.some((kw) => text.includes(kw)));
}
function isNonCashierReason(value) {
  const text = normalizeTextNoAccent(value);
  return Boolean(text && NON_CASHIER_REASON_KEYWORDS.some((kw) => text.includes(kw)));
}
function hasCashierAttribution(...texts) {
  if (texts.some((v) => isNonCashierReason(v))) return false;
  return texts.some((v) => isCashierAttributableReason(v));
}
function calculateCashierOperationalPenalty(cashierMetrics = {}) {
  const penalty =
    Number(cashierMetrics?.wrongBillRate || 0) * 8 +
    Number(cashierMetrics?.paymentErrorRate || 0) * 6 +
    Number(cashierMetrics?.cashierRefundRate || 0) * 8 +
    Number(cashierMetrics?.cashVarianceRate || 0) * 20 +
    Number(cashierMetrics?.latePaymentRequestRate || 0) * 4 +
    Number(cashierMetrics?.unauthorizedDiscountRate || 0) * 6;
  return Math.min(15, roundOneDecimal(penalty));
}
function calculateHeadChefQualityPenalty(kitchenMetrics = {}) {
  const denom = Number(kitchenMetrics?.headChefItems || kitchenMetrics?.kitchenItems || kitchenMetrics?.totalItems || 0);
  if (denom <= 0) return 0;
  const penalty =
    safeRate(kitchenMetrics?.lateItems, denom) * 4 +
    safeRate(kitchenMetrics?.veryLateItems, denom) * 12 +
    safeRate(kitchenMetrics?.kitchenRelatedReturnedItems, denom) * 10 +
    safeRate(kitchenMetrics?.kitchenRelatedCancelledItems, denom) * 6 +
    safeRate(kitchenMetrics?.unacceptedItems, denom) * 3;
  return Math.min(20, roundOneDecimal(penalty));
}
function calculateAssistantChefQualityPenalty(kitchenMetrics = {}) {
  const denom = Number(kitchenMetrics?.assistantItems || kitchenMetrics?.teamItems || kitchenMetrics?.kitchenItems || kitchenMetrics?.totalItems || 0);
  if (denom <= 0) return 0;
  const penalty =
    safeRate(kitchenMetrics?.unacceptedItems, denom) * 12 +
    safeRate(kitchenMetrics?.lateItems, denom) * 3 +
    safeRate(kitchenMetrics?.veryLateItems, denom) * 4 +
    safeRate(kitchenMetrics?.kitchenRelatedReturnedItems, denom) * 3 +
    safeRate(kitchenMetrics?.kitchenRelatedCancelledItems, denom) * 2;
  return Math.min(18, roundOneDecimal(penalty));
}
export function buildQualityEvidenceForEmployee({ staff, baseSkillScore, hasManagerReview, kitchenMetrics, cashierMetrics, customerRatingScore, staffRateCount }) {
  const roleGroup = resolveQualityRoleGroup(staff, kitchenMetrics);
  const kitchenPenalty =
    roleGroup === "head_chef"
      ? calculateHeadChefQualityPenalty(kitchenMetrics)
      : roleGroup === "assistant_chef"
        ? calculateAssistantChefQualityPenalty(kitchenMetrics)
        : 0;
  const customerPenalty =
    roleGroup === "order_staff"
      ? calculateOrderStaffQualityPenalty({ customerRatingScore, staffRateCount })
      : roleGroup === "cashier"
        ? calculateCashierQualityPenalty({ customerRatingScore, staffRateCount })
        : 0;
  const cashierOperationalPenalty = roleGroup === "cashier" ? calculateCashierOperationalPenalty(cashierMetrics) : 0;
  const hasCashierOperationalEvidence = roleGroup === "cashier" && Number(cashierOperationalPenalty || 0) > 0;
  const hasKitchenEvidence = Number(kitchenMetrics?.totalItems || 0) > 0 && ["head_chef", "assistant_chef"].includes(roleGroup);
  const hasCustomerEvidence = Number(staffRateCount || 0) > 0 && ["order_staff", "cashier"].includes(roleGroup);
  const totalPenalty = roundOneDecimal(kitchenPenalty + customerPenalty + cashierOperationalPenalty);
  let score = 75;
  if (hasManagerReview || hasKitchenEvidence || hasCustomerEvidence || hasCashierOperationalEvidence) {
    score = clampScore(baseSkillScore - totalPenalty, 75);
    if (totalPenalty > 0) score = Math.max(50, score);
  }
  const evidenceSource = roleGroup === "cashier"
    ? cashierOperationalPenalty > 0 && customerPenalty > 0 && hasManagerReview
      ? "manager_skill+customer_rating+cashier_operational_metrics"
      : cashierOperationalPenalty > 0 && customerPenalty > 0 && !hasManagerReview
        ? "neutral_skill+customer_rating+cashier_operational_metrics"
        : cashierOperationalPenalty > 0 && customerPenalty <= 0 && hasManagerReview
          ? "manager_skill+cashier_operational_metrics"
          : cashierOperationalPenalty > 0 && customerPenalty <= 0 && !hasManagerReview
            ? "neutral_skill+cashier_operational_metrics"
            : cashierOperationalPenalty <= 0 && customerPenalty > 0 && hasManagerReview
              ? "manager_skill+customer_rating"
              : cashierOperationalPenalty <= 0 && customerPenalty > 0 && !hasManagerReview
                ? "neutral_skill+customer_rating"
                : hasManagerReview
                  ? "manager_skill_only"
                  : "neutral_no_quality_evidence"
    : kitchenPenalty > 0 && customerPenalty > 0
    ? "manager_skill+kitchen_metrics+customer_rating"
    : kitchenPenalty > 0
      ? "manager_skill+kitchen_metrics"
      : customerPenalty > 0
        ? "manager_skill+customer_rating"
        : hasManagerReview
          ? "manager_skill_only"
          : "neutral_no_quality_evidence";
  const notes = {
    head_chef: "Quality dựa trên điểm kỹ năng quản lý, điều chỉnh nhẹ theo món trễ, rất trễ, trả/hủy có lý do liên quan bếp phù hợp vai trò bếp chính.",
    assistant_chef: "Quality dựa trên điểm kỹ năng quản lý, điều chỉnh nhẹ theo món chưa nhận và lỗi bếp liên quan phù hợp vai trò phụ bếp.",
    order_staff: "Quality dựa trên điểm kỹ năng quản lý, điều chỉnh nhẹ theo đánh giá khách hàng gắn với nhân viên.",
    cashier: cashierOperationalPenalty > 0
      ? "Quality dựa trên điểm kỹ năng quản lý, điều chỉnh theo đánh giá khách hàng và các lỗi nghiệp vụ thu ngân có thể quy trách nhiệm như sai bill, lỗi thanh toán, refund do thao tác sai, phản hồi thanh toán chậm hoặc giảm giá không hợp lệ."
      : "Không có lỗi nghiệp vụ thu ngân có thể quy trách nhiệm trong kỳ.",
    other: "Quality dựa trên điểm kỹ năng/chất lượng chuyên môn do quản lý nhập.",
  };
  return { score, baseSkillScore, finalQualityScore: score, roleGroup, kitchenPenalty, customerPenalty, cashierOperationalPenalty, cashierMetrics, totalPenalty, hasManagerReview, hasKitchenEvidence, hasCustomerEvidence, hasCashierOperationalEvidence, evidenceSource, affectsScore: totalPenalty > 0, note: notes[roleGroup] || notes.other };
}

function getActorId(ctx) {
  return toObjectId(ctx?.user?.id || ctx?.user?._id);
}

function getActorName(ctx) {
  return (
    ctx?.user?.fullName ||
    ctx?.user?.name ||
    ctx?.user?.username ||
    ctx?.user?.email ||
    "Người dùng"
  );
}

function getActorRole(ctx) {
  return normalizeRole(
    ctx?.user?.roleName ||
      ctx?.user?.userType ||
      ctx?.user?.role?.slug ||
      ctx?.user?.role ||
      "",
  );
}

function assertCanManagePerformance(ctx) {
  const role = getActorRole(ctx);
  if (!["admin", "manager", "hr"].includes(role)) {
    throw new Error("Bạn không có quyền cập nhật hiệu suất nhân viên.");
  }
}

function assertCanViewPerformance(ctx, employeeId) {
  const role = getActorRole(ctx);
  const actorId = getActorId(ctx);

  if (["admin", "manager", "hr", "accountant"].includes(role)) return;

  if (role === "staff" && actorId && String(actorId) === String(employeeId)) {
    return;
  }

  throw new Error("Bạn không có quyền xem hiệu suất nhân viên này.");
}

function clampScore(value, fallback = 75) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function getOverlapMinutes(start, end, rangeStart, rangeEnd) {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const fromDate = rangeStart ? new Date(rangeStart) : null;
  const toDate = rangeEnd ? new Date(rangeEnd) : null;
  if (
    !startDate ||
    !endDate ||
    !fromDate ||
    !toDate ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime())
  ) {
    return 0;
  }
  const overlapStart = Math.max(startDate.getTime(), fromDate.getTime());
  const overlapEnd = Math.min(endDate.getTime(), toDate.getTime());
  if (overlapEnd <= overlapStart) return 0;
  return (overlapEnd - overlapStart) / (1000 * 60);
}

function sumScheduledMinutes(shifts, periodStart, periodEnd) {
  return Math.round(
    (shifts || []).reduce(
      (sum, shift) =>
        sum +
        getOverlapMinutes(shift?.startTime, shift?.endTime, periodStart, periodEnd),
      0,
    ),
  );
}

export function hasPerformanceEvidence({
  scheduledMinutes = 0,
  actualWorkedMinutes = 0,
  recordCount = 0,
  orderCount = 0,
  hasManagerReview = false,
  correctionsCount = 0,
  staffRateCount = 0,
  kitchenMetrics = {},
  cashierMetrics = {},
} = {}) {
  return (
    Number(scheduledMinutes || 0) > 0 ||
    Number(actualWorkedMinutes || 0) > 0 ||
    Number(recordCount || 0) > 0 ||
    Number(orderCount || 0) > 0 ||
    Boolean(hasManagerReview) ||
    Number(correctionsCount || 0) > 0 ||
    Number(staffRateCount || 0) > 0 ||
    Number(kitchenMetrics?.totalItems || 0) > 0 ||
    Number(cashierMetrics?.totalHandledPayments || 0) > 0
  );
}

function weightedFinalScore(components) {
  const totalWeight = Object.values(PERFORMANCE_WEIGHTS).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );

  if (totalWeight <= 0) return 75;

  const raw =
    (components.productivity.score * PERFORMANCE_WEIGHTS.productivity +
      components.punctuality.score * PERFORMANCE_WEIGHTS.punctuality +
      components.quality.score * PERFORMANCE_WEIGHTS.quality +
      components.managerReview.score * PERFORMANCE_WEIGHTS.managerReview +
      components.compliance.score * PERFORMANCE_WEIGHTS.compliance) /
    totalWeight;

  return clampScore(raw);
}

async function resolvePerformanceScoreAdjustmentSummary({
  employeeId,
  restaurantId,
  periodStart,
  periodEnd,
}) {
  const incidents = await PerformanceIncident.find({
    employeeId,
    restaurantId,
    occurredAt: { $gte: periodStart, $lte: periodEnd },
    scoreImpactStatus: "applied",
  })
    .select("_id")
    .lean();

  const appliedIncidentIds = incidents.map((incident) => incident?._id).filter(Boolean);
  if (!appliedIncidentIds.length) {
    return {
      formulaScoreAdjustmentDelta: 0,
      incidentAdjustmentDelta: 0,
      appealReversalDelta: 0,
      finalAdjustmentDelta: 0,
      appliedAdjustmentCount: 0,
      reversedAppealCount: 0,
      appliedIncidentIds: [],
      reversalIds: [],
    };
  }

  const [adjustments, reversals] = await Promise.all([
    StaffPerformanceScoreAdjustment.find({ incidentId: { $in: appliedIncidentIds } })
      .select("_id incidentId scoreDelta")
      .lean(),
    StaffPerformanceScoreReversal.find({ incidentId: { $in: appliedIncidentIds } })
      .select("_id reversalDelta")
      .lean(),
  ]);

  const incidentAdjustmentDelta = adjustments.reduce(
    (sum, adjustment) => sum + Number(adjustment?.scoreDelta || 0),
    0,
  );
  const appealReversalDelta = reversals.reduce(
    (sum, reversal) => sum + Number(reversal?.reversalDelta || 0),
    0,
  );
  const finalAdjustmentDelta = incidentAdjustmentDelta + appealReversalDelta;

  return {
    formulaScoreAdjustmentDelta: finalAdjustmentDelta,
    incidentAdjustmentDelta,
    appealReversalDelta,
    finalAdjustmentDelta,
    appliedAdjustmentCount: adjustments.length,
    reversedAppealCount: reversals.length,
    appliedIncidentIds: appliedIncidentIds.map((id) => String(id)),
    reversalIds: reversals.map((reversal) => String(reversal._id)),
  };
}

export function resolvePerformanceLevel(score) {
  const n = Number(score || 0);

  if (n >= 90) return "excellent";
  if (n >= 80) return "good";
  if (n >= 65) return "average";
  if (n >= 50) return "needs_attention";
  return "poor";
}

function mapSnapshot(doc) {
  if (!doc) return null;

  const employee = doc.employeeId;

  return {
    id: String(doc._id),

    employeeId: String(employee?._id || employee),
    employeeName: employee?.fullName || null,
    employeeCode: employee?.employeeCode || null,
    employeeRole: employee?.positionTitle || employee?.roleName || null,
    employeeAvatar: employee?.avatarUrl || employee?.avatar || null,

    restaurantId: String(doc.restaurantId),
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,

    productivity: doc.productivity,
    punctuality: doc.punctuality,
    quality: doc.quality,
    managerReview: doc.managerReview,
    compliance: doc.compliance,

    finalPerformanceScore: Number(doc.finalPerformanceScore || 0),
    performanceLevel: doc.performanceLevel || "average",

    factors: doc.factors || {},

    generatedBy: doc.generatedBy ? String(doc.generatedBy) : null,
    generatedByName: doc.generatedByName || "",

    reviewedBy: doc.reviewedBy ? String(doc.reviewedBy) : null,
    reviewedAt: doc.reviewedAt || null,
    lockedAt: doc.lockedAt || null,

    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

function mapReview(doc) {
  if (!doc) return null;

  const employee = doc.employeeId;

  return {
    id: String(doc._id),

    employeeId: String(employee?._id || employee),
    employeeName: employee?.fullName || null,
    employeeCode: employee?.employeeCode || null,

    restaurantId: String(doc.restaurantId),
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,

    managerRatingScore: Number(doc.managerRatingScore || 0),
    attitudeScore: Number(doc.attitudeScore || 0),
    teamworkScore: Number(doc.teamworkScore || 0),
    skillScore: Number(doc.skillScore || 0),

    note: doc.note || "",

    reviewedBy: doc.reviewedBy ? String(doc.reviewedBy) : null,
    reviewedByName: doc.reviewedByName || "",

    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

async function getPeerOrderBenchmark({ restaurantId, periodStart, periodEnd }) {
  const rows = await Order.aggregate([
    {
      $match: {
        restaurantId,
        userId: { $ne: null },
        createdAt: { $gte: periodStart, $lte: periodEnd },
        currentStatus: { $in: ["served", "completed", "paid"] },
      },
    },
    {
      $group: {
        _id: "$userId",
        orderCount: { $sum: 1 },
      },
    },
    {
      $sort: { orderCount: -1 },
    },
  ]);

  const maxOrders = Number(rows?.[0]?.orderCount || 0);

  return {
    maxOrders,
    byEmployeeId: new Map(
      rows.map((row) => [String(row._id), Number(row.orderCount || 0)]),
    ),
  };
}


function buildKitchenMetricsMatchForEmployee({
  employeeId,
  restaurantId,
  periodStart,
  periodEnd,
}) {
  return {
    restaurantId,
    kitchenEnteredAt: { $gte: periodStart, $lte: periodEnd },
    $or: [
      { headChefId: employeeId },
      { assistantChefIds: employeeId },
      { teamEmployeeIds: employeeId },
      { barLeadId: employeeId },
      { barStaffIds: employeeId },
      { unacceptedResponsibleEmployeeIds: employeeId },
    ],
  };
}

function resolveKitchenMetricRoleForEmployee(workItem, employeeId) {
  const employeeIdText = String(employeeId || "");
  const hasInArray = (arr) =>
    Array.isArray(arr) && arr.some((item) => String(item || "") === employeeIdText);

  return {
    isHeadChef: String(workItem?.headChefId || "") === employeeIdText,
    isAssistant: hasInArray(workItem?.assistantChefIds),
    isTeam: hasInArray(workItem?.teamEmployeeIds),
    isBarLead: String(workItem?.barLeadId || "") === employeeIdText,
    isBarStaff: hasInArray(workItem?.barStaffIds),
    isUnacceptedResponsible: hasInArray(workItem?.unacceptedResponsibleEmployeeIds),
  };
}

function buildKitchenMetricsSummary(workItems = [], employeeId) {
  const summary = {
    totalItems: 0,
    kitchenItems: 0,
    barItems: 0,
    preparedItems: 0,
    servedItems: 0,
    cancelledItems: 0,
    returnedItems: 0,
    kitchenRelatedCancelledItems: 0,
    kitchenRelatedReturnedItems: 0,
    nonKitchenCancelledItems: 0,
    nonKitchenReturnedItems: 0,
    onTimeItems: 0,
    lateItems: 0,
    veryLateItems: 0,
    unacceptedItems: 0,
    headChefItems: 0,
    assistantItems: 0,
    teamItems: 0,
    barLeadItems: 0,
    barStaffItems: 0,
    unacceptedResponsibleItems: 0,
    avgPrepMinutes: 0,
    targetPrepMinutesAvg: 0,
    noRosterItems: 0,
    attributionSource: "kitchen_order_work_items",
    affectsScore: false,
    note: "Không có dữ liệu bếp/bar liên quan nhân viên trong kỳ.",
  };

  const actualPrepValues = [];
  const targetPrepValues = [];

  for (const workItem of workItems) {
    summary.totalItems += 1;
    const roleFlags = resolveKitchenMetricRoleForEmployee(workItem, employeeId);

    if (workItem?.station === "kitchen") summary.kitchenItems += 1;
    if (workItem?.station === "bar") summary.barItems += 1;
    if (["ready", "served"].includes(workItem?.status) || workItem?.readyAt) summary.preparedItems += 1;
    if (workItem?.status === "served" || workItem?.servedAt) summary.servedItems += 1;
    if (workItem?.status === "cancelled" || workItem?.cancelledAt) summary.cancelledItems += 1;
    if (workItem?.status === "returned" || workItem?.returnedAt) summary.returnedItems += 1;
    if (workItem?.status === "cancelled" || workItem?.cancelledAt) {
      if (workItem?.issueReasonKitchenRelated === true) summary.kitchenRelatedCancelledItems += 1;
      else summary.nonKitchenCancelledItems += 1;
    }
    if (workItem?.status === "returned" || workItem?.returnedAt) {
      if (workItem?.issueReasonKitchenRelated === true) summary.kitchenRelatedReturnedItems += 1;
      else summary.nonKitchenReturnedItems += 1;
    }
    if (workItem?.timeLevel === "on_time") summary.onTimeItems += 1;
    if (workItem?.timeLevel === "late") summary.lateItems += 1;
    if (workItem?.timeLevel === "very_late") summary.veryLateItems += 1;
    if (workItem?.noRoster === true) summary.noRosterItems += 1;

    if (roleFlags.isHeadChef) summary.headChefItems += 1;
    if (roleFlags.isAssistant) summary.assistantItems += 1;
    if (roleFlags.isTeam) summary.teamItems += 1;
    if (roleFlags.isBarLead) summary.barLeadItems += 1;
    if (roleFlags.isBarStaff) summary.barStaffItems += 1;
    if (roleFlags.isUnacceptedResponsible) summary.unacceptedResponsibleItems += 1;

    if (workItem?.unaccepted === true && roleFlags.isUnacceptedResponsible) {
      summary.unacceptedItems += 1;
    }

    const actualPrepMinutes = Number(workItem?.actualPrepMinutes);
    if (Number.isFinite(actualPrepMinutes) && actualPrepMinutes >= 0) actualPrepValues.push(actualPrepMinutes);

    const targetPrepMinutes = Number(workItem?.targetPrepMinutes);
    if (Number.isFinite(targetPrepMinutes) && targetPrepMinutes > 0) targetPrepValues.push(targetPrepMinutes);
  }

  if (actualPrepValues.length > 0) {
    const avg = actualPrepValues.reduce((sum, v) => sum + v, 0) / actualPrepValues.length;
    summary.avgPrepMinutes = Math.round(avg * 10) / 10;
  }

  if (targetPrepValues.length > 0) {
    const avg = targetPrepValues.reduce((sum, v) => sum + v, 0) / targetPrepValues.length;
    summary.targetPrepMinutesAvg = Math.round(avg * 10) / 10;
  }

  if (summary.totalItems > 0) {
    summary.note = "Dữ liệu bếp/bar là nguồn bằng chứng; việc có làm thay đổi điểm hay không được quyết định trong qualityEvidence theo vai trò và lỗi có thể quy trách nhiệm.";
  }

  return summary;
}

async function getKitchenMetricsForEmployee({ employeeId, restaurantId, periodStart, periodEnd }) {
  const match = buildKitchenMetricsMatchForEmployee({ employeeId, restaurantId, periodStart, periodEnd });
  const workItems = await KitchenOrderWorkItem.find(match).lean();
  return buildKitchenMetricsSummary(workItems, employeeId);
}
async function getCashierMetricsForEmployee({ employeeId, restaurantId, periodStart, periodEnd }) {
  // TODO: Integrate PaymentSession reconciliation when QR/provider callbacks are used as authoritative cashier scoring evidence. Current scoring relies on Order payment state and attribution text only to remain conservative.
  const orders = await Order.find({
    restaurantId,
    $or: [
      { "payment.paidBy": employeeId, "payment.paidAt": { $gte: periodStart, $lte: periodEnd } },
      { "payment.requestedBy": employeeId, "payment.requestedAt": { $gte: periodStart, $lte: periodEnd } },
      { customerRequests: { $elemMatch: { acknowledgedBy: employeeId, acknowledgedAt: { $gte: periodStart, $lte: periodEnd } } } },
      { customerRequests: { $elemMatch: { resolvedBy: employeeId, resolvedAt: { $gte: periodStart, $lte: periodEnd } } } },
    ],
  }).lean();

  let wrongBillIssues = 0;
  let paymentErrors = 0;
  let cashierRefunds = 0;
  let latePaymentRequests = 0;
  let unauthorizedDiscounts = 0;

  for (const order of orders) {
    const texts = [order?.payment?.requestClearReason, order?.payment?.requestNote];
    for (const item of order?.items || []) {
      for (const req of item?.voidRequests || []) {
        if (["approved", "accepted", "resolved"].includes(String(req?.status || "").toLowerCase()) && hasCashierAttribution(req?.reason, req?.reviewNote, ...texts)) wrongBillIssues += 1;
      }
      for (const req of item?.returnRequests || []) {
        if (["approved", "accepted", "resolved"].includes(String(req?.status || "").toLowerCase()) && hasCashierAttribution(req?.reason, req?.reviewNote, ...texts)) wrongBillIssues += 1;
      }
    }

    const paymentStatus = normalizeTextNoAccent(order?.payment?.status || order?.orderPaymentStatus);
    const isFailedPayment = paymentStatus.includes("failed");
    const isRefunded = paymentStatus.includes("refunded");
    if (isFailedPayment && hasCashierAttribution(...texts)) paymentErrors += 1;
    if (isRefunded) {
      const returnTexts = (order?.items || []).flatMap((item) => (item?.returnRequests || []).flatMap((req) => [req?.reason, req?.reviewNote]));
      if (hasCashierAttribution(...returnTexts, ...texts)) cashierRefunds += 1;
    }

    for (const req of order?.customerRequests || []) {
      if (req?.type !== "PAYMENT_REQUEST") continue;
      const ackByCashier = req?.acknowledgedBy && String(req.acknowledgedBy) === String(employeeId);
      const resByCashier = req?.resolvedBy && String(req.resolvedBy) === String(employeeId);
      const inPeriod = (req?.acknowledgedAt && req.acknowledgedAt >= periodStart && req.acknowledgedAt <= periodEnd) || (req?.resolvedAt && req.resolvedAt >= periodStart && req.resolvedAt <= periodEnd);
      if (!inPeriod || (!ackByCashier && !resByCashier) || !req?.createdAt) continue;
      const base = new Date(req.createdAt).getTime();
      if (!Number.isFinite(base)) continue;
      const ackAtMs = req?.acknowledgedAt ? new Date(req.acknowledgedAt).getTime() : null;
      const resolvedAtMs = req?.resolvedAt ? new Date(req.resolvedAt).getTime() : null;
      const ackDelayMs = Number.isFinite(ackAtMs) ? ackAtMs - base : null;
      const resDelayMs = Number.isFinite(resolvedAtMs) ? resolvedAtMs - base : null;
      const isAckLate = ackByCashier && Number.isFinite(ackDelayMs) && ackDelayMs > 3 * 60 * 1000;
      const isResolveLate = resByCashier && Number.isFinite(resDelayMs) && resDelayMs > 8 * 60 * 1000;
      if (isAckLate || isResolveLate) latePaymentRequests += 1;
    }

    const discount = Number(order?.totals?.discount || 0);
    const hasValidVoucherOrPromo = Boolean(order?.totals?.voucherCode || order?.totals?.promotionId);
    if (discount > 0 && !hasValidVoucherOrPromo) {
      const reason = String(order?.totals?.discountReason || "").trim();
      if (!reason || hasCashierAttribution(reason)) unauthorizedDiscounts += 1;
    }
  }
  const totalHandledPayments = orders.length;
  const wrongBillRate = safeRate(wrongBillIssues, totalHandledPayments);
  const paymentErrorRate = safeRate(paymentErrors, totalHandledPayments);
  const cashierRefundRate = safeRate(cashierRefunds, totalHandledPayments);
  const latePaymentRequestRate = safeRate(latePaymentRequests, totalHandledPayments);
  const unauthorizedDiscountRate = safeRate(unauthorizedDiscounts, totalHandledPayments);
  const cashVarianceRate = 0; // TODO: bổ sung từ dữ liệu reconciliation khi có model CashierShiftReconciliation.
  const operationalPenalty = calculateCashierOperationalPenalty({ wrongBillRate, paymentErrorRate, cashierRefundRate, latePaymentRequestRate, unauthorizedDiscountRate, cashVarianceRate });
  return {
    totalHandledPayments, wrongBillIssues, paymentErrors, cashierRefunds, latePaymentRequests, unauthorizedDiscounts, cashVarianceRate,
    wrongBillRate, paymentErrorRate, cashierRefundRate, latePaymentRequestRate, unauthorizedDiscountRate,
    operationalPenalty, affectsScore: operationalPenalty > 0, attributionSource: "order_payment_customer_requests", note: operationalPenalty > 0 ? "Có lỗi nghiệp vụ thu ngân có quy trách nhiệm trong kỳ." : "Không có lỗi nghiệp vụ thu ngân có thể quy trách nhiệm trong kỳ.",
  };
}
async function calculateSnapshotForEmployee({
  employeeId,
  restaurantId,
  periodStart,
  periodEnd,
  ctx,
  unacceptedAuditResult,
  unacceptedAuditNow,
}) {
  const staff = await Staff.findById(employeeId).lean();

  if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const [timesheets, shifts, correctionsCount, review, benchmark, customerRatingAgg, kitchenMetrics, cashierMetrics] =
    await Promise.all([
      Timesheet.find({
        employeeId,
        restaurantId,
        workDate: { $gte: periodStart, $lte: periodEnd },
      }).lean(),

      Shift.find({
        employeeId,
        restaurantId,
        startTime: { $lte: periodEnd },
        endTime: { $gte: periodStart },
        status: { $ne: "cancelled" },
      }).lean(),

      AttendanceCorrectionRequest.countDocuments({
        employeeId,
        restaurantId,
        workDate: { $gte: periodStart, $lte: periodEnd },
        status: { $in: ["pending", "approved", "applied", "rejected"] },
      }),

      StaffPerformanceReview.findOne({
        employeeId,
        restaurantId,
        periodStart,
        periodEnd,
      }).lean(),

      getPeerOrderBenchmark({
        restaurantId,
        periodStart,
        periodEnd,
      }),
      Review.aggregate([
        {
          $match: {
            staffId: employeeId,
            restaurantId,
            createdAt: { $gte: periodStart, $lte: periodEnd },
            status: "published",
            rating: { $gte: 1, $lte: 5 },
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
            verifiedReviews: { $sum: { $cond: ["$verifiedPurchase", 1, 0] } },
            verifiedRatingSum: { $sum: { $cond: ["$verifiedPurchase", "$rating", 0] } },
          },
        },
      ]),
      getKitchenMetricsForEmployee({ employeeId, restaurantId, periodStart, periodEnd }),
      getCashierMetricsForEmployee({ employeeId, restaurantId, periodStart, periodEnd }),
    ]);

  const staffRateRaw = Number(customerRatingAgg?.[0]?.averageRating || 0);
  const staffRate = Number.isFinite(staffRateRaw)
    ? Math.round(staffRateRaw * 100) / 100
    : 0;
  const staffRateCount = Number(customerRatingAgg?.[0]?.totalReviews || 0);
  const verifiedStaffRateCount = Number(customerRatingAgg?.[0]?.verifiedReviews || 0);
  const unverifiedStaffRateCount = Math.max(0, staffRateCount - verifiedStaffRateCount);
  const verifiedStaffRate = verifiedStaffRateCount > 0
    ? Math.round((Number(customerRatingAgg?.[0]?.verifiedRatingSum || 0) / verifiedStaffRateCount) * 100) / 100
    : 0;
  const customerRatingScore = staffRateCount >= 3 ? clampScore(staffRate * 20, 0) : 0;

  const orderCount = benchmark.byEmployeeId.get(String(employeeId)) || 0;
  const shiftsCount = shifts.length;
  const scheduledMinutes = sumScheduledMinutes(shifts, periodStart, periodEnd);
  const actualWorkedMinutes = Math.round(
    timesheets.reduce((sum, row) => {
      const workedMinutes = Number(row?.workedMinutes);
      if (Number.isFinite(workedMinutes) && workedMinutes > 0) {
        return sum + workedMinutes;
      }
      const checkIn = row?.actualCheckInAt ? new Date(row.actualCheckInAt) : null;
      const checkOut = row?.actualCheckOutAt ? new Date(row.actualCheckOutAt) : null;
      if (
        !checkIn ||
        !checkOut ||
        Number.isNaN(checkIn.getTime()) ||
        Number.isNaN(checkOut.getTime()) ||
        checkOut <= checkIn
      ) {
        return sum;
      }
      return sum + (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);
    }, 0),
  );

  const recordCount = timesheets.length;
  const lateEvents = timesheets.filter(
    (row) => Number(row.latenessMinutes || 0) > 0,
  ).length;
  const earlyEvents = timesheets.filter(
    (row) => Number(row.earlyLeaveMinutes || 0) > 0,
  ).length;
  const absenceEvents = timesheets.filter((row) => !row.actualCheckInAt).length;

  const totalLateMinutes = timesheets.reduce(
    (sum, row) => sum + Number(row.latenessMinutes || 0),
    0,
  );
  const totalEarlyMinutes = timesheets.reduce(
    (sum, row) => sum + Number(row.earlyLeaveMinutes || 0),
    0,
  );

  const punctualityPenalty =
    lateEvents * 6 +
    earlyEvents * 5 +
    absenceEvents * 12 +
    totalLateMinutes * 0.15 +
    totalEarlyMinutes * 0.12;

  const punctualityScore =
    recordCount > 0 ? clampScore(100 - punctualityPenalty, 75) : 75;

  const baseSkillScore = review ? clampScore(review.skillScore, 75) : 75;
  const qualityEvidence = buildQualityEvidenceForEmployee({
    staff,
    baseSkillScore,
    hasManagerReview: Boolean(review),
    kitchenMetrics,
    cashierMetrics,
    customerRatingScore,
    staffRateCount,
  });
  const qualityScore = qualityEvidence.score;
  if (Number(kitchenMetrics.totalItems || 0) > 0) {
    kitchenMetrics.note = qualityEvidence.kitchenPenalty > 0
      ? `Dữ liệu bếp/bar được dùng làm bằng chứng để giảm ${qualityEvidence.kitchenPenalty} điểm trong thành phần Chất lượng theo vai trò; đây không phải điều chỉnh điểm độc lập.`
      : "Dữ liệu bếp/bar đã được đối chiếu nhưng không phát sinh điều chỉnh điểm Chất lượng trong kỳ.";
  }
  const managerBaseScore = review ? clampScore(review.managerRatingScore, 75) : 75;

  const compliancePenalty = correctionsCount * 7;
  const complianceScore = clampScore(100 - compliancePenalty, 75);

  const hasPerformanceActivity = hasPerformanceEvidence({
    scheduledMinutes,
    actualWorkedMinutes,
    recordCount,
    orderCount,
    hasManagerReview: Boolean(review),
    correctionsCount,
    staffRateCount,
    kitchenMetrics,
    cashierMetrics,
  });
  const insufficientData = !hasPerformanceActivity;

  const productivityScore = insufficientData
    ? 0
    : scheduledMinutes > 0
      ? clampScore((actualWorkedMinutes / scheduledMinutes) * 100, 0)
      : recordCount > 0
        ? 75
        : 0;

  const productivityNote = insufficientData
    ? "Không có dữ liệu làm việc trong kỳ."
    : scheduledMinutes > 0
      ? "Dựa trên tỷ lệ hoàn thành thời lượng ca được phân công trong kỳ; order chỉ dùng làm dữ liệu tham khảo."
      : "Có dữ liệu chấm công nhưng thiếu lịch phân ca, dùng điểm trung lập.";

  const components = {
    productivity: {
      score: productivityScore,
      weight: PERFORMANCE_WEIGHTS.productivity,
      note: productivityNote,
    },
    punctuality: {
      score: insufficientData ? 0 : punctualityScore,
      weight: PERFORMANCE_WEIGHTS.punctuality,
      note: insufficientData
        ? "Không có dữ liệu làm việc trong kỳ."
        : "Dựa trên đi trễ, về sớm, vắng mặt và tổng số phút vi phạm.",
    },
    quality: {
      score: insufficientData ? 0 : qualityScore,
      weight: PERFORMANCE_WEIGHTS.quality,
      note: insufficientData
        ? "Không có dữ liệu làm việc trong kỳ."
        : qualityEvidence.note,
    },
    managerReview: {
      score: insufficientData ? 0 : managerBaseScore,
      weight: PERFORMANCE_WEIGHTS.managerReview,
      note: insufficientData
        ? "Không có dữ liệu làm việc trong kỳ."
        : review
          ? "Dựa trên điểm đánh giá tổng quan của quản lý trong kỳ."
          : "Chưa có đánh giá quản lý, dùng điểm trung lập.",
    },
    compliance: {
      score: insufficientData ? 0 : complianceScore,
      weight: PERFORMANCE_WEIGHTS.compliance,
      note: insufficientData
        ? "Không có dữ liệu làm việc trong kỳ."
        : "Dựa trên số yêu cầu chỉnh công và mức độ tuân thủ quy trình.",
    },
  };

  const baseFormulaScore = insufficientData ? 0 : weightedFinalScore(components);
  const adjustmentSummary = await resolvePerformanceScoreAdjustmentSummary({
    employeeId,
    restaurantId,
    periodStart,
    periodEnd,
  });
  const hasAdjustmentDelta = Number(adjustmentSummary.finalAdjustmentDelta || 0) !== 0;
  const finalPerformanceScore = insufficientData && !hasAdjustmentDelta
    ? 0
    : clampScore(baseFormulaScore + Number(adjustmentSummary.finalAdjustmentDelta || 0), 0);

  const actorId = getActorId(ctx);

  const doc = await StaffPerformanceSnapshot.findOneAndUpdate(
    {
      employeeId,
      restaurantId,
      periodStart,
      periodEnd,
    },
    {
      $set: {
        ...components,
        finalPerformanceScore,
        performanceLevel: insufficientData
          ? "poor"
          : resolvePerformanceLevel(finalPerformanceScore),
        factors: {
          orderCount,
          peerMaxOrderCount: benchmark.maxOrders,
          shiftsCount,
          recordCount,
          lateEvents,
          earlyEvents,
          absenceEvents,
          totalLateMinutes,
          totalEarlyMinutes,
          correctionsCount,
          staffRate,
          staffRateCount,
          verifiedStaffRate,
          verifiedStaffRateCount,
          unverifiedStaffRateCount,
          customerRatingScore,
          hasManagerReview: Boolean(review),
          qualityEvidence: {
            baseSkillScore,
            finalQualityScore: insufficientData ? 0 : qualityScore,
            roleGroup: qualityEvidence.roleGroup,
            kitchenPenalty: qualityEvidence.kitchenPenalty,
            customerPenalty: qualityEvidence.customerPenalty,
            cashierOperationalPenalty: qualityEvidence.cashierOperationalPenalty,
            totalPenalty: qualityEvidence.totalPenalty,
            hasManagerReview: qualityEvidence.hasManagerReview,
            hasKitchenEvidence: qualityEvidence.hasKitchenEvidence,
            hasCustomerEvidence: qualityEvidence.hasCustomerEvidence,
            hasCashierOperationalEvidence: qualityEvidence.hasCashierOperationalEvidence,
            evidenceSource: qualityEvidence.evidenceSource,
            affectsScore: qualityEvidence.affectsScore,
            note: `${qualityEvidence.note} Dữ liệu khách hàng, bếp và thu ngân chỉ điều chỉnh thành phần Chất lượng khi có penalty theo vai trò; không tự động kỷ luật.`,
          },
          scheduledMinutes,
          actualWorkedMinutes,
          productivitySource: "shift_completion",
          hasPerformanceActivity,
          insufficientData,
          kitchenMetrics,
          cashierMetrics,
          baseFormulaScore,
          incidentAdjustmentDelta: adjustmentSummary.incidentAdjustmentDelta,
          appealReversalDelta: adjustmentSummary.appealReversalDelta,
          finalAdjustmentDelta: adjustmentSummary.finalAdjustmentDelta,
          appliedAdjustmentCount: adjustmentSummary.appliedAdjustmentCount,
          reversedAppealCount: adjustmentSummary.reversedAppealCount,
          appliedIncidentIds: adjustmentSummary.appliedIncidentIds,
          scoreReversalIds: adjustmentSummary.reversalIds,
          ...(unacceptedAuditResult
            ? {
                unacceptedAuditRefreshed: true,
                unacceptedAuditRefreshedAt: new Date(),
                unacceptedAuditEffectiveAt: unacceptedAuditNow,
                unacceptedAuditMatchedCount: Number(unacceptedAuditResult?.matchedCount || 0),
                unacceptedAuditModifiedCount: Number(unacceptedAuditResult?.modifiedCount || 0),
              }
            : {}),
        },
        generatedBy: actorId,
        generatedByName: getActorName(ctx),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  )
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .lean();

  return mapSnapshot(doc);
}

export async function upsertStaffPerformanceReview({ input, ctx }) {
  assertCanManagePerformance(ctx);

  const employeeId = toObjectId(input.employeeId);
  const restaurantId = toObjectId(input.restaurantId);

  if (!employeeId) throw new Error("employeeId không hợp lệ.");
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");

  const periodStart = toStartOfDay(input.periodStart);
  const periodEnd = toEndOfDay(input.periodEnd);

  if (periodEnd < periodStart) {
    throw new Error("Khoảng thời gian đánh giá không hợp lệ.");
  }

  const doc = await StaffPerformanceReview.findOneAndUpdate(
    {
      employeeId,
      restaurantId,
      periodStart,
      periodEnd,
    },
    {
      $set: {
        managerRatingScore: clampScore(input.managerRatingScore, 75),
        attitudeScore: clampScore(input.attitudeScore, 75),
        teamworkScore: clampScore(input.teamworkScore, 75),
        skillScore: clampScore(input.skillScore, 75),
        note: String(input.note || "").trim(),
        reviewedBy: getActorId(ctx),
        reviewedByName: getActorName(ctx),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  )
    .populate("employeeId", "fullName employeeCode")
    .lean();

  return mapReview(doc);
}

export async function recalculateStaffPerformanceSnapshots({ input, ctx }) {
  assertCanManagePerformance(ctx);

  const restaurantId = toObjectId(input.restaurantId);
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");

  const periodStart = toStartOfDay(input.periodStart);
  const periodEnd = toEndOfDay(input.periodEnd);

  if (periodEnd < periodStart) {
    throw new Error("Khoảng thời gian đánh giá không hợp lệ.");
  }

  const employeeId = toObjectId(input.employeeId);
  const unacceptedAuditNow = resolveUnacceptedAuditNow(periodEnd);

  const unacceptedAuditResult = await markUnacceptedKitchenOrderWorkItems({
    restaurantId,
    now: unacceptedAuditNow,
  });

  const staffFilter = {
    userType: "STAFF",
    deletedAt: null,
    $or: [
      { restaurantForStaff: restaurantId },
    ],
  };

  if (employeeId) {
    staffFilter._id = employeeId;
    delete staffFilter.$or;
  }

  const staffList = await Staff.find(staffFilter).select({ _id: 1 }).lean();

  const results = [];

  for (const staff of staffList) {
    const result = await calculateSnapshotForEmployee({
      employeeId: staff._id,
      restaurantId,
      periodStart,
      periodEnd,
      ctx,
      unacceptedAuditResult,
      unacceptedAuditNow,
    });

    results.push(result);
  }

  return results;
}

export async function listStaffPerformanceSnapshots({ filter = {}, ctx }) {
  const query = {};

  const restaurantId = toObjectId(filter.restaurantId);
  const employeeId = toObjectId(filter.employeeId);

  if (restaurantId) query.restaurantId = restaurantId;
  if (employeeId) query.employeeId = employeeId;

  if (filter.periodStart || filter.periodEnd) {
    query.periodStart = {};
    if (filter.periodStart)
      query.periodStart.$gte = toStartOfDay(filter.periodStart);
    if (filter.periodEnd) query.periodStart.$lte = toEndOfDay(filter.periodEnd);
  }

  if (employeeId) {
    assertCanViewPerformance(ctx, employeeId);
  }

  const rows = await StaffPerformanceSnapshot.find(query)
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .sort({ periodEnd: -1, finalPerformanceScore: -1 })
    .limit(1000)
    .lean();

  return rows.map(mapSnapshot);
}

export async function getLatestStaffPerformanceSnapshot({
  employeeId,
  restaurantId,
  atDate,
}) {
  const eid = toObjectId(employeeId);
  const rid = toObjectId(restaurantId);

  if (!eid || !rid) return null;

  const date = atDate ? new Date(atDate) : new Date();

  const exact = await StaffPerformanceSnapshot.findOne({
    employeeId: eid,
    restaurantId: rid,
    periodStart: { $lte: date },
    periodEnd: { $gte: date },
  })
    .sort({ periodEnd: -1, createdAt: -1 })
    .lean();

  if (exact) return exact;

  return StaffPerformanceSnapshot.findOne({
    employeeId: eid,
    restaurantId: rid,
    periodEnd: { $lte: date },
  })
    .sort({ periodEnd: -1, createdAt: -1 })
    .lean();
}
