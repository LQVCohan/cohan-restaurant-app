// scripts/seedRoles.js
import mongoose from "mongoose";
import { Role, ParentRole } from "../models/index.js";
import process from "process";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI, {
  dbName: process.env.MONGO_DB,
});

// ==========================
// LIST ROLE TO SEED
// ==========================
const roles = [
  // ====== BASE SYSTEM ROLES ======
  {
    name: "Admin",
    slug: "admin",
    parentRole: "admin",
    isSystem: true,
  },
  {
    name: "Manager",
    slug: "manager",
    parentRole: "manager",
    isSystem: true,
  },
  {
    name: "Customer",
    slug: "customer",
    parentRole: "staff",
    isSystem: true,
  },
  {
    name: "Staff",
    slug: "staff",
    parentRole: "staff",
    isSystem: true,
  },

  // ====== SERVICE department ======
  {
    name: "Server",
    slug: "server",
    parentRole: "staff",
    department: "service",
  },
  {
    name: "Supervisor",
    slug: "supervisor",
    parentRole: "staff",
    department: "service",
  },

  // ====== KITCHEN department ======
  {
    name: "Chef",
    slug: "chef",
    parentRole: "staff",
    department: "kitchen",
  },

  // ====== CASHIER department ======
  {
    name: "Cashier",
    slug: "cashier",
    parentRole: "staff",
    department: "cashier",
  },

  // ====== CLEANING department ======
  {
    name: "Cleaner",
    slug: "cleaner",
    parentRole: "staff",
    department: "cleaning",
  },

  // ====== DELIVERY department ======
  {
    name: "Shipper",
    slug: "shipper",
    parentRole: "staff",
    department: "delivery",
  },
];

// ==========================
// SEEDER
// ==========================
async function run() {
  for (const r of roles) {
    // skip if exists
    const exists = await Role.findOne({ slug: r.slug }).lean();
    if (exists) {
      console.log(`= Skipped role (exists): ${r.slug}`);
      continue;
    }

    // find parentRole id
    const parent = await ParentRole.findOne({ slug: r.parentRole }).lean();
    if (!parent) {
      console.log(`❌ ParentRole not found for: ${r.slug}`);
      continue;
    }

    // create role WITHOUT PERMISSIONS
    await Role.create({
      name: r.name,
      slug: r.slug,
      description: r.description || "",
      isSystem: r.isSystem || false,
      parentRole: parent._id,
      department: r.department || null,
      permissions: [], // ← now always empty
    });

    console.log(`+ Created role: ${r.slug}`);
  }

  await mongoose.disconnect();
  console.log("🏁 Done Role Seeding");
}

run().catch(console.error);
