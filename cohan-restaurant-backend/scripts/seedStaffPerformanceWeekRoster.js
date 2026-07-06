import "dotenv/config.js";
import mongoose from "mongoose";
import {
  AttendanceCorrectionRequest,
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

const RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
const MANAGER_ID = process.env.DEMO_MANAGER_ID?.trim() || "69f7162dab80d0aaef80d5c8";
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
  ["staff.server.demo@cohan.local", "morning", 8, 1, [], {}, {}, 0, "excellent"],
  ["staff.supervisor.demo@cohan.local", "morning", 10, 0.875, [], { 0: 20 }, {}, 1, "good"],
  ["staff.cashier.demo@cohan.local", "evening", 14, 0.8125, [], { 0: 20 }, { 0: 30 }, 2, "average"],
  ["staff.chef.demo@cohan.local", "morning", 7, 0.5625, [3], { 0: 30 }, { 1: 30 }, 3, "needs_attention"],
  ["staff.kitchenhelper.demo@cohan.local", "afternoon", 12, 0.6875, [], { 0: 20, 1: 20 }, {}, 2, "average"],
  ["staff.exception.demo@cohan.local", "afternoon", 12, 0.1875, [1, 3], { 0: 45 }, { 2: 60 }, 5, "poor"],
  ["staff.parttime.demo@cohan.local", "evening", 14, 0.875, [], { 0: 10 }, {}, 1, "good"],
].map(([email, shiftType, startHour, ratio, absences, late, early, corrections, level]) => ({
  email, shiftType, startHour, ratio, absences, late, early, corrections, level,
}));

const utcDay = (ymd) => new Date(`${ymd}T00:00:00.000Z`);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
const hcmTime = (ymd, hour, minute = 0, second = 0, ms = 0) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - 7, minute, second, ms));
};
const dateRange = (start, end) => {
  const rows = [];
  for (let d = utcDay(start); d <= utcDay(end); d = addDays(d, 1)) {
    rows.push(d.toISOString().slice(0, 10));
  }
  return rows;
};
const allDates = dateRange("2026-06-29", "2026-07-12");
const julyDates = dateRange("2026-07-01", "2026-07-12");
const julyIndex = new Map(julyDates.map((date, index) => [date, index]));

function distributedMinutes(scenario) {
  const result = Array(julyDates.length).fill(0);
  const working = result
    .map((_, index) => index)
    .filter((index) => !scenario.absences.includes(index));
  const target = Math.round(julyDates.length * 480 * scenario.ratio);
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

async function resolveContext() {
  if (!mongoose.isValidObjectId(RESTAURANT_ID)) throw new Error("DEMO_RESTAURANT_ID_INVALID");
  if (!mongoose.isValidObjectId(MANAGER_ID)) throw new Error("DEMO_MANAGER_ID_INVALID");
  const restaurantId = new mongoose.Types.ObjectId(RESTAURANT_ID);
  const manager = await User.findById(MANAGER_ID).populate("role", "slug").lean();
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
  const missing = SCENARIOS.map((item) => item.email).filter((email) => !staffByEmail.has(email));
  if (missing.length) throw new Error(`DEMO_STAFF_ACCOUNTS_MISSING: ${missing.join(", ")}`);
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
  await AttendanceCorrectionRequest.deleteMany({
    restaurantId,
    employeeId: { $in: staffIds },
    workDate,
    $or: [{ reason: TAG_PATTERN }, { evidenceNote: TAG_PATTERN }, { reviewNote: TAG_PATTERN }],
  });
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

async function seedShiftsAndTimesheets({ restaurantId, staffByEmail }) {
  const julyTimesheets = new Map(SCENARIOS.map((item) => [item.email, []]));
  for (const scenario of SCENARIOS) {
    const staff = staffByEmail.get(scenario.email);
    const julyMinutes = distributedMinutes(scenario);
    for (const ymd of allDates) {
      const index = julyIndex.get(ymd);
      const isJuly = index !== undefined;
      const absent = isJuly && scenario.absences.includes(index);
      const late = isJuly ? Number(scenario.late[index] || 0) : 0;
      const early = isJuly ? Number(scenario.early[index] || 0) : 0;
      const worked = isJuly ? julyMinutes[index] : 420;
      const startTime = hcmTime(ymd, scenario.startHour);
      const endTime = hcmTime(ymd, scenario.startHour + 8);
      const checkIn = absent ? null : new Date(startTime.getTime() + late * 60000);
      const checkOut = absent ? null : new Date(checkIn.getTime() + worked * 60000);
      const status = absent
        ? "scheduled_absent"
        : late && early
          ? "late_early_leave"
          : late
            ? "late"
            : early
              ? "early_leave"
              : "completed";
      const shift = await Shift.create({
        restaurantId,
        employeeId: staff._id,
        shiftType: scenario.shiftType,
        startTime,
        endTime,
        status: "completed",
        notes: `${WEEK_TAG} ${scenario.email} ${ymd}`,
      });
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
        workedMinutes: worked,
        hours: Number((worked / 60).toFixed(2)),
        status,
        approved: !absent,
        isOffSchedule: false,
        note: `${WEEK_TAG} ${scenario.email} ${ymd}`,
      });
      if (isJuly) julyTimesheets.get(scenario.email).push(timesheet);
    }
  }
  return julyTimesheets;
}

async function seedCorrections(context, julyTimesheets) {
  for (const scenario of SCENARIOS) {
    const staff = context.staffByEmail.get(scenario.email);
    const rows = julyTimesheets.get(scenario.email);
    for (let index = 0; index < scenario.corrections; index += 1) {
      const row = rows[index];
      const applied = index % 2 === 0;
      await AttendanceCorrectionRequest.create({
        restaurantId: context.restaurantId,
        employeeId: staff._id,
        requestedBy: staff._id,
        requestedByRole: "STAFF",
        timesheetId: row._id,
        shiftId: row.shiftId,
        workDate: row.workDate,
        correctionType: "wrong_check_in_out",
        reason: `${WEEK_TAG} correction ${index + 1}`,
        evidenceNote: `${WEEK_TAG} deterministic correction`,
        status: applied ? "applied" : "rejected",
        reviewedBy: context.manager._id,
        reviewedAt: new Date(),
        reviewNote: `${WEEK_TAG} reviewed`,
        appliedBy: applied ? context.manager._id : null,
        appliedAt: applied ? new Date() : null,
      });
    }
  }
}

async function recalculate(context) {
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
      },
    },
  );
}

async function main() {
  assertDemoScriptAllowed("seedStaffPerformanceWeekRoster.js");
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "foodhub",
  });
  const context = await resolveContext();
  await resetRoster(context);
  await seedPublications(context);
  const julyTimesheets = await seedShiftsAndTimesheets(context);
  await seedCorrections(context, julyTimesheets);
  await recalculate(context);
  const [shiftCount, timesheetCount] = await Promise.all([
    Shift.countDocuments({
      restaurantId: context.restaurantId,
      employeeId: { $in: context.staffIds },
      notes: WEEK_TAG_PATTERN,
    }),
    Timesheet.countDocuments({
      restaurantId: context.restaurantId,
      employeeId: { $in: context.staffIds },
      note: WEEK_TAG_PATTERN,
    }),
  ]);
  if (shiftCount !== 98 || timesheetCount !== 98) {
    throw new Error(`DEMO_TWO_WEEK_ROSTER_COUNT_MISMATCH: shifts=${shiftCount} timesheets=${timesheetCount}`);
  }
  console.log(`Two-week roster completed: shifts=${shiftCount}, timesheets=${timesheetCount}`);
}

main()
  .catch((error) => {
    console.error("[seed:demo:staff-performance-weeks] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect().catch(() => {}));
