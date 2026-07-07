import "dotenv/config.js";
import mongoose from "mongoose";
import {
  SchedulingPolicy,
  Shift,
  Staff,
  Timesheet,
} from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const RESTAURANT_ID =
  process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
const WEEK_TAG_PATTERN = /demo-staff-performance-weeks-2026-07/;
const EXPECTED_SHIFT_COUNT = 98;
const OPEN_MINUTES = 7 * 60;
const CLOSE_MINUTES = 23 * 60;

const SCENARIOS = [
  ["staff.server.demo@cohan.local", "morning", 7, 8],
  ["staff.chef.demo@cohan.local", "morning", 7, 8],
  ["staff.supervisor.demo@cohan.local", "evening", 15, 8],
  ["staff.cashier.demo@cohan.local", "afternoon", 11, 4],
  ["staff.kitchenhelper.demo@cohan.local", "afternoon", 11, 4],
  ["staff.exception.demo@cohan.local", "afternoon", 11, 4],
  ["staff.parttime.demo@cohan.local", "rotating", 19, 4],
].map(([email, shiftType, startHour, shiftHours]) => ({
  email,
  shiftType,
  startHour,
  shiftHours,
}));

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

const hcmDate = (value) =>
  new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

const hcmMinutes = (value) => {
  const shifted = new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
};

const durationMinutes = (startTime, endTime) =>
  Math.round((new Date(endTime) - new Date(startTime)) / 60000);

const rangesOverlap = (left, right) =>
  new Date(left.startTime) < new Date(right.endTime) &&
  new Date(right.startTime) < new Date(left.endTime);

async function run() {
  assertDemoScriptAllowed("verifySharedRosterHoursDemo.js");
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "foodhub",
  });

  const restaurantId = new mongoose.Types.ObjectId(RESTAURANT_ID);
  const staff = await Staff.find({
    restaurantForStaff: restaurantId,
    email: { $in: SCENARIOS.map((item) => item.email) },
    userType: "STAFF",
    deletedAt: null,
  })
    .select("_id email employmentType")
    .lean();
  const staffById = new Map(staff.map((item) => [String(item._id), item]));
  const scenarioByEmail = new Map(SCENARIOS.map((item) => [item.email, item]));

  const [shifts, timesheets, policy] = await Promise.all([
    Shift.find({
      restaurantId,
      employeeId: { $in: staff.map((item) => item._id) },
      notes: WEEK_TAG_PATTERN,
    })
      .sort({ startTime: 1 })
      .lean(),
    Timesheet.find({
      restaurantId,
      employeeId: { $in: staff.map((item) => item._id) },
      note: WEEK_TAG_PATTERN,
      shiftId: { $ne: null },
    }).lean(),
    SchedulingPolicy.findOne({ restaurantId }).lean(),
  ]);

  check(staff.length === SCENARIOS.length, "found the existing seven demo staff");
  check(shifts.length === EXPECTED_SHIFT_COUNT, "reused the existing 98 shifts");

  const shiftsByDate = new Map();
  const employeeDates = new Set();
  let validShiftCount = 0;

  for (const shift of shifts) {
    const staffRow = staffById.get(String(shift.employeeId));
    const scenario = scenarioByEmail.get(staffRow?.email);
    if (!scenario) continue;

    const expectedStart = scenario.startHour * 60;
    const expectedEnd = expectedStart + scenario.shiftHours * 60;
    if (
      shift.shiftType === scenario.shiftType &&
      hcmMinutes(shift.startTime) === expectedStart &&
      hcmMinutes(shift.endTime) === expectedEnd &&
      durationMinutes(shift.startTime, shift.endTime) === scenario.shiftHours * 60 &&
      expectedStart >= OPEN_MINUTES &&
      expectedEnd <= CLOSE_MINUTES
    ) {
      validShiftCount += 1;
    }

    const date = hcmDate(shift.startTime);
    const rows = shiftsByDate.get(date) || [];
    rows.push(shift);
    shiftsByDate.set(date, rows);
    employeeDates.add(`${shift.employeeId}:${date}`);
  }

  check(validShiftCount === shifts.length, "all existing shifts use the new 07:00-23:00 windows");
  check(shiftsByDate.size === 14, "the original previous/current two-week range remains intact");
  check(
    [...shiftsByDate.values()].every((rows) => rows.length === SCENARIOS.length),
    "every date still contains seven assignments",
  );
  check(employeeDates.size === EXPECTED_SHIFT_COUNT, "no duplicate employee/date shift was created");

  const mixedOverlapDates = [...shiftsByDate.values()].filter((rows) => {
    const fullTime = rows.filter(
      (row) => staffById.get(String(row.employeeId))?.employmentType === "full_time",
    );
    const partTime = rows.filter(
      (row) => staffById.get(String(row.employeeId))?.employmentType === "part_time",
    );
    return fullTime.some((fullShift) =>
      partTime.some((partShift) => rangesOverlap(fullShift, partShift)),
    );
  });
  check(
    mixedOverlapDates.length === shiftsByDate.size,
    "full-time and part-time coverage overlaps on every existing roster date",
  );

  const shiftById = new Map(shifts.map((item) => [String(item._id), item]));
  check(
    timesheets.every((row) => {
      const shift = shiftById.get(String(row.shiftId));
      const staffRow = staffById.get(String(row.employeeId));
      const scenario = scenarioByEmail.get(staffRow?.email);
      if (!shift || !scenario) return false;
      return (
        durationMinutes(row.plannedStartTime, row.plannedEndTime) ===
          scenario.shiftHours * 60 &&
        Number(row.workedMinutes || 0) <= scenario.shiftHours * 60 &&
        Math.abs(Number(row.hours || 0) * 60 - Number(row.workedMinutes || 0)) < 1
      );
    }),
    "existing attendance rows match 8-hour full-time and 4-hour part-time plans",
  );

  const templates = policy?.shiftTemplates || [];
  const templateByKey = new Map(templates.map((item) => [item.key, item]));
  check(Boolean(policy), "restaurant scheduling policy exists");
  check(templateByKey.get("morning")?.startTime === "07:00", "full-time morning starts at 07:00");
  check(templateByKey.get("evening")?.endTime === "23:00", "full-time evening ends at 23:00");
  check(templateByKey.get("afternoon")?.startTime === "11:00", "lunch part-time starts at 11:00");
  check(templateByKey.get("rotating")?.startTime === "19:00", "evening part-time starts at 19:00");
  check(policy?.laborRules?.preventShiftOverlap === true, "same-employee overlap protection remains enabled");
  check(policy?.employmentTypePolicy?.full_time?.weeklyHoursTarget === 40, "full-time weekly target is 40 hours");
  check(policy?.employmentTypePolicy?.part_time?.weeklyHoursTarget === 20, "part-time weekly target is 20 hours");

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
