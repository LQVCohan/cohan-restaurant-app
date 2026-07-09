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
const LEGACY_TAG_PATTERN = /demo-shared-roster-hours-2026-07/;
const ROSTER_START = "2026-06-29";
const ROSTER_END_EXCLUSIVE = "2026-07-13";

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

const hcmMinutes = (value) => {
  const shifted = new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
};

const hcmTime = (ymd, hour, minute = 0) => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
};

const durationMinutes = (startTime, endTime) =>
  Math.max(1, Math.round((new Date(endTime) - new Date(startTime)) / 60000));

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
  }).lean();
  if (tagged.length) return { shifts: tagged, source: "tagged" };

  const shifts = await Shift.find({
    restaurantId,
    startTime: {
      $gte: hcmTime(ROSTER_START, 0),
      $lt: hcmTime(ROSTER_END_EXCLUSIVE, 0),
    },
  }).lean();
  if (!shifts.length) {
    throw new Error(
      `DEMO_WEEK_ROSTER_NOT_FOUND: restaurant=${RESTAURANT_ID}, range=${ROSTER_START}..${ROSTER_END_EXCLUSIVE}`,
    );
  }
  return { shifts, source: "date-range" };
}

async function loadContext() {
  if (!mongoose.isValidObjectId(RESTAURANT_ID)) {
    throw new Error("DEMO_RESTAURANT_ID_INVALID");
  }

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
  const missingIds = employeeIds.filter((id) => !staffById.has(id));
  if (missingIds.length) {
    throw new Error(`DEMO_ROSTER_STAFF_MISSING: ${missingIds.join(", ")}`);
  }

  const selectedTypes = new Set(
    staff.map((item) => item.employmentType || "full_time"),
  );
  if (!selectedTypes.has("full_time") || !selectedTypes.has("part_time")) {
    throw new Error(
      `DEMO_ROSTER_EMPLOYMENT_TYPES_MISSING: full_time=${selectedTypes.has("full_time")}, part_time=${selectedTypes.has("part_time")}`,
    );
  }

  return {
    restaurantId,
    shifts: roster.shifts,
    rosterSource: roster.source,
    staffById,
  };
}

async function removeLegacyDuplicateRoster(restaurantId) {
  const shiftIds = await Shift.find({
    restaurantId,
    notes: LEGACY_TAG_PATTERN,
  }).distinct("_id");

  const timesheetResult = await Timesheet.deleteMany({
    restaurantId,
    $or: [{ shiftId: { $in: shiftIds } }, { note: LEGACY_TAG_PATTERN }],
  });
  const shiftResult = await Shift.deleteMany({ _id: { $in: shiftIds } });

  return {
    shifts: shiftResult.deletedCount || 0,
    timesheets: timesheetResult.deletedCount || 0,
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
  let updatedShifts = 0;
  let updatedTimesheets = 0;
  let skippedUnsupported = 0;

  for (const shift of context.shifts) {
    const staff = context.staffById.get(String(shift.employeeId));
    const plan = buildShiftPlan(shift, staff);
    if (!plan) {
      skippedUnsupported += 1;
      continue;
    }

    const ymd = hcmDate(shift.startTime);
    const startTime = hcmTime(ymd, plan.startHour);
    const endTime = hcmTime(ymd, plan.startHour + plan.shiftHours);
    const plannedMinutes = plan.shiftHours * 60;

    await Shift.updateOne(
      { _id: shift._id },
      {
        $set: {
          shiftType: plan.shiftType,
          startTime,
          endTime,
        },
      },
    );
    updatedShifts += 1;

    const timesheet = await Timesheet.findOne({ shiftId: shift._id }).lean();
    if (!timesheet) continue;

    const oldPlannedMinutes =
      timesheet.plannedStartTime && timesheet.plannedEndTime
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
          requestedCheckInAt: actualCheckInAt || startTime,
          requestedCheckOutAt: actualCheckOutAt || endTime,
          originalWorkedMinutes: workedMinutes,
          requestedWorkedMinutes: workedMinutes,
        },
      },
    );

    const overtimeRequests = await OvertimeRequest.find({
      timesheetId: timesheet._id,
    }).lean();
    for (const request of overtimeRequests) {
      const plannedOvertimeMinutes = Number(
        request.plannedOvertimeMinutes || 0,
      );
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

  return { updatedShifts, updatedTimesheets, skippedUnsupported };
}

async function main() {
  assertDemoScriptAllowed("applySharedRosterHoursDemo.js");
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "cohan",
  });

  const context = await loadContext();
  const removed = await removeLegacyDuplicateRoster(context.restaurantId);
  await updatePolicy(context.restaurantId);
  const result = await updateExistingRoster(context);
  console.log(
    `Shared roster hours applied in place: restaurant=${RESTAURANT_ID}, source=${context.rosterSource}, shifts=${result.updatedShifts}, timesheets=${result.updatedTimesheets}, skippedUnsupported=${result.skippedUnsupported}, removedLegacyShifts=${removed.shifts}, removedLegacyTimesheets=${removed.timesheets}`,
  );
}

main()
  .catch((error) => {
    console.error("[apply:demo:shared-roster-hours] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect().catch(() => {}));
