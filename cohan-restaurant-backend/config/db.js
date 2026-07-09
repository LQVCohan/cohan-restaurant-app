// src/config/db.js
import mongoose from "mongoose";
import process from "process";

function shouldRetryWrites() {
  const value = process.env.MONGO_RETRY_WRITES;
  if (value === undefined || value === null || String(value).trim() === "") return false;
  return String(value).trim().toLowerCase() === "true";
}

export async function connectDB() {
  const explicitDbName = process.env.MONGO_DB?.trim();
  const connectOptions = {
    ...(explicitDbName ? { dbName: explicitDbName } : {}),
    // Standalone MongoDB rejects retryable writes with: Transaction numbers are only allowed on a replica set member or mongos.
    retryWrites: shouldRetryWrites(),
  };

  await mongoose.connect(process.env.MONGO_URI, connectOptions);

  const activeDbName = mongoose.connection?.db?.databaseName || "unknown";
  console.log(`✅ MongoDB connected (db: ${activeDbName})`);
}
