import "dotenv/config.js";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  Restaurant,
  SchedulePublication,
  Shift,
  User,
} from "../models/index.js";
import {
  assertDemoScriptAllowed,
  safeDbInfo,
} from "./lib/scriptSafety.js";

const scriptPath = fileURLToPath(import.meta.url);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const VIETNAM_UTC_OFFSET_MS = 7 * HOUR_MS;
const PRIMARY_RESTAURANT_NAME = "Nhà hàng COHAN Thủ Đức";
const LEGACY_RESTAURANT_NAME = "COHAN Defense Demo Restaurant";
const PREVIOUS_WEEK_NOTE = "Ca làm việc đã hoàn thành";
const CURRENT_WEEK_NOTE = "Lịch làm việc tuần hiện tại";

export const STAFF_SCHEDULE_BLUEPRINTS = [
  {
    email: "staff.server.demo@cohan.local",
    days: [0, 1, 2, 3, 4, 5],
    shiftType: "morning",
    startHour: 8,
    endHour: 14,
  },
  {
    email: "staff.supervisor.demo@cohan.local",
    days: [0, 1, 2, 3, 4],
    shiftType: "morning",
    startHour: 8,
    endHour: 14,
  },
  {
    email: "staff.host.demo@cohan.local",
    days: [4, 5, 6],
    shiftType: "evening",
    startHour: 16,
    endHour: 22,
  },
  {
    email: "staff.cashier.demo@cohan.local",
    days: [1, 3, 5],
    shiftType: "morning",
    startHour: 8,
    endHour: 14,
  },
  {
    email: "staff.chef.demo@cohan.local",
    days: [0, 1, 2, 3, 4, 5],
    shiftType: "morning",
    startHour: 8,
    endHour: 14,
  },
  {
    email: "staff.cook.demo@cohan.local",
    days: [0, 1, 2, 3, 4, 5],
    shiftType: "evening",
    startHour: 16,
    endHour: 22,
  },
  {
    email: "staff.kitchenhelper.demo@cohan.local",
    days: [2, 4, 5],
    shiftType: "evening",
    startHour: 16,
    endHour: 22,
  },
  {
    email: "staff.cleaner.demo@cohan.local",
    days: [0, 2, 4, 6],
    shiftType: "morning",
    startHour: 8,
    endHour: 14,
  },
  {
    email: "staff.shipper.demo@cohan.local",
    days: [0, 1, 2, 3, 4],
    shiftType: "evening",
    startHour: 16,
    endHour: 22,
  },
  {
    email: "staff.storekeeper.demo@cohan.local",
    days: [0, 1, 2, 3, 4],
    shiftType: "morning",
    startHour: 8,
    endHour: 14,
  },
  {
    email: "staff.bartender.demo@cohan.local",
    days: [3, 4, 5, 6],
    shiftType: "evening",
    startHour: 16,
    endHour: 22,
  },
  {
    email: "staff.fulltime.demo@cohan.local",
    days: [0, 1, 2, 3, 4, 5],
    shiftType: "evening",
    startHour: 16,
    endHour: 22,
  },
  {
    email: "staff.parttime.demo@cohan.local",
    days: [1, 3, 5],
    shiftType: "evening",
    startHour: 16,
    endHour: 22,
  },
  {
    email: "staff.exception.demo@cohan.local",
    days: [2, 4, 5],
    shiftType: "evening",
    startHour: 16,
    endHour: 22,
  },
];

export function startOfWeekVietnam(reference = new Date()) {
  const shifted = new Date(reference.getTime() + VIETNAM_UTC_OFFSET_MS);
  const localMidnightAsUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const weekday = shifted.getUTCDay() || 7;
  return new Date(
    localMidnightAsUtc - (weekday - 1) * DAY_MS - VIETNAM_UTC_OFFSET_MS,
  );
}

export function atVietnam(weekStart, dayOffset, hour, minute = 0) {
  return new Date(
    weekStart.getTime() +
      dayOffset * DAY_MS +
      hour * HOUR_MS +
      minute * MINUTE_MS,
  );
}

export function weekRangeVietnam(reference = new Date(), weekOffset = 0) {
  const currentStart = startOfWeekVietnam(reference);
  const periodStart = new Date(currentStart.getTime() + weekOffset * 7 * DAY_MS);
  const periodEnd = new Date(periodStart.getTime() + 7 * DAY_MS - 1);
  return { periodStart, periodEnd };
}

export function buildWeekShiftPlans({
  staffByEmail,
  restaurantId,
  periodStart,
  reference = new Date(),
  previousWeek = false,
}) {
  const notes = previousWeek ? PREVIOUS_WEEK_NOTE : CURRENT_WEEK_NOTE;
  const plans = [];

  for (const blueprint of STAFF_SCHEDULE_BLUEPRINTS) {
    const employee = staffByEmail.get(blueprint.email);
    if (!employee?._id) {
      throw new Error(`SCHEDULE_STAFF_NOT_FOUND: ${blueprint.email}`);
    }

    for (const dayOffset of blueprint.days) {
      const startTime = atVietnam(
        periodStart,
        dayOffset,
        blueprint.startHour,
      );
      const endTime = atVietnam(periodStart, dayOffset, blueprint.endHour);
      plans.push({
        restaurantId,
        employeeId: employee._id,
        shiftType: blueprint.shiftType,
        startTime,
        endTime,
        status:
          previousWeek || endTime.getTime() <= reference.getTime()
            ? "completed"
            : "scheduled",
        notes,
      });
    }
  }

  return plans;
}

async function resolveRestaurant() {
  const explicitId = process.env.DEMO_RESTAURANT_ID?.trim();
  if (explicitId) {
    const restaurant = await Restaurant.findById(explicitId);
    if (!restaurant) {
      throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${explicitId}`);
    }
    return restaurant;
  }

  const restaurant = await Restaurant.findOne({
    name: { $in: [PRIMARY_RESTAURANT_NAME, LEGACY_RESTAURANT_NAME] },
    status: "active",
  }).sort({ name: 1 });
  if (!restaurant) {
    throw new Error("PRIMARY_RESTAURANT_NOT_FOUND");
  }
  return restaurant;
}

async function resolveActors() {
  const emails = STAFF_SCHEDULE_BLUEPRINTS.map((item) => item.email);
  const [manager, staff] = await Promise.all([
    User.findOne({ email: "manager.demo@cohan.local" })
      .select("_id email fullName")
      .lean(),
    User.find({ email: { $in: emails } })
      .select("_id email fullName userType")
      .lean(),
  ]);

  if (!manager?._id) throw new Error("SCHEDULE_MANAGER_NOT_FOUND");
  const staffByEmail = new Map(staff.map((item) => [item.email, item]));
  const missing = emails.filter((email) => !staffByEmail.has(email));
  if (missing.length) {
    throw new Error(`SCHEDULE_STAFF_NOT_FOUND: ${missing.join(", ")}`);
  }
  return { manager, staff, staffByEmail };
}

async function upsertPublication({
  restaurantId,
  managerId,
  periodStart,
  periodEnd,
  previousWeek,
  reference,
}) {
  const status = previousWeek ? "closed" : "active";
  const payload = {
    status,
    publishedAt: atVietnam(periodStart, -3, 10),
    publishedBy: managerId,
    activatedAt: periodStart,
    lastChangedAt: reference,
    reopenedAt: null,
    reopenedBy: null,
    reopenReason: null,
    reopenCount: 0,
  };

  if (previousWeek) {
    payload.closedAt = periodEnd;
    payload.closedBy = managerId;
    payload.closeReason = "Đã hoàn tất kỳ làm việc";
  } else {
    payload.closedAt = null;
    payload.closedBy = null;
    payload.closeReason = null;
  }

  return SchedulePublication.findOneAndUpdate(
    { restaurantId, periodStart, periodEnd },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function replaceWeekShifts({
  restaurantId,
  employeeIds,
  periodStart,
  periodEnd,
  plans,
}) {
  await Shift.deleteMany({
    restaurantId,
    employeeId: { $in: employeeIds },
    startTime: { $gte: periodStart, $lte: periodEnd },
    notes: { $in: [PREVIOUS_WEEK_NOTE, CURRENT_WEEK_NOTE] },
  });
  return Shift.insertMany(plans, { ordered: true });
}

export async function seedCurrentAndPreviousWeekSchedules(
  reference = new Date(),
) {
  const restaurant = await resolveRestaurant();
  const { manager, staff, staffByEmail } = await resolveActors();
  const previousRange = weekRangeVietnam(reference, -1);
  const currentRange = weekRangeVietnam(reference, 0);
  const previousPlans = buildWeekShiftPlans({
    staffByEmail,
    restaurantId: restaurant._id,
    periodStart: previousRange.periodStart,
    reference,
    previousWeek: true,
  });
  const currentPlans = buildWeekShiftPlans({
    staffByEmail,
    restaurantId: restaurant._id,
    periodStart: currentRange.periodStart,
    reference,
    previousWeek: false,
  });
  const employeeIds = staff.map((item) => item._id);

  const [previousShifts, currentShifts, previousPublication, currentPublication] =
    await Promise.all([
      replaceWeekShifts({
        restaurantId: restaurant._id,
        employeeIds,
        periodStart: previousRange.periodStart,
        periodEnd: previousRange.periodEnd,
        plans: previousPlans,
      }),
      replaceWeekShifts({
        restaurantId: restaurant._id,
        employeeIds,
        periodStart: currentRange.periodStart,
        periodEnd: currentRange.periodEnd,
        plans: currentPlans,
      }),
      upsertPublication({
        restaurantId: restaurant._id,
        managerId: manager._id,
        ...previousRange,
        previousWeek: true,
        reference,
      }),
      upsertPublication({
        restaurantId: restaurant._id,
        managerId: manager._id,
        ...currentRange,
        previousWeek: false,
        reference,
      }),
    ]);

  const [previousEmployeeIds, currentEmployeeIds] = await Promise.all([
    Shift.distinct("employeeId", {
      restaurantId: restaurant._id,
      startTime: {
        $gte: previousRange.periodStart,
        $lte: previousRange.periodEnd,
      },
      notes: PREVIOUS_WEEK_NOTE,
    }),
    Shift.distinct("employeeId", {
      restaurantId: restaurant._id,
      startTime: { $gte: currentRange.periodStart, $lte: currentRange.periodEnd },
      notes: CURRENT_WEEK_NOTE,
    }),
  ]);

  if (previousShifts.length !== previousPlans.length) {
    throw new Error(
      `PREVIOUS_WEEK_SHIFT_COUNT_MISMATCH: expected=${previousPlans.length} actual=${previousShifts.length}`,
    );
  }
  if (currentShifts.length !== currentPlans.length) {
    throw new Error(
      `CURRENT_WEEK_SHIFT_COUNT_MISMATCH: expected=${currentPlans.length} actual=${currentShifts.length}`,
    );
  }
  if (previousEmployeeIds.length !== STAFF_SCHEDULE_BLUEPRINTS.length) {
    throw new Error(
      `PREVIOUS_WEEK_EMPLOYEE_COVERAGE_MISMATCH: expected=${STAFF_SCHEDULE_BLUEPRINTS.length} actual=${previousEmployeeIds.length}`,
    );
  }
  if (currentEmployeeIds.length !== STAFF_SCHEDULE_BLUEPRINTS.length) {
    throw new Error(
      `CURRENT_WEEK_EMPLOYEE_COVERAGE_MISMATCH: expected=${STAFF_SCHEDULE_BLUEPRINTS.length} actual=${currentEmployeeIds.length}`,
    );
  }

  return {
    restaurant,
    previousRange,
    currentRange,
    previousShifts: previousShifts.length,
    currentShifts: currentShifts.length,
    employeesPerWeek: STAFF_SCHEDULE_BLUEPRINTS.length,
    previousPublicationStatus: previousPublication.status,
    currentPublicationStatus: currentPublication.status,
  };
}

async function main() {
  assertDemoScriptAllowed("seedScheduleCurrentAndPreviousWeek.js");
  const mongoUri =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB";
  const dbName = process.env.MONGO_DB || "RestaurantDB";

  console.log("Seeding previous and current work schedules:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });
  const result = await seedCurrentAndPreviousWeekSchedules(new Date());
  await mongoose.disconnect();

  console.log("\n✅ Work schedules seeded for previous and current week");
  console.table({
    previousWeek: {
      periodStart: result.previousRange.periodStart.toISOString(),
      periodEnd: result.previousRange.periodEnd.toISOString(),
      shifts: result.previousShifts,
      employees: result.employeesPerWeek,
      publicationStatus: result.previousPublicationStatus,
    },
    currentWeek: {
      periodStart: result.currentRange.periodStart.toISOString(),
      periodEnd: result.currentRange.periodEnd.toISOString(),
      shifts: result.currentShifts,
      employees: result.employeesPerWeek,
      publicationStatus: result.currentPublicationStatus,
    },
  });
}

if (path.resolve(process.argv[1] || "") === scriptPath) {
  main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}
