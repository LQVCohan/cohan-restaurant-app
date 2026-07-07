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
const TAG_PATTERN = /demo-shared-roster-hours-2026-07/;
const HISTORICAL_START = "2026-06-15";
const FUTURE_START = "2026-07-13";
const EXPECTED_STAFF = 14;
const EXPECTED_SHIFT_COUNT = EXPECTED_STAFF * 14;
const EXPECTED_TIMESHEET_COUNT = EXPECTED_STAFF * 7;
const OPEN_MINUTES = 7 * 60;
const CLOSE_MINUTES = 23 * 60;

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
    userType: "STAFF",
    deletedAt: null,
  })
    .select("_id email employmentType")
    .lean();
  const staffById = new Map(staff.map((item) => [String(item._id), item]));

  const [shifts, timesheets, policy] = await Promise.all([
    Shift.find({ restaurantId, notes: TAG_PATTERN }).sort({ startTime: 1 }).lean(),
    Timesheet.find({ restaurantId, note: TAG_PATTERN }).sort({ workDate: 1 }).lean(),
    SchedulingPolicy.findOne({ restaurantId }).lean(),
  ]);

  const seededStaffIds = new Set(shifts.map((item) => String(item.employeeId)));
  check(seededStaffIds.size === EXPECTED_STAFF, "roster contains all fourteen demo staff");
  check(shifts.length === EXPECTED_SHIFT_COUNT, "created two complete seven-day rosters");
  check(timesheets.length === EXPECTED_TIMESHEET_COUNT, "created attendance only for the historical week");

  const shiftsByDate = new Map();
  const shiftsByEmployeeDate = new Map();
  let validDurationCount = 0;
  let insideOperatingHoursCount = 0;

  for (const shift of shifts) {
    const staffRow = staffById.get(String(shift.employeeId));
    const expectedMinutes = staffRow?.employmentType === "full_time" ? 480 : 240;
    if (durationMinutes(shift.startTime, shift.endTime) === expectedMinutes) {
      validDurationCount += 1;
    }
    if (
      hcmMinutes(shift.startTime) >= OPEN_MINUTES &&
      hcmMinutes(shift.endTime) <= CLOSE_MINUTES
    ) {
      insideOperatingHoursCount += 1;
    }

    const date = hcmDate(shift.startTime);
    const dateRows = shiftsByDate.get(date) || [];
    dateRows.push(shift);
    shiftsByDate.set(date, dateRows);

    const employeeDateKey = `${shift.employeeId}:${date}`;
    const employeeRows = shiftsByEmployeeDate.get(employeeDateKey) || [];
    employeeRows.push(shift);
    shiftsByEmployeeDate.set(employeeDateKey, employeeRows);
  }

  check(validDurationCount === shifts.length, "full-time shifts are 8 hours and part-time shifts are 4 hours");
  check(insideOperatingHoursCount === shifts.length, "all planned shifts stay inside 07:00-23:00");
  check(shiftsByDate.size === 14, "roster covers fourteen Vietnam calendar dates");
  check(
    [...shiftsByDate.values()].every((rows) => rows.length === EXPECTED_STAFF),
    "every roster date contains fourteen staff assignments",
  );

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
    "every date has full-time and part-time coverage overlapping in one roster",
  );

  const duplicateEmployeeOverlap = [...shiftsByEmployeeDate.values()].some((rows) => {
    const sorted = [...rows].sort(
      (left, right) => new Date(left.startTime) - new Date(right.startTime),
    );
    return sorted.some(
      (row, index) => index > 0 && new Date(row.startTime) < new Date(sorted[index - 1].endTime),
    );
  });
  check(!duplicateEmployeeOverlap, "no employee receives overlapping assignments");

  const historicalShifts = shifts.filter(
    (item) => hcmDate(item.startTime) >= HISTORICAL_START && hcmDate(item.startTime) < FUTURE_START,
  );
  const futureShifts = shifts.filter((item) => hcmDate(item.startTime) >= FUTURE_START);
  check(historicalShifts.every((item) => item.status === "completed"), "historical roster is completed");
  check(futureShifts.every((item) => item.status === "scheduled"), "upcoming roster remains scheduled");

  const shiftById = new Map(shifts.map((item) => [String(item._id), item]));
  check(
    timesheets.every((row) => {
      const shift = shiftById.get(String(row.shiftId));
      if (!shift || hcmDate(shift.startTime) >= FUTURE_START) return false;
      const staffRow = staffById.get(String(row.employeeId));
      const expectedMinutes = staffRow?.employmentType === "full_time" ? 480 : 240;
      return (
        durationMinutes(row.plannedStartTime, row.plannedEndTime) === expectedMinutes &&
        Number(row.workedMinutes || 0) > 0 &&
        Number(row.workedMinutes || 0) <= expectedMinutes &&
        Math.abs(Number(row.hours || 0) * 60 - Number(row.workedMinutes || 0)) < 1
      );
    }),
    "timesheets preserve planned and actual hours for each employment type",
  );

  const templates = policy?.shiftTemplates || [];
  const templateByKey = new Map(templates.map((item) => [item.key, item]));
  check(Boolean(policy), "restaurant scheduling policy exists");
  check(templateByKey.get("morning")?.startTime === "07:00", "morning full-time template starts at 07:00");
  check(templateByKey.get("evening")?.endTime === "23:00", "evening full-time template ends at 23:00");
  check(templateByKey.get("afternoon")?.startTime === "11:00", "lunch part-time template starts at 11:00");
  check(templateByKey.get("rotating")?.startTime === "19:00", "evening part-time template starts at 19:00");
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
