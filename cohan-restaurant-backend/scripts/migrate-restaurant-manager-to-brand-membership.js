import "dotenv/config.js";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { BrandMembership, Restaurant } from "../models/index.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "foodhub";

const emptyReport = () => ({ created: 0, updated: 0, skippedNoBrandId: 0, skippedNoManagerId: 0, conflicts: [] });
const id = (value) => String(value?._id || value?.id || value || "");

export async function migrateRestaurantManagersToBrandMembership({ dryRun = true, dbName = DB_NAME, models = { Restaurant, BrandMembership }, logger = console } = {}) {
  logger.log(`Using database ${dbName}${process.env.MONGO_DB ? "" : " (default; MONGO_DB not set)"}`);
  const report = emptyReport();
  const restaurants = await models.Restaurant.find({}).select("_id brandId managerId name").lean();

  for (const restaurant of restaurants) {
    if (!restaurant.brandId) { report.skippedNoBrandId += 1; continue; }
    if (!restaurant.managerId) { report.skippedNoManagerId += 1; continue; }

    const existingForRestaurant = await models.BrandMembership.findOne({
      brandId: restaurant.brandId,
      role: "manager",
      status: "active",
      restaurantIds: restaurant._id,
    }).lean();

    if (existingForRestaurant && id(existingForRestaurant.userId) !== id(restaurant.managerId)) {
      report.conflicts.push({ restaurantId: id(restaurant._id), brandId: id(restaurant.brandId), legacyManagerId: id(restaurant.managerId), existingManagerId: id(existingForRestaurant.userId) });
      continue;
    }

    const existingForUser = await models.BrandMembership.findOne({
      brandId: restaurant.brandId,
      userId: restaurant.managerId,
    }).lean();

    if (!dryRun) {
      await models.BrandMembership.updateOne(
        { brandId: restaurant.brandId, userId: restaurant.managerId },
        { $set: { role: "manager", status: "active", restaurantIds: [restaurant._id] }, $setOnInsert: { createdBy: restaurant.managerId } },
        { upsert: true },
      );
    }
    if (existingForUser) report.updated += 1;
    else report.created += 1;
  }

  logger.log(JSON.stringify({ dryRun, ...report }, null, 2));
  return report;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  if (!dryRun && process.env.NODE_ENV === "production" && !process.argv.includes("--allow-production")) {
    throw new Error("Refusing to run in production without --allow-production.");
  }
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  try {
    await migrateRestaurantManagersToBrandMembership({ dryRun, dbName: DB_NAME });
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
