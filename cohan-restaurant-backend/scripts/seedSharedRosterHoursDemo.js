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
const TAG = "[demo-shared-roster-hours-2026-07]";
const TAG_PATTERN = /demo-shared-roster-hours-2026-07/;

const ROSTER_WEEKS = [
  { start: "2026-06-15", status: "completed" },
  { start: "2026-07-13", status: "scheduled" },
];

const SHIFT_TEMPLATES = [
  {
    key: "morning",
    label: "Full-time sáng",
    startTime: "07:00",
    endTime: "15:00",
    enabled: true,
    allowCrossDay: false,
  },
  {
    key: "afternoon",
    label: "Part-time cao điểm trưa",
    startTime: "11:00",
    endTime: "15:00",
    enabled: true,
    allowCrossDay: false,
  },
  {
    key: "evening",
    label: "Full-time tối",
    startTime: "15:00",
    endTime: "23:00",
    enabled: true,
    allowCrossDay: false,
  },
  {
    key: "rotating",
    label: "Part-time cao điểm tối",
    startTime: "19:00",
    endTime: "23:00",
    enabled: true,
    allowCrossDay: false,
  },
];

const STAFF_SCENARIOS = [
  ["staff.chef.demo@cohan.local", "full_time", "morning", 7, 8],
  ["staff.cook.demo@cohan.local", "full_time", "morning", 7, 8],
  ["staff.fulltime.demo@cohan.local", "full_time", "morning", 7, 8],
  ["staff.server.demo@cohan.local", "full_time", "morning", 7, 8],
  ["staff.storekeeper.demo@cohan.local", "full_time", "morning", 7, 8],
  ["staff.supervisor.demo@cohan.local", "full_time", "evening", 15, 8],
  ["staff.cashier.demo@cohan.local", "part_time", "afternoon", 11, 4],
  ["staff.cleaner.demo@cohan.local", "part_time", "afternoon", 11, 4],
  ["staff.exception.demo@cohan.local", "part_time", "afternoon", 11, 4],
  ["staff.kitchenhelper.demo@cohan.local", "part_time", "afternoon", 11, 4],
  ["staff.bartender.demo@cohan.local", "part_time", "rotating", 19, 4],
  ["staff.host.demo@cohan.local", "part_time", "rotating", 19, 4],
  ["staff.parttime.demo@cohan.local", "part_time", "rotating", 19, 4],
  ["staff.shipper.demo@cohan.local", "part_time", "rotating", 19, 4],
].map(([email, employmentType, shiftType, startHour, shiftHours]) => ({
  email,
  employmentType,
  shiftType,
  startHour,
  shiftHours,
}));

const utcDay = (ymd) => new Date(`${ymd}T00:00:00.000Z`);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);
const isoDate = (date) => date.toISOString().slice(0, 10);
const hcmTime = (ymd, hour, minute = 0) => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
};

const weekDates = (start) =>
  Array.from({ length: 7 }, (_, index) => isoDate(addDays(utcDay(start), index)));

async function loadContext() {
  if (!mongoose.isValidObjectId(RESTAURANT_ID)) {
    throw new Error("DEMO_RESTAURANT_ID_INVALID");
  }

  const restaurantId = new mongoose.Types.ObjectId(RESTAURANT_ID);
  const staff = await Staff.find({
    restaurantForStaff: restaurantId,
    email: { $in: STAFF_SCENARIOS.map((item) => item.email) },
    userType: "STAFF",
    deletedAt: null,
  })
    .select("_id email employmentType")
    .lean();
  const staffByEmail = new Map(staff.map((item) => [item.email, item]));
  const missing = STAFF_SCENARIOS.filter((item) => !staffByEmail.has(item.email));
  if (missing.length) {
    throw new Error(
      `DEMO_STAFF_ACCOUNTS_MISSING: ${missing.map((item) => item.email).join(", ")}`,
    );
  }

  const mismatched = STAFF_SCENARIOS.filter(
    (item) => staffByEmail.get(item.email)?.employmentType !== item.employmentType,
  );
  if (mismatched.length) {
    throw new Error(
      `DEMO_STAFF_EMPLOYMENT_TYPE_MISMATCH: ${mismatched
        .map((item) => `${item.email}:${item.employmentType}`)
        .join(", ")}`,
    );
  }

  return { restaurantId, staffByEmail, staffIds: staff.map((item) => item._id) };
}

async function resetDemo({ restaurantId, staffIds }) {
  const shiftIds = await Shift.find({
    restaurantId,
    employeeId: { $in: staffIds },
    notes: TAG_PATTERN,
  }).distinct("_id");

  await Timesheet.deleteMany({
    restaurantId,
    employeeId: { $in: staffIds },
    $or: [{ shiftId: { $in: shiftIds } }, { note: TAG_PATTERN }],
  });
  await Shift.deleteMany({ _id: { $in: shiftIds } });
}

async function seedPolicy(restaurantId) {
  await SchedulingPolicy.findOneAndUpdate(
    { restaurantId },
    {
      $set: {
        shiftTemplates: SHIFT_TEMPLATES,
        "laborRules.preventShiftOverlap": true,
        "employmentTypePolicy.full_time.weeklyHoursTarget": 40,
        "employmentTypePolicy.full_time.weeklyHoursCap": 48,
        "employmentTypePolicy.part_time.minWeeklyHours": 8,
        "employmentTypePolicy.part_time.weeklyHoursTarget": 20,
        "employmentTypePolicy.part_time.weeklyHoursCap": 28,
        "employmentTypePolicy.part_time.requireAvailability": true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );
}

async function seedRoster(context) {
  let shiftCount = 0;
  let timesheetCount = 0;

  for (const week of ROSTER_WEEKS) {
    const dates = weekDates(week.start);
    for (const [staffIndex, scenario] of STAFF_SCENARIOS.entries()) {
      const staff = context.staffByEmail.get(scenario.email);
      for (const [dayIndex, ymd] of dates.entries()) {
        const startTime = hcmTime(ymd, scenario.startHour);
        const endTime = hcmTime(
          ymd,
          scenario.startHour + scenario.shiftHours,
        );
        const shift = await Shift.create({
          restaurantId: context.restaurantId,
          employeeId: staff._id,
          shiftType: scenario.shiftType,
          startTime,
          endTime,
          status: week.status,
          notes: `${TAG} ${scenario.employmentType} ${scenario.shiftHours}h ${ymd}`,
        });
        shiftCount += 1;

        if (week.status !== "completed") continue;

        const latenessMinutes = (staffIndex + dayIndex) % 5 === 0 ? 5 : 0;
        const earlyLeaveMinutes = (staffIndex + dayIndex) % 7 === 0 ? 10 : 0;
        const actualCheckInAt = new Date(
          startTime.getTime() + latenessMinutes * 60000,
        );
        const actualCheckOutAt = new Date(
          endTime.getTime() - earlyLeaveMinutes * 60000,
        );
        const workedMinutes = Math.max(
          0,
          Math.round((actualCheckOutAt - actualCheckInAt) / 60000),
        );
        const status = latenessMinutes && earlyLeaveMinutes
          ? "late_early_leave"
          : latenessMinutes
            ? "late"
            : earlyLeaveMinutes
              ? "early_leave"
              : "completed";

        await Timesheet.create({
          restaurantId: context.restaurantId,
          employeeId: staff._id,
          shiftId: shift._id,
          workDate: utcDay(ymd),
          source: "system",
          plannedStartTime: startTime,
          plannedEndTime: endTime,
          actualCheckInAt,
          actualCheckOutAt,
          latenessMinutes,
          earlyLeaveMinutes,
          workedMinutes,
          hours: Number((workedMinutes / 60).toFixed(2)),
          status,
          approved: true,
          isOffSchedule: false,
          note: `${TAG} ${scenario.employmentType} ${scenario.shiftHours}h ${ymd}`,
        });
        timesheetCount += 1;
      }
    }
  }

  return { shiftCount, timesheetCount };
}

async function main() {
  assertDemoScriptAllowed("seedSharedRosterHoursDemo.js");
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "foodhub",
  });

  const context = await loadContext();
  await resetDemo(context);
  await seedPolicy(context.restaurantId);
  const result = await seedRoster(context);
  console.log(
    `Shared roster hours seeded: restaurant=${RESTAURANT_ID}, shifts=${result.shiftCount}, timesheets=${result.timesheetCount}`,
  );
}

main()
  .catch((error) => {
    console.error("[seed:demo:shared-roster-hours] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect().catch(() => {}));
