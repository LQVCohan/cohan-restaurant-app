// src/config/db.js
import mongoose from "mongoose";
import process from "process";
export async function connectDB() {
  const explicitDbName = process.env.MONGO_DB?.trim();
  const connectOptions = explicitDbName ? { dbName: explicitDbName } : {};

  await mongoose.connect(process.env.MONGO_URI, connectOptions);

  const activeDbName = mongoose.connection?.db?.databaseName || "unknown";
  console.log(`✅ MongoDB connected (db: ${activeDbName})`);
}
