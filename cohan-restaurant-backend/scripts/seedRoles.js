import mongoose from "mongoose";
import process from "process";
import dotenv from "dotenv";
import { Role, ParentRole } from "../models/index.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB,
});

const roles = [
  // Base system roles
  { name: "Admin", slug: "admin", parentRole: "admin", isSystem: true },
  { name: "Manager", slug: "manager", parentRole: "manager", isSystem: true },
  { name: "Customer", slug: "customer", parentRole: "customer", isSystem: true },
  { name: "Staff", slug: "staff", parentRole: "staff", isSystem: true },

  // Service
  { name: "Server", slug: "server", parentRole: "staff", department: "service" },
  { name: "Supervisor", slug: "supervisor", parentRole: "staff", department: "service" },
  { name: "Host", slug: "host", parentRole: "staff", department: "service" },

  // Cashier
  { name: "Cashier", slug: "cashier", parentRole: "staff", department: "cashier" },

  // Kitchen
  { name: "Chef", slug: "chef", parentRole: "staff", department: "kitchen" },
  { name: "Cook", slug: "cook", parentRole: "staff", department: "kitchen" },
  {
    name: "Kitchen Helper",
    slug: "kitchen_helper",
    parentRole: "staff",
    department: "kitchen",
  },

  // Cleaning
  { name: "Cleaner", slug: "cleaner", parentRole: "staff", department: "cleaning" },

  // Delivery
  { name: "Shipper", slug: "shipper", parentRole: "staff", department: "delivery" },

  // Inventory
  { name: "Storekeeper", slug: "storekeeper", parentRole: "staff", department: "inventory" },

  // Bar
  { name: "Bartender", slug: "bartender", parentRole: "staff", department: "bar" },
];

async function run() {
  for (const parentRole of [
    { name: "Admin", slug: "admin" },
    { name: "Manager", slug: "manager" },
    { name: "Customer", slug: "customer" },
    { name: "Staff", slug: "staff" },
  ]) {
    await ParentRole.findOneAndUpdate(
      { slug: parentRole.slug },
      { $set: parentRole },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  const parentRoles = await ParentRole.find({}).lean();
  const parentRoleBySlug = new Map(parentRoles.map((role) => [role.slug, role]));

  for (const role of roles) {
    const parent = parentRoleBySlug.get(role.parentRole);
    if (!parent) {
      console.log(`ParentRole not found for role ${role.slug}: ${role.parentRole}`);
      continue;
    }

    const update = {
      name: role.name,
      slug: role.slug,
      description: role.description || "",
      isSystem: Boolean(role.isSystem),
      parentRole: parent._id,
      department: role.department || null,
    };

    const existing = await Role.findOne({ slug: role.slug }).lean();
    await Role.findOneAndUpdate(
      { slug: role.slug },
      {
        $set: update,
        $setOnInsert: { permissions: [] },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    console.log(`${existing ? "Updated" : "Created"} role: ${role.slug}`);
  }

  await mongoose.disconnect();
  console.log("Done Role Seeding");
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
