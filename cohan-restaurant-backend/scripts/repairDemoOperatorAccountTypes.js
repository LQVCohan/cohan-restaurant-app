import "dotenv/config.js";
import mongoose from "mongoose";
import { Role, User } from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const DEMO_OPERATOR_ACCOUNT_CONTRACT = Object.freeze([
  Object.freeze({
    email: "hr.demo@cohan.local",
    userType: "HR",
    roleSlug: "hr",
  }),
  Object.freeze({
    email: "accountant.demo@cohan.local",
    userType: "ACCOUNTANT",
    roleSlug: "accountant",
  }),
]);

async function repairDemoOperatorAccountTypes() {
  const emails = DEMO_OPERATOR_ACCOUNT_CONTRACT.map((item) => item.email);
  const roleSlugs = DEMO_OPERATOR_ACCOUNT_CONTRACT.map((item) => item.roleSlug);

  const [users, roles] = await Promise.all([
    User.find({ email: { $in: emails } })
      .select("_id email userType role status")
      .lean(),
    Role.find({ slug: { $in: roleSlugs } })
      .select("_id slug")
      .lean(),
  ]);

  const userByEmail = new Map(users.map((user) => [user.email, user]));
  const roleBySlug = new Map(roles.map((role) => [role.slug, role]));
  const missingUsers = emails.filter((email) => !userByEmail.has(email));
  const missingRoles = roleSlugs.filter((slug) => !roleBySlug.has(slug));

  if (missingUsers.length) {
    throw new Error(
      `DEMO_OPERATOR_ACCOUNTS_MISSING: ${missingUsers.join(", ")}`,
    );
  }
  if (missingRoles.length) {
    throw new Error(`DEMO_OPERATOR_ROLES_MISSING: ${missingRoles.join(", ")}`);
  }

  const repaired = [];
  for (const contract of DEMO_OPERATOR_ACCOUNT_CONTRACT) {
    const user = userByEmail.get(contract.email);
    const role = roleBySlug.get(contract.roleSlug);

    // ponytail: use the native collection only for this discriminator-key repair;
    // normal Mongoose updates may strip a userType change from CUSTOMER to HR/ACCOUNTANT.
    await User.collection.updateOne(
      { _id: user._id, email: contract.email },
      {
        $set: {
          userType: contract.userType,
          role: role._id,
          status: "active",
        },
      },
    );

    const updated = await User.findById(user._id)
      .populate("role", "slug")
      .select("_id email userType role status")
      .lean();

    if (
      updated?.userType !== contract.userType ||
      updated?.role?.slug !== contract.roleSlug
    ) {
      throw new Error(
        `DEMO_OPERATOR_ACCOUNT_REPAIR_FAILED: ${contract.email} userType=${updated?.userType || "missing"} role=${updated?.role?.slug || "missing"}`,
      );
    }

    repaired.push(updated);
  }

  return repaired;
}

async function main() {
  assertDemoScriptAllowed("repairDemoOperatorAccountTypes.js");
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGO_DB || "cohan";
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });

  const repaired = await repairDemoOperatorAccountTypes();
  for (const user of repaired) {
    console.log(
      `Repaired ${user.email}: userType=${user.userType}, role=${user.role?.slug}, status=${user.status}`,
    );
  }
}

main()
  .catch((error) => {
    console.error("[repair:demo:operator-account-types] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
