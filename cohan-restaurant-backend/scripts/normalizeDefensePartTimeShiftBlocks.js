import "dotenv/config.js";
import mongoose from "mongoose";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { Restaurant, Shift, Staff, Timesheet } from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";
import { weekRangeVietnam } from "./seedScheduleCurrentAndPreviousWeek.js";

const PRIMARY_RESTAURANT_NAME = "Nhà hàng COHAN Thủ Đức";
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const PART_TIME_TYPES = ["part_time", "seasonal"];
const MANAGED_NOTE_PATTERN = /^COHAN • (Tuần trước|Tuần này)/i;
const DEFAULT_PART_TIME_HOURS = 4;
const scriptPath = fileURLToPath(import.meta.url);

function normalizeError(message) {
  return new Error(`DEFENSE_PART_TIME_SHIFT_NORMALIZATION_FAILED: ${message}`);
}

export function buildPartTimeBlockRange(startTime, durationHours = 4) {
  const start = new Date(startTime);
  const duration = Number(durationHours);
  if (Number.isNaN(start.getTime())) throw normalizeError("invalid shift start time");
  if (!Number.isFinite(duration) || duration < 1 || duration > 12) {
    throw normalizeError("duration must be between 1 and 12 hours");
  }
  return {
    startTime: start,
    endTime: new Date(start.getTime() + duration * 60 * 60 * 1000),
    shiftType: "rotating",
  };
}

async function resolveRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID).lean();
    if (!restaurant) throw normalizeError(`restaurant ${DEMO_RESTAURANT_ID} not found`);
    return restaurant;
  }
  const restaurant = await Restaurant.findOne({
    name: PRIMARY_RESTAURANT_NAME,
    status: "active",
  }).lean();
  if (!restaurant) throw normalizeError(`${PRIMARY_RESTAURANT_NAME} not found`);
  return restaurant;
}

export async function normalizeDefensePartTimeShiftBlocks({
  restaurantId,
  reference = new Date(),
  durationHours = DEFAULT_PART_TIME_HOURS,
}) {
  const previous = weekRangeVietnam(reference, -1);
  const current = weekRangeVietnam(reference, 0);

  const staff = await Staff.find({
    restaurantForStaff: restaurantId,
    userType: "STAFF",
    status: "active",
    employmentStatus: "working",
    employmentType: { $in: PART_TIME_TYPES },
    email: /\.demo@cohan\.local$/i,
    deletedAt: null,
  })
    .select("_id email employmentType")
    .lean();

  if (!staff.length) {
    throw normalizeError("no active seeded part-time staff profiles found");
  }

  const staffIds = staff.map((person) => person._id);
  const shifts = await Shift.find({
    restaurantId,
    employeeId: { $in: staffIds },
    startTime: { $gte: previous.periodStart, $lte: current.periodEnd },
    notes: MANAGED_NOTE_PATTERN,
  })
    .select("_id employeeId startTime endTime shiftType")
    .lean();

  let updatedShifts = 0;
  let updatedTimesheets = 0;

  for (const shift of shifts) {
    const normalized = buildPartTimeBlockRange(shift.startTime, durationHours);
    const alreadyNormalized =
      String(shift.shiftType || "").toLowerCase() === normalized.shiftType &&
      new Date(shift.endTime).getTime() === normalized.endTime.getTime();

    if (!alreadyNormalized) {
      await Shift.updateOne(
        { _id: shift._id },
        {
          $set: {
            shiftType: normalized.shiftType,
            endTime: normalized.endTime,
          },
        },
        { runValidators: true },
      );
      updatedShifts += 1;
    }

    const timesheetResult = await Timesheet.updateMany(
      { shiftId: shift._id },
      {
        $set: {
          plannedStartTime: normalized.startTime,
          plannedEndTime: normalized.endTime,
          workDate: new Date(
            normalized.startTime.getFullYear(),
            normalized.startTime.getMonth(),
            normalized.startTime.getDate(),
          ),
        },
      },
    );
    updatedTimesheets += timesheetResult.modifiedCount || 0;
  }

  const normalizedCount = await Shift.countDocuments({
    restaurantId,
    employeeId: { $in: staffIds },
    startTime: { $gte: previous.periodStart, $lte: current.periodEnd },
    notes: MANAGED_NOTE_PATTERN,
    shiftType: "rotating",
    $expr: {
      $eq: [
        { $subtract: ["$endTime", "$startTime"] },
        durationHours * 60 * 60 * 1000,
      ],
    },
  });

  if (normalizedCount !== shifts.length) {
    throw normalizeError(
      `expected ${shifts.length} four-hour part-time shifts, got ${normalizedCount}`,
    );
  }

  return {
    partTimeStaff: staff.length,
    managedShifts: shifts.length,
    normalizedShifts: normalizedCount,
    updatedShifts,
    updatedTimesheets,
    durationHours,
  };
}

async function main() {
  assertDemoScriptAllowed("normalizeDefensePartTimeShiftBlocks.js");
  const mongoUri =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/RestaurantDB?replicaSet=rs0";
  const dbName = process.env.MONGO_DB || "RestaurantDB";

  console.log("Normalizing defense part-time shift blocks:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });
  try {
    const restaurant = await resolveRestaurant();
    const summary = await normalizeDefensePartTimeShiftBlocks({
      restaurantId: restaurant._id,
    });
    console.table([summary]);
    console.log("✅ Defense part-time shifts normalized to four-hour blocks");
  } finally {
    await mongoose.disconnect();
  }
}

if (path.resolve(process.argv[1] || "") === scriptPath) {
  main().catch(async (error) => {
    console.error(error?.stack || error?.message || error);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
  });
}
