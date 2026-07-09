import "dotenv/config.js";
import mongoose from "mongoose";
import { SchedulingPolicy, Shift, Staff, Timesheet } from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const RESTAURANT_ID =
  process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
const WEEK_TAG_PATTERN = /demo-staff-performance-weeks-2026-07/;
const LEGACY_TAG_PATTERN = /demo-shared-roster-hours-2026-07/;
const ROSTER_START = "2026-06-29";
const ROSTER_END_EXCLUSIVE = "2026-07-13";
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

const hcmTime = (ymd, hour, minute = 0) => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
};

const durationMinutes = (startTime, endTime) =>
  Math.round((new Date(endTime) - new Date(startTime)) / 60000);

const rangesOverlap = (left, right) =>
  new Date(left.startTime) < new Date(right.endTime) &&
  new Date(right.startTime) < new Date(left.endTime);

function buildShiftPlan(shift, staff) {
  const employmentType = staff.employmentType || "full_time";
  if (!["full_time", "part_time"].includes(employmentType)) return null;

  const evening =
    ["evening", "rotating"].includes(shift.shiftType) ||
    hcmMinutes(shift.startTime) >= 15 * 60;

  if (employmentType === "full_time") {
    return {
      shiftType: evening ? "evening" : "morning",
      startHour: evening ? 15 : 7,
      shiftHours: 8,
    };
  }

  return {
    shiftType: evening ? "rotating" : "afternoon",
    startHour: evening ? 19 : 11,
    shiftHours: 4,
  };
}

async function findExistingRoster(restaurantId) {
  const tagged = await Shift.find({
    restaurantId,
    notes: WEEK_TAG_PATTERN,
  })
    .sort({ startTime: 1 })
    .lean();
  if (tagged.length) return { shifts: tagged, source: "tagged" };

  const shifts = await Shift.find({
    restaurantId,
    startTime: {
      $gte: hcmTime(ROSTER_START, 0),
      $lt: hcmTime(ROSTER_END_EXCLUSIVE, 0),
    },
  })
    .sort({ startTime: 1 })
    .lean();
  return { shifts, source: "date-range" };
}

async function run() {
  assertDemoScriptAllowed("verifySharedRosterHoursDemo.js");
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "cohan",
  });

  const restaurantId = new mongoose.Types.ObjectId(RESTAURANT_ID);
  const roster = await findExistingRoster(restaurantId);
  const employeeIds = [
    ...new Set(roster.shifts.map((shift) => String(shift.employeeId))),
  ];
  const staff = await Staff.find({
    _id: { $in: employeeIds },
    userType: "STAFF",
    deletedAt: null,
  })
    .select("_id email fullName employmentType")
    .lean();
  const staffById = new Map(staff.map((item) => [String(item._id), item]));
  const shiftIds = roster.shifts.map((item) => item._id);

  const [timesheets, policy, legacyShiftCount, legacyTimesheetCount] =
    await Promise.all([
      Timesheet.find({
        restaurantId,
        shiftId: { $in: shiftIds },
      }).lean(),
      SchedulingPolicy.findOne({ restaurantId }).lean(),
      Shift.countDocuments({ restaurantId, notes: LEGACY_TAG_PATTERN }),
      Timesheet.countDocuments({ restaurantId, note: LEGACY_TAG_PATTERN }),
    ]);

  const missingStaffIds = employeeIds.filter((id) => !staffById.has(id));
  const employmentTypes = new Set(
    staff.map((item) => item.employmentType || "full_time"),
  );

  console.log(
    `Roster source=${roster.source}, shifts=${roster.shifts.length}, staff=${staff.length}, timesheets=${timesheets.length}`,
  );
  check(
    roster.shifts.length > 0,
    "found the existing previous/current week roster",
  );
  check(
    missingStaffIds.length === 0,
    "every roster employee resolves to an existing staff account",
  );
  check(employmentTypes.has("full_time"), "roster contains full-time staff");
  check(employmentTypes.has("part_time"), "roster contains part-time staff");
  check(
    legacyShiftCount === 0,
    "removed legacy duplicate shifts if they existed",
  );
  check(
    legacyTimesheetCount === 0,
    "removed legacy duplicate timesheets if they existed",
  );

  const shiftsByDate = new Map();
  const shiftsByEmployeeDate = new Map();
  let eligibleShiftCount = 0;
  let validShiftCount = 0;

  for (const shift of roster.shifts) {
    const staffRow = staffById.get(String(shift.employeeId));
    if (!staffRow) continue;
    const plan = buildShiftPlan(shift, staffRow);
    if (!plan) continue;

    eligibleShiftCount += 1;
    const expectedStart = plan.startHour * 60;
    const expectedEnd = expectedStart + plan.shiftHours * 60;
    if (
      shift.shiftType === plan.shiftType &&
      hcmMinutes(shift.startTime) === expectedStart &&
      hcmMinutes(shift.endTime) === expectedEnd &&
      durationMinutes(shift.startTime, shift.endTime) ===
        plan.shiftHours * 60 &&
      expectedStart >= OPEN_MINUTES &&
      expectedEnd <= CLOSE_MINUTES
    ) {
      validShiftCount += 1;
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

  check(
    eligibleShiftCount > 0,
    "found full-time or part-time shifts to validate",
  );
  check(
    validShiftCount === eligibleShiftCount,
    "all full-time and part-time shifts use 8-hour/4-hour windows inside 07:00-23:00",
  );

  const sameEmployeeOverlap = [...shiftsByEmployeeDate.values()].some(
    (rows) => {
      const sorted = [...rows].sort(
        (left, right) => new Date(left.startTime) - new Date(right.startTime),
      );
      return sorted.some(
        (row, index) =>
          index > 0 &&
          new Date(row.startTime) < new Date(sorted[index - 1].endTime),
      );
    },
  );
  check(
    !sameEmployeeOverlap,
    "no employee receives overlapping shifts on the same date",
  );

  const mixedDates = [...shiftsByDate.values()].filter((rows) => {
    const types = new Set(
      rows
        .map((row) => staffById.get(String(row.employeeId))?.employmentType)
        .filter(Boolean),
    );
    return types.has("full_time") && types.has("part_time");
  });
  const overlappingMixedDates = mixedDates.filter((rows) => {
    const fullTime = rows.filter(
      (row) =>
        staffById.get(String(row.employeeId))?.employmentType === "full_time",
    );
    const partTime = rows.filter(
      (row) =>
        staffById.get(String(row.employeeId))?.employmentType === "part_time",
    );
    return fullTime.some((fullShift) =>
      partTime.some((partShift) => rangesOverlap(fullShift, partShift)),
    );
  });
  check(
    mixedDates.length > 0,
    "at least one roster date contains both employment types",
  );
  check(
    overlappingMixedDates.length === mixedDates.length,
    "full-time and part-time coverage overlaps on every mixed roster date",
  );

  const shiftById = new Map(
    roster.shifts.map((item) => [String(item._id), item]),
  );
  check(
    timesheets.every((row) => {
      const shift = shiftById.get(String(row.shiftId));
      const staffRow = staffById.get(String(row.employeeId));
      const plan = shift && staffRow ? buildShiftPlan(shift, staffRow) : null;
      if (!shift || !plan) return true;
      return (
        durationMinutes(row.plannedStartTime, row.plannedEndTime) ===
          plan.shiftHours * 60 &&
        Number(row.workedMinutes || 0) <= plan.shiftHours * 60 &&
        Math.abs(Number(row.hours || 0) * 60 - Number(row.workedMinutes || 0)) <
          1
      );
    }),
    "linked attendance rows match their updated shift durations",
  );

  const templates = policy?.shiftTemplates || [];
  const templateByKey = new Map(templates.map((item) => [item.key, item]));
  check(Boolean(policy), "restaurant scheduling policy exists");
  check(
    templateByKey.get("morning")?.startTime === "07:00",
    "full-time morning starts at 07:00",
  );
  check(
    templateByKey.get("evening")?.endTime === "23:00",
    "full-time evening ends at 23:00",
  );
  check(
    templateByKey.get("afternoon")?.startTime === "11:00",
    "lunch part-time starts at 11:00",
  );
  check(
    templateByKey.get("rotating")?.startTime === "19:00",
    "evening part-time starts at 19:00",
  );
  check(
    policy?.laborRules?.preventShiftOverlap === true,
    "same-employee overlap protection remains enabled",
  );
  check(
    policy?.employmentTypePolicy?.full_time?.weeklyHoursTarget === 40,
    "full-time weekly target is 40 hours",
  );
  check(
    policy?.employmentTypePolicy?.part_time?.weeklyHoursTarget === 20,
    "part-time weekly target is 20 hours",
  );

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
