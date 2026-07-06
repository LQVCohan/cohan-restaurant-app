import "dotenv/config.js";
import mongoose from "mongoose";
import {
  Staff,
  StaffPerformanceReview,
  StaffPerformanceSnapshot,
} from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
const STAFF_EMAILS = [
  "staff.server.demo@cohan.local",
  "staff.supervisor.demo@cohan.local",
  "staff.cashier.demo@cohan.local",
  "staff.chef.demo@cohan.local",
  "staff.kitchenhelper.demo@cohan.local",
  "staff.exception.demo@cohan.local",
  "staff.parttime.demo@cohan.local",
];

async function main() {
  assertDemoScriptAllowed("prepareStaffPerformanceDemoPeriods.js");
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGO_DB || "foodhub";
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });

  const restaurantId = new mongoose.Types.ObjectId(RESTAURANT_ID);
  const staff = await Staff.find({
    email: { $in: STAFF_EMAILS },
    restaurantForStaff: restaurantId,
    userType: "STAFF",
  })
    .select("_id email")
    .lean();

  const foundEmails = new Set(staff.map((item) => item.email));
  const missingEmails = STAFF_EMAILS.filter((email) => !foundEmails.has(email));
  if (missingEmails.length > 0) {
    throw new Error(`DEMO_STAFF_ACCOUNTS_MISSING: ${missingEmails.join(", ")}`);
  }

  const employeeIds = staff.map((item) => item._id);
  const filter = {
    restaurantId,
    employeeId: { $in: employeeIds },
    periodStart: {
      $gte: new Date("2026-05-31T00:00:00.000Z"),
      $lt: new Date("2026-08-02T00:00:00.000Z"),
    },
  };

  const [snapshotResult, reviewResult] = await Promise.all([
    StaffPerformanceSnapshot.deleteMany(filter),
    StaffPerformanceReview.deleteMany(filter),
  ]);

  console.log(
    `Cleared demo performance periods: snapshots=${snapshotResult.deletedCount || 0}, reviews=${reviewResult.deletedCount || 0}`,
  );
}

main()
  .catch((error) => {
    console.error("[prepare:demo:staff-performance] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
