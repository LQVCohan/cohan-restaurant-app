/**
 * Normalize refRestaurants as CUSTOMER recent restaurant history only.
 * Usage:
 *   node scripts/migration/normalizeRefRestaurantsRecentHistory.js --dry-run
 *   node scripts/migration/normalizeRefRestaurantsRecentHistory.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Customer, Order, Reservation, Restaurant, User } from "../../models/index.js";

dotenv.config();
const dryRun = process.argv.includes("--dry-run");
const LIMIT = 12;
const uniq = (ids = []) => [...new Set(ids.map(String).filter(mongoose.isValidObjectId))];

async function run() {
  if (!process.env.MONGO_URI) throw new Error("Missing MONGO_URI");
  const dbName = process.env.MONGO_DB?.trim();
  await mongoose.connect(process.env.MONGO_URI, dbName ? { dbName } : {});
  const connectedDb = mongoose.connection?.db?.databaseName || mongoose.connection?.name;
  if (dbName && connectedDb !== dbName) throw new Error(`Connected to wrong database. Expected ${dbName}, got ${connectedDb}`);

  const restaurants = await Restaurant.find({}).select("_id").lean();
  const existingRestaurants = new Set(restaurants.map((r) => String(r._id)));
  const customers = await Customer.find({}).select("_id userType refRestaurants customerRestaurants archivedRestaurants isGuest").lean();
  const nonCustomersWithRefs = await User.find({ userType: { $ne: "CUSTOMER" }, refRestaurants: { $exists: true, $ne: [] } }).select("_id").lean();

  const stats = { nonCustomerUnset: nonCustomersWithRefs.length, customersScanned: customers.length, customersChanged: 0, copiedMembership: 0, removedArchived: 0, removedMissing: 0, deduped: 0, rebuiltRecent: 0, fallbackRecent: 0 };

  if (!dryRun && nonCustomersWithRefs.length) {
    await User.updateMany({ _id: { $in: nonCustomersWithRefs.map((u) => u._id) } }, { $unset: { refRestaurants: 1 } });
  }

  for (const customer of customers) {
    const oldRefsRaw = (customer.refRestaurants || []).map(String);
    const oldRefs = uniq(oldRefsRaw).filter((id) => existingRestaurants.has(id));
    stats.deduped += Math.max(0, oldRefsRaw.length - uniq(oldRefsRaw).length);
    stats.removedMissing += uniq(oldRefsRaw).filter((id) => !existingRestaurants.has(id)).length;

    const archived = new Set((customer.archivedRestaurants || []).map((a) => String(a.restaurantId)).filter(Boolean));
    const currentMembership = uniq(customer.customerRestaurants || []).filter((id) => existingRestaurants.has(id));
    const membership = uniq([...currentMembership, ...oldRefs]).filter((id) => !archived.has(id));
    stats.removedArchived += uniq([...currentMembership, ...oldRefs]).length - membership.length;
    if (oldRefs.length) stats.copiedMembership += 1;

    const tx = [];
    const [orders, reservations] = await Promise.all([
      Order.find({ userId: customer._id, restaurantId: { $exists: true, $ne: null } }).select("restaurantId createdAt").sort({ createdAt: -1 }).limit(50).lean(),
      Reservation.find({ userId: customer._id, restaurantId: { $exists: true, $ne: null } }).select("restaurantId createdAt timeTo").sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    orders.forEach((o) => tx.push({ id: String(o.restaurantId), at: new Date(o.createdAt || 0).getTime() }));
    reservations.forEach((r) => tx.push({ id: String(r.restaurantId), at: new Date(r.createdAt || r.timeTo || 0).getTime() }));
    const recent = uniq(tx.filter((item) => existingRestaurants.has(item.id)).sort((a, b) => b.at - a.at).map((item) => item.id)).slice(0, LIMIT);
    const nextRefs = recent.length ? recent : oldRefs.slice(0, LIMIT);
    if (recent.length) stats.rebuiltRecent += 1;
    else if (nextRefs.length) stats.fallbackRecent += 1;

    const sameRefs = oldRefsRaw.slice(0, LIMIT).join(",") === nextRefs.join(",");
    const sameMembership = currentMembership.join(",") === membership.join(",");
    if (!sameRefs || !sameMembership) {
      stats.customersChanged += 1;
      if (!dryRun) {
        await Customer.updateOne({ _id: customer._id }, { $set: { refRestaurants: nextRefs, customerRestaurants: membership } });
      }
    }
  }

  console.log({ dryRun, database: connectedDb, collection: User.collection.name, scanned: customers.length + nonCustomersWithRefs.length, willModify: stats.customersChanged + stats.nonCustomerUnset, stats });
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
