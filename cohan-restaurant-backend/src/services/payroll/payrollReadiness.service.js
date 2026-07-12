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
const PENDING_OVERTIME_STATUSES = [
  "pending_employee_confirmation",
  "pending_approval",
  "approved",
];
const APPROVAL_VALIDATION_CODES = new Set([
  "OVERTIME_REQUEST_NOT_COMPLETED",
  "UNAPPROVED_OVERTIME",
  "OFF_SCHEDULE_ATTENDANCE_PENDING_APPROVAL",
  "ATTENDANCE_CORRECTION_PENDING",
]);
const WORKED_OFF_SCHEDULE_EVIDENCE_FILTER = {
  $or: [
    { workedMinutes: { $gt: 0 } },
    { hours: { $gt: 0 } },
    { amount: { $gt: 0 } },
    { actualCheckInAt: { [EXISTS]: true } },
    { actualCheckOutAt: { [EXISTS]: true } },
  ],
};
const UNRESOLVED_OVERTIME_FILTER = {
  $or: [
    { overtimeApprovalStatus: { [EXISTS]: false } },
    { overtimeApprovalStatus: null },
    { overtimeApprovalStatus: "not_required" },
    { overtimeApprovalStatus: "pending" },
    {
      overtimeApprovalStatus: "approved",
      approvedOvertimeMinutes: { $lte: 0 },
    },
  ],
};
const toOid = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;
const id = (value) => (value ? String(value._id || value.id || value) : null);
const dayStart = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};
const dayEnd = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};
const emp = (employee) => ({
  employeeId: id(employee),
  employeeName: employee?.fullName || null,
  employeeCode: employee?.employeeCode || null,
});
const issue = (payload = {}) => ({
  code: String(payload.code || "PAYROLL_READINESS_ISSUE"),
  severity: ["error", "warning", "info"].includes(payload.severity)
    ? payload.severity
    : "warning",
  message: String(payload.message || "Payroll readiness issue."),
  employeeId: payload.employeeId ? String(payload.employeeId) : null,
  employeeName: payload.employeeName || null,
  employeeCode: payload.employeeCode || null,
  sourceType: payload.sourceType || null,
  sourceId: payload.sourceId ? String(payload.sourceId) : null,
  suggestedAction: payload.suggestedAction || null,
  targetRoute: payload.targetRoute || null,
});
const emptySection = (status = "checked") => ({
  status,
  blockingCount: 0,
  warningCount: 0,
  metrics: {},
  issues: [],
});
const add = (section, payload) => section.issues.push(issue(payload));
const close = (section) => {
  section.blockingCount = section.issues.filter(
    (item) => item.severity === "error",
  ).length;
  section.warningCount = section.issues.filter(
    (item) => item.severity === "warning",
  ).length;
  return section;
};

async function checkSchedule({ restaurantId, start, end }) {
  const section = emptySection(null);
  const publications = await SchedulePublication.find({
    restaurantId,
    periodStart: { $lte: end },
    periodEnd: { $gte: start },
  })
    .sort({ periodStart: 1 })
    .lean();
  const ready = publications.filter((publication) =>
    READY_SCHEDULE_STATUSES.includes(String(publication.status || "")),
  );
  Object.assign(section.metrics, {
    publicationCount: publications.length,
    readyPublicationCount: ready.length,
    publicationStatuses: publications.map((publication) =>
      String(publication.status || "draft"),
    ),
  });
  section.status = ready.length ? "published" : "not_published";
  if (!ready.length) {
    add(section, {
      code: "SCHEDULE_NOT_PUBLISHED",
      severity: "error",
      sourceType: "schedule",
      message: "Lịch làm việc của kỳ lương chưa được công bố.",
      suggestedAction: "Công bố lịch làm việc trước khi chốt lương.",
      targetRoute: "schedule",
    });
    return close(section);
  }

  const shifts = await Shift.find({
    restaurantId,
    startTime: { $lte: end },
    endTime: { $gte: start },
    status: { $ne: "cancelled" },
  })
    .select({ _id: 1, employeeId: 1 })
    .lean();
  const employeeIds = [
    ...new Set(shifts.map((shift) => id(shift.employeeId)).filter(Boolean)),
  ];
  const employeeObjectIds = employeeIds.map(toOid).filter(Boolean);
  const publicationIds = ready.map((publication) => publication._id);
  const acknowledgements = employeeObjectIds.length
    ? await ScheduleAcknowledgement.find({
        restaurantId,
        schedulePublicationId: { $in: publicationIds },
        employeeId: { $in: employeeObjectIds },
      }).lean()
    : [];
  const acknowledgementMap = new Map(
    acknowledgements.map((acknowledgement) => [
      `${id(acknowledgement.schedulePublicationId)}:${id(acknowledgement.employeeId)}`,
      acknowledgement,
    ]),
  );
  let pending = 0;
  let changed = 0;
  for (const publication of ready) {
    for (const employeeId of employeeIds) {
      const acknowledgement = acknowledgementMap.get(
        `${id(publication._id)}:${employeeId}`,
      );
      if (!acknowledgement) pending += 1;
      else if (
        acknowledgement.changedAfterAcknowledgement ||
        acknowledgement.status === "needs_review"
      ) {
        changed += 1;
      }
    }
  }
  Object.assign(section.metrics, {
    shiftCount: shifts.length,
    assignedStaffCount: employeeIds.length,
    pendingAcknowledgementCount: pending,
    changedAfterAcknowledgementCount: changed,
  });
  if (pending) {
    add(section, {
      code: "SCHEDULE_ACK_PENDING",
      severity: "warning",
      sourceType: "schedule_acknowledgement",
      message: "Còn nhân viên chưa xác nhận lịch làm việc.",
      targetRoute: "schedule",
    });
  }
  if (changed) {
    add(section, {
      code: "SCHEDULE_CHANGED_AFTER_ACK",
      severity: "warning",
      sourceType: "schedule_acknowledgement",
      message: "Có lịch đã thay đổi sau khi nhân viên xác nhận.",
      targetRoute: "schedule",
    });
  }

  const declined = await ShiftAcknowledgement.find({
    restaurantId,
    periodEnd: { $gte: start },
    periodStart: { $lte: end },
    status: "declined",
    $or: [
      { declineClassification: { [EXISTS]: false } },
      { declineClassification: "unknown" },
      { declineClassification: null },
    ],
  })
    .populate("employeeId", "fullName employeeCode")
    .lean();
  section.metrics.unreviewedDeclinedShiftCount = declined.length;
  declined.forEach((item) =>
    add(section, {
      code: "SHIFT_DECLINE_UNREVIEWED",
      severity: "error",
      message: "Có ca làm bị từ chối nhưng chưa được quản lý xử lý.",
      ...emp(item.employeeId),
      sourceType: "shift_acknowledgement",
      sourceId: id(item._id),
      targetRoute: "schedule",
    }),
  );
  return close(section);
}

async function checkAttendance({ restaurantId, start, end }) {
  const section = emptySection();
  const rows = await Timesheet.find({
    restaurantId,
    workDate: { $gte: start, $lte: end },
  })
    .populate("employeeId", "fullName employeeCode")
    .lean();
  Object.assign(section.metrics, {
    timesheetCount: rows.length,
    missingCheckInCount: 0,
    missingCheckOutCount: 0,
    noShowCount: 0,
    unresolvedExceptionCount: 0,
  });
  rows.forEach((row) => {
    const status = String(row.status || "").toLowerCase();
    const base = {
      ...emp(row.employeeId),
      sourceType: "timesheet",
      sourceId: id(row._id),
      targetRoute: "attendance",
    };
    if (status === "scheduled_absent" || status === "no_show") {
      section.metrics.noShowCount += 1;
      section.metrics.unresolvedExceptionCount += 1;
      add(section, {
        ...base,
        code: "ATTENDANCE_NO_SHOW_UNRESOLVED",
        severity: "error",
        message: "Có ca vắng/no-show chưa được xử lý.",
      });
      return;
    }
    if (!row.actualCheckInAt && !row.isOffSchedule) {
      section.metrics.missingCheckInCount += 1;
      section.metrics.unresolvedExceptionCount += 1;
      add(section, {
        ...base,
        code: "ATTENDANCE_MISSING_CHECK_IN",
        severity: "error",
        message: "Có bản ghi chấm công thiếu giờ vào.",
      });
    }
    if (
      (row.actualCheckInAt &&
        !row.actualCheckOutAt &&
        status !== "completed") ||
      status === "missed_checkout"
    ) {
      section.metrics.missingCheckOutCount += 1;
      section.metrics.unresolvedExceptionCount += 1;
      add(section, {
        ...base,
        code: "ATTENDANCE_MISSING_CHECK_OUT",
        severity: "error",
        message: "Có bản ghi chấm công thiếu giờ ra.",
      });
    }
  });
  return close(section);
}

async function checkApprovals({ restaurantId, start, end }) {
  const section = emptySection();
  const [corrections, offSchedule, overtimeRequests, overtimeTimesheets] =
    await Promise.all([
      AttendanceCorrectionRequest.find({
        restaurantId,
        status: "pending",
        workDate: { $gte: start, $lte: end },
      })
        .populate("employeeId", "fullName employeeCode")
        .lean(),
      Timesheet.find({
        restaurantId,
        workDate: { $gte: start, $lte: end },
        isOffSchedule: true,
        approved: { $ne: true },
        $and: [
          {
            $or: [
              { offScheduleApprovalStatus: { [EXISTS]: false } },
              { offScheduleApprovalStatus: "not_required" },
              { offScheduleApprovalStatus: "pending" },
              { offScheduleApprovalStatus: null },
            ],
          },
          WORKED_OFF_SCHEDULE_EVIDENCE_FILTER,
        ],
      })
        .populate("employeeId", "fullName employeeCode")
        .lean(),
      OvertimeRequest.find({
        restaurantId,
        workDate: { $gte: start, $lte: end },
        status: { $in: PENDING_OVERTIME_STATUSES },
      })
        .populate("employeeId", "fullName employeeCode")
        .lean(),
      Timesheet.find({
        restaurantId,
        workDate: { $gte: start, $lte: end },
        overtimeMinutes: { $gt: 0 },
        ...UNRESOLVED_OVERTIME_FILTER,
      })
        .populate("employeeId", "fullName employeeCode")
        .lean(),
    ]);
  Object.assign(section.metrics, {
    pendingAttendanceCorrectionCount: corrections.length,
    pendingOffScheduleAttendanceCount: offSchedule.length,
    pendingOvertimeRequestCount: overtimeRequests.length,
    pendingOvertimeTimesheetCount: overtimeTimesheets.length,
  });
  corrections.forEach((item) =>
    add(section, {
      code: "ATTENDANCE_CORRECTION_PENDING",
      severity: "error",
      message: "Còn đơn sửa công chưa duyệt.",
      ...emp(item.employeeId),
      sourceType: "attendance_correction",
      sourceId: id(item._id),
      targetRoute: "attendance_correction",
    }),
  );
  offSchedule.forEach((item) =>
    add(section, {
      code: "OFF_SCHEDULE_ATTENDANCE_PENDING",
      severity: "error",
      message: "Còn công ngoài lịch chưa được duyệt.",
      ...emp(item.employeeId),
      sourceType: "off_schedule_attendance",
      sourceId: id(item._id),
      targetRoute: "off_schedule",
    }),
  );
  const addOvertime = (item, sourceType) =>
    add(section, {
      code: "OVERTIME_PENDING",
      severity: "error",
      message: "Còn tăng ca chưa được duyệt.",
      ...emp(item.employeeId),
      sourceType,
      sourceId: id(item._id),
      targetRoute: "overtime",
    });
  overtimeRequests.forEach((item) => addOvertime(item, "overtime"));
  overtimeTimesheets.forEach((item) =>
    addOvertime(item, "timesheet_overtime"),
  );
  return close(section);
}

async function checkPayroll(periodId) {
  const section = emptySection();
  const validation = await validatePayrollPeriod(periodId);
  const issues = (validation?.issues || [])
    .filter((item) => !APPROVAL_VALIDATION_CODES.has(item.code))
    .map((item) => issue({ targetRoute: "payroll", ...item }));
  section.issues.push(...issues);
  section.metrics = {
    validationErrorCount: issues.filter((item) => item.severity === "error")
      .length,
    validationWarningCount: issues.filter(
      (item) => item.severity === "warning",
    ).length,
  };
  section.status = section.metrics.validationErrorCount
    ? "blocked"
    : section.metrics.validationWarningCount
      ? "warning"
      : "ready";
  return close(section);
}

export async function buildPayrollReadiness({
  periodId,
  actor = null,
  context = {},
}) {
  void actor;
  void context;
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
  const issues = Object.values(sections).flatMap(
    (section) => section.issues,
  );
  const blockingCount = issues.filter(
    (item) => item.severity === "error",
  ).length;
  const warningCount = issues.filter(
    (item) => item.severity === "warning",
  ).length;
  return {
    periodId: id(period._id),
    restaurantId: id(period.restaurantId),
    status: String(period.status || "draft"),
    readyToFinalize: blockingCount === 0,
    blockingCount,
    warningCount,
    sections,
    issues,
  };
}
