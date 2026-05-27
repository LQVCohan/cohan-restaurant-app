import "dotenv/config.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import process from "process";

import { User, Role, Permission } from "../models/index.js";
import { validatePasswordStrong } from "../lib/passwordPolicy.js";

export function buildAdminUserPayload({ email, passwordHash, adminRoleId }) {
  return {
    fullName: "System Admin",
    email,
    passwordHash,
    role: adminRoleId,
    status: "active",
    provider: "local",
    userType: "ADMIN",
  };
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.MONGO_DB || "foodhub";

  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log("✅ Connected Mongo");

  const perms = [{ action: "manage", resource: "all", name: "ALL_PRIVILEGES", description: "Full access" }];
  const permDocs = [];
  for (const p of perms) {
    let doc = await Permission.findOne({ action: p.action, resource: p.resource });
    if (!doc) doc = await Permission.create(p);
    permDocs.push(doc);
  }

  let adminRole = await Role.findOne({ name: "admin" });
  if (!adminRole) {
    adminRole = await Role.create({ name: "admin", description: "Restaurant chain owner", permissions: permDocs.map((d) => d._id) });
  } else {
    adminRole.permissions = permDocs.map((d) => d._id);
    await adminRole.save();
  }

  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email) throw new Error("Missing required ADMIN_EMAIL environment variable");
  if (!password) throw new Error("Missing required ADMIN_PASSWORD environment variable");

  const passwordPolicy = validatePasswordStrong(password);
  if (!passwordPolicy.ok) throw new Error(`ADMIN_PASSWORD does not satisfy policy: ${passwordPolicy.reason || "invalid password"}`);

  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create(buildAdminUserPayload({ email, passwordHash, adminRoleId: adminRole._id }));
    console.log("✅ Created admin:", email);
  } else {
    console.log("ℹ️ Admin existed:", email);
  }

  console.log("🎉 DONE. Admin account is ready for:", email);
  await mongoose.disconnect();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
