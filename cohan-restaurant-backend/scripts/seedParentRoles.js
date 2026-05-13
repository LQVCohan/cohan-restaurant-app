import mongoose from "mongoose";
import process from "process";
import dotenv from "dotenv";
import { ParentRole, Permission } from "../models/index.js";

dotenv.config();
await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });

const parentRoleMatrix = {
  admin: { name: "Admin", permissions: ["*"] },
  manager: {
    name: "Manager",
    permissions: [
      "restaurant.read", "menu.read", "menu.write", "order.read", "order.create",
      "order.update", "order.cancel", "payment.read", "staff.read", "staff.write",
      "shift.read", "shift.manage", "table.read", "report.read", "dashboard.read",
      "role.read", "permission.read",
    ],
  },
  hr: { name: "HR", permissions: ["staff.read", "shift.read", "report.read"] },
  accountant: { name: "Accountant", permissions: ["payment.read", "report.read", "report.export"] },
  staff: { name: "Staff", permissions: [] },
  customer: {
    name: "Customer",
    permissions: [
      "profile.update", "address.read", "address.write", "cart.read", "cart.write",
      "reservation.create", "review.create", "notification.read",
    ],
  },
};

async function permissionIdsFor(codes) {
  if (codes.includes("*")) return (await Permission.find({}).select("_id").lean()).map((p) => p._id);
  return (await Permission.find({ code: { $in: codes } }).select("_id").lean()).map((p) => p._id);
}

async function run() {
  for (const [slug, config] of Object.entries(parentRoleMatrix)) {
    const permissions = await permissionIdsFor(config.permissions);
    await ParentRole.findOneAndUpdate(
      { slug },
      { $set: { name: config.name, slug, description: `${config.name} parent role`, permissions } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(`✓ parentRole: ${slug}`);
  }
  await mongoose.disconnect();
  console.log("🏁 Done ParentRole");
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
