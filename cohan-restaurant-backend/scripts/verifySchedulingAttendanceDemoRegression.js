import "dotenv/config.js";
import mongoose from "mongoose";
import {
  AttendanceCorrectionRequest,
  AvailabilityRegistrationWindow,
  LeaveRequest,
  OvertimeRequest,
  Restaurant,
  SchedulePublication,
  ShiftAcknowledgement,
  Staff,
  StaffAvailabilitySubmission,
  StaffPerformanceSnapshot,
  Timesheet,
} from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const DEMO_TAG = "[demo-scheduling-pr21]";
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const DEMO_STAFF_EMAILS = [
  "staff.fulltime.demo@cohan.local",
  "staff.parttime.demo@cohan.local",
  "staff.host.demo@cohan.local",
  "staff.cashier.demo@cohan.local",
  "staff.cleaner.demo@cohan.local",
  "staff.shipper.demo@cohan.local",
  "staff.bartender.demo@cohan.local",
  "staff.exception.demo@cohan.local",
];

const state = { pass: 0, fail: 0 };
const pass = (message) => {
  state.pass += 1;
  console.log(`PASS ${message}`);
};
const fail = (message) => {
  state.fail += 1;
  console.error(`FAIL ${message}`);
};

async function resolveDemoRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    return Restaurant.findById(DEMO_RESTAURANT_ID).lean();
  }
  return Restaurant.findOne({
    name: "Cohan Demo Restaurant - District 1",
    description: { $regex: DEMO_TAG },
  }).lean();
}

function expectSet(label, actualValues, expectedValues) {
  const actual = new Set(actualValues.map((value) => String(value || "")));
  for (const expected of expectedValues) {
    actual.has(expected)
      ? pass(`${label}: ${expected}`)
      : fail(`${label}: missing ${expected}`);
  }
}

async function run() {
  assertDemoScriptAllowed("verifySchedulingAttendanceDemoRegression.js");
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.MONGO_DB || "cohan";
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });

  const restaurant = await resolveDemoRestaurant();
  if (!restaurant) throw new Error("DEMO_RESTAURANT_NOT_FOUND");
  pass(`Found demo restaurant ${restaurant._id}`);

  const staff = await Staff.find({ email: { $in: DEMO_STAFF_EMAILS } })
    .select("_id email")
    .lean();
  const staffIds = staff.map((item) => item._id);
  staff.length >= 8
    ? pass(`Found ${staff.length} demo staff`)
    : fail(`Expected at least 8 demo staff, found ${staff.length}`);

  const publication = await SchedulePublication.findOne({
    restaurantId: restaurant._id,
    status: "published",
  })
    .sort({ periodStart: -1 })
    .lean();
  if (!publication) throw new Error("DEMO_PUBLISHED_SCHEDULE_NOT_FOUND");
  pass(
    `Found published schedule ${publication.periodStart?.toISOString()} - ${publication.periodEnd?.toISOString()}`,
  );

  const periodFilter = {
    $gte: publication.periodStart,
    $lte: publication.periodEnd,
  };

  const availabilityWindow = await AvailabilityRegistrationWindow.findOne({
    restaurantId: restaurant._id,
    periodStart: publication.periodStart,
    periodEnd: publication.periodEnd,
  }).lean();
  availabilityWindow
    ? pass("Found availability registration window for published period")
    : fail("Missing availability registration window for published period");

  const availabilitySubmissions = await StaffAvailabilitySubmission.find({
    restaurantId: restaurant._id,
    periodStart: publication.periodStart,
    periodEnd: publication.periodEnd,
  })
    .select("status")
    .lean();
  expectSet(
    "Availability submissions",
    availabilitySubmissions.map((item) => item.status),
    ["approved", "pending", "rejected", "late_change_requested"],
  );

  const timesheets = await Timesheet.find({
    restaurantId: restaurant._id,
    employeeId: { $in: staffIds },
    workDate: periodFilter,
    note: { $regex: DEMO_TAG },
  })
    .select("status offScheduleApprovalStatus")
    .lean();
  expectSet(
    "Timesheet statuses",
    timesheets.map((item) => item.status),
    [
      "completed",
      "late",
      "early_leave",
      "late_early_leave",
      "scheduled_absent",
      "missed_checkout",
      "unscheduled_completed",
    ],
  );
  expectSet(
    "Off-schedule approvals",
    timesheets.map((item) => item.offScheduleApprovalStatus),
    ["pending", "approved", "rejected"],
  );

  const corrections = await AttendanceCorrectionRequest.find({
    restaurantId: restaurant._id,
    employeeId: { $in: staffIds },
    workDate: periodFilter,
    $or: [
      { reason: { $regex: DEMO_TAG } },
      { evidenceNote: { $regex: DEMO_TAG } },
    ],
  })
    .select("status")
    .lean();
  expectSet(
    "Attendance corrections",
    corrections.map((item) => item.status),
    ["pending", "applied", "rejected", "cancelled"],
  );

  const overtimeRequests = await OvertimeRequest.find({
    restaurantId: restaurant._id,
    employeeId: { $in: staffIds },
    workDate: periodFilter,
    note: { $regex: DEMO_TAG },
  })
    .select("status")
    .lean();
  expectSet(
    "Overtime requests",
    overtimeRequests.map((item) => item.status),
    ["approved", "completed"],
  );

  const leaveRequests = await LeaveRequest.find({
    restaurantId: restaurant._id,
    employeeId: { $in: staffIds },
    startDate: periodFilter,
    reason: { $regex: DEMO_TAG },
  })
    .select("status")
    .lean();
  expectSet(
    "Leave requests",
    leaveRequests.map((item) => item.status),
    ["approved", "pending"],
  );

  const acknowledgements = await ShiftAcknowledgement.find({
    restaurantId: restaurant._id,
    periodStart: publication.periodStart,
    periodEnd: publication.periodEnd,
    reason: { $regex: DEMO_TAG },
  })
    .select("status declineClassification")
    .lean();
  expectSet(
    "Shift acknowledgements",
    acknowledgements.map((item) => item.status),
    ["accepted", "pending", "expired", "declined"],
  );
  expectSet(
    "Decline classifications",
    acknowledgements.map((item) => item.declineClassification),
    ["valid", "invalid", "late"],
  );

  const snapshot = await StaffPerformanceSnapshot.findOne({
    restaurantId: restaurant._id,
    employeeId: { $in: staffIds },
    finalPerformanceScore: { $exists: true },
  }).lean();
  snapshot
    ? pass("Found StaffPerformanceSnapshot.finalPerformanceScore")
    : fail("Missing StaffPerformanceSnapshot.finalPerformanceScore");

  console.log(`\nSummary: PASS=${state.pass} FAIL=${state.fail}`);
  return state.fail > 0 ? 1 : 0;
}

(async () => {
  let exitCode = 1;
  try {
    exitCode = await run();
  } catch (error) {
    fail(error?.message || String(error));
    console.log(`\nSummary: PASS=${state.pass} FAIL=${state.fail}`);
  } finally {
    try {
      await mongoose.disconnect();
    } catch {}
  }
  process.exit(exitCode);
})();
