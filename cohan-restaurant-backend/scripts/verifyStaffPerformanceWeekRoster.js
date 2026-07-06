import "dotenv/config.js";
import mongoose from "mongoose";
import {
  AttendanceCorrectionRequest,
  SchedulePublication,
  Shift,
  Staff,
  StaffPerformanceSnapshot,
  Timesheet,
} from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
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

const hcmTime = (ymd, hour, minute = 0, second = 0, ms = 0) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - 7, minute, second, ms));
};
const hcmDate = (value) =>
  new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

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

async function run() {
  assertDemoScriptAllowed("verifyStaffPerformanceWeekRoster.js");
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "foodhub",
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
  const [shifts, timesheets, corrections, publications, snapshots] = await Promise.all([
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
  ]);

  check(shifts.length === 98, "created 98 shifts for fourteen days and seven employees");
  check(timesheets.length === 98, "created 98 matching timesheets");
  check(corrections.length === 14, "preserved fourteen July correction scenarios");
  check(publications.length === 2, "created both weekly schedule publications");
  check(publications.some((item) => item.status === "published"), "previous week is published");
  check(publications.some((item) => item.status === "active"), "current week is active");

  const dates = new Map();
  const employeeDates = new Set();
  for (const shift of shifts) {
    const date = hcmDate(shift.startTime);
    dates.set(date, (dates.get(date) || 0) + 1);
    employeeDates.add(`${shift.employeeId}:${date}`);
  }
  check(dates.size === 14, "roster covers fourteen distinct Vietnam calendar dates");
  check([...dates.values()].every((count) => count === 7), "every date contains seven employee shifts");
  check(employeeDates.size === 98, "there are no duplicate employee/date shifts");

  const shiftIds = new Set(shifts.map((item) => String(item._id)));
  check(
    timesheets.every((item) => shiftIds.has(String(item.shiftId))),
    "every timesheet points to a roster shift",
  );

  const shiftsByEmployee = new Map();
  for (const shift of shifts) {
    const key = String(shift.employeeId);
    shiftsByEmployee.set(key, (shiftsByEmployee.get(key) || 0) + 1);
  }
  for (const [email] of STAFF_LEVELS) {
    const employee = staffByEmail.get(email);
    check(Number(shiftsByEmployee.get(String(employee?._id)) || 0) === 14, `${email} has fourteen shifts`);
  }

  const snapshotByEmployee = new Map(
    snapshots.map((snapshot) => [String(snapshot.employeeId), snapshot]),
  );
  for (const [email, expectedLevel] of STAFF_LEVELS) {
    const employee = staffByEmail.get(email);
    const snapshot = snapshotByEmployee.get(String(employee?._id));
    check(Boolean(snapshot), `${email} has a July performance snapshot`);
    check(snapshot?.performanceLevel === expectedLevel, `${email} keeps level=${expectedLevel}`);
    check(snapshot?.factors?.weekRosterTag?.includes("demo-staff-performance-weeks"), `${email} snapshot references the two-week roster`);
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
