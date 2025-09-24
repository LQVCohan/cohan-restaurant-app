// src/config/db.js
import mongoose from "mongoose";
import process from "process";
export async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB || "RestaurantDB",
  });
  console.log("✅ MongoDB connected");
}
