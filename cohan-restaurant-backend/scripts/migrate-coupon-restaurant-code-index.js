import "dotenv/config";
import mongoose from "mongoose";
import { Coupon } from "../models/index.js";

const mongoUri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  process.env.DB_URI;

async function indexExists(collection, indexName) {
  const indexes = await collection.indexes();
  return indexes.some((index) => index.name === indexName);
}

async function migrateCouponRestaurantCodeIndex() {
  if (!mongoUri) {
    throw new Error("Missing MongoDB connection string. Set MONGO_URI or MONGODB_URI.");
  }

  await mongoose.connect(mongoUri);

  const collection = Coupon.collection;

  if (await indexExists(collection, "code_1")) {
    await collection.dropIndex("code_1");
    console.log("Dropped legacy global coupon code index: code_1");
  } else {
    console.log("Legacy global coupon code index code_1 not found; skipping drop.");
  }

  await collection.createIndex(
    { restaurantId: 1, code: 1 },
    { unique: true, name: "restaurantId_1_code_1" },
  );
  console.log("Ensured scoped unique coupon index: restaurantId_1_code_1");
}

migrateCouponRestaurantCodeIndex()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
