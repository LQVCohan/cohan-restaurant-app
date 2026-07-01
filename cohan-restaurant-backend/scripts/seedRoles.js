import mongoose from "mongoose";
import process from "process";
import dotenv from "dotenv";
import { Role, ParentRole, Permission } from "../models/index.js";

dotenv.config();
await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB });

const MENU_MANAGER_PERMISSIONS = [
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

const MANAGER_PERMISSIONS = [
  ...MENU_MANAGER_PERMISSIONS,
  "dashboard.read",
  "restaurant.read",
  "restaurant.write",
  "report.read",
  "staff.read",
  "shift.read",
  "shift.manage",
  "attendance.read",
  "order.read",
  "order.create",
  "order.update",
  "order.write",
  "order.cancel",
  "table.read",
  "table.write",
  "reservation.read",
  "reservation.create",
  "reservation.update",
  "reservation.cancel",
  "customer.read",
  "inventory.read",
  "inventory.write",
  "payment.read",
  "finance.read",
  "transaction.read",
  "ai.chatbot.read",
  "ai.chatbot.write",
  "ai.chatbot.handoff",
  "ai.chatbot.analytics.read",
];

const roles = [
  { name: "Admin", slug: "admin", parentRole: "admin", isSystem: true, permissions: [] },
  { name: "Manager", slug: "manager", parentRole: "manager", isSystem: true, permissions: MANAGER_PERMISSIONS },
  { name: "HR", slug: "hr", parentRole: "hr", isSystem: true, permissions: [] },
  { name: "Accountant", slug: "accountant", parentRole: "accountant", isSystem: true, permissions: [] },
  { name: "Customer", slug: "customer", parentRole: "customer", isSystem: true, permissions: [] },
  { name: "Staff", slug: "staff", parentRole: "staff", isSystem: true, permissions: [] },
  { name: "Server", slug: "server", parentRole: "staff", department: "service", permissions: ["menu.read", "order.read", "order.create", "order.update", "table.read"] },
  { name: "Supervisor", slug: "supervisor", parentRole: "staff", department: "service", permissions: ["menu.read", "menu.item.update", "menu.price.update", "menu.audit.read", "order.read", "order.create", "order.update", "order.cancel", "table.read", "table.write", "staff.read", "shift.read"] },
  { name: "Host", slug: "host", parentRole: "staff", department: "service", permissions: ["menu.read", "reservation.read", "reservation.update", "table.read"] },
  { name: "Cashier", slug: "cashier", parentRole: "staff", department: "cashier", permissions: ["menu.read", "order.read", "payment.read", "payment.write", "table.read"] },
  { name: "Chef", slug: "chef", parentRole: "staff", department: "kitchen", permissions: ["menu.read", "menu.item.update", "kitchen.read", "kitchen.write", "order.read", "order.update"] },
  { name: "Cook", slug: "cook", parentRole: "staff", department: "kitchen", permissions: ["menu.read", "menu.item.update", "kitchen.read", "kitchen.write", "order.read", "order.update"] },
  { name: "Kitchen Helper", slug: "kitchen_helper", parentRole: "staff", department: "kitchen", permissions: ["menu.read", "kitchen.read", "kitchen.write", "order.read", "order.update"] },
  { name: "Cleaner", slug: "cleaner", parentRole: "staff", department: "cleaning", permissions: ["cleaning.read"] },
  { name: "Shipper", slug: "shipper", parentRole: "staff", department: "delivery", permissions: ["delivery.read", "delivery.update"] },
  { name: "Storekeeper", slug: "storekeeper", parentRole: "staff", department: "inventory", permissions: ["menu.read", "menu.inventory.sync", "inventory.read", "inventory.write", "stock.read", "stock.write", "supplier.read", "supplier.write"] },
  { name: "Bartender", slug: "bartender", parentRole: "staff", department: "bar", permissions: ["menu.read", "menu.item.update", "order.read", "order.create"] },
];

async function idsFor(codes) {
  return (await Permission.find({ code: { $in: codes } }).select("_id").lean()).map((p) => p._id);
}

async function run() {
  const parentRoles = await ParentRole.find({}).lean();
  const parentRoleBySlug = new Map(parentRoles.map((role) => [role.slug, role]));

  for (const role of roles) {
    const parent = parentRoleBySlug.get(role.parentRole);
    if (!parent) throw new Error(`ParentRole not found for role ${role.slug}: ${role.parentRole}`);
    const permissions = await idsFor(role.permissions || []);
    await Role.findOneAndUpdate(
      { slug: role.slug },
      {
        $set: {
          name: role.name,
          slug: role.slug,
          description: role.description || "",
          isSystem: Boolean(role.isSystem),
          parentRole: parent._id,
          department: role.department || null,
          permissions,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(`✓ role: ${role.slug}`);
  }
  await mongoose.disconnect();
  console.log("Done Role Seeding");
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
