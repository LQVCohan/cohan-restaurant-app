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
} from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const RESTAURANT_ID =
  process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
const DEMO_AS_OF_DATE = process.env.DEMO_AS_OF_DATE?.trim() || "2026-07-07";
const WEEK_TAG_PATTERN = /demo-staff-performance-weeks-2026-07/;
const STAFF_LEVELS = [
  ["staff.server.demo@cohan.local", "excellent"],
  ["staff.supervisor.demo@cohan.local", "good"],
  ["staff.cashier.demo@cohan.local", "average"],
  ["staff.chef.demo@cohan.local", "needs_attention"],
  ["staff.kitchenhelper.demo@cohan.local", "average"],
  ["staff.exception.demo@cohan.local", "poor"],
  ["staff.parttime.demo@cohan.local", "good"],
];
const JULY_START = new Date("2026-07-01T00:00:00.000Z");
const JULY_END = new Date("2026-07-31T23:59:59.999Z");

const utcDay = (ymd) => new Date(`${ymd}T00:00:00.000Z`);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
const isoDate = (date) => date.toISOString().slice(0, 10);
const hcmTime = (ymd, hour, minute = 0, second = 0, ms = 0) => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second, ms));
};
const hcmDate = (value) =>
  new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
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
const attendanceCutoffDate = attendanceDates.at(-1) || null;
const asOfStart = hcmTime(DEMO_AS_OF_DATE, 0);

const state = { pass: 0, fail: 0 };
const check = (condition, message) => {
  if (condition) {
    state.pass += 1;
    console.log(`PASS ${message}`);
  } else {
    state.fail += 1;
    console.error(`FAIL ${message}`);
  }
};

function isBeforeAsOf(value) {
  if (!value) return true;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date < asOfStart;
}

async function run() {
  assertDemoScriptAllowed("verifyStaffPerformanceWeekRoster.js");
  console.log("Connecting with DB settings:", safeDbInfo());
  console.log(
    `Verifying attendance as-of=${DEMO_AS_OF_DATE}, cutoff=${attendanceCutoffDate || "none"}`,
  );
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "cohan",
  });

  const restaurantId = new mongoose.Types.ObjectId(RESTAURANT_ID);
  const staff = await Staff.find({
    email: { $in: STAFF_LEVELS.map(([email]) => email) },
    restaurantForStaff: restaurantId,
    userType: "STAFF",
  })
    .select("_id email")
    .lean();
  const staffByEmail = new Map(staff.map((item) => [item.email, item]));
  check(staff.length === 7, "found seven performance demo staff accounts");

  const staffIds = staff.map((item) => item._id);
  const [
    shifts,
    timesheets,
    corrections,
    publications,
    snapshots,
    overtimeRequests,
  ] = await Promise.all([
    Shift.find({
      restaurantId,
      employeeId: { $in: staffIds },
      notes: WEEK_TAG_PATTERN,
    }).lean(),
    Timesheet.find({
      restaurantId,
      employeeId: { $in: staffIds },
      note: WEEK_TAG_PATTERN,
    }).lean(),
    AttendanceCorrectionRequest.find({
      restaurantId,
      employeeId: { $in: staffIds },
      reason: WEEK_TAG_PATTERN,
    }).lean(),
    SchedulePublication.find({
      restaurantId,
      $or: [
        {
          periodStart: hcmTime("2026-06-29", 0),
          periodEnd: hcmTime("2026-07-05", 23, 59, 59, 999),
        },
        {
          periodStart: hcmTime("2026-07-06", 0),
          periodEnd: hcmTime("2026-07-12", 23, 59, 59, 999),
        },
      ],
    }).lean(),
    StaffPerformanceSnapshot.find({
      restaurantId,
      employeeId: { $in: staffIds },
      periodStart: JULY_START,
      periodEnd: JULY_END,
    }).lean(),
    OvertimeRequest.find({
      restaurantId,
      employeeId: { $in: staffIds },
      reason: WEEK_TAG_PATTERN,
    }).lean(),
  ]);

  const regularTimesheets = timesheets.filter(
    (item) => !item.isOffSchedule && item.shiftId,
  );
  const offScheduleTimesheets = timesheets.filter((item) => item.isOffSchedule);
  const overtimeTimesheets = regularTimesheets.filter(
    (item) => Number(item.overtimeMinutes || 0) > 0,
  );
  const expectedRegularTimesheets =
    attendanceDates.length * STAFF_LEVELS.length;

  check(
    shifts.length === allDates.length * STAFF_LEVELS.length,
    "created 98 shifts for fourteen days and seven employees",
  );
  check(
    regularTimesheets.length === expectedRegularTimesheets,
    `created ${expectedRegularTimesheets} regular timesheets only for completed dates`,
  );
  check(
    offScheduleTimesheets.length === 3,
    "created three off-schedule attendance review examples",
  );
  check(
    timesheets.length === expectedRegularTimesheets + 3,
    "total attendance count contains no future placeholders",
  );
  check(
    corrections.length === 16,
    "created fourteen countable corrections plus two cancelled examples",
  );
  check(publications.length === 2, "created both weekly schedule publications");
  check(
    publications.some((item) => item.status === "published"),
    "previous week is published",
  );
  check(
    publications.some((item) => item.status === "active"),
    "current week is active",
  );

  const dates = new Map();
  const employeeDates = new Set();
  for (const shift of shifts) {
    const date = hcmDate(shift.startTime);
    dates.set(date, (dates.get(date) || 0) + 1);
    employeeDates.add(`${shift.employeeId}:${date}`);
    check(
      shift.status === (date < DEMO_AS_OF_DATE ? "completed" : "scheduled"),
      `${date} shift status matches past/future lifecycle`,
    );
  }
  check(
    dates.size === 14,
    "roster covers fourteen distinct Vietnam calendar dates",
  );
  check(
    [...dates.values()].every((count) => count === 7),
    "every roster date contains seven employee shifts",
  );
  check(
    employeeDates.size === 98,
    "there are no duplicate employee/date shifts",
  );

  const regularDates = new Map();
  const regularEmployeeDates = new Set();
  for (const row of regularTimesheets) {
    const date = hcmDate(row.workDate);
    regularDates.set(date, (regularDates.get(date) || 0) + 1);
    regularEmployeeDates.add(`${row.employeeId}:${date}`);
  }
  check(
    regularDates.size === attendanceDates.length,
    "attendance covers only completed calendar dates",
  );
  check(
    [...regularDates.keys()].every((date) => date < DEMO_AS_OF_DATE),
    "no regular attendance exists today or in the future",
  );
  check(
    [...regularDates.values()].every((count) => count === 7),
    "every completed date contains seven regular attendance rows",
  );
  check(
    regularEmployeeDates.size === expectedRegularTimesheets,
    "there are no duplicate regular employee/date attendance rows",
  );

  const shiftIds = new Set(shifts.map((item) => String(item._id)));
  check(
    regularTimesheets.every((item) => shiftIds.has(String(item.shiftId))),
    "every regular timesheet points to a roster shift",
  );
  check(
    timesheets.every((item) => hcmDate(item.workDate) < DEMO_AS_OF_DATE),
    "all tagged timesheets are strictly before the as-of date",
  );

  const regularByEmployee = new Map();
  for (const row of regularTimesheets) {
    const key = String(row.employeeId);
    regularByEmployee.set(key, (regularByEmployee.get(key) || 0) + 1);
  }
  for (const [email] of STAFF_LEVELS) {
    const employee = staffByEmail.get(email);
    check(
      Number(regularByEmployee.get(String(employee?._id)) || 0) ===
        attendanceDates.length,
      `${email} has attendance for every completed date`,
    );
  }

  const correctionStatuses = new Set(corrections.map((item) => item.status));
  check(
    correctionStatuses.has("pending"),
    "attendance corrections include pending review",
  );
  check(
    correctionStatuses.has("applied"),
    "attendance corrections include applied approvals",
  );
  check(
    correctionStatuses.has("rejected"),
    "attendance corrections include rejected reviews",
  );
  check(
    correctionStatuses.has("cancelled"),
    "attendance corrections include employee-cancelled requests",
  );
  check(
    corrections.filter((item) => item.status !== "cancelled").length === 14,
    "fourteen corrections remain performance-countable",
  );
  check(
    corrections.every((item) => hcmDate(item.workDate) < DEMO_AS_OF_DATE),
    "all correction requests are for completed dates",
  );
  check(
    corrections.every((item) =>
      [item.requestedAt, item.reviewedAt, item.appliedAt].every(isBeforeAsOf),
    ),
    "all correction workflow timestamps are before the as-of date",
  );

  const offScheduleStatuses = new Set(
    offScheduleTimesheets.map((item) => item.offScheduleApprovalStatus),
  );
  check(
    offScheduleStatuses.has("pending"),
    "off-schedule attendance includes pending review",
  );
  check(
    offScheduleStatuses.has("approved"),
    "off-schedule attendance includes approved review",
  );
  check(
    offScheduleStatuses.has("rejected"),
    "off-schedule attendance includes rejected review",
  );
  check(
    offScheduleTimesheets.every((item) => !item.shiftId),
    "off-schedule attendance is not bound to roster shifts",
  );
  check(
    offScheduleTimesheets.every((item) =>
      [
        item.actualCheckInAt,
        item.actualCheckOutAt,
        item.offScheduleReviewedAt,
      ].every(isBeforeAsOf),
    ),
    "off-schedule workflow timestamps are before the as-of date",
  );

  const overtimeApprovalStatuses = new Set(
    overtimeTimesheets.map((item) => item.overtimeApprovalStatus),
  );
  check(
    overtimeTimesheets.length === 5,
    "created five overtime-bearing timesheets",
  );
  check(
    overtimeApprovalStatuses.has("pending"),
    "timesheet overtime includes pending review",
  );
  check(
    overtimeApprovalStatuses.has("approved"),
    "timesheet overtime includes approved review",
  );
  check(
    overtimeApprovalStatuses.has("rejected"),
    "timesheet overtime includes rejected review",
  );
  check(
    overtimeTimesheets.every(
      (item) => item.actualCheckOutAt > item.plannedEndTime,
    ),
    "every overtime timesheet has check-out after planned end",
  );

  const requestStatuses = new Set(overtimeRequests.map((item) => item.status));
  for (const status of [
    "pending_employee_confirmation",
    "pending_approval",
    "approved",
    "rejected",
    "completed",
  ]) {
    check(requestStatuses.has(status), `overtime requests include ${status}`);
  }
  check(
    overtimeRequests.length === 5,
    "created five employee overtime requests",
  );
  check(
    overtimeRequests.every((item) => hcmDate(item.workDate) < DEMO_AS_OF_DATE),
    "all overtime requests are for completed dates",
  );
  check(
    overtimeRequests.every((item) =>
      [
        item.requestedAt,
        item.employeeConfirmedAt,
        item.approvedAt,
        item.rejectedAt,
        item.completedAt,
      ].every(isBeforeAsOf),
    ),
    "all overtime workflow timestamps are before the as-of date",
  );
  check(
    overtimeRequests.every((item) => item.timesheetId && item.shiftId),
    "every overtime request is linked to its roster shift and timesheet",
  );

  const snapshotByEmployee = new Map(
    snapshots.map((snapshot) => [String(snapshot.employeeId), snapshot]),
  );
  for (const [email, expectedLevel] of STAFF_LEVELS) {
    const employee = staffByEmail.get(email);
    const snapshot = snapshotByEmployee.get(String(employee?._id));
    check(Boolean(snapshot), `${email} has a July performance snapshot`);
    check(
      snapshot?.performanceLevel === expectedLevel,
      `${email} keeps level=${expectedLevel}`,
    );
    check(
      snapshot?.factors?.weekRosterTag?.includes(
        "demo-staff-performance-weeks",
      ),
      `${email} snapshot references the two-week roster`,
    );
    check(
      snapshot?.factors?.attendanceDataAsOf === DEMO_AS_OF_DATE,
      `${email} snapshot records attendance as-of date`,
    );
    check(
      snapshot?.factors?.attendanceDataCutoff === attendanceCutoffDate,
      `${email} snapshot records attendance cutoff`,
    );
  }

  console.log(`\nSummary: PASS=${state.pass} FAIL=${state.fail}`);
  return state.fail ? 1 : 0;
}

let exitCode = 1;
try {
  exitCode = await run();
} catch (error) {
  console.error(error);
} finally {
  await mongoose.disconnect().catch(() => {});
}
process.exit(exitCode);
