/**
 * Usage:
 * node scripts/cleanupStaffFields.js --dry-run
 * node scripts/cleanupStaffFields.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../../models/index.js";
import process from "process";
dotenv.config();
const dryRun = process.argv.includes("--dry-run");
let modifiedCount = 0;
async function run() {
  if (!process.env.MONGO_URI)
    throw new Error("Missing MONGO_URI in environment");

  const explicitDbName = process.env.MONGO_DB?.trim();
  const connectOptions = explicitDbName ? { dbName: explicitDbName } : {};

  await mongoose.connect(process.env.MONGO_URI, connectOptions);

  const activeDbName =
    mongoose.connection?.db?.databaseName || mongoose.connection?.name;

  if (explicitDbName && activeDbName !== explicitDbName) {
    throw new Error(
      `Connected to wrong database. Expected ${explicitDbName}, got ${activeDbName}`,
    );
  }

  console.log({
    configuredDb: explicitDbName || null,
    connectedDb: activeDbName,
    userCollection: User.collection.name,
    totalUsers: await User.countDocuments(),
  });
  const staffList = await User.find({ userType: "STAFF" })
    .select(
      "_id userType employeeCode restaurantForStaff primaryRestaurant refRestaurants rate rateCount baseSalary gender maritalStatus contractType salaryType trainingStatus",
    )
    .lean();

  const scopeMap = new Map();
  const duplicateEmployeeCodeScopes = [];
  let migratedRestaurantForStaffCount = 0;
  let unsetPrimaryRestaurantCount = 0;
  let unsetRefRestaurantsCount = 0;
  let unsetRateCount = 0;
  const missingRestaurantForStaffIds = [];
  const defaultedFieldCounts = {
    baseSalary: 0,
    gender: 0,
    maritalStatus: 0,
    contractType: 0,
    salaryType: 0,
    trainingStatus: 0,
  };

  for (const s of staffList) {
    if (s.employeeCode) {
      const scope = String(
        s.restaurantForStaff || s.primaryRestaurant || "missing",
      );
      const key = `${scope}::${s.employeeCode}`;
      if (scopeMap.has(key))
        duplicateEmployeeCodeScopes.push([scopeMap.get(key), String(s._id)]);
      else scopeMap.set(key, String(s._id));
    }

    const set = {};
    const unset = {};
    if (!s.restaurantForStaff && s.primaryRestaurant) {
      set.restaurantForStaff = s.primaryRestaurant;
      migratedRestaurantForStaffCount += 1;
    }
    if (!s.restaurantForStaff && !s.primaryRestaurant)
      missingRestaurantForStaffIds.push(String(s._id));
    if (s.primaryRestaurant) {
      unset.primaryRestaurant = 1;
      unsetPrimaryRestaurantCount += 1;
    }
    if (Array.isArray(s.refRestaurants) && s.refRestaurants.length) {
      unset.refRestaurants = 1;
      unsetRefRestaurantsCount += 1;
    }
    if (s.rate != null || s.rateCount != null) {
      unset.rate = 1;
      unset.rateCount = 1;
      unsetRateCount += 1;
    }

    const defaults = {
      baseSalary: 0,
      gender: "unspecified",
      maritalStatus: "unspecified",
      contractType: "none",
      salaryType: "monthly",
      trainingStatus: "not_started",
    };
    for (const [k, v] of Object.entries(defaults))
      if (s[k] == null) {
        set[k] = v;
        defaultedFieldCounts[k] += 1;
      }

    if (!dryRun && (Object.keys(set).length || Object.keys(unset).length)) {
      const update = {};

      if (Object.keys(set).length) {
        update.$set = set;
      }

      if (Object.keys(unset).length) {
        update.$unset = unset;
      }

      const result = await User.collection.updateOne({ _id: s._id }, update);

      modifiedCount += result.modifiedCount || 0;
    }
  }

  console.log({
    modifiedCount,
    dryRun,
    scannedCount: staffList.length,
    migratedRestaurantForStaffCount,
    unsetPrimaryRestaurantCount,
    unsetRefRestaurantsCount,
    unsetRateCount,
    defaultedFieldCounts,
    duplicateEmployeeCodeScopes,
    missingRestaurantForStaffCount: missingRestaurantForStaffIds.length,
    missingRestaurantForStaffIds,
  });
  await mongoose.disconnect();
}
run().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
