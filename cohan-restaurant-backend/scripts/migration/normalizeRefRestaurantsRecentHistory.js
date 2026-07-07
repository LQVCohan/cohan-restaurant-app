/**
 * Normalize refRestaurants as CUSTOMER recent restaurant history only.
 * Usage:
 *   node scripts/migration/normalizeRefRestaurantsRecentHistory.js --dry-run
 *   node scripts/migration/normalizeRefRestaurantsRecentHistory.js --apply
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Customer, Order, Reservation, Restaurant, User } from "../../models/index.js";

dotenv.config();
const applyMode = process.argv.includes("--apply");
const dryRun = !applyMode || process.argv.includes("--dry-run");

export function assertApplyDatabaseName({ apply = applyMode, dbName = process.env.MONGO_DB?.trim() } = {}) {
  if (apply && !dbName) throw new Error("MONGO_DB is required when using --apply");
}
const LIMIT = 12;
const toId = (value) => String(value?._id || value || "");
const isValidId = (id) => mongoose.isValidObjectId(String(id));

export function normalizeIdList(raw = [], existingRestaurants = new Set(), stats = null) {
  const out = [];
  const seen = new Set();
  for (const value of raw || []) {
    const id = toId(value);
    if (!isValidId(id) || !existingRestaurants.has(id)) {
      if (stats) stats.removedMissing += 1;
      continue;
    }
    if (seen.has(id)) {
      if (stats) stats.removedDuplicate += 1;
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}


export function mergeCleanIdLists(primary = [], fallback = [], stats = null) {
  const out = [];
  const seen = new Set();
  for (const id of [...primary, ...fallback]) {
    const key = String(id);
    if (seen.has(key)) {
      if (stats) stats.removedDuplicate += 1;
      continue;
    }
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function buildCustomerMigrationUpdate(customer, existingRestaurants, transactionMap, stats = null) {
  const localStats = stats || { removedDuplicate: 0, removedMissing: 0, removedArchived: 0, rebuiltRecent: 0, fallbackRecent: 0 };
  const rawRefs = (customer.refRestaurants || []).map(toId);
  const rawMembership = (customer.customerRestaurants || []).map(toId);
  const archived = new Set((customer.archivedRestaurants || []).map((item) => toId(item.restaurantId)).filter(Boolean));

  const cleanLegacyRefs = normalizeIdList(rawRefs, existingRestaurants, localStats);
  const cleanMembership = normalizeIdList(rawMembership, existingRestaurants, localStats);
  const mergedMembership = mergeCleanIdLists(cleanMembership, cleanLegacyRefs, localStats).filter((id) => {
    const archivedOut = archived.has(id);
    if (archivedOut) localStats.removedArchived += 1;
    return !archivedOut;
  });

  const txRecent = normalizeIdList(transactionMap.get(toId(customer._id)) || [], existingRestaurants, localStats).slice(0, LIMIT);
  const nextRefs = (txRecent.length ? txRecent : cleanLegacyRefs).slice(0, LIMIT);
  if (txRecent.length) localStats.rebuiltRecent += 1;
  else if (nextRefs.length) localStats.fallbackRecent += 1;

  const refsChanged = rawRefs.length !== nextRefs.length || rawRefs.some((id, index) => id !== nextRefs[index]);
  const membershipChanged = rawMembership.length !== mergedMembership.length || rawMembership.some((id, index) => id !== mergedMembership[index]);
  return { changed: refsChanged || membershipChanged, nextRefs, customerRestaurants: mergedMembership };
}

async function buildTransactionMap(customerIds) {
  const ids = customerIds.map((id) => new mongoose.Types.ObjectId(id));
  const [orders, reservations] = await Promise.all([
    Order.aggregate([
      { $match: { userId: { $in: ids }, restaurantId: { $exists: true, $ne: null } } },
      { $sort: { createdAt: -1 } },
      { $project: { userId: 1, restaurantId: 1, at: "$createdAt" } },
    ]),
    Reservation.aggregate([
      { $match: { userId: { $in: ids }, restaurantId: { $exists: true, $ne: null } } },
      { $sort: { createdAt: -1 } },
      { $project: { userId: 1, restaurantId: 1, at: { $ifNull: ["$createdAt", "$timeTo"] } } },
    ]),
  ]);
  const rows = [...orders, ...reservations].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  const map = new Map();
  for (const row of rows) {
    const uid = toId(row.userId);
    const rid = toId(row.restaurantId);
    if (!map.has(uid)) map.set(uid, []);
    if (!map.get(uid).includes(rid)) map.get(uid).push(rid);
  }
  return map;
}

async function run() {
  if (!process.env.MONGO_URI) throw new Error("Missing MONGO_URI");
  const dbName = process.env.MONGO_DB?.trim();
  assertApplyDatabaseName({ apply: applyMode, dbName });
  await mongoose.connect(process.env.MONGO_URI, dbName ? { dbName } : {});
  const connectedDb = mongoose.connection?.db?.databaseName || mongoose.connection?.name;
  if (dbName && connectedDb !== dbName) throw new Error(`Connected to wrong database. Expected ${dbName}, got ${connectedDb}`);

  const restaurants = await Restaurant.find({}).select("_id").lean();
  const existingRestaurants = new Set(restaurants.map((r) => toId(r._id)));
  const customers = await Customer.find({}).select("_id refRestaurants customerRestaurants archivedRestaurants").lean();
  const nonCustomersWithRefs = await User.find({ userType: { $ne: "CUSTOMER" }, refRestaurants: { $exists: true, $ne: [] } }).select("_id").lean();
  const transactionMap = await buildTransactionMap(customers.map((c) => toId(c._id)));

  const stats = { nonCustomerUnset: nonCustomersWithRefs.length, customersScanned: customers.length, customersChanged: 0, removedDuplicate: 0, removedMissing: 0, removedArchived: 0, rebuiltRecent: 0, fallbackRecent: 0 };

  if (!dryRun && nonCustomersWithRefs.length) {
    await User.updateMany({ _id: { $in: nonCustomersWithRefs.map((u) => u._id) } }, { $unset: { refRestaurants: 1 } });
  }

  for (const customer of customers) {
    const update = buildCustomerMigrationUpdate(customer, existingRestaurants, transactionMap, stats);
    if (!update.changed) continue;
    stats.customersChanged += 1;
    if (!dryRun) {
      await Customer.updateOne(
        { _id: customer._id },
        { $set: { refRestaurants: update.nextRefs, customerRestaurants: update.customerRestaurants } },
      );
    }
  }

  console.log({
    dryRun,
    database: connectedDb,
    collection: User.collection.name,
    usersScanned: customers.length + nonCustomersWithRefs.length,
    customersScanned: customers.length,
    willModify: stats.customersChanged + stats.nonCustomerUnset,
    stats,
  });
  await mongoose.disconnect();
}

function normalizeEntrypointPath(value) {
  return path.resolve(String(value || "").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1:"));
}

export function isMainModulePath(argvPath = process.argv[1], moduleUrl = import.meta.url) {
  if (!argvPath) return false;
  return normalizeEntrypointPath(argvPath) === normalizeEntrypointPath(fileURLToPath(moduleUrl));
}

export { run };

if (isMainModulePath()) {
  run().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
}
