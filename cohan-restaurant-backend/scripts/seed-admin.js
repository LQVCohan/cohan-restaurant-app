import "dotenv/config.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import process from "process";
import { pathToFileURL } from "node:url";

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

export function isDirectExecution(metaUrl = import.meta.url, argvPath = process.argv[1]) {
  return Boolean(argvPath) && metaUrl === pathToFileURL(argvPath).href;
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB";
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
    user.provider = "local";
    user.userType = "ADMIN";
    user.emailVerified = true;
    user.emailVerifiedAt ||= new Date();
    user.verifiedAt ||= new Date();
    user.verificationLastChannel = "email";
    user.verificationLastStatus = "verified";
    user.forcePasswordChange = false;
    if (!user.passwordHash) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }
    await user.save();
    console.log("ℹ️ Admin existed, normalized login fields:", email);
  }

  console.log("🎉 DONE. Admin account is ready for:", email, String(user._id));
  await mongoose.disconnect();
}

if (isDirectExecution()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
