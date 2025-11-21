// scripts/seedParentRoles.js
import mongoose from "mongoose";
import { ParentRole, Permission } from "../models/index.js";
import process from "process";
import dotenv from "dotenv";
dotenv.config();
await mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB,
});
const parentRoles = [
  { name: "Admin", slug: "admin" },
  { name: "Manager", slug: "manager" },
  { name: "Staff", slug: "staff" },
];

async function run() {
  for (const r of parentRoles) {
    const exists = await ParentRole.findOne({ slug: r.slug }).lean();
    if (!exists) {
      await ParentRole.create(r);
      console.log(`+ Created ParentRole: ${r.slug}`);
    } else {
      console.log(`= Skipped ParentRole (exists): ${r.slug}`);
    }
  }

  await mongoose.disconnect();
  console.log("🏁 Done ParentRole");
}

run().catch(console.error);
