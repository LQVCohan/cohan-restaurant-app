import "dotenv/config.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import process from "process";

import { User, Role } from "../models/index.js";
import { validatePasswordStrong } from "../lib/passwordPolicy.js";

export function buildAdminUserPayload({ email, passwordHash, adminRoleId }) {
  const now = new Date();
  return {
    fullName: "System Admin",
    email,
    passwordHash,
    role: adminRoleId,
    status: "active",
    provider: "local",
    userType: "ADMIN",
    emailVerified: true,
    emailVerifiedAt: now,
    verifiedAt: now,
    verificationLastChannel: "email",
    verificationLastStatus: "verified",
    forcePasswordChange: false,
  };
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.MONGO_DB || "RestaurantDB";

  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log("✅ Connected Mongo", { dbName: mongoose.connection.name });

  const adminRole = await Role.findOne({ slug: "admin" });
  if (!adminRole) {
    throw new Error("Missing admin role. Run `npm run seed:rbac` before `npm run seed:admin`.");
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
    user.role = adminRole._id;
    user.status = "active";
    user.userType = "ADMIN";
    user.emailVerified = true;
    user.emailVerifiedAt ||= new Date();
    user.verifiedAt ||= new Date();
    user.verificationLastChannel = "email";
    user.verificationLastStatus = "verified";
    user.forcePasswordChange = false;
    await user.save();
    console.log("ℹ️ Admin existed, normalized role/status:", email);
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
