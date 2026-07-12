import mongoose from "mongoose";
import {
  AuditLog,
  BrandMembership,
  CashierShiftReconciliation,
  Invoice,
  Order,
  PaymentRefund,
  PaymentTransaction,
  Shift,
  Staff,
  StaffPerformanceSnapshot,
  Timesheet,
} from "../../../models/index.js";
import {
  resolveUserRoles,
  userCanAccessRestaurant,
} from "../scheduling/schedulingPermission.service.js";

const { Types } = mongoose;

const REVIEW_ROLES = new Set(["ADMIN", "MANAGER", "HR", "ACCOUNTANT"]);
const ACTIVE_STATUSES = new Set(["OPEN", "SUBMITTED"]);
const TERMINAL_STATUSES = new Set(["APPROVED", "WAIVED", "REJECTED"]);
const PERFORMANCE_WEIGHTS = Object.freeze({
  productivity: 25,
  punctuality: 25,
  quality: 20,
  managerReview: 20,
  compliance: 10,
});

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
  "thieu tien",
  "thua tien",
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

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new Types.ObjectId(value);
}

function actorIdFromContext(ctx) {
  return toObjectId(ctx?.user?.id || ctx?.user?._id);
}

function normalizeTextNoAccent(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function normalizeRegisterCode(value) {
  const normalized = String(value || "MAIN").trim().toUpperCase();
  return normalized || "MAIN";
}

function normalizeDate(value, fieldName, fallback = null) {
  const date = value ? new Date(value) : fallback;
  if (!date || Number.isNaN(date.getTime())) {
    const error = new Error(`${fieldName} không hợp lệ.`);
    error.code = "BAD_USER_INPUT";
    throw error;
  }
  return date;
}

function normalizeMoney(value, fieldName, { allowNegative = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || (!allowNegative && number < 0)) {
    const error = new Error(`${fieldName} không hợp lệ.`);
    error.code = "BAD_USER_INPUT";
    throw error;
  }
  return Math.round(number);
}

function safeRate(count, total) {
  const numerator = Number(count || 0);
  const denominator = Number(total || 0);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function roundOneDecimal(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 10) / 10;
}

function clampScore(value, fallback = 75) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function hasManagerRole(ctx) {
  return resolveUserRoles(ctx?.user || {}).some((role) => REVIEW_ROLES.has(role));
}

function assertActor(ctx) {
  const actorId = actorIdFromContext(ctx);
  if (!actorId) {
    const error = new Error("Unauthorized");
    error.code = "UNAUTHENTICATED";
    throw error;
  }
  return actorId;
}

async function assertRestaurantAccess(ctx, restaurantId) {
  const allowed = await userCanAccessRestaurant(ctx?.user || {}, restaurantId);
  if (!allowed) {
    const error = new Error("Bạn không có quyền truy cập nhà hàng này.");
    error.code = "FORBIDDEN";
    throw error;
  }
}

function assertManagerOrSelf(ctx, cashierId, { managerOnly = false } = {}) {
  const actorId = assertActor(ctx);
  if (hasManagerRole(ctx)) return actorId;
  if (!managerOnly && String(actorId) === String(cashierId)) return actorId;
  const error = new Error(
    managerOnly
      ? "Chỉ quản lý được phép duyệt đối soát ca thu ngân."
      : "Bạn chỉ được thao tác đối soát của chính mình.",
  );
  error.code = "FORBIDDEN";
  throw error;
}

function isCashierAttributableReason(value) {
  const text = normalizeTextNoAccent(value);
  return Boolean(text && CASHIER_REASON_KEYWORDS.some((keyword) => text.includes(keyword)));
}

function isNonCashierReason(value) {
  const text = normalizeTextNoAccent(value);
  return Boolean(text && NON_CASHIER_REASON_KEYWORDS.some((keyword) => text.includes(keyword)));
}

function hasCashierAttribution(...values) {
  if (values.some((value) => isNonCashierReason(value))) return false;
  return values.some((value) => isCashierAttributableReason(value));
}

function uniqueIds(values = []) {
  return [...new Map(values.filter(Boolean).map((value) => [String(value), value])).values()];
}

function buildActiveKey({ restaurantId, cashierId, registerCode }) {
  return `${String(restaurantId)}:${String(cashierId)}:${normalizeRegisterCode(registerCode)}`;
}

function auditEntry({ action, actorId, previousStatus, nextStatus, note, metadata }) {
  return {
    action,
    actorId,
    previousStatus,
    nextStatus,
    note: String(note || "").trim(),
    metadata,
    at: new Date(),
  };
}

async function safeAuditLog(payload) {
  try {
    await AuditLog.create(payload);
  } catch (error) {
    console.warn("[cashierShiftReconciliation] audit log failed", error?.message || error);
  }
}

function mapMovement(movement) {
  if (!movement) return null;
  return {
    id: String(movement._id || movement.id),
    type: movement.type,
    amount: Number(movement.amount || 0),
    reason: movement.reason || "",
    occurredAt: movement.occurredAt || null,
    createdBy: movement.createdBy ? String(movement.createdBy) : null,
  };
}

export function mapCashierShiftReconciliation(doc) {
  if (!doc) return null;
  const source = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const cashier = source.cashierId;
  return {
    id: String(source._id || source.id),
    restaurantId: String(source.restaurantId),
    cashierId: String(cashier?._id || cashier),
    cashierName: cashier?.fullName || null,
    cashierCode: cashier?.employeeCode || null,
    shiftId: source.shiftId ? String(source.shiftId) : null,
    timesheetId: source.timesheetId ? String(source.timesheetId) : null,
    registerCode: source.registerCode || "MAIN",
    status: source.status,
    openedAt: source.openedAt || null,
    closedAt: source.closedAt || null,
    submittedAt: source.submittedAt || null,
    reviewedAt: source.reviewedAt || null,
    lockedAt: source.lockedAt || null,
    openingCash: Number(source.openingCash || 0),
    actualCash: source.actualCash == null ? null : Number(source.actualCash),
    cashSalesAmount: Number(source.cashSalesAmount || 0),
    cashRefundAmount: Number(source.cashRefundAmount || 0),
    movementNetAmount: Number(source.movementNetAmount || 0),
    managerAdjustmentAmount: Number(source.managerAdjustmentAmount || 0),
    expectedCash: Number(source.expectedCash || 0),
    varianceAmount: Number(source.varianceAmount || 0),
    varianceRate: Number(source.varianceRate || 0),
    attributableToCashier: Boolean(source.attributableToCashier),
    cashierNote: source.cashierNote || "",
    reviewNote: source.reviewNote || "",
    evidenceAttachments: source.evidenceAttachments || [],
    movements: (source.movements || []).map(mapMovement).filter(Boolean),
    transactionIds: (source.transactionIds || []).map(String),
    refundIds: (source.refundIds || []).map(String),
    calculatedAt: source.calculatedAt || null,
    openedBy: source.openedBy ? String(source.openedBy) : null,
    submittedBy: source.submittedBy ? String(source.submittedBy) : null,
    reviewedBy: source.reviewedBy ? String(source.reviewedBy) : null,
    auditTrail: (source.auditTrail || []).map((item) => ({
      action: item.action,
      actorId: item.actorId ? String(item.actorId) : null,
      previousStatus: item.previousStatus || null,
      nextStatus: item.nextStatus || null,
      note: item.note || "",
      metadata: item.metadata || null,
      at: item.at || null,
    })),
    createdAt: source.createdAt || null,
    updatedAt: source.updatedAt || null,
  };
}

export function calculateCashierReconciliationAmounts({
  openingCash = 0,
  cashSalesAmount = 0,
  cashRefundAmount = 0,
  movements = [],
  managerAdjustmentAmount = 0,
  actualCash = null,
} = {}) {
  const movementNetAmount = (movements || []).reduce((sum, movement) => {
    const amount = Math.max(0, Number(movement?.amount || 0));
    return sum + (movement?.type === "CASH_OUT" ? -amount : amount);
  }, 0);
  const expectedCash = Math.max(
    0,
    Math.round(
      Number(openingCash || 0) +
        Number(cashSalesAmount || 0) -
        Number(cashRefundAmount || 0) +
        movementNetAmount +
        Number(managerAdjustmentAmount || 0),
    ),
  );
  const hasActualCash = actualCash !== null && actualCash !== undefined;
  const varianceAmount = hasActualCash
    ? Math.round(Number(actualCash || 0) - expectedCash)
    : 0;
  const varianceRate = hasActualCash && expectedCash > 0
    ? Math.abs(varianceAmount) / expectedCash
    : 0;

  return {
    movementNetAmount: Math.round(movementNetAmount),
    expectedCash,
    varianceAmount,
    varianceRate,
  };
}

async function assertCashierRestaurantScope({ cashierId, restaurantId }) {
  const staff = await Staff.findOne({
    _id: cashierId,
    userType: "STAFF",
    deletedAt: null,
  })
    .select("_id fullName employeeCode restaurantForStaff department positionTitle roleName")
    .lean();
  if (!staff) {
    const error = new Error("Không tìm thấy nhân viên thu ngân.");
    error.code = "BAD_USER_INPUT";
    throw error;
  }

  const legacyScopeMatches = String(staff.restaurantForStaff || "") === String(restaurantId);
  const membership = await BrandMembership.findOne({
    userId: cashierId,
    status: "active",
    $or: [
      { role: { $in: ["owner", "admin"] } },
      { restaurantIds: restaurantId },
    ],
  })
    .select("_id")
    .lean();

  if (!legacyScopeMatches && !membership) {
    const error = new Error("Nhân viên không thuộc phạm vi nhà hàng đã chọn.");
    error.code = "BAD_USER_INPUT";
    throw error;
  }
  return staff;
}

async function assertOptionalShiftBindings({
  shiftId,
  timesheetId,
  cashierId,
  restaurantId,
}) {
  if (shiftId) {
    const shift = await Shift.findOne({
      _id: shiftId,
      employeeId: cashierId,
      restaurantId,
      status: { $ne: "cancelled" },
    })
      .select("_id")
      .lean();
    if (!shift) throw new Error("Ca làm không thuộc nhân viên hoặc nhà hàng đã chọn.");
  }
  if (timesheetId) {
    const timesheet = await Timesheet.findOne({
      _id: timesheetId,
      employeeId: cashierId,
      restaurantId,
    })
      .select("_id")
      .lean();
    if (!timesheet) throw new Error("Bảng công không thuộc nhân viên hoặc nhà hàng đã chọn.");
  }
}

async function findCashierAttributedOrderIds({
  cashierId,
  restaurantId,
  periodStart,
  periodEnd,
}) {
  const rows = await Order.find({
    restaurantId,
    "payment.paidBy": cashierId,
    "payment.paidAt": { $gte: periodStart, $lte: periodEnd },
  })
    .select("_id")
    .lean();
  return rows.map((row) => row._id);
}

async function findCashierHandledTransactions({
  cashierId,
  restaurantId,
  periodStart,
  periodEnd,
  statuses = ["SUCCESS"],
  methods = null,
}) {
  const orderIds = await findCashierAttributedOrderIds({
    cashierId,
    restaurantId,
    periodStart,
    periodEnd,
  });
  const attribution = [{ createdBy: cashierId }];
  if (orderIds.length) {
    attribution.push({ orderId: { $in: orderIds } }, { orderIds: { $in: orderIds } });
  }
  const filter = {
    restaurantId,
    status: { $in: statuses },
    paidAt: { $gte: periodStart, $lte: periodEnd },
    $or: attribution,
  };
  if (methods?.length) filter.method = { $in: methods };
  return PaymentTransaction.find(filter).lean();
}

async function resolveReconciliationCashSources(doc, endAt = null) {
  const periodStart = normalizeDate(doc.openedAt, "Thời điểm mở ca");
  const periodEnd = normalizeDate(
    endAt || doc.closedAt,
    "Thời điểm kết thúc ca",
    new Date(),
  );
  if (periodEnd < periodStart) throw new Error("Thời điểm kết thúc phải sau thời điểm mở ca.");

  const [transactions, refunds] = await Promise.all([
    findCashierHandledTransactions({
      cashierId: doc.cashierId,
      restaurantId: doc.restaurantId,
      periodStart,
      periodEnd,
      statuses: ["SUCCESS"],
      methods: ["cash"],
    }),
    PaymentRefund.find({
      restaurantId: doc.restaurantId,
      processedBy: doc.cashierId,
      status: "success",
      method: "cash",
      processedAt: { $gte: periodStart, $lte: periodEnd },
    }).lean(),
  ]);

  return {
    periodEnd,
    transactions,
    refunds,
    cashSalesAmount: transactions.reduce(
      (sum, transaction) => sum + Number(transaction?.paidAmount || 0),
      0,
    ),
    cashRefundAmount: refunds.reduce(
      (sum, refund) => sum + Number(refund?.amount || 0),
      0,
    ),
  };
}

async function recalculateReconciliationDocument(doc, { endAt = null } = {}) {
  const sources = await resolveReconciliationCashSources(doc, endAt);
  const amounts = calculateCashierReconciliationAmounts({
    openingCash: doc.openingCash,
    cashSalesAmount: sources.cashSalesAmount,
    cashRefundAmount: sources.cashRefundAmount,
    movements: doc.movements,
    managerAdjustmentAmount: doc.managerAdjustmentAmount,
    actualCash: doc.actualCash,
  });
  doc.cashSalesAmount = Math.round(sources.cashSalesAmount);
  doc.cashRefundAmount = Math.round(sources.cashRefundAmount);
  doc.movementNetAmount = amounts.movementNetAmount;
  doc.expectedCash = amounts.expectedCash;
  doc.varianceAmount = amounts.varianceAmount;
  doc.varianceRate = amounts.varianceRate;
  doc.transactionIds = uniqueIds(sources.transactions.map((item) => item._id));
  doc.refundIds = uniqueIds(sources.refunds.map((item) => item._id));
  doc.calculatedAt = new Date();
  return doc;
}

async function loadReconciliation(id) {
  const reconciliationId = toObjectId(id);
  if (!reconciliationId) throw new Error("reconciliationId không hợp lệ.");
  const doc = await CashierShiftReconciliation.findById(reconciliationId);
  if (!doc) throw new Error("Không tìm thấy đối soát ca thu ngân.");
  return doc;
}

async function populateAndMap(doc) {
  await doc.populate("cashierId", "fullName employeeCode positionTitle department");
  return mapCashierShiftReconciliation(doc);
}

export async function listCashierShiftReconciliations({ filter = {}, ctx }) {
  const restaurantId = toObjectId(filter.restaurantId);
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");
  await assertRestaurantAccess(ctx, restaurantId);
  const actorId = assertActor(ctx);
  const query = { restaurantId };
  const cashierId = toObjectId(filter.cashierId);

  if (hasManagerRole(ctx)) {
    if (cashierId) query.cashierId = cashierId;
  } else {
    query.cashierId = actorId;
  }
  if (filter.status) query.status = String(filter.status).toUpperCase();
  if (filter.dateFrom || filter.dateTo) {
    query.openedAt = {};
    if (filter.dateFrom) query.openedAt.$gte = normalizeDate(filter.dateFrom, "Từ ngày");
    if (filter.dateTo) query.openedAt.$lte = normalizeDate(filter.dateTo, "Đến ngày");
  }

  const limit = Math.min(200, Math.max(1, Number(filter.limit || 100)));
  const rows = await CashierShiftReconciliation.find(query)
    .populate("cashierId", "fullName employeeCode positionTitle department")
    .sort({ openedAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map(mapCashierShiftReconciliation);
}

export async function openCashierShiftReconciliation({ input = {}, ctx }) {
  const restaurantId = toObjectId(input.restaurantId);
  const cashierId = toObjectId(input.cashierId);
  if (!restaurantId || !cashierId) throw new Error("restaurantId hoặc cashierId không hợp lệ.");
  await assertRestaurantAccess(ctx, restaurantId);
  const actorId = assertManagerOrSelf(ctx, cashierId);
  await assertCashierRestaurantScope({ cashierId, restaurantId });
  const shiftId = toObjectId(input.shiftId);
  const timesheetId = toObjectId(input.timesheetId);
  await assertOptionalShiftBindings({ shiftId, timesheetId, cashierId, restaurantId });

  const registerCode = normalizeRegisterCode(input.registerCode);
  const openingCash = normalizeMoney(input.openingCash, "Tiền đầu ca");
  const openedAt = normalizeDate(input.openedAt, "Thời điểm mở ca", new Date());
  const activeKey = buildActiveKey({ restaurantId, cashierId, registerCode });
  const existing = await CashierShiftReconciliation.findOne({ activeKey }).lean();
  if (existing) throw new Error("Thu ngân đang có một ca đối soát chưa hoàn tất tại quầy này.");

  let doc;
  try {
    doc = await CashierShiftReconciliation.create({
      restaurantId,
      cashierId,
      shiftId,
      timesheetId,
      registerCode,
      activeKey,
      status: "OPEN",
      openedAt,
      openingCash,
      expectedCash: openingCash,
      cashierNote: String(input.note || "").trim(),
      openedBy: actorId,
      auditTrail: [
        auditEntry({
          action: "cashier_reconciliation.open",
          actorId,
          nextStatus: "OPEN",
          note: input.note,
          metadata: { openingCash, registerCode },
        }),
      ],
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new Error("Thu ngân đang có một ca đối soát chưa hoàn tất tại quầy này.");
    }
    throw error;
  }

  await safeAuditLog({
    action: "CASHIER_SHIFT_RECONCILIATION_OPENED",
    module: "staff_performance",
    targetType: "CashierShiftReconciliation",
    targetId: doc._id,
    restaurantId,
    actorId,
    byUserId: actorId,
    after: doc.toObject(),
  });
  return populateAndMap(doc);
}

export async function addCashierShiftCashMovement({ input = {}, ctx }) {
  const doc = await loadReconciliation(input.reconciliationId);
  await assertRestaurantAccess(ctx, doc.restaurantId);
  const actorId = assertManagerOrSelf(ctx, doc.cashierId);
  if (doc.status !== "OPEN") throw new Error("Chỉ ca đang mở mới được ghi nhận tiền vào/ra.");
  const type = String(input.type || "").toUpperCase();
  if (!["CASH_IN", "CASH_OUT"].includes(type)) throw new Error("Loại biến động tiền mặt không hợp lệ.");
  const amount = normalizeMoney(input.amount, "Số tiền");
  if (amount <= 0) throw new Error("Số tiền phải lớn hơn 0.");
  const reason = String(input.reason || "").trim();
  if (!reason) throw new Error("Lý do biến động tiền mặt là bắt buộc.");

  doc.movements.push({
    type,
    amount,
    reason,
    occurredAt: normalizeDate(input.occurredAt, "Thời điểm phát sinh", new Date()),
    createdBy: actorId,
  });
  await recalculateReconciliationDocument(doc);
  doc.auditTrail.push(
    auditEntry({
      action: "cashier_reconciliation.movement_added",
      actorId,
      previousStatus: doc.status,
      nextStatus: doc.status,
      note: reason,
      metadata: { type, amount },
    }),
  );
  await doc.save();
  return populateAndMap(doc);
}

export async function refreshCashierShiftReconciliation({ id, ctx }) {
  const doc = await loadReconciliation(id);
  await assertRestaurantAccess(ctx, doc.restaurantId);
  const actorId = assertManagerOrSelf(ctx, doc.cashierId);
  if (!ACTIVE_STATUSES.has(doc.status)) throw new Error("Đối soát đã khóa và không thể tính lại.");
  await recalculateReconciliationDocument(doc);
  doc.auditTrail.push(
    auditEntry({
      action: "cashier_reconciliation.refreshed",
      actorId,
      previousStatus: doc.status,
      nextStatus: doc.status,
      metadata: {
        cashSalesAmount: doc.cashSalesAmount,
        cashRefundAmount: doc.cashRefundAmount,
        expectedCash: doc.expectedCash,
      },
    }),
  );
  await doc.save();
  return populateAndMap(doc);
}

export async function submitCashierShiftReconciliation({ input = {}, ctx }) {
  const doc = await loadReconciliation(input.reconciliationId);
  await assertRestaurantAccess(ctx, doc.restaurantId);
  const actorId = assertManagerOrSelf(ctx, doc.cashierId);
  if (doc.status !== "OPEN") throw new Error("Chỉ ca đang mở mới được nộp chốt quỹ.");
  const closedAt = normalizeDate(input.closedAt, "Thời điểm đóng ca", new Date());
  if (closedAt < new Date(doc.openedAt)) throw new Error("Thời điểm đóng ca phải sau thời điểm mở ca.");

  doc.closedAt = closedAt;
  doc.actualCash = normalizeMoney(input.actualCash, "Tiền thực đếm cuối ca");
  doc.cashierNote = String(input.note || doc.cashierNote || "").trim();
  doc.evidenceAttachments = Array.isArray(input.evidenceAttachments)
    ? input.evidenceAttachments.map((item) => String(item || "").trim()).filter(Boolean)
    : doc.evidenceAttachments;
  await recalculateReconciliationDocument(doc, { endAt: closedAt });
  doc.status = "SUBMITTED";
  doc.submittedAt = new Date();
  doc.submittedBy = actorId;
  doc.auditTrail.push(
    auditEntry({
      action: "cashier_reconciliation.submitted",
      actorId,
      previousStatus: "OPEN",
      nextStatus: "SUBMITTED",
      note: input.note,
      metadata: {
        actualCash: doc.actualCash,
        expectedCash: doc.expectedCash,
        varianceAmount: doc.varianceAmount,
      },
    }),
  );
  await doc.save();
  await safeAuditLog({
    action: "CASHIER_SHIFT_RECONCILIATION_SUBMITTED",
    module: "staff_performance",
    targetType: "CashierShiftReconciliation",
    targetId: doc._id,
    restaurantId: doc.restaurantId,
    actorId,
    byUserId: actorId,
    after: doc.toObject(),
  });
  return populateAndMap(doc);
}

export async function reviewCashierShiftReconciliation({ input = {}, ctx }) {
  const doc = await loadReconciliation(input.reconciliationId);
  await assertRestaurantAccess(ctx, doc.restaurantId);
  const actorId = assertManagerOrSelf(ctx, doc.cashierId, { managerOnly: true });
  if (doc.status !== "SUBMITTED") throw new Error("Chỉ đối soát đã nộp mới được duyệt.");
  const decision = String(input.decision || "").toUpperCase();
  const statusByDecision = {
    APPROVE: "APPROVED",
    WAIVE: "WAIVED",
    REJECT: "REJECTED",
  };
  const nextStatus = statusByDecision[decision];
  if (!nextStatus) throw new Error("Quyết định đối soát không hợp lệ.");
  const note = String(input.note || "").trim();
  if (!note) throw new Error("Ghi chú quyết định là bắt buộc.");

  const previousStatus = doc.status;
  doc.managerAdjustmentAmount = decision === "APPROVE"
    ? normalizeMoney(input.managerAdjustmentAmount || 0, "Điều chỉnh quản lý", { allowNegative: true })
    : 0;
  await recalculateReconciliationDocument(doc, { endAt: doc.closedAt });
  doc.status = nextStatus;
  doc.attributableToCashier = decision === "APPROVE" && Boolean(input.attributableToCashier);
  doc.reviewNote = note;
  doc.reviewedBy = actorId;
  doc.reviewedAt = new Date();
  doc.lockedAt = new Date();
  doc.activeKey = null;
  doc.auditTrail.push(
    auditEntry({
      action: `cashier_reconciliation.${decision.toLowerCase()}`,
      actorId,
      previousStatus,
      nextStatus,
      note,
      metadata: {
        attributableToCashier: doc.attributableToCashier,
        managerAdjustmentAmount: doc.managerAdjustmentAmount,
        expectedCash: doc.expectedCash,
        actualCash: doc.actualCash,
        varianceAmount: doc.varianceAmount,
        varianceRate: doc.varianceRate,
      },
    }),
  );
  await doc.save();
  await safeAuditLog({
    action: "CASHIER_SHIFT_RECONCILIATION_REVIEWED",
    module: "staff_performance",
    targetType: "CashierShiftReconciliation",
    targetId: doc._id,
    restaurantId: doc.restaurantId,
    actorId,
    byUserId: actorId,
    after: doc.toObject(),
    metadata: { decision, attributableToCashier: doc.attributableToCashier },
  });
  return populateAndMap(doc);
}

export function calculateCashierOperationalPenalty(cashierMetrics = {}) {
  const penalty =
    Number(cashierMetrics?.wrongBillRate || 0) * 8 +
    Number(cashierMetrics?.paymentErrorRate || 0) * 6 +
    Number(cashierMetrics?.cashierRefundRate || 0) * 8 +
    Number(cashierMetrics?.cashVarianceRate || 0) * 20 +
    Number(cashierMetrics?.latePaymentRequestRate || 0) * 4 +
    Number(cashierMetrics?.unauthorizedDiscountRate || 0) * 6;
  return Math.min(15, roundOneDecimal(penalty));
}

function collectOrderIds(transactions = []) {
  return uniqueIds(
    transactions.flatMap((transaction) => [
      transaction?.orderId,
      ...(Array.isArray(transaction?.orderIds) ? transaction.orderIds : []),
    ]),
  );
}

function mergeOrders(...groups) {
  return [...new Map(groups.flat().filter(Boolean).map((order) => [String(order._id), order])).values()];
}

function countWrongBillIssues(orders = []) {
  let count = 0;
  for (const order of orders) {
    const paymentTexts = [order?.payment?.requestClearReason, order?.payment?.requestNote];
    for (const item of order?.items || []) {
      for (const request of [...(item?.voidRequests || []), ...(item?.returnRequests || [])]) {
        if (
          ["approved", "accepted", "resolved"].includes(String(request?.status || "").toLowerCase()) &&
          hasCashierAttribution(request?.reason, request?.reviewNote, ...paymentTexts)
        ) {
          count += 1;
        }
      }
    }
  }
  return count;
}

function countLatePaymentRequests(orders = [], cashierId) {
  let count = 0;
  for (const order of orders) {
    for (const request of order?.customerRequests || []) {
      if (request?.type !== "PAYMENT_REQUEST" || !request?.createdAt) continue;
      const acknowledgedByCashier = String(request?.acknowledgedBy || "") === String(cashierId);
      const resolvedByCashier = String(request?.resolvedBy || "") === String(cashierId);
      if (!acknowledgedByCashier && !resolvedByCashier) continue;
      const createdAt = new Date(request.createdAt).getTime();
      const acknowledgedAt = request?.acknowledgedAt ? new Date(request.acknowledgedAt).getTime() : null;
      const resolvedAt = request?.resolvedAt ? new Date(request.resolvedAt).getTime() : null;
      const acknowledgementLate =
        acknowledgedByCashier && Number.isFinite(acknowledgedAt) && acknowledgedAt - createdAt > 3 * 60 * 1000;
      const resolutionLate =
        resolvedByCashier && Number.isFinite(resolvedAt) && resolvedAt - createdAt > 8 * 60 * 1000;
      if (acknowledgementLate || resolutionLate) count += 1;
    }
  }
  return count;
}

function invoiceHasAuthorizedDiscount(invoice = {}) {
  const appliedPromotions = invoice?.meta?.appliedPromotions || invoice?.meta?.requestedPromotionIds || [];
  const appliedCoupons = invoice?.meta?.appliedCoupons || [];
  return Boolean(
    invoice?.totals?.voucherCode ||
      invoice?.totals?.promotionId ||
      invoice?.meta?.voucherCode ||
      appliedPromotions.length ||
      appliedCoupons.length,
  );
}

export async function getCashierPerformanceMetrics({
  employeeId,
  restaurantId,
  periodStart,
  periodEnd,
}) {
  const cashierId = toObjectId(employeeId);
  const rid = toObjectId(restaurantId);
  const start = normalizeDate(periodStart, "Ngày bắt đầu");
  const end = normalizeDate(periodEnd, "Ngày kết thúc");
  if (!cashierId || !rid) throw new Error("employeeId hoặc restaurantId không hợp lệ.");

  const [successfulTransactions, failedTransactions, interactionOrders, refunds, reconciliations] =
    await Promise.all([
      findCashierHandledTransactions({
        cashierId,
        restaurantId: rid,
        periodStart: start,
        periodEnd: end,
        statuses: ["SUCCESS"],
      }),
      findCashierHandledTransactions({
        cashierId,
        restaurantId: rid,
        periodStart: start,
        periodEnd: end,
        statuses: ["FAILED", "CANCELED"],
      }),
      Order.find({
        restaurantId: rid,
        $or: [
          { "payment.paidBy": cashierId, "payment.paidAt": { $gte: start, $lte: end } },
          { "payment.requestedBy": cashierId, "payment.requestedAt": { $gte: start, $lte: end } },
          { customerRequests: { $elemMatch: { acknowledgedBy: cashierId, acknowledgedAt: { $gte: start, $lte: end } } } },
          { customerRequests: { $elemMatch: { resolvedBy: cashierId, resolvedAt: { $gte: start, $lte: end } } } },
        ],
      }).lean(),
      PaymentRefund.find({
        restaurantId: rid,
        processedBy: cashierId,
        status: "success",
        processedAt: { $gte: start, $lte: end },
      }).lean(),
      CashierShiftReconciliation.find({
        restaurantId: rid,
        cashierId,
        status: "APPROVED",
        attributableToCashier: true,
        closedAt: { $gte: start, $lte: end },
      }).lean(),
    ]);

  const linkedOrderIds = collectOrderIds(successfulTransactions);
  const linkedOrders = linkedOrderIds.length
    ? await Order.find({ _id: { $in: linkedOrderIds }, restaurantId: rid }).lean()
    : [];
  const orders = mergeOrders(interactionOrders, linkedOrders);
  const transactionIds = successfulTransactions.map((transaction) => transaction._id);
  const invoices = transactionIds.length
    ? await Invoice.find({ restaurantId: rid, refTransactionId: { $in: transactionIds } }).lean()
    : [];

  const totalHandledPayments = successfulTransactions.length;
  const wrongBillIssues = countWrongBillIssues(orders);
  const paymentErrors = failedTransactions.filter((transaction) =>
    hasCashierAttribution(transaction?.note, JSON.stringify(transaction?.meta || {})),
  ).length;
  const cashierRefunds = refunds.filter((refund) =>
    hasCashierAttribution(
      refund?.reason,
      ...(refund?.auditTrail || []).flatMap((item) => [item?.reason, item?.note]),
    ),
  ).length;
  const latePaymentRequests = countLatePaymentRequests(orders, cashierId);
  const unauthorizedDiscounts = invoices.filter((invoice) => {
    if (!(Number(invoice?.totals?.discount || 0) > 0) || invoiceHasAuthorizedDiscount(invoice)) return false;
    const reason = String(invoice?.totals?.discountReason || invoice?.meta?.discountReason || "").trim();
    return !reason || hasCashierAttribution(reason);
  }).length;

  const approvedCashExpectedAmount = reconciliations.reduce(
    (sum, item) => sum + Math.max(0, Number(item?.expectedCash || 0)),
    0,
  );
  const approvedCashVarianceAmount = reconciliations.reduce(
    (sum, item) => sum + Math.abs(Number(item?.varianceAmount || 0)),
    0,
  );
  const cashVarianceRate = approvedCashExpectedAmount > 0
    ? Math.min(1, approvedCashVarianceAmount / approvedCashExpectedAmount)
    : 0;

  const metrics = {
    totalHandledPayments,
    wrongBillIssues,
    paymentErrors,
    cashierRefunds,
    latePaymentRequests,
    unauthorizedDiscounts,
    cashReconciliationCount: reconciliations.length,
    approvedCashExpectedAmount: Math.round(approvedCashExpectedAmount),
    approvedCashVarianceAmount: Math.round(approvedCashVarianceAmount),
    cashVarianceDataAvailable: reconciliations.length > 0,
    cashVarianceRate,
    wrongBillRate: safeRate(wrongBillIssues, totalHandledPayments),
    paymentErrorRate: safeRate(paymentErrors, totalHandledPayments),
    cashierRefundRate: safeRate(cashierRefunds, totalHandledPayments),
    latePaymentRequestRate: safeRate(latePaymentRequests, totalHandledPayments),
    unauthorizedDiscountRate: safeRate(unauthorizedDiscounts, totalHandledPayments),
    attributionSource: "payment_transactions+payment_refunds+invoices+approved_cashier_shift_reconciliations",
  };
  metrics.operationalPenalty = calculateCashierOperationalPenalty(metrics);
  metrics.affectsScore = metrics.operationalPenalty > 0;
  metrics.note = metrics.affectsScore
    ? "Có bằng chứng nghiệp vụ thu ngân đã được quy trách nhiệm trong kỳ. Lệch tiền mặt chỉ tính từ đối soát được quản lý duyệt và đánh dấu thuộc trách nhiệm thu ngân."
    : metrics.cashVarianceDataAvailable
      ? "Các ca đã được đối soát nhưng không phát sinh lỗi nghiệp vụ thu ngân làm giảm điểm."
      : "Chưa có lỗi nghiệp vụ thu ngân được xác nhận trong kỳ.";
  return metrics;
}

function defaultPerformanceLevel(score) {
  const number = Number(score || 0);
  if (number >= 90) return "excellent";
  if (number >= 80) return "good";
  if (number >= 65) return "average";
  if (number >= 50) return "needs_attention";
  return "poor";
}

function weightedFinalScore(components) {
  const totalWeight = Object.values(PERFORMANCE_WEIGHTS).reduce(
    (sum, weight) => sum + weight,
    0,
  );
  if (!totalWeight) return 75;
  return clampScore(
    Object.entries(PERFORMANCE_WEIGHTS).reduce(
      (sum, [key, weight]) => sum + Number(components?.[key]?.score || 0) * weight,
      0,
    ) / totalWeight,
  );
}

function isCashierSnapshot(snapshot = {}) {
  const roleGroup = snapshot?.factors?.qualityEvidence?.roleGroup;
  const roleText = normalizeTextNoAccent(snapshot?.employeeRole);
  return roleGroup === "cashier" || roleText.includes("cashier") || roleText.includes("thu ngan");
}

export async function enrichCashierPerformanceRecalculationResult({
  result,
  restaurantId,
}) {
  const isList = Array.isArray(result);
  const snapshots = isList ? result : result ? [result] : [];
  if (!snapshots.length) return result;
  const enriched = [];

  for (const snapshot of snapshots) {
    if (!isCashierSnapshot(snapshot)) {
      enriched.push(snapshot);
      continue;
    }
    const metrics = await getCashierPerformanceMetrics({
      employeeId: snapshot.employeeId,
      restaurantId,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
    });
    const factors = snapshot.factors || {};
    const previousEvidence = factors.qualityEvidence || {};
    const customerPenalty = Number(previousEvidence.customerPenalty || 0);
    const kitchenPenalty = Number(previousEvidence.kitchenPenalty || 0);
    const cashierOperationalPenalty = Number(metrics.operationalPenalty || 0);
    const totalPenalty = roundOneDecimal(
      customerPenalty + kitchenPenalty + cashierOperationalPenalty,
    );
    const hasManagerReview = Boolean(previousEvidence.hasManagerReview ?? factors.hasManagerReview);
    const hasCustomerEvidence = Boolean(previousEvidence.hasCustomerEvidence);
    const hasCashierOperationalEvidence = cashierOperationalPenalty > 0;
    const baseSkillScore = Number(previousEvidence.baseSkillScore ?? 75);
    let qualityScore = 75;
    if (hasManagerReview || hasCustomerEvidence || hasCashierOperationalEvidence) {
      qualityScore = clampScore(baseSkillScore - totalPenalty, 75);
      if (totalPenalty > 0) qualityScore = Math.max(50, qualityScore);
    }

    const hasPerformanceActivity =
      Boolean(factors.hasPerformanceActivity) ||
      metrics.totalHandledPayments > 0 ||
      metrics.cashReconciliationCount > 0;
    const insufficientData = !hasPerformanceActivity;
    const quality = {
      ...(snapshot.quality || {}),
      score: insufficientData ? 0 : qualityScore,
      weight: PERFORMANCE_WEIGHTS.quality,
      note: insufficientData
        ? "Không có dữ liệu làm việc trong kỳ."
        : metrics.note,
    };
    const components = {
      productivity: snapshot.productivity,
      punctuality: snapshot.punctuality,
      quality,
      managerReview: snapshot.managerReview,
      compliance: snapshot.compliance,
    };
    const baseFormulaScore = insufficientData ? 0 : weightedFinalScore(components);
    const adjustmentDelta = Number(factors.finalAdjustmentDelta || 0);
    const finalPerformanceScore = insufficientData && adjustmentDelta === 0
      ? 0
      : clampScore(baseFormulaScore + adjustmentDelta, 0);
    const performanceLevel = insufficientData
      ? "poor"
      : defaultPerformanceLevel(finalPerformanceScore);
    const qualityEvidence = {
      ...previousEvidence,
      baseSkillScore,
      finalQualityScore: insufficientData ? 0 : qualityScore,
      cashierOperationalPenalty,
      totalPenalty,
      hasCashierOperationalEvidence,
      evidenceSource: hasCashierOperationalEvidence
        ? "manager_skill+customer_rating+verified_cashier_operational_metrics"
        : previousEvidence.evidenceSource || "manager_skill_only",
      affectsScore: totalPenalty > 0,
      note: `${metrics.note} Dữ liệu chuyển khoản/cổng thanh toán không tự động quy trách nhiệm cho thu ngân.`,
    };
    const nextFactors = {
      ...factors,
      cashierMetrics: metrics,
      qualityEvidence,
      baseFormulaScore,
      hasPerformanceActivity,
      insufficientData,
    };
    const nextSnapshot = {
      ...snapshot,
      quality,
      finalPerformanceScore,
      performanceLevel,
      factors: nextFactors,
    };

    if (snapshot.id && mongoose.isValidObjectId(snapshot.id)) {
      await StaffPerformanceSnapshot.updateOne(
        { _id: toObjectId(snapshot.id) },
        {
          $set: {
            quality,
            finalPerformanceScore,
            performanceLevel,
            "factors.cashierMetrics": metrics,
            "factors.qualityEvidence": qualityEvidence,
            "factors.baseFormulaScore": baseFormulaScore,
            "factors.hasPerformanceActivity": hasPerformanceActivity,
            "factors.insufficientData": insufficientData,
          },
        },
      );
    }
    enriched.push(nextSnapshot);
  }

  return isList ? enriched : enriched[0];
}

export function isTerminalCashierReconciliationStatus(status) {
  return TERMINAL_STATUSES.has(String(status || "").toUpperCase());
}
