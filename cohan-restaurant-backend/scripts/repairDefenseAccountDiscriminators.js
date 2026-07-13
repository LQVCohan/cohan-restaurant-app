import "dotenv/config.js";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { User } from "../models/index.js";
import {
  assertDemoScriptAllowed,
  safeDbInfo,
} from "./lib/scriptSafety.js";

const scriptPath = fileURLToPath(import.meta.url);
const DEFENSE_EMAIL_PATTERN = /\.demo@cohan\.local$/i;

const EXACT_ACCOUNT_TYPES = new Map([
  ["admin.demo@cohan.local", "ADMIN"],
  ["business.owner.demo@cohan.local", "MANAGER"],
  ["manager.demo@cohan.local", "MANAGER"],
  ["manager.branch2.demo@cohan.local", "MANAGER"],
  ["hr.demo@cohan.local", "HR"],
  ["accountant.demo@cohan.local", "ACCOUNTANT"],
  ["customer.demo@cohan.local", "CUSTOMER"],
]);

const CUSTOMER_ONLY_FIELDS = {
  loyaltyPoints: "",
  customerType: "",
  totalOrders: "",
  totalSpending: "",
  isGuest: "",
  guestExpiresAt: "",
  guestLastSeenAt: "",
  registeredAt: "",
  customerRestaurants: "",
  archivedRestaurants: "",
  customerNotes: "",
  foodPreferences: "",
};

export function expectedDefenseUserType(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (EXACT_ACCOUNT_TYPES.has(normalized)) {
    return EXACT_ACCOUNT_TYPES.get(normalized);
  }
  if (/^staff\..+\.demo@cohan\.local$/.test(normalized)) return "STAFF";
  return null;
}

export function buildDefenseAccountTypeRepair(document) {
  const expectedUserType = expectedDefenseUserType(document?.email);
  if (!expectedUserType) return null;

  const update = { $set: { userType: expectedUserType } };
  if (expectedUserType !== "CUSTOMER") {
    update.$unset = { ...CUSTOMER_ONLY_FIELDS };
  }
  return update;
}

export async function repairDefenseAccountDiscriminators() {
  const accounts = await User.collection
    .find({ email: DEFENSE_EMAIL_PATTERN })
    .project({ _id: 1, email: 1, fullName: 1, userType: 1 })
    .toArray();

  const repaired = [];
  for (const account of accounts) {
    const update = buildDefenseAccountTypeRepair(account);
    if (!update) continue;

    const expectedUserType = update.$set.userType;
    await User.collection.updateOne({ _id: account._id }, update);
    repaired.push({
      email: account.email,
      fullName: account.fullName,
      previousUserType: account.userType,
      userType: expectedUserType,
    });
  }

  const invalid = await User.collection
    .find({
      email: { $in: repaired.map((item) => item.email) },
      $or: repaired.map((item) => ({
        email: item.email,
        userType: { $ne: item.userType },
      })),
    })
    .project({ email: 1, userType: 1 })
    .toArray();

  if (invalid.length) {
    throw new Error(
      `DEFENSE_ACCOUNT_TYPE_REPAIR_FAILED: ${invalid
        .map((item) => `${item.email}:${item.userType}`)
        .join(", ")}`,
    );
  }

  return repaired;
}

async function main() {
  assertDemoScriptAllowed("repairDefenseAccountDiscriminators.js");
  const mongoUri =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB";
  const dbName = process.env.MONGO_DB || "RestaurantDB";

  console.log("Repairing defense account discriminator types:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });
  const repaired = await repairDefenseAccountDiscriminators();
  await mongoose.disconnect();

  console.log(`Defense account types normalized: ${repaired.length}`);
  console.table(repaired);
}

if (path.resolve(process.argv[1] || "") === scriptPath) {
  main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}
