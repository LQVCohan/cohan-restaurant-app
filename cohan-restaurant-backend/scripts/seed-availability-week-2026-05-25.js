// cohan-restaurant-backend/scripts/seed-availability-week-2026-05-25.js
//
// DEV/TEST ONLY.
// Script này tạo availability đã duyệt sẵn để test auto scheduling cho tuần:
// 25/05/2026 - 31/05/2026.
//
// Nhà hàng mặc định:
// 69ce9e2e8d8d711f12e251b1
//
// Cách chạy:
// npm run seed:availability:2026-05-25
// npm run seed:availability:2026-05-25 -- --dry-run
// npm run seed:availability:2026-05-25 -- --reset
// npm run seed:availability:2026-05-25 -- --restaurantId=69ce9e2e8d8d711f12e251b1 --reset
// npm run seed:availability:2026-05-25 -- --shiftTypes=morning,afternoon,evening
//
// Quy tắc seed:
// - part_time / seasonal / probation / contract:
//   tạo weekly_availability approved với tất cả ca available.
// - full_time:
//   KHÔNG tạo weekly_availability giả.
//   tạo unavailable_exception approved rỗng để full-time vẫn đi theo workingDays.
// - Không tạo pendingSlots.
// - Không sửa Staff.workingDays.
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import {
  Restaurant,
  Staff,
  SchedulingPolicy,
  AvailabilityRegistrationWindow,
  StaffAvailabilitySubmission,
} from "../models/index.js";
import process from "process";
const DEFAULT_RESTAURANT_ID = "69ce9e2e8d8d711f12e251b1";

const PERIOD_START = new Date("2026-05-25T00:00:00.000+07:00");
const PERIOD_END = new Date("2026-05-31T23:59:59.999+07:00");
const OPEN_AT = new Date("2026-05-18T00:00:00.000+07:00");
const CLOSE_AT = new Date("2026-05-24T23:59:59.999+07:00");

const WEEK_DATES = [
  "2026-05-25",
  "2026-05-26",
  "2026-05-27",
  "2026-05-28",
  "2026-05-29",
  "2026-05-30",
  "2026-05-31",
];

const WEEKLY_AVAILABILITY_TYPES = new Set([
  "part_time",
  "seasonal",
  "probation",
  "contract",
]);

const FULL_TIME_TYPES = new Set(["full_time"]);

function parseArgs(argv = []) {
  return argv.reduce(
    (acc, raw) => {
      const arg = String(raw || "").trim();
      if (!arg) return acc;

      if (arg === "--dry-run") {
        acc.dryRun = true;
        return acc;
      }

      if (arg === "--reset") {
        acc.reset = true;
        return acc;
      }

      if (arg === "--all-restaurants") {
        acc.allRestaurants = true;
        return acc;
      }

      if (arg === "--include-full-time-exceptions") {
        acc.includeFullTimeExceptions = true;
        return acc;
      }

      if (arg === "--no-full-time-exceptions") {
        acc.includeFullTimeExceptions = false;
        return acc;
      }

      if (arg.startsWith("--restaurantId=")) {
        acc.restaurantId = arg.slice("--restaurantId=".length).trim();
        return acc;
      }

      if (arg.startsWith("--shiftTypes=")) {
        acc.shiftTypes = arg
          .slice("--shiftTypes=".length)
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
        return acc;
      }

      acc.unknownArgs.push(arg);
      return acc;
    },
    {
      restaurantId: DEFAULT_RESTAURANT_ID,
      allRestaurants: false,
      dryRun: false,
      reset: false,
      includeFullTimeExceptions: true,
      shiftTypes: null,
      unknownArgs: [],
    },
  );
}

function asObjectId(value, fieldName = "id") {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`${fieldName} không hợp lệ: ${value}`);
  }

  return new mongoose.Types.ObjectId(value);
}

function normalizeEmploymentType(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (raw === "fulltime" || raw === "full-time") return "full_time";
  if (raw === "parttime" || raw === "part-time") return "part_time";
  if (raw === "season") return "seasonal";
  if (raw === "temporary") return "seasonal";
  if (raw === "trial") return "probation";
  if (raw === "contractor") return "contract";

  if (
    ["full_time", "part_time", "seasonal", "probation", "contract"].includes(
      raw,
    )
  ) {
    return raw;
  }

  return "part_time";
}

function makeDayDate(dateText) {
  return new Date(`${dateText}T00:00:00.000+07:00`);
}

function buildAvailableSlots(shiftTypes) {
  return WEEK_DATES.flatMap((dateText) =>
    shiftTypes.map((shiftType) => ({
      date: makeDayDate(dateText),
      shiftType,
      status: "available",
      note: "Seed test availability",
    })),
  );
}

function buildRestaurantStaffQuery(restaurantObjectId) {
  return {
    userType: "STAFF",
    employmentStatus: "working",
    $or: [
      { restaurantForStaff: restaurantObjectId },
      { restaurantId: restaurantObjectId },
      { primaryRestaurant: restaurantObjectId },
      { refRestaurants: restaurantObjectId },
      { restaurants: restaurantObjectId },
      { assignedRestaurants: restaurantObjectId },

      // Một số DB dev có thể lưu id dạng string.
      { restaurantForStaff: String(restaurantObjectId) },
      { restaurantId: String(restaurantObjectId) },
      { primaryRestaurant: String(restaurantObjectId) },
      { refRestaurants: String(restaurantObjectId) },
      { restaurants: String(restaurantObjectId) },
      { assignedRestaurants: String(restaurantObjectId) },
    ],
  };
}

async function resolveRestaurants(options) {
  if (options.allRestaurants) {
    return Restaurant.find({}).sort({ name: 1 }).lean();
  }

  const restaurantObjectId = asObjectId(options.restaurantId, "restaurantId");
  const restaurant = await Restaurant.findById(restaurantObjectId).lean();

  if (!restaurant) {
    throw new Error(`Không tìm thấy nhà hàng: ${options.restaurantId}`);
  }

  return [restaurant];
}

async function resolveShiftTypes(restaurantId, cliShiftTypes) {
  if (Array.isArray(cliShiftTypes) && cliShiftTypes.length > 0) {
    return Array.from(new Set(cliShiftTypes.map((item) => item.toLowerCase())));
  }

  const policy = await SchedulingPolicy.findOne({ restaurantId }).lean();

  const fromPolicy = (policy?.shiftTemplates || [])
    .filter((template) => template?.enabled !== false)
    .map((template) =>
      String(template?.key || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  if (fromPolicy.length > 0) {
    return Array.from(new Set(fromPolicy));
  }

  return ["morning", "afternoon", "evening"];
}

async function upsertAvailabilityWindow({ restaurantId, dryRun }) {
  const filter = {
    restaurantId,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
  };

  const update = {
    $set: {
      restaurantId,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      openAt: OPEN_AT,
      closeAt: CLOSE_AT,
      status: "closed",
      registrationModeSnapshot: "manual",
      targetEmploymentTypes: ["part_time", "seasonal", "probation", "contract"],
      allowFullTimeUnavailableException: true,
      lateChangeRequiresApproval: true,
    },
  };

  if (dryRun) {
    const existing =
      await AvailabilityRegistrationWindow.findOne(filter).lean();
    return {
      _id: existing?._id || new mongoose.Types.ObjectId(),
      dryRunCreated: !existing,
    };
  }

  return AvailabilityRegistrationWindow.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
}

async function resetWindowSubmissions({ windowId, dryRun }) {
  if (dryRun) {
    return StaffAvailabilitySubmission.countDocuments({
      availabilityWindowId: windowId,
    });
  }

  const result = await StaffAvailabilitySubmission.deleteMany({
    availabilityWindowId: windowId,
  });

  return result.deletedCount || 0;
}

async function seedWeeklyAvailability({
  staff,
  restaurantId,
  windowId,
  employmentType,
  slots,
  dryRun,
}) {
  const now = new Date();

  const filter = {
    availabilityWindowId: windowId,
    employeeId: staff._id,
  };

  const update = {
    $set: {
      restaurantId,
      availabilityWindowId: windowId,
      employeeId: staff._id,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      employmentType,
      submissionType: "weekly_availability",
      pendingSubmissionType: null,
      slots,
      pendingSlots: [],
      submittedAt: now,
      pendingSubmittedAt: null,
      lockedAt: now,
      status: "approved",
      reviewedAt: now,
      reviewNote: "Seeded approved availability for auto schedule testing",
      source: "system",
      pendingSource: null,
      pendingNote: "",
    },
  };

  if (dryRun) {
    return { dryRun: true, upserted: true };
  }

  return StaffAvailabilitySubmission.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
}

async function seedFullTimeUnavailableException({
  staff,
  restaurantId,
  windowId,
  employmentType,
  reset,
  dryRun,
}) {
  const filter = {
    availabilityWindowId: windowId,
    employeeId: staff._id,
  };

  const existing = await StaffAvailabilitySubmission.findOne(filter).lean();

  if (existing && !reset) {
    const isSeeded =
      existing.source === "system" &&
      String(existing.reviewNote || "").includes("Seeded");

    if (!isSeeded) {
      return { skippedExisting: true };
    }
  }

  const now = new Date();

  const update = {
    $set: {
      restaurantId,
      availabilityWindowId: windowId,
      employeeId: staff._id,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      employmentType,
      submissionType: "unavailable_exception",
      pendingSubmissionType: null,
      slots: [],
      pendingSlots: [],
      submittedAt: now,
      pendingSubmittedAt: null,
      lockedAt: now,
      status: "approved",
      reviewedAt: now,
      reviewNote: "Seeded empty unavailable exception for full-time test staff",
      source: "system",
      pendingSource: null,
      pendingNote: "",
    },
  };

  if (dryRun) {
    return { dryRun: true, upserted: true };
  }

  await StaffAvailabilitySubmission.findOneAndUpdate(filter, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });

  return { upserted: true };
}

async function seedRestaurant(restaurant, options) {
  const restaurantId = restaurant._id;
  const shiftTypes = await resolveShiftTypes(restaurantId, options.shiftTypes);
  const window = await upsertAvailabilityWindow({
    restaurantId,
    dryRun: options.dryRun,
  });

  let resetCount = 0;
  if (options.reset) {
    resetCount = await resetWindowSubmissions({
      windowId: window._id,
      dryRun: options.dryRun,
    });
  }

  const staffList = await Staff.find(buildRestaurantStaffQuery(restaurantId))
    .sort({ fullName: 1, employeeCode: 1 })
    .lean();

  const slots = buildAvailableSlots(shiftTypes);

  const summary = {
    restaurantId: String(restaurantId),
    restaurantName: restaurant.name || restaurant.restaurantName || "(no name)",
    shiftTypes,
    staffMatched: staffList.length,
    resetDeleted: resetCount,
    seeded: {
      part_time: 0,
      seasonal: 0,
      probation: 0,
      contract: 0,
    },
    missingEmploymentTypeWarnings: [],
    fullTimeExceptionCreated: 0,
    fullTimeExistingExceptionSkipped: 0,
    skippedUnknownEmploymentType: 0,
  };

  for (const staff of staffList) {
    const rawEmploymentType = staff.employmentType;
    const employmentType = normalizeEmploymentType(rawEmploymentType);

    if (!rawEmploymentType) {
      summary.missingEmploymentTypeWarnings.push({
        employeeId: String(staff._id),
        name: staff.fullName || staff.employeeCode || "(no name)",
        defaultedTo: employmentType,
      });
    }

    if (WEEKLY_AVAILABILITY_TYPES.has(employmentType)) {
      await seedWeeklyAvailability({
        staff,
        restaurantId,
        windowId: window._id,
        employmentType,
        slots,
        dryRun: options.dryRun,
      });

      summary.seeded[employmentType] += 1;
      continue;
    }

    if (FULL_TIME_TYPES.has(employmentType)) {
      if (!options.includeFullTimeExceptions) {
        continue;
      }

      const result = await seedFullTimeUnavailableException({
        staff,
        restaurantId,
        windowId: window._id,
        employmentType,
        reset: options.reset,
        dryRun: options.dryRun,
      });

      if (result.skippedExisting) {
        summary.fullTimeExistingExceptionSkipped += 1;
      } else {
        summary.fullTimeExceptionCreated += 1;
      }

      continue;
    }

    summary.skippedUnknownEmploymentType += 1;
  }

  return summary;
}

function printSummary(summaries, options) {
  console.log("");
  console.log("========== Seed availability summary ==========");
  console.log(`Mode: ${options.dryRun ? "DRY RUN" : "WRITE"}`);
  console.log(`Reset: ${options.reset ? "yes" : "no"}`);
  console.log(
    `Full-time empty unavailable exceptions: ${
      options.includeFullTimeExceptions ? "yes" : "no"
    }`,
  );
  console.log(
    `Period: ${PERIOD_START.toISOString()} -> ${PERIOD_END.toISOString()}`,
  );

  for (const summary of summaries) {
    console.log("");
    console.log(
      `Restaurant: ${summary.restaurantName} (${summary.restaurantId})`,
    );
    console.log(`Shift types: ${summary.shiftTypes.join(", ")}`);
    console.log(`Staff matched: ${summary.staffMatched}`);
    console.log(`Reset deleted submissions: ${summary.resetDeleted}`);
    console.log(`Seeded part_time: ${summary.seeded.part_time}`);
    console.log(`Seeded seasonal: ${summary.seeded.seasonal}`);
    console.log(`Seeded probation: ${summary.seeded.probation}`);
    console.log(`Seeded contract: ${summary.seeded.contract}`);
    console.log(
      `Full-time empty exceptions created/updated: ${summary.fullTimeExceptionCreated}`,
    );
    console.log(
      `Full-time existing real exceptions skipped: ${summary.fullTimeExistingExceptionSkipped}`,
    );
    console.log(
      `Skipped unknown employmentType: ${summary.skippedUnknownEmploymentType}`,
    );

    if (summary.missingEmploymentTypeWarnings.length > 0) {
      console.log("Missing employmentType warnings:");
      summary.missingEmploymentTypeWarnings.forEach((item) => {
        console.log(
          `- ${item.name} (${item.employeeId}) defaulted to ${item.defaultedTo}`,
        );
      });
    }
  }

  console.log("");
  console.log("Done.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log("============================================================");
  console.log(
    "DEV/TEST ONLY. This script directly creates approved availability submissions.",
  );
  console.log("Target week: 2026-05-25 -> 2026-05-31");
  console.log("Default restaurant:", DEFAULT_RESTAURANT_ID);
  console.log("============================================================");

  if (options.unknownArgs.length > 0) {
    console.warn(`Unknown args ignored: ${options.unknownArgs.join(", ")}`);
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Refusing to run seed script.");
  }

  await connectDB();

  const restaurants = await resolveRestaurants(options);

  if (!restaurants.length) {
    throw new Error("No restaurants found to seed.");
  }

  const summaries = [];
  for (const restaurant of restaurants) {
    const summary = await seedRestaurant(restaurant, options);
    summaries.push(summary);
  }

  printSummary(summaries, options);
}

main()
  .catch((error) => {
    console.error("Seed availability failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
