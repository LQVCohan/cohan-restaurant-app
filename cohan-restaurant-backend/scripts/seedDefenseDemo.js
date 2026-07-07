import "dotenv/config.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { Customer, Restaurant, Role, User } from "../models/index.js";
import {
  assertDemoScriptAllowed,
  getDemoPassword,
  safeDbInfo,
} from "./lib/scriptSafety.js";

const DEFENSE_TAG = "[defense-demo-2026]";
const DEFAULT_RESTAURANT_NAME = "COHAN Defense Demo Restaurant";
const scriptPath = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(scriptPath);
const backendDir = path.dirname(scriptsDir);

export function buildSeedSteps({ restaurantId, reset = false }) {
  const sharedEnv = {
    DEMO_RESTAURANT_ID: String(restaurantId),
    CUSTOMER_DEMO_RESTAURANT_ID: String(restaurantId),
    SEED_CUSTOMER_DEMO: "true",
    ...(reset ? { DEMO_RESET: "1" } : {}),
  };

  return [
    { script: "seedPermissions.js", args: [], env: sharedEnv },
    { script: "seedParentRoles.js", args: [], env: sharedEnv },
    { script: "seedRoles.js", args: [], env: sharedEnv },
    {
      script: "seedSchedulingAttendanceDemo.js",
      args: reset ? ["--reset"] : [],
      env: sharedEnv,
    },
    { script: "seedMenuManagementDemo.js", args: [], env: sharedEnv },
    { script: "seedCouponPromotionDemo.js", args: [], env: sharedEnv },
    {
      script: "seedCustomerDemoData.js",
      args: ["--confirm", `--restaurantId=${restaurantId}`],
      env: sharedEnv,
    },
  ];
}

export function buildDefenseAccountDefinitions({
  restaurantId,
  roleBySlug,
  passwordHash,
  now = new Date(),
}) {
  const roleId = (slug) => {
    const role = roleBySlug.get(slug);
    if (!role?._id) throw new Error(`Missing seeded role: ${slug}`);
    return role._id;
  };
  const verified = {
    status: "active",
    provider: "local",
    passwordHash,
    emailVerified: true,
    emailVerifiedAt: now,
    verifiedAt: now,
    verificationLastChannel: "email",
    verificationLastStatus: "verified",
    forcePasswordChange: false,
  };

  return [
    {
      model: "User",
      email: "admin.demo@cohan.local",
      payload: {
        ...verified,
        fullName: "COHAN Demo Admin",
        username: "admin.demo",
        userType: "ADMIN",
        role: roleId("admin"),
      },
    },
    {
      model: "User",
      email: "manager.demo@cohan.local",
      payload: {
        ...verified,
        fullName: "COHAN Demo Manager",
        username: "manager.demo",
        userType: "MANAGER",
        role: roleId("manager"),
        restaurantForStaff: restaurantId,
        refRestaurants: [restaurantId],
      },
    },
    {
      model: "Customer",
      email: "customer.demo@cohan.local",
      payload: {
        ...verified,
        fullName: "COHAN Demo Customer",
        username: "customer.demo",
        userType: "CUSTOMER",
        role: roleId("customer"),
        refRestaurants: [restaurantId],
        isGuest: false,
        registeredAt: now,
        customerType: "NEW",
      },
    },
    {
      model: "User",
      email: "staff.server.demo@cohan.local",
      payload: {
        ...verified,
        fullName: "COHAN Demo Server",
        username: "staff.server.demo",
        userType: "STAFF",
        role: roleId("server"),
        restaurantForStaff: restaurantId,
        refRestaurants: [restaurantId],
      },
    },
  ];
}

function runSeedStep(step) {
  console.log(`\n▶ ${step.script} ${step.args.join(" ")}`.trim());
  const result = spawnSync(
    process.execPath,
    [path.join(scriptsDir, step.script), ...step.args],
    {
      cwd: backendDir,
      env: { ...process.env, ...step.env },
      stdio: "inherit",
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${step.script} failed with exit code ${result.status}`);
  }
}

async function resolveDefenseRestaurant() {
  return Restaurant.findOneAndUpdate(
    { description: { $regex: DEFENSE_TAG } },
    {
      $set: {
        name: DEFAULT_RESTAURANT_NAME,
        description: `${DEFENSE_TAG} Local dataset for graduation defense`,
        status: "active",
        businessStatus: "active",
        publicationStatus: "published",
        operationalStatus: "normal",
        timezone: "Asia/Ho_Chi_Minh",
        address: {
          line1: "1 Võ Văn Ngân",
          ward: "Linh Chiểu",
          district: "Thủ Đức",
          city: "TP. Hồ Chí Minh",
          country: "Việt Nam",
          lat: 10.8506,
          lng: 106.7719,
        },
        capabilities: {
          acceptsReservations: true,
          acceptsOrders: true,
          acceptsTableOrders: true,
          acceptsDelivery: true,
          acceptsPickup: true,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function normalizeDefenseAccounts(restaurantId) {
  const roles = await Role.find({
    slug: { $in: ["admin", "manager", "customer", "server"] },
  }).select("_id slug");
  const roleBySlug = new Map(roles.map((role) => [role.slug, role]));
  const passwordHash = await bcrypt.hash(getDemoPassword(), 10);
  const accounts = buildDefenseAccountDefinitions({
    restaurantId,
    roleBySlug,
    passwordHash,
  });

  for (const account of accounts) {
    const Model = account.model === "Customer" ? Customer : User;
    await Model.findOneAndUpdate(
      { email: account.email },
      { $set: { email: account.email, ...account.payload } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  return accounts;
}

async function main() {
  assertDemoScriptAllowed("seedDefenseDemo.js");
  const reset = process.argv.includes("--reset");
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB";
  const dbName = process.env.MONGO_DB || "RestaurantDB";
  process.env.MONGO_URI ||= mongoUri;
  process.env.MONGO_DB ||= dbName;

  console.log("Preparing COHAN defense dataset:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });
  const restaurant = await resolveDefenseRestaurant();
  const restaurantId = String(restaurant._id);
  await mongoose.disconnect();

  for (const step of buildSeedSteps({ restaurantId, reset })) {
    runSeedStep(step);
  }

  await mongoose.connect(mongoUri, { dbName });
  const accounts = await normalizeDefenseAccounts(restaurant._id);
  await Restaurant.findByIdAndUpdate(restaurant._id, {
    $set: {
      managerId: (await User.findOne({ email: "manager.demo@cohan.local" }).select("_id"))?._id,
    },
  });
  await mongoose.disconnect();

  console.log("\n✅ COHAN defense dataset is ready");
  console.log(`Restaurant: ${DEFAULT_RESTAURANT_NAME} (${restaurantId})`);
  console.table(
    accounts.map(({ email, payload }) => ({
      email,
      role: payload.userType,
      username: payload.username,
    })),
  );
  console.log("Password: DEMO_PASSWORD from .env, or Demo@123456 in local development");
}

if (path.resolve(process.argv[1] || "") === scriptPath) {
  main().catch(async (error) => {
    console.error("❌ Defense seed failed:", error);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}
