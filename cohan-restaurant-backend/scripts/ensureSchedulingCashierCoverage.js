import "dotenv/config.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Restaurant, Role, Staff, User } from "../models/index.js";
import {
  assertDemoScriptAllowed,
  getDemoPassword,
  safeDbInfo,
} from "./lib/scriptSafety.js";

const DEMO_TAG = "[demo-scheduling-cashier-coverage]";
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const CASHIER_EMAIL = "staff.cashier.coverage.demo@cohan.local";
const WORKING_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

async function resolveDemoRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID);
    if (!restaurant) {
      throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${DEMO_RESTAURANT_ID}`);
    }
    return restaurant;
  }

  const taggedRestaurant = await Restaurant.findOne({
    name: "Cohan Demo Restaurant - District 1",
    description: { $regex: "\\[demo-scheduling-pr21\\]" },
  });
  if (taggedRestaurant) return taggedRestaurant;

  const fallbackRestaurant = await Restaurant.findOne({
    name: "Cohan Demo Restaurant - District 1",
  });
  if (!fallbackRestaurant) {
    throw new Error(
      "DEMO_RESTAURANT_NOT_FOUND: run npm run seed:demo:scheduling after npm run seed:rbac",
    );
  }
  return fallbackRestaurant;
}

async function ensureCashierCoverage({ restaurant, cashierRole }) {
  const existingUser = await User.findOne({ email: CASHIER_EMAIL })
    .select("_id userType")
    .lean();

  if (existingUser && existingUser.userType !== "STAFF") {
    throw new Error(`DEMO_EMAIL_CONFLICT_NOT_STAFF: ${CASHIER_EMAIL}`);
  }

  const passwordHash = await bcrypt.hash(getDemoPassword(), 10);
  const cashier = await Staff.findOneAndUpdate(
    { email: CASHIER_EMAIL },
    {
      $set: {
        fullName: "Demo Cashier Fulltime",
        userType: "STAFF",
        role: cashierRole._id,
        status: "active",
        provider: "local",
        restaurantForStaff: restaurant._id,
        refRestaurants: [restaurant._id],
        primaryRestaurant: restaurant._id,
        department: "cashier",
        positionTitle: "Thu ngân",
        employmentType: "full_time",
        employmentStatus: "working",
        workingDays: WORKING_DAYS,
        noteInternal: `${DEMO_TAG} Always-visible cashier for mandatory shift coverage`,
      },
      $setOnInsert: { passwordHash },
    },
    { upsert: true, new: true },
  );

  return cashier;
}

async function main() {
  assertDemoScriptAllowed("ensureSchedulingCashierCoverage.js");

  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.MONGO_DB || "cohan";

  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });

  const restaurant = await resolveDemoRestaurant();
  const cashierRole = await Role.findOne({ slug: "cashier" });
  if (!cashierRole) {
    throw new Error("CASHIER_ROLE_NOT_FOUND: run npm run seed:rbac first");
  }

  const cashier = await ensureCashierCoverage({ restaurant, cashierRole });

  console.log("Cashier scheduling coverage is ready:", {
    restaurantId: String(restaurant._id),
    staffId: String(cashier._id),
    email: cashier.email,
    employmentType: cashier.employmentType,
    workingDays: cashier.workingDays,
  });
}

(async () => {
  let exitCode = 0;
  try {
    await main();
  } catch (error) {
    exitCode = 1;
    console.error(error?.stack || error?.message || String(error));
  } finally {
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(exitCode);
  }
})();
