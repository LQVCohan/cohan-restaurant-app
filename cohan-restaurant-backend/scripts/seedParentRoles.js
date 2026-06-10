import mongoose from "mongoose";
import process from "process";
import dotenv from "dotenv";
import { ParentRole, Permission } from "../models/index.js";

dotenv.config();
await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });

const MENU_MANAGEMENT_PERMISSIONS = [
  "menu.read",
  "menu.write",
  "menu.create",
  "menu.update",
  "menu.delete",
  "menu.copy",
  "menu.item.create",
  "menu.item.update",
  "menu.item.delete",
  "menu.price.update",
  "menu.category.manage",
  "menu.group.manage",
  "menu.inventory.sync",
  "menu.audit.read",
];

const parentRoleMatrix = {
  admin: { name: "Admin", permissions: ["*"] },
  manager: {
    name: "Manager",
    permissions: [
      "system.manage", "backup.read", "backup.write", "backup.export", "backup.import",
      "restaurant.read", "restaurant.write", ...MENU_MANAGEMENT_PERMISSIONS,
      "order.read", "order.create", "order.update", "order.cancel",
      "payment.read", "payment.write", "staff.read", "staff.write",
      "customer.read", "customer.update",
      "shift.read", "shift.manage", "table.read", "table.write",
      "report.read", "report.export", "dashboard.read",
      "inventory.read", "inventory.write", "stock.read", "stock.write",
      "reservation.read", "reservation.update", "reservation.cancel",
      "promotion.read", "promotion.write", "coupon.read", "coupon.write",
      "role.read", "permission.read", "log.read",
    ],
  },
  hr: { name: "HR", permissions: ["staff.read", "shift.read", "report.read", "attendance.read", "performance.read"] },
  accountant: { name: "Accountant", permissions: ["payment.read", "report.read", "report.export", "payroll.read"] },
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
