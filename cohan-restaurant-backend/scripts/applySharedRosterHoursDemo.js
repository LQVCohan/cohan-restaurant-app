import "dotenv/config.js";
import mongoose from "mongoose";
import {
  AttendanceCorrectionRequest,
  OvertimeRequest,
  SchedulingPolicy,
  Shift,
  Staff,
  Timesheet,
} from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const RESTAURANT_ID =
  process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
const WEEK_TAG_PATTERN = /demo-staff-performance-weeks-2026-07/;

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

const hcmDate = (value) =>
  new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

const hcmTime = (ymd, hour, minute = 0) => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
};

const durationMinutes = (startTime, endTime) =>
  Math.max(1, Math.round((new Date(endTime) - new Date(startTime)) / 60000));

async function loadContext() {
  if (!mongoose.isValidObjectId(RESTAURANT_ID)) {
    throw new Error("DEMO_RESTAURANT_ID_INVALID");
  }

  const restaurantId = new mongoose.Types.ObjectId(RESTAURANT_ID);
  const staff = await Staff.find({
    restaurantForStaff: restaurantId,
    email: { $in: SCENARIOS.map((item) => item.email) },
    userType: "STAFF",
    deletedAt: null,
  })
    .select("_id email employmentType")
    .lean();
  const staffByEmail = new Map(staff.map((item) => [item.email, item]));
  const missing = SCENARIOS.filter((item) => !staffByEmail.has(item.email));
  if (missing.length) {
    throw new Error(
      `DEMO_STAFF_ACCOUNTS_MISSING: ${missing.map((item) => item.email).join(", ")}`,
    );
  }

  const scenarioByStaffId = new Map(
    SCENARIOS.map((scenario) => [
      String(staffByEmail.get(scenario.email)._id),
      scenario,
    ]),
  );

  return {
    restaurantId,
    staff,
    scenarioByStaffId,
  };
}

async function updatePolicy(restaurantId) {
  const policy =
    (await SchedulingPolicy.findOne({ restaurantId })) ||
    new SchedulingPolicy({ restaurantId });

  policy.shiftTemplates = SHIFT_TEMPLATES;
  policy.laborRules.preventShiftOverlap = true;
  policy.employmentTypePolicy.full_time.weeklyHoursTarget = 40;
  policy.employmentTypePolicy.full_time.weeklyHoursCap = 48;
  policy.employmentTypePolicy.part_time.minWeeklyHours = 8;
  policy.employmentTypePolicy.part_time.weeklyHoursTarget = 20;
  policy.employmentTypePolicy.part_time.weeklyHoursCap = 28;
  policy.employmentTypePolicy.part_time.requireAvailability = true;
  await policy.save();
}

async function updateExistingRoster(context) {
  const shifts = await Shift.find({
    restaurantId: context.restaurantId,
    employeeId: { $in: context.staff.map((item) => item._id) },
    notes: WEEK_TAG_PATTERN,
  }).lean();

  if (!shifts.length) {
    throw new Error(
      "DEMO_WEEK_ROSTER_NOT_FOUND: run the existing staff-performance week seed first",
    );
  }

  let updatedTimesheets = 0;
  for (const shift of shifts) {
    const scenario = context.scenarioByStaffId.get(String(shift.employeeId));
    if (!scenario) continue;

    const ymd = hcmDate(shift.startTime);
    const startTime = hcmTime(ymd, scenario.startHour);
    const endTime = hcmTime(ymd, scenario.startHour + scenario.shiftHours);
    const plannedMinutes = scenario.shiftHours * 60;

    await Shift.updateOne(
      { _id: shift._id },
      {
        $set: {
          shiftType: scenario.shiftType,
          startTime,
          endTime,
        },
      },
    );

    const timesheet = await Timesheet.findOne({ shiftId: shift._id }).lean();
    if (!timesheet) continue;

    const oldPlannedMinutes = timesheet.plannedStartTime && timesheet.plannedEndTime
      ? durationMinutes(timesheet.plannedStartTime, timesheet.plannedEndTime)
      : durationMinutes(shift.startTime, shift.endTime);
    const oldWorkedMinutes = Number(timesheet.workedMinutes || 0);
    const workedMinutes = timesheet.actualCheckInAt
      ? Math.min(
          plannedMinutes,
          Math.round((oldWorkedMinutes * plannedMinutes) / oldPlannedMinutes),
        )
      : 0;
    const latenessMinutes = Number(timesheet.latenessMinutes || 0);
    const overtimeMinutes = Number(timesheet.overtimeMinutes || 0);
    const actualCheckInAt = timesheet.actualCheckInAt
      ? new Date(startTime.getTime() + latenessMinutes * 60000)
      : null;
    const actualCheckOutAt = actualCheckInAt
      ? overtimeMinutes > 0
        ? new Date(endTime.getTime() + overtimeMinutes * 60000)
        : new Date(actualCheckInAt.getTime() + workedMinutes * 60000)
      : null;

    await Timesheet.updateOne(
      { _id: timesheet._id },
      {
        $set: {
          plannedStartTime: startTime,
          plannedEndTime: endTime,
          actualCheckInAt,
          actualCheckOutAt,
          workedMinutes,
          hours: Number((workedMinutes / 60).toFixed(2)),
        },
      },
    );
    updatedTimesheets += 1;

    await AttendanceCorrectionRequest.updateMany(
      { timesheetId: timesheet._id },
      {
        $set: {
          originalCheckInAt: actualCheckInAt,
          originalCheckOutAt: actualCheckOutAt,
          requestedCheckInAt: actualCheckInAt,
          requestedCheckOutAt: actualCheckOutAt,
          originalWorkedMinutes: workedMinutes,
          requestedWorkedMinutes: workedMinutes,
        },
      },
    );

    const overtimeRequests = await OvertimeRequest.find({
      timesheetId: timesheet._id,
    }).lean();
    for (const request of overtimeRequests) {
      const plannedOvertimeMinutes = Number(request.plannedOvertimeMinutes || 0);
      const actualOvertimeMinutes = Number(request.actualOvertimeMinutes || 0);
      await OvertimeRequest.updateOne(
        { _id: request._id },
        {
          $set: {
            plannedStartTime: endTime,
            plannedEndTime: new Date(
              endTime.getTime() + plannedOvertimeMinutes * 60000,
            ),
            actualStartTime: request.actualStartTime ? endTime : null,
            actualEndTime: request.actualEndTime
              ? new Date(endTime.getTime() + actualOvertimeMinutes * 60000)
              : null,
          },
        },
      );
    }
  }

  return { shifts: shifts.length, timesheets: updatedTimesheets };
}

async function main() {
  assertDemoScriptAllowed("applySharedRosterHoursDemo.js");
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "foodhub",
  });

  const context = await loadContext();
  await updatePolicy(context.restaurantId);
  const result = await updateExistingRoster(context);
  console.log(
    `Shared roster hours applied in place: restaurant=${RESTAURANT_ID}, shifts=${result.shifts}, timesheets=${result.timesheets}`,
  );
}

main()
  .catch((error) => {
    console.error("[apply:demo:shared-roster-hours] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect().catch(() => {}));
