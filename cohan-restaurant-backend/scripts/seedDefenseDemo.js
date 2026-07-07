import "dotenv/config.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import {
  Brand,
  BrandMembership,
  Customer,
  Restaurant,
  Role,
  User,
} from "../models/index.js";
import {
  assertDemoScriptAllowed,
  getDemoPassword,
  safeDbInfo,
} from "./lib/scriptSafety.js";

const DEFENSE_TAG = "[defense-demo-2026]";
const DEFAULT_BRAND_NAME = "COHAN Demo Business";
const DEFAULT_BRAND_SLUG = "cohan-demo-business";
const DEFAULT_RESTAURANT_NAME = "COHAN Defense Demo Restaurant";
const SECONDARY_RESTAURANT_NAME = "COHAN Defense Demo Restaurant - Quận 1";
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
  primaryRestaurantId,
  secondaryRestaurantId,
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
      email: "business.owner.demo@cohan.local",
      payload: {
        ...verified,
        fullName: "COHAN Demo Business Owner",
        username: "business.owner.demo",
        userType: "MANAGER",
        role: roleId("manager"),
        restaurantForStaff: primaryRestaurantId,
        refRestaurants: [primaryRestaurantId, secondaryRestaurantId],
      },
    },
    {
      model: "User",
      email: "manager.demo@cohan.local",
      payload: {
        ...verified,
        fullName: "COHAN Demo Manager - Thủ Đức",
        username: "manager.demo",
        userType: "MANAGER",
        role: roleId("manager"),
        restaurantForStaff: primaryRestaurantId,
        refRestaurants: [primaryRestaurantId],
      },
    },
    {
      model: "User",
      email: "manager.branch2.demo@cohan.local",
      payload: {
        ...verified,
        fullName: "COHAN Demo Manager - Quận 1",
        username: "manager.branch2.demo",
        userType: "MANAGER",
        role: roleId("manager"),
        restaurantForStaff: secondaryRestaurantId,
        refRestaurants: [secondaryRestaurantId],
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
        refRestaurants: [primaryRestaurantId],
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
        fullName: "COHAN Demo Server - Thủ Đức",
        username: "staff.server.demo",
        userType: "STAFF",
        role: roleId("server"),
        restaurantForStaff: primaryRestaurantId,
        refRestaurants: [primaryRestaurantId],
      },
    },
    {
      model: "User",
      email: "staff.branch2.demo@cohan.local",
      payload: {
        ...verified,
        fullName: "COHAN Demo Server - Quận 1",
        username: "staff.branch2.demo",
        userType: "STAFF",
        role: roleId("server"),
        restaurantForStaff: secondaryRestaurantId,
        refRestaurants: [secondaryRestaurantId],
      },
    },
  ];
}

export function buildDefenseBrandMembershipDefinitions({
  brandId,
  primaryRestaurantId,
  secondaryRestaurantId,
  userIdByEmail,
}) {
  const member = (email, role, restaurantIds = []) => {
    const userId = userIdByEmail.get(email);
    if (!userId) throw new Error(`Missing normalized defense account: ${email}`);
    return { brandId, userId, email, role, restaurantIds, status: "active" };
  };

  return [
    member("business.owner.demo@cohan.local", "owner"),
    member("admin.demo@cohan.local", "admin"),
    member("manager.demo@cohan.local", "manager", [primaryRestaurantId]),
    member("manager.branch2.demo@cohan.local", "manager", [secondaryRestaurantId]),
    member("staff.server.demo@cohan.local", "staff", [primaryRestaurantId]),
    member("staff.branch2.demo@cohan.local", "staff", [secondaryRestaurantId]),
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

const commonRestaurantPayload = {
  status: "active",
  businessStatus: "active",
  publicationStatus: "published",
  operationalStatus: "normal",
  timezone: "Asia/Ho_Chi_Minh",
  capabilities: {
    acceptsReservations: true,
    acceptsOrders: true,
    acceptsTableOrders: true,
    acceptsDelivery: true,
    acceptsPickup: true,
  },
};

async function resolveDefenseRestaurants() {
  const primary = await Restaurant.findOneAndUpdate(
    { name: DEFAULT_RESTAURANT_NAME },
    {
      $set: {
        ...commonRestaurantPayload,
        name: DEFAULT_RESTAURANT_NAME,
        description: `${DEFENSE_TAG} Full local dataset for graduation defense`,
        address: {
          line1: "1 Võ Văn Ngân",
          ward: "Linh Chiểu",
          district: "Thủ Đức",
          city: "TP. Hồ Chí Minh",
          country: "Việt Nam",
          lat: 10.8506,
          lng: 106.7719,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const secondary = await Restaurant.findOneAndUpdate(
    { name: SECONDARY_RESTAURANT_NAME },
    {
      $set: {
        ...commonRestaurantPayload,
        name: SECONDARY_RESTAURANT_NAME,
        description: `${DEFENSE_TAG} Secondary branch for Brand and scope demonstration`,
        address: {
          line1: "12 Nguyễn Huệ",
          ward: "Bến Nghé",
          district: "Quận 1",
          city: "TP. Hồ Chí Minh",
          country: "Việt Nam",
          lat: 10.7736,
          lng: 106.7032,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { primary, secondary };
}

async function normalizeDefenseAccounts(primaryRestaurantId, secondaryRestaurantId) {
  const roles = await Role.find({
    slug: { $in: ["admin", "manager", "customer", "server"] },
  }).select("_id slug");
  const roleBySlug = new Map(roles.map((role) => [role.slug, role]));
  const passwordHash = await bcrypt.hash(getDemoPassword(), 10);
  const definitions = buildDefenseAccountDefinitions({
    primaryRestaurantId,
    secondaryRestaurantId,
    roleBySlug,
    passwordHash,
  });
  const accounts = [];

  for (const account of definitions) {
    const Model = account.model === "Customer" ? Customer : User;
    const document = await Model.findOneAndUpdate(
      { email: account.email },
      { $set: { email: account.email, ...account.payload } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    accounts.push({ ...account, userId: document._id });
  }

  return accounts;
}

async function normalizeDefenseBrand({ primary, secondary, accounts }) {
  const userIdByEmail = new Map(accounts.map((account) => [account.email, account.userId]));
  const ownerId = userIdByEmail.get("business.owner.demo@cohan.local");
  const brand = await Brand.findOneAndUpdate(
    { slug: DEFAULT_BRAND_SLUG },
    {
      $set: {
        name: DEFAULT_BRAND_NAME,
        slug: DEFAULT_BRAND_SLUG,
        description: `${DEFENSE_TAG} Business with two demo restaurant branches`,
        ownerId,
        businessName: "COHAN Restaurant Business",
        businessTaxCode: "DEMO-COHAN-2026",
        businessEmail: "business.owner.demo@cohan.local",
        businessPhone: "0900002026",
        address: primary.address,
        status: "active",
        deletedAt: null,
        deletedBy: null,
        updatedBy: ownerId,
      },
      $setOnInsert: { createdBy: ownerId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await Restaurant.updateMany(
    { _id: { $in: [primary._id, secondary._id] } },
    { $set: { brandId: brand._id } },
  );

  const memberships = buildDefenseBrandMembershipDefinitions({
    brandId: brand._id,
    primaryRestaurantId: primary._id,
    secondaryRestaurantId: secondary._id,
    userIdByEmail,
  });

  for (const membership of memberships) {
    await BrandMembership.findOneAndUpdate(
      { brandId: membership.brandId, userId: membership.userId },
      {
        $set: {
          role: membership.role,
          restaurantIds: membership.restaurantIds,
          status: membership.status,
          updatedBy: ownerId,
        },
        $setOnInsert: { createdBy: ownerId, invitedBy: ownerId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  return { brand, memberships };
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
  const { primary, secondary } = await resolveDefenseRestaurants();
  const primaryRestaurantId = String(primary._id);
  await mongoose.disconnect();

  // Full operational data is seeded once for the primary branch. The second
  // branch exists for Brand, membership and restaurant-scope demonstrations.
  for (const step of buildSeedSteps({ restaurantId: primaryRestaurantId, reset })) {
    runSeedStep(step);
  }

  await mongoose.connect(mongoUri, { dbName });
  const accounts = await normalizeDefenseAccounts(primary._id, secondary._id);
  const { brand } = await normalizeDefenseBrand({ primary, secondary, accounts });
  await mongoose.disconnect();

  console.log("\n✅ COHAN defense dataset is ready");
  console.log(`Brand: ${DEFAULT_BRAND_NAME} (${brand._id})`);
  console.log(`Primary/full data: ${DEFAULT_RESTAURANT_NAME} (${primaryRestaurantId})`);
  console.log(`Secondary/Brand demo: ${SECONDARY_RESTAURANT_NAME} (${secondary._id})`);
  console.table(
    accounts.map(({ email, payload }) => ({
      email,
      role: payload.userType,
      username: payload.username,
      restaurantIds: (payload.refRestaurants || []).map(String).join(", "),
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
