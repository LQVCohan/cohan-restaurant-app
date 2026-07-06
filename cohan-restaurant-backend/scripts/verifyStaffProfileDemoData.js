import "dotenv/config.js";
import mongoose from "mongoose";
import { Staff } from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
const EMAILS = [
  "staff.bartender.demo@cohan.local",
  "staff.cashier.demo@cohan.local",
  "staff.chef.demo@cohan.local",
  "staff.cleaner.demo@cohan.local",
  "staff.cook.demo@cohan.local",
  "staff.host.demo@cohan.local",
  "staff.kitchenhelper.demo@cohan.local",
  "staff.server.demo@cohan.local",
  "staff.shipper.demo@cohan.local",
  "staff.exception.demo@cohan.local",
  "staff.fulltime.demo@cohan.local",
  "staff.parttime.demo@cohan.local",
  "staff.storekeeper.demo@cohan.local",
  "staff.supervisor.demo@cohan.local",
];

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

async function run() {
  assertDemoScriptAllowed("verifyStaffProfileDemoData.js");
  if (!mongoose.isValidObjectId(RESTAURANT_ID)) throw new Error("DEMO_RESTAURANT_ID_INVALID");

  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "foodhub",
  });

  const rows = await Staff.find({
    email: { $in: EMAILS },
    restaurantForStaff: new mongoose.Types.ObjectId(RESTAURANT_ID),
    userType: "STAFF",
    deletedAt: null,
  }).lean();

  check(rows.length === 14, "found fourteen demo staff profiles");
  const phones = new Set();
  const employeeCodes = new Set();

  for (const row of rows) {
    check(Boolean(row.employeeCode), `${row.email} has employeeCode`);
    check(Boolean(row.phone), `${row.email} has phone`);
    check(Boolean(row.address?.line1 && row.address?.city), `${row.email} has display address`);
    check(Boolean(row.dateJoined), `${row.email} has dateJoined`);
    check(Number(row.baseSalary || 0) > 0, `${row.email} has baseSalary`);
    check(Boolean(row.shiftType), `${row.email} has shiftType`);
    check(row.emailVerified === true, `${row.email} has verified email`);
    check(row.phoneVerified === true, `${row.email} has verified phone`);
    check(Boolean(row.verifiedAt), `${row.email} has verifiedAt`);
    check(row.status === "active", `${row.email} account is active`);
    check(row.employmentStatus === "working", `${row.email} employment is working`);

    if (row.phone) phones.add(row.phone);
    if (row.employeeCode) employeeCodes.add(row.employeeCode);
  }

  check(phones.size === 14, "all demo staff phone numbers are unique");
  check(employeeCodes.size === 14, "all demo staff employee codes are unique");

  const missingEmails = EMAILS.filter((email) => !rows.some((row) => row.email === email));
  check(missingEmails.length === 0, "all expected demo staff emails are present");

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
