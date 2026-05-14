import mongoose from "mongoose";
import {
  AttendanceCorrectionRequest,
  OvertimeRequest,
  PayrollPeriod,
  ScheduleAcknowledgement,
  SchedulePublication,
  Shift,
  ShiftAcknowledgement,
  Timesheet,
} from "../../../models/index.js";
import { validatePayrollPeriod } from "./payrollValidation.service.js";

const EXISTS = "$" + "exists";
const READY_SCHEDULE_STATUSES = ["published", "active", "locked", "closed"];
const PENDING_OVERTIME_STATUSES = ["pending_employee_confirmation", "pending_approval", "approved"];
const APPROVAL_VALIDATION_CODES = new Set(["OVERTIME_REQUEST_NOT_COMPLETED", "UNAPPROVED_OVERTIME", "OFF_SCHEDULE_ATTENDANCE_PENDING_APPROVAL", "ATTENDANCE_CORRECTION_PENDING"]);
const WORKED_OFF_SCHEDULE_EVIDENCE_FILTER = { $or: [{ workedMinutes: { $gt: 0 } }, { hours: { $gt: 0 } }, { amount: { $gt: 0 } }, { actualCheckInAt: { [EXISTS]: true } }, { actualCheckOutAt: { [EXISTS]: true } }] };
const toOid = (v) => (v && mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null);
const id = (v) => (v ? String(v._id || v.id || v) : null);
const dayStart = (v) => { const d = new Date(v); d.setHours(0, 0, 0, 0); return d; };
const dayEnd = (v) => { const d = new Date(v); d.setHours(23, 59, 59, 999); return d; };
const emp = (e) => ({ employeeId: id(e), employeeName: e?.fullName || null, employeeCode: e?.employeeCode || null });
const issue = (x = {}) => ({
  code: String(x.code || "PAYROLL_READINESS_ISSUE"),
  severity: ["error", "warning", "info"].includes(x.severity) ? x.severity : "warning",
  message: String(x.message || "Payroll readiness issue."),
  employeeId: x.employeeId ? String(x.employeeId) : null,
  employeeName: x.employeeName || null,
  employeeCode: x.employeeCode || null,
  sourceType: x.sourceType || null,
  sourceId: x.sourceId ? String(x.sourceId) : null,
  suggestedAction: x.suggestedAction || null,
  targetRoute: x.targetRoute || null,
});
const emptySection = (status = "checked") => ({ status, blockingCount: 0, warningCount: 0, metrics: {}, issues: [] });
const add = (s, x) => s.issues.push(issue(x));
const close = (s) => {
  s.blockingCount = s.issues.filter((x) => x.severity === "error").length;
  s.warningCount = s.issues.filter((x) => x.severity === "warning").length;
  return s;
};

async function checkSchedule({ restaurantId, start, end }) {
  const s = emptySection(null);
  const pubs = await SchedulePublication.find({ restaurantId, periodStart: { $lte: end }, periodEnd: { $gte: start } }).sort({ periodStart: 1 }).lean();
  const ready = pubs.filter((p) => READY_SCHEDULE_STATUSES.includes(String(p.status || "")));
  Object.assign(s.metrics, { publicationCount: pubs.length, readyPublicationCount: ready.length, publicationStatuses: pubs.map((p) => String(p.status || "draft")) });
  s.status = ready.length ? "published" : "not_published";
  if (!ready.length) {
    add(s, { code: "SCHEDULE_NOT_PUBLISHED", severity: "error", sourceType: "schedule", message: "Lịch làm việc của kỳ lương chưa được công bố.", suggestedAction: "Công bố lịch làm việc trước khi chốt lương.", targetRoute: "schedule" });
    return close(s);
  }

  const shifts = await Shift.find({ restaurantId, startTime: { $lte: end }, endTime: { $gte: start }, status: { $ne: "cancelled" } }).select({ _id: 1, employeeId: 1 }).lean();
  const employeeIds = [...new Set(shifts.map((x) => id(x.employeeId)).filter(Boolean))];
  const employeeObjectIds = employeeIds.map(toOid).filter(Boolean);
  const pubIds = ready.map((x) => x._id);
  const acks = employeeObjectIds.length ? await ScheduleAcknowledgement.find({ restaurantId, schedulePublicationId: { $in: pubIds }, employeeId: { $in: employeeObjectIds } }).lean() : [];
  const ackMap = new Map(acks.map((a) => [`${id(a.schedulePublicationId)}:${id(a.employeeId)}`, a]));
  let pending = 0;
  let changed = 0;
  for (const p of ready) {
    for (const employeeId of employeeIds) {
      const a = ackMap.get(`${id(p._id)}:${employeeId}`);
      if (!a) pending += 1;
      else if (a.changedAfterAcknowledgement || a.status === "needs_review") changed += 1;
    }
  }
  Object.assign(s.metrics, { shiftCount: shifts.length, assignedStaffCount: employeeIds.length, pendingAcknowledgementCount: pending, changedAfterAcknowledgementCount: changed });
  if (pending) add(s, { code: "SCHEDULE_ACK_PENDING", severity: "warning", sourceType: "schedule_acknowledgement", message: "Còn nhân viên chưa xác nhận lịch làm việc.", targetRoute: "schedule" });
  if (changed) add(s, { code: "SCHEDULE_CHANGED_AFTER_ACK", severity: "warning", sourceType: "schedule_acknowledgement", message: "Có lịch đã thay đổi sau khi nhân viên xác nhận.", targetRoute: "schedule" });

  const declined = await ShiftAcknowledgement.find({ restaurantId, periodEnd: { $gte: start }, periodStart: { $lte: end }, status: "declined", $or: [{ declineClassification: { [EXISTS]: false } }, { declineClassification: "unknown" }, { declineClassification: null }] }).populate("employeeId", "fullName employeeCode").lean();
  s.metrics.unreviewedDeclinedShiftCount = declined.length;
  declined.forEach((x) => add(s, { code: "SHIFT_DECLINE_UNREVIEWED", severity: "error", message: "Có ca làm bị từ chối nhưng chưa được quản lý xử lý.", ...emp(x.employeeId), sourceType: "shift_acknowledgement", sourceId: id(x._id), targetRoute: "schedule" }));
  return close(s);
}

async function checkAttendance({ restaurantId, start, end }) {
  const s = emptySection();
  const rows = await Timesheet.find({ restaurantId, workDate: { $gte: start, $lte: end } }).populate("employeeId", "fullName employeeCode").lean();
  Object.assign(s.metrics, { timesheetCount: rows.length, missingCheckInCount: 0, missingCheckOutCount: 0, noShowCount: 0, unresolvedExceptionCount: 0 });
  rows.forEach((r) => {
    const status = String(r.status || "").toLowerCase();
    const base = { ...emp(r.employeeId), sourceType: "timesheet", sourceId: id(r._id), targetRoute: "attendance" };
    if (status === "scheduled_absent" || status === "no_show") {
      s.metrics.noShowCount += 1; s.metrics.unresolvedExceptionCount += 1;
      add(s, { ...base, code: "ATTENDANCE_NO_SHOW_UNRESOLVED", severity: "error", message: "Có ca vắng/no-show chưa được xử lý." });
      return;
    }
    if (!r.actualCheckInAt && !r.isOffSchedule) {
      s.metrics.missingCheckInCount += 1; s.metrics.unresolvedExceptionCount += 1;
      add(s, { ...base, code: "ATTENDANCE_MISSING_CHECK_IN", severity: "error", message: "Có bản ghi chấm công thiếu giờ vào." });
    }
    if ((r.actualCheckInAt && !r.actualCheckOutAt && status !== "completed") || status === "missed_checkout") {
      s.metrics.missingCheckOutCount += 1; s.metrics.unresolvedExceptionCount += 1;
      add(s, { ...base, code: "ATTENDANCE_MISSING_CHECK_OUT", severity: "error", message: "Có bản ghi chấm công thiếu giờ ra." });
    }
  });
  return close(s);
}

async function checkApprovals({ restaurantId, start, end }) {
  const s = emptySection();
  const [corrections, offSchedule, overtimeRequests, overtimeTimesheets] = await Promise.all([
    AttendanceCorrectionRequest.find({ restaurantId, status: "pending", workDate: { $gte: start, $lte: end } }).populate("employeeId", "fullName employeeCode").lean(),
    Timesheet.find({
      restaurantId,
      workDate: { $gte: start, $lte: end },
      isOffSchedule: true,
      approved: { $ne: true },
      $and: [
        { $or: [{ offScheduleApprovalStatus: { [EXISTS]: false } }, { offScheduleApprovalStatus: "not_required" }, { offScheduleApprovalStatus: "pending" }, { offScheduleApprovalStatus: null }] },
        WORKED_OFF_SCHEDULE_EVIDENCE_FILTER,
      ],
    }).populate("employeeId", "fullName employeeCode").lean(),
    OvertimeRequest.find({ restaurantId, workDate: { $gte: start, $lte: end }, status: { $in: PENDING_OVERTIME_STATUSES } }).populate("employeeId", "fullName employeeCode").lean(),
    Timesheet.find({ restaurantId, workDate: { $gte: start, $lte: end }, overtimeMinutes: { $gt: 0 }, overtimeApprovalStatus: "pending" }).populate("employeeId", "fullName employeeCode").lean(),
  ]);
  Object.assign(s.metrics, { pendingAttendanceCorrectionCount: corrections.length, pendingOffScheduleAttendanceCount: offSchedule.length, pendingOvertimeRequestCount: overtimeRequests.length, pendingOvertimeTimesheetCount: overtimeTimesheets.length });
  corrections.forEach((x) => add(s, { code: "ATTENDANCE_CORRECTION_PENDING", severity: "error", message: "Còn đơn sửa công chưa duyệt.", ...emp(x.employeeId), sourceType: "attendance_correction", sourceId: id(x._id), targetRoute: "attendance_correction" }));
  offSchedule.forEach((x) => add(s, { code: "OFF_SCHEDULE_ATTENDANCE_PENDING", severity: "error", message: "Còn công ngoài lịch chưa được duyệt.", ...emp(x.employeeId), sourceType: "off_schedule_attendance", sourceId: id(x._id), targetRoute: "off_schedule" }));
  const ot = (x, sourceType) => add(s, { code: "OVERTIME_PENDING", severity: "error", message: "Còn tăng ca chưa được duyệt.", ...emp(x.employeeId), sourceType, sourceId: id(x._id), targetRoute: "overtime" });
  overtimeRequests.forEach((x) => ot(x, "overtime"));
  overtimeTimesheets.forEach((x) => ot(x, "timesheet_overtime"));
  return close(s);
}

async function checkPayroll(periodId) {
  const s = emptySection();
  const validation = await validatePayrollPeriod(periodId);
  const issues = (validation?.issues || [])
    .filter((x) => !APPROVAL_VALIDATION_CODES.has(x.code))
    .map((x) => issue({ targetRoute: "payroll", ...x }));
  s.issues.push(...issues);
  s.metrics = {
    validationErrorCount: issues.filter((x) => x.severity === "error").length,
    validationWarningCount: issues.filter((x) => x.severity === "warning").length,
  };
  s.status = s.metrics.validationErrorCount ? "blocked" : s.metrics.validationWarningCount ? "warning" : "ready";
  return close(s);
}

export async function buildPayrollReadiness({ periodId, actor = null, context = {} }) {
  void actor; void context;
  const period = await PayrollPeriod.findById(periodId).lean();
  if (!period) throw new Error("PAYROLL_PERIOD_NOT_FOUND");
  const restaurantId = toOid(period.restaurantId) || period.restaurantId;
  const start = dayStart(period.startDate);
  const end = dayEnd(period.endDate);
  const [schedule, attendance, approvals, payroll] = await Promise.all([
    checkSchedule({ restaurantId, start, end }),
    checkAttendance({ restaurantId, start, end }),
    checkApprovals({ restaurantId, start, end }),
    checkPayroll(period._id),
  ]);
  const sections = { schedule, attendance, approvals, payroll };
  const issues = Object.values(sections).flatMap((s) => s.issues);
  const blockingCount = issues.filter((x) => x.severity === "error").length;
  const warningCount = issues.filter((x) => x.severity === "warning").length;
  return { periodId: id(period._id), restaurantId: id(period.restaurantId), status: String(period.status || "draft"), readyToFinalize: blockingCount === 0, blockingCount, warningCount, sections, issues };
}
