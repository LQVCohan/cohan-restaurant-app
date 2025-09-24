import "dotenv/config.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import process from "process";
// 👉 chỉnh đường dẫn đúng tới models ESM của bạn

import { User, Role, Permission } from "../models/index.js";
async function main() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.MONGO_DB || "foodhub";

  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log("✅ Connected Mongo");

  // 1) Tạo/đảm bảo Permission cơ bản cho admin
  const perms = [
    {
      action: "manage",
      resource: "all",
      name: "ALL_PRIVILEGES",
      description: "Full access",
    },
  ];
  const permDocs = [];
  for (const p of perms) {
    let doc = await Permission.findOne({
      action: p.action,
      resource: p.resource,
    });
    if (!doc) doc = await Permission.create(p);
    permDocs.push(doc);
  }

  // 2) Tạo/đảm bảo Role admin
  let adminRole = await Role.findOne({ name: "admin" });
  if (!adminRole) {
    adminRole = await Role.create({
      name: "admin",
      description: "Restaurant chain owner",
      permissions: permDocs.map((d) => d._id),
    });
  } else {
    // đảm bảo tất cả quyền
    adminRole.permissions = permDocs.map((d) => d._id);
    await adminRole.save();
  }

  // 3) Tạo user admin
  const email = process.env.ADMIN_EMAIL || "admin@foodhub.local";
  const password = process.env.ADMIN_PASSWORD || "Admin@12345";

  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      name: "System Admin",
      email,
      passwordHash,
      roles: [adminRole._id],
      status: "active",
      provider: "local",
    });
    console.log("✅ Created admin:", email);
  } else {
    console.log("ℹ️ Admin existed:", email);
  }

  console.log("🎉 DONE. Use credentials:", email, "/", password);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
