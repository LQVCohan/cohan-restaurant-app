import "dotenv/config.js";
import mongoose from "mongoose";
import { Menu } from "../models/index.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "cohan";
const APPLY = process.argv.includes("--apply");

const isLegacyUniqueSlotIndex = (index) =>
  index?.unique === true &&
  Object.keys(index.key || {}).length === 2 &&
  index.key?.restaurantId === 1 &&
  index.key?.timeSlot === 1;

const readIndexes = async (collection) => {
  try {
    return await collection.indexes();
  } catch (error) {
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") return [];
    throw error;
  }
};

export async function migrateMenuMultiSlotIndexes({
  apply = APPLY,
  collection = Menu.collection,
  logger = console,
} = {}) {
  const indexes = await readIndexes(collection);
  const legacyIndexes = indexes.filter(isLegacyUniqueSlotIndex);
  const targetName = "restaurantId_1_timeSlot_1_isActive_1";
  const targetExists = indexes.some((index) => index.name === targetName);

  const report = {
    apply,
    legacyIndexes: legacyIndexes.map((index) => index.name),
    targetExists,
    dropped: [],
    created: false,
  };

  if (!apply) {
    logger.log(JSON.stringify(report, null, 2));
    return report;
  }

  for (const index of legacyIndexes) {
    await collection.dropIndex(index.name);
    report.dropped.push(index.name);
  }

  if (!targetExists) {
    await collection.createIndex(
      { restaurantId: 1, timeSlot: 1, isActive: 1 },
      { name: targetName },
    );
    report.created = true;
  }

  logger.log(JSON.stringify(report, null, 2));
  return report;
}

const isDirectRun = process.argv[1]?.endsWith("migrateMenuMultiSlotIndexes.js");
if (isDirectRun) {
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  try {
    await migrateMenuMultiSlotIndexes();
  } finally {
    await mongoose.disconnect();
  }
}
