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
  { name: "HR", slug: "hr" },
  { name: "Accountant", slug: "accountant" },
  { name: "Customer", slug: "customer" },
  { name: "Staff", slug: "staff" },
];

async function run() {
  for (const r of parentRoles) {
    const exists = await ParentRole.findOne({ slug: r.slug }).lean();
    await ParentRole.findOneAndUpdate(
      { slug: r.slug },
      { $set: { name: r.name, slug: r.slug } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(`${exists ? "Updated" : "Created"} ParentRole: ${r.slug}`);
  }

  await mongoose.disconnect();
  console.log("🏁 Done ParentRole");
}

run().catch(console.error);
