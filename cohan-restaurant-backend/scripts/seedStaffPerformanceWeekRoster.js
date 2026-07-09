import "dotenv/config.js";
import mongoose from "mongoose";
import {
  AttendanceCorrectionRequest,
  OvertimeRequest,
  SchedulePublication,
  Shift,
  Staff,
  StaffPerformanceSnapshot,
  Timesheet,
  User,
} from "../models/index.js";
import { canAccessRestaurant } from "../src/services/auth/restaurantScope.service.js";
import { recalculateStaffPerformanceSnapshots } from "../src/services/staffPerformance/staffPerformance.service.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const RESTAURANT_ID =
  process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
const MANAGER_ID =
  process.env.DEMO_MANAGER_ID?.trim() || "69f7162dab80d0aaef80d5c8";
const DEMO_AS_OF_DATE = process.env.DEMO_AS_OF_DATE?.trim() || "2026-07-07";
const BASE_TAG = "[demo-staff-performance-2026-07]";
const WEEK_TAG = "[demo-staff-performance-weeks-2026-07]";
const TAG_PATTERN = /demo-staff-performance/;
const WEEK_TAG_PATTERN = /demo-staff-performance-weeks-2026-07/;

const WEEKS = [
  { start: "2026-06-29", end: "2026-07-05", status: "published" },
  { start: "2026-07-06", end: "2026-07-12", status: "active" },
];
const PERIODS = [
  [new Date("2026-06-01T00:00:00.000Z"), new Date("2026-06-30T23:59:59.999Z")],
  [new Date("2026-07-01T00:00:00.000Z"), new Date("2026-07-31T23:59:59.999Z")],
];

const SCENARIOS = [
  [
    "staff.server.demo@cohan.local",
    "morning",
    8,
    1,
    [],
    {},
    {},
    0,
    "excellent",
  ],
  [
    "staff.supervisor.demo@cohan.local",
    "morning",
    10,
    0.875,
    [],
    { 0: 20 },
    {},
    1,
    "good",
  ],
  [
    "staff.cashier.demo@cohan.local",
    "evening",
    14,
    0.8125,
    [],
    { 0: 20 },
    { 0: 30 },
    2,
    "average",
  ],
  [
    "staff.chef.demo@cohan.local",
    "morning",
    7,
    0.5625,
    [3],
    { 0: 30 },
    { 1: 30 },
    3,
    "needs_attention",
  ],
  [
    "staff.kitchenhelper.demo@cohan.local",
    "afternoon",
    12,
    0.6875,
    [],
    { 0: 20, 1: 20 },
    {},
    2,
    "average",
  ],
  [
    "staff.exception.demo@cohan.local",
    "afternoon",
    12,
    0.1875,
    [1, 3],
    { 0: 45 },
    { 2: 60 },
    5,
    "poor",
  ],
  [
    "staff.parttime.demo@cohan.local",
    "evening",
    14,
    0.875,
    [],
    { 0: 10 },
    {},
    1,
    "good",
  ],
].map(
  ([
    email,
    shiftType,
    startHour,
    ratio,
    absences,
    late,
    early,
    corrections,
    level,
  ]) => ({
    email,
    shiftType,
    startHour,
    ratio,
    absences,
    late,
    early,
    corrections,
    level,
  }),
);

const OFF_SCHEDULE_DEFINITIONS = [
  [
    "staff.server.demo@cohan.local",
    "2026-07-02",
    "pending",
    120,
    "manager_requested",
  ],
  [
    "staff.supervisor.demo@cohan.local",
    "2026-07-03",
    "approved",
    120,
    "emergency_cover",
  ],
  [
    "staff.parttime.demo@cohan.local",
    "2026-07-04",
    "rejected",
    90,
    "self_initiated",
  ],
].map(([email, workDate, approvalStatus, workedMinutes, reasonCategory]) => ({
  email,
  workDate,
  approvalStatus,
  workedMinutes,
  reasonCategory,
}));

const OVERTIME_DEFINITIONS = [
  ["staff.server.demo@cohan.local", "2026-07-01", 60, "completed", "weekday"],
  [
    "staff.supervisor.demo@cohan.local",
    "2026-07-02",
    90,
    "approved",
    "weekday",
  ],
  ["staff.cashier.demo@cohan.local", "2026-07-03", 45, "rejected", "weekday"],
  [
    "staff.parttime.demo@cohan.local",
    "2026-07-05",
    60,
    "pending_approval",
    "weekend",
  ],
  [
    "staff.kitchenhelper.demo@cohan.local",
    "2026-07-06",
    30,
    "pending_employee_confirmation",
    "weekday",
  ],
].map(([email, workDate, minutes, requestStatus, overtimeType]) => ({
  email,
  workDate,
  minutes,
  requestStatus,
  overtimeType,
}));

const utcDay = (ymd) => new Date(`${ymd}T00:00:00.000Z`);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
const isoDate = (date) => date.toISOString().slice(0, 10);
const hcmTime = (ymd, hour, minute = 0, second = 0, ms = 0) => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second, ms));
};
const dateRange = (start, end) => {
  const rows = [];
  for (let date = utcDay(start); date <= utcDay(end); date = addDays(date, 1)) {
    rows.push(isoDate(date));
  }
  return rows;
};

if (!/^\d{4}-\d{2}-\d{2}$/.test(DEMO_AS_OF_DATE)) {
  throw new Error("DEMO_AS_OF_DATE_INVALID: expected YYYY-MM-DD");
}

const allDates = dateRange("2026-06-29", "2026-07-12");
const attendanceDates = allDates.filter((ymd) => ymd < DEMO_AS_OF_DATE);
const julyAttendanceDates = attendanceDates.filter((ymd) =>
  ymd.startsWith("2026-07-"),
);
const julyIndex = new Map(
  julyAttendanceDates.map((date, index) => [date, index]),
);
const attendanceCutoffDate = attendanceDates.at(-1) || null;

function distributedMinutes(scenario) {
  const result = Array(julyAttendanceDates.length).fill(0);
  const working = result
    .map((_, index) => index)
    .filter((index) => !scenario.absences.includes(index));
  const target = Math.round(julyAttendanceDates.length * 480 * scenario.ratio);
  const base = working.length ? Math.floor(target / working.length) : 0;
  let remainder = target - base * working.length;

  for (const index of working) {
    result[index] = base;
    if (remainder > 0) {
      result[index] += 1;
      remainder -= 1;
    }
  }
  return result;
}

function actorAudit(action, actor, at, note, meta = null) {
  return {
    action,
    actorId: actor._id,
    actorName: actor.fullName || actor.email || "Demo Manager",
    note,
    at,
    meta,
  };
}

async function resolveContext() {
  if (!mongoose.isValidObjectId(RESTAURANT_ID))
    throw new Error("DEMO_RESTAURANT_ID_INVALID");
  if (!mongoose.isValidObjectId(MANAGER_ID))
    throw new Error("DEMO_MANAGER_ID_INVALID");

  const restaurantId = new mongoose.Types.ObjectId(RESTAURANT_ID);
  const manager = await User.findById(MANAGER_ID)
    .populate("role", "slug")
    .lean();
  if (!manager) throw new Error("DEMO_MANAGER_NOT_FOUND");

  const managerUser = {
    id: manager._id,
    _id: manager._id,
    userType: manager.userType,
    roleName: manager?.role?.slug || "manager",
    fullName: manager.fullName,
  };
  if (!(await canAccessRestaurant(managerUser, restaurantId))) {
    throw new Error("DEMO_MANAGER_CANNOT_ACCESS_RESTAURANT");
  }

  const staff = await Staff.find({
    email: { $in: SCENARIOS.map((item) => item.email) },
    restaurantForStaff: restaurantId,
    userType: "STAFF",
    status: "active",
    deletedAt: null,
  }).lean();
  const staffByEmail = new Map(staff.map((item) => [item.email, item]));
  const missing = SCENARIOS.map((item) => item.email).filter(
    (email) => !staffByEmail.has(email),
  );
  if (missing.length)
    throw new Error(`DEMO_STAFF_ACCOUNTS_MISSING: ${missing.join(", ")}`);

  return {
    restaurantId,
    manager,
    managerUser,
    staffByEmail,
    staffIds: staff.map((item) => item._id),
  };
}

async function resetRoster({ restaurantId, staffIds }) {
  const workDate = { $gte: utcDay("2026-06-29"), $lt: utcDay("2026-07-13") };
  const shiftIds = await Shift.find({
    restaurantId,
    employeeId: { $in: staffIds },
    startTime: {
      $gte: hcmTime("2026-06-29", 0),
      $lte: hcmTime("2026-07-12", 23, 59, 59, 999),
    },
    notes: TAG_PATTERN,
  }).distinct("_id");

  await Promise.all([
    AttendanceCorrectionRequest.deleteMany({
      restaurantId,
      employeeId: { $in: staffIds },
      workDate,
      $or: [
        { reason: TAG_PATTERN },
        { evidenceNote: TAG_PATTERN },
        { reviewNote: TAG_PATTERN },
      ],
    }),
    OvertimeRequest.deleteMany({
      restaurantId,
      employeeId: { $in: staffIds },
      workDate,
      $or: [
        { reason: TAG_PATTERN },
        { approvalNote: TAG_PATTERN },
        { completionNote: TAG_PATTERN },
      ],
    }),
  ]);
  await Timesheet.deleteMany({
    restaurantId,
    employeeId: { $in: staffIds },
    workDate,
    $or: [{ shiftId: { $in: shiftIds } }, { note: TAG_PATTERN }],
  });
  await Shift.deleteMany({ _id: { $in: shiftIds } });
}

async function seedPublications({ restaurantId, manager }) {
  for (const week of WEEKS) {
    const periodStart = hcmTime(week.start, 0);
    const periodEnd = hcmTime(week.end, 23, 59, 59, 999);
    await SchedulePublication.findOneAndUpdate(
      { restaurantId, periodStart, periodEnd },
      {
        $set: {
          status: week.status,
          publishedAt: periodStart,
          publishedBy: manager._id,
          activatedAt: week.status === "active" ? periodStart : null,
          lastChangedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
}

async function seedShiftsAndPastTimesheets({ restaurantId, staffByEmail }) {
  const regularTimesheetByKey = new Map();
  const futureShiftIds = [];

  for (const scenario of SCENARIOS) {
    const staff = staffByEmail.get(scenario.email);
    const julyMinutes = distributedMinutes(scenario);

    for (const ymd of allDates) {
      const isPastDate = ymd < DEMO_AS_OF_DATE;
      const index = julyIndex.get(ymd);
      const isPastJuly = index !== undefined;
      const absent = isPastJuly && scenario.absences.includes(index);
      const late = isPastJuly ? Number(scenario.late[index] || 0) : 0;
      const early = isPastJuly ? Number(scenario.early[index] || 0) : 0;
      const worked = isPastJuly ? julyMinutes[index] : 420;
      const startTime = hcmTime(ymd, scenario.startHour);
      const endTime = hcmTime(ymd, scenario.startHour + 8);

      const shift = await Shift.create({
        restaurantId,
        employeeId: staff._id,
        shiftType: scenario.shiftType,
        startTime,
        endTime,
        status: isPastDate ? "completed" : "scheduled",
        notes: `${WEEK_TAG} ${scenario.email} ${ymd}`,
      });

      if (!isPastDate) {
        futureShiftIds.push(shift._id);
        continue;
      }

      const checkIn = absent
        ? null
        : new Date(startTime.getTime() + late * 60000);
      const checkOut = absent
        ? null
        : new Date(checkIn.getTime() + worked * 60000);
      const status = absent
        ? "scheduled_absent"
        : late && early
          ? "late_early_leave"
          : late
            ? "late"
            : early
              ? "early_leave"
              : "completed";

      const timesheet = await Timesheet.create({
        restaurantId,
        employeeId: staff._id,
        shiftId: shift._id,
        workDate: utcDay(ymd),
        source: "system",
        plannedStartTime: startTime,
        plannedEndTime: endTime,
        actualCheckInAt: checkIn,
        actualCheckOutAt: checkOut,
        latenessMinutes: late,
        earlyLeaveMinutes: early,
        workedMinutes: absent ? 0 : worked,
        hours: Number(((absent ? 0 : worked) / 60).toFixed(2)),
        status,
        approved: !absent,
        isOffSchedule: false,
        note: `${WEEK_TAG} ${scenario.email} ${ymd}`,
      });
      regularTimesheetByKey.set(`${scenario.email}:${ymd}`, timesheet);
    }
  }

  return { regularTimesheetByKey, futureShiftIds };
}

async function seedCorrections(context, regularTimesheetByKey) {
  const countableStatuses = ["pending", "applied", "rejected"];
  let sequence = 0;

  for (const scenario of SCENARIOS) {
    const staff = context.staffByEmail.get(scenario.email);
    const availableRows = julyAttendanceDates
      .map((ymd) => regularTimesheetByKey.get(`${scenario.email}:${ymd}`))
      .filter(Boolean);

    for (let index = 0; index < scenario.corrections; index += 1) {
      const row = availableRows[index % availableRows.length];
      const status = countableStatuses[sequence % countableStatuses.length];
      sequence += 1;
      const requestedAt = new Date(
        (row.actualCheckOutAt || row.plannedEndTime).getTime() + 30 * 60000,
      );
      const reviewedAt = new Date(requestedAt.getTime() + 60 * 60000);
      const requestedCheckInAt = row.actualCheckInAt || row.plannedStartTime;
      const requestedCheckOutAt = row.actualCheckOutAt || row.plannedEndTime;
      const auditLogs = [
        actorAudit(
          "attendance_correction.create",
          staff,
          requestedAt,
          `${WEEK_TAG} nhân viên gửi yêu cầu chỉnh công`,
        ),
      ];

      if (status === "applied") {
        auditLogs.push(
          actorAudit(
            "attendance_correction.approve",
            context.manager,
            reviewedAt,
            `${WEEK_TAG} quản lý duyệt`,
          ),
          actorAudit(
            "attendance_correction.apply",
            context.manager,
            reviewedAt,
            `${WEEK_TAG} đã áp dụng`,
          ),
        );
      }
      if (status === "rejected") {
        auditLogs.push(
          actorAudit(
            "attendance_correction.reject",
            context.manager,
            reviewedAt,
            `${WEEK_TAG} từ chối do không đủ bằng chứng`,
          ),
        );
      }

      await AttendanceCorrectionRequest.create({
        restaurantId: context.restaurantId,
        employeeId: staff._id,
        requestedBy: staff._id,
        requestedByRole: "STAFF",
        requestedAt,
        timesheetId: row._id,
        shiftId: row.shiftId,
        workDate: row.workDate,
        correctionType: "wrong_check_in_out",
        originalCheckInAt: row.actualCheckInAt,
        originalCheckOutAt: row.actualCheckOutAt,
        requestedCheckInAt,
        requestedCheckOutAt,
        originalWorkedMinutes: Number(row.workedMinutes || 0),
        requestedWorkedMinutes: Number(row.workedMinutes || 0),
        originalLatenessMinutes: Number(row.latenessMinutes || 0),
        requestedLatenessMinutes: Number(row.latenessMinutes || 0),
        originalEarlyLeaveMinutes: Number(row.earlyLeaveMinutes || 0),
        requestedEarlyLeaveMinutes: Number(row.earlyLeaveMinutes || 0),
        originalOvertimeMinutes: Number(row.overtimeMinutes || 0),
        requestedOvertimeMinutes: Number(row.overtimeMinutes || 0),
        reason: `${WEEK_TAG} Nhân viên đề nghị đối chiếu lại giờ vào/ra`,
        evidenceNote: `${WEEK_TAG} dữ liệu demo có lịch sử duyệt`,
        status,
        reviewedBy: status === "pending" ? null : context.manager._id,
        reviewedAt: status === "pending" ? null : reviewedAt,
        reviewNote:
          status === "applied" ? `${WEEK_TAG} đã đối chiếu và chấp nhận` : "",
        rejectionReason:
          status === "rejected"
            ? `${WEEK_TAG} thông tin chưa đủ để điều chỉnh`
            : "",
        appliedBy: status === "applied" ? context.manager._id : null,
        appliedAt: status === "applied" ? reviewedAt : null,
        auditLogs,
      });
    }
  }

  for (const [email, ymd] of [
    ["staff.server.demo@cohan.local", "2026-07-03"],
    ["staff.supervisor.demo@cohan.local", "2026-07-04"],
  ]) {
    const row = regularTimesheetByKey.get(`${email}:${ymd}`);
    if (!row) continue;
    const staff = context.staffByEmail.get(email);
    const requestedAt = new Date(
      (row.actualCheckOutAt || row.plannedEndTime).getTime() + 20 * 60000,
    );
    const cancelledAt = new Date(requestedAt.getTime() + 15 * 60000);
    await AttendanceCorrectionRequest.create({
      restaurantId: context.restaurantId,
      employeeId: staff._id,
      requestedBy: staff._id,
      requestedByRole: "STAFF",
      requestedAt,
      timesheetId: row._id,
      shiftId: row.shiftId,
      workDate: row.workDate,
      correctionType: "other",
      originalCheckInAt: row.actualCheckInAt,
      originalCheckOutAt: row.actualCheckOutAt,
      requestedCheckInAt: row.actualCheckInAt,
      requestedCheckOutAt: row.actualCheckOutAt,
      originalWorkedMinutes: Number(row.workedMinutes || 0),
      requestedWorkedMinutes: Number(row.workedMinutes || 0),
      reason: `${WEEK_TAG} Yêu cầu được nhân viên hủy`,
      evidenceNote: `${WEEK_TAG} cancelled demo`,
      status: "cancelled",
      auditLogs: [
        actorAudit(
          "attendance_correction.create",
          staff,
          requestedAt,
          `${WEEK_TAG} tạo yêu cầu`,
        ),
        actorAudit(
          "attendance_correction.cancel",
          staff,
          cancelledAt,
          `${WEEK_TAG} nhân viên tự hủy`,
        ),
      ],
    });
  }
}

async function seedOffScheduleAttendance(context) {
  const created = [];
  for (const definition of OFF_SCHEDULE_DEFINITIONS.filter(
    (item) => item.workDate < DEMO_AS_OF_DATE,
  )) {
    const staff = context.staffByEmail.get(definition.email);
    const checkIn = hcmTime(definition.workDate, 18, 0);
    const checkOut = new Date(
      checkIn.getTime() + definition.workedMinutes * 60000,
    );
    const reviewedAt = new Date(checkOut.getTime() + 30 * 60000);
    const approved = definition.approvalStatus === "approved";
    const reviewed = ["approved", "rejected"].includes(
      definition.approvalStatus,
    );

    const row = await Timesheet.create({
      restaurantId: context.restaurantId,
      employeeId: staff._id,
      shiftId: null,
      workDate: utcDay(definition.workDate),
      source: "manual",
      plannedStartTime: null,
      plannedEndTime: null,
      actualCheckInAt: checkIn,
      actualCheckOutAt: checkOut,
      workedMinutes: definition.workedMinutes,
      hours: Number((definition.workedMinutes / 60).toFixed(2)),
      status: "unscheduled_completed",
      isOffSchedule: true,
      offScheduleReasonCategory: definition.reasonCategory,
      offScheduleReason: `${WEEK_TAG} phát sinh hỗ trợ ngoài lịch`,
      offScheduleApprovalStatus: definition.approvalStatus,
      offScheduleReviewedBy: reviewed ? context.manager._id : null,
      offScheduleReviewedAt: reviewed ? reviewedAt : null,
      offScheduleReviewNote: reviewed
        ? `${WEEK_TAG} ${approved ? "đã duyệt" : "từ chối"} công ngoài lịch`
        : "",
      approved,
      note: `${WEEK_TAG} off-schedule ${definition.approvalStatus}`,
    });
    created.push(row);
  }
  return created;
}

async function applyOvertimeState({
  row,
  minutes,
  status,
  manager,
  reviewNote,
}) {
  row.actualCheckOutAt = new Date(
    row.plannedEndTime.getTime() + minutes * 60000,
  );
  row.earlyLeaveMinutes = 0;
  row.overtimeMinutes = minutes;
  // ponytail: base workedMinutes stays separate so overtime is not counted twice in performance/payroll summaries.
  await row.save();

  if (status === "pending") return row;

  row.overtimeApprovalStatus = status;
  row.approvedOvertimeMinutes = status === "approved" ? minutes : 0;
  row.overtimeReviewNote = reviewNote;
  row.overtimeReviewedBy = manager._id;
  row.overtimeReviewedAt = new Date(
    row.actualCheckOutAt.getTime() + 30 * 60000,
  );
  await row.save();
  return row;
}

async function seedOvertime(context, regularTimesheetByKey) {
  const requests = [];

  for (const definition of OVERTIME_DEFINITIONS.filter(
    (item) => item.workDate < DEMO_AS_OF_DATE,
  )) {
    const staff = context.staffByEmail.get(definition.email);
    const row = regularTimesheetByKey.get(
      `${definition.email}:${definition.workDate}`,
    );
    if (!row || !row.actualCheckInAt || !row.actualCheckOutAt) {
      throw new Error(
        `DEMO_OVERTIME_TIMESHEET_NOT_REVIEWABLE: ${definition.email} ${definition.workDate}`,
      );
    }

    const timesheetStatus =
      definition.requestStatus === "rejected"
        ? "rejected"
        : ["approved", "completed"].includes(definition.requestStatus)
          ? "approved"
          : "pending";
    await applyOvertimeState({
      row,
      minutes: definition.minutes,
      status: timesheetStatus,
      manager: context.manager,
      reviewNote: `${WEEK_TAG} ${timesheetStatus === "rejected" ? "từ chối" : "duyệt"} tăng ca từ bảng công`,
    });

    const plannedStartTime = row.plannedEndTime;
    const plannedEndTime = new Date(
      plannedStartTime.getTime() + definition.minutes * 60000,
    );
    const requestedAt = new Date(plannedStartTime.getTime() - 2 * 60 * 60000);
    const approvedAt = new Date(plannedStartTime.getTime() - 60 * 60000);
    const completedAt = new Date(row.actualCheckOutAt.getTime() + 15 * 60000);
    const isApproved = ["approved", "completed"].includes(
      definition.requestStatus,
    );
    const isRejected = definition.requestStatus === "rejected";
    const isCompleted = definition.requestStatus === "completed";
    const employeeConfirmationRequired =
      definition.requestStatus === "pending_employee_confirmation";
    const requestedBy = employeeConfirmationRequired
      ? context.manager._id
      : staff._id;
    const requestedByRole = employeeConfirmationRequired ? "manager" : "staff";
    const auditLogs = [
      actorAudit(
        "overtime.create",
        employeeConfirmationRequired ? context.manager : staff,
        requestedAt,
        `${WEEK_TAG} tạo yêu cầu tăng ca`,
        {
          plannedOvertimeMinutes: definition.minutes,
          overtimeType: definition.overtimeType,
        },
      ),
    ];

    if (isApproved) {
      auditLogs.push(
        actorAudit(
          "overtime.approve",
          context.manager,
          approvedAt,
          `${WEEK_TAG} quản lý duyệt`,
          {
            approvedOvertimeMinutes: definition.minutes,
          },
        ),
      );
    }
    if (isRejected) {
      auditLogs.push(
        actorAudit(
          "overtime.reject",
          context.manager,
          approvedAt,
          `${WEEK_TAG} từ chối tăng ca`,
        ),
      );
    }
    if (isCompleted) {
      auditLogs.push(
        actorAudit(
          "overtime.complete",
          context.manager,
          completedAt,
          `${WEEK_TAG} hoàn tất tăng ca`,
          {
            actualOvertimeMinutes: definition.minutes,
            approvedOvertimeMinutes: definition.minutes,
          },
        ),
        actorAudit(
          "overtime.apply_to_timesheet",
          context.manager,
          completedAt,
          `${WEEK_TAG} ghi nhận vào bảng công`,
          {
            timesheetId: String(row._id),
          },
        ),
      );
    }

    const request = await OvertimeRequest.create({
      employeeId: staff._id,
      restaurantId: context.restaurantId,
      shiftId: row.shiftId,
      timesheetId: row._id,
      workDate: row.workDate,
      plannedStartTime,
      plannedEndTime,
      plannedOvertimeMinutes: definition.minutes,
      actualStartTime: isCompleted ? plannedStartTime : null,
      actualEndTime: isCompleted ? row.actualCheckOutAt : null,
      actualOvertimeMinutes: isCompleted ? definition.minutes : 0,
      approvedOvertimeMinutes: isApproved ? definition.minutes : 0,
      overtimeType: definition.overtimeType,
      reason: `${WEEK_TAG} hỗ trợ vận hành sau giờ phân ca`,
      status: definition.requestStatus,
      employeeConfirmationRequired,
      requestedBy,
      requestedByRole,
      requestedAt,
      approvedBy: isApproved ? context.manager._id : null,
      approvedAt: isApproved ? approvedAt : null,
      approvalNote: isApproved ? `${WEEK_TAG} duyệt theo nhu cầu vận hành` : "",
      rejectedBy: isRejected ? context.manager._id : null,
      rejectedAt: isRejected ? approvedAt : null,
      rejectionReason: isRejected ? `${WEEK_TAG} không đủ nhu cầu tăng ca` : "",
      completedBy: isCompleted ? context.manager._id : null,
      completedAt: isCompleted ? completedAt : null,
      completionNote: isCompleted ? `${WEEK_TAG} đã đối chiếu giờ thực tế` : "",
      auditLogs,
    });

    row.overtimeRequestId = request._id;
    await row.save();
    requests.push(request);
  }

  return requests;
}

async function recalculate(context, futureShiftIds) {
  // ponytail: the production formula has no as-of argument; hide future demo shifts only while calculating the current snapshot.
  if (futureShiftIds.length) {
    await Shift.updateMany(
      { _id: { $in: futureShiftIds } },
      { $set: { status: "cancelled" } },
    );
  }

  try {
    for (const [periodStart, periodEnd] of PERIODS) {
      for (const employeeId of context.staffIds) {
        await recalculateStaffPerformanceSnapshots({
          input: {
            restaurantId: String(context.restaurantId),
            employeeId: String(employeeId),
            periodStart,
            periodEnd,
          },
          ctx: { user: context.managerUser },
        });
      }
    }
  } finally {
    if (futureShiftIds.length) {
      await Shift.updateMany(
        { _id: { $in: futureShiftIds } },
        { $set: { status: "scheduled" } },
      );
    }
  }

  await StaffPerformanceSnapshot.updateMany(
    {
      restaurantId: context.restaurantId,
      employeeId: { $in: context.staffIds },
      periodStart: { $in: PERIODS.map(([start]) => start) },
    },
    {
      $set: {
        "factors.demoTag": BASE_TAG,
        "factors.weekRosterTag": WEEK_TAG,
        "factors.weekRosterStart": "2026-06-29",
        "factors.weekRosterEnd": "2026-07-12",
        "factors.attendanceDataAsOf": DEMO_AS_OF_DATE,
        "factors.attendanceDataCutoff": attendanceCutoffDate,
      },
    },
  );
}

async function main() {
  assertDemoScriptAllowed("seedStaffPerformanceWeekRoster.js");
  console.log("Connecting with DB settings:", safeDbInfo());
  console.log(
    `Attendance demo as-of=${DEMO_AS_OF_DATE}, cutoff=${attendanceCutoffDate || "none"}`,
  );
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "cohan",
  });

  const context = await resolveContext();
  await resetRoster(context);
  await seedPublications(context);
  const { regularTimesheetByKey, futureShiftIds } =
    await seedShiftsAndPastTimesheets(context);
  await seedCorrections(context, regularTimesheetByKey);
  await seedOffScheduleAttendance(context);
  await seedOvertime(context, regularTimesheetByKey);
  await recalculate(context, futureShiftIds);

  const [
    shiftCount,
    regularTimesheetCount,
    offScheduleCount,
    correctionCount,
    overtimeRequestCount,
    futureAttendanceCount,
  ] = await Promise.all([
    Shift.countDocuments({
      restaurantId: context.restaurantId,
      employeeId: { $in: context.staffIds },
      notes: WEEK_TAG_PATTERN,
    }),
    Timesheet.countDocuments({
      restaurantId: context.restaurantId,
      employeeId: { $in: context.staffIds },
      note: WEEK_TAG_PATTERN,
      isOffSchedule: false,
    }),
    Timesheet.countDocuments({
      restaurantId: context.restaurantId,
      employeeId: { $in: context.staffIds },
      note: WEEK_TAG_PATTERN,
      isOffSchedule: true,
    }),
    AttendanceCorrectionRequest.countDocuments({
      restaurantId: context.restaurantId,
      employeeId: { $in: context.staffIds },
      reason: WEEK_TAG_PATTERN,
    }),
    OvertimeRequest.countDocuments({
      restaurantId: context.restaurantId,
      employeeId: { $in: context.staffIds },
      reason: WEEK_TAG_PATTERN,
    }),
    Timesheet.countDocuments({
      restaurantId: context.restaurantId,
      employeeId: { $in: context.staffIds },
      note: WEEK_TAG_PATTERN,
      workDate: { $gte: utcDay(DEMO_AS_OF_DATE) },
    }),
  ]);

  const expectedRegularTimesheets = attendanceDates.length * SCENARIOS.length;
  if (
    shiftCount !== allDates.length * SCENARIOS.length ||
    regularTimesheetCount !== expectedRegularTimesheets ||
    offScheduleCount !==
      OFF_SCHEDULE_DEFINITIONS.filter((item) => item.workDate < DEMO_AS_OF_DATE)
        .length ||
    correctionCount !==
      SCENARIOS.reduce((sum, item) => sum + item.corrections, 0) + 2 ||
    overtimeRequestCount !==
      OVERTIME_DEFINITIONS.filter((item) => item.workDate < DEMO_AS_OF_DATE)
        .length ||
    futureAttendanceCount !== 0
  ) {
    throw new Error(
      `DEMO_ATTENDANCE_COUNT_MISMATCH: shifts=${shiftCount} regularTimesheets=${regularTimesheetCount} offSchedule=${offScheduleCount} corrections=${correctionCount} overtimeRequests=${overtimeRequestCount} futureAttendance=${futureAttendanceCount}`,
    );
  }

  console.log(
    `Past attendance completed: shifts=${shiftCount}, regularTimesheets=${regularTimesheetCount}, offSchedule=${offScheduleCount}, corrections=${correctionCount}, overtimeRequests=${overtimeRequestCount}, futureAttendance=${futureAttendanceCount}`,
  );
}

main()
  .catch((error) => {
    console.error("[seed:demo:staff-performance-weeks] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect().catch(() => {}));
