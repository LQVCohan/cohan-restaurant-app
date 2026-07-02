import "dotenv/config.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import {
  Brand,
  BrandMembership,
  Restaurant,
  Role,
  User,
} from "../models/index.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "foodhub";
const id = (value) => String(value?._id || value?.id || value || "");

const emptyReport = () => ({
  ownerCandidates: 0,
  managerCandidates: 0,
  restaurantsAssignedToOnlyBrand: 0,
  membershipsCreated: 0,
  membershipsUpdated: 0,
  restaurantsCleaned: 0,
  usersCleaned: 0,
  ownerUsersMigrated: 0,
  ownerRolesRemoved: 0,
  droppedIndexes: [],
  conflicts: [],
});

async function backupLegacyData(payload) {
  const directory = path.resolve("backups");
  await fs.mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(directory, `brand-scope-cleanup-${stamp}.json`);
  await fs.writeFile(
    filePath,
    JSON.stringify({ createdAt: new Date().toISOString(), ...payload }, null, 2),
    "utf8",
  );
  return filePath;
}

export async function migrateRestaurantManagersToBrandMembership({
  dryRun = true,
  confirmCleanup = false,
  dbName = DB_NAME,
  models = { Brand, BrandMembership, Restaurant, Role, User },
  logger = console,
} = {}) {
  if (!dryRun && !confirmCleanup) {
    throw new Error("Apply requires confirmCleanup=true.");
  }

  const report = emptyReport();
  logger.log(`Using database ${dbName}`);

  const [brands, restaurants, users, roles, memberships] = await Promise.all([
    models.Brand.find({}).select("_id ownerId name").lean(),
    models.Restaurant.find({}).select("_id brandId managerId name").lean(),
    models.User.find({}).select("_id role roleName userType restaurantId restaurantIds restaurants").lean(),
    models.Role.find({}).select("_id slug name").lean(),
    models.BrandMembership.find({}).select("_id brandId userId role status restaurantIds").lean(),
  ]);

  const onlyBrandId = brands.length === 1 ? brands[0]._id : null;
  const missingBrandAssignments = [];
  const managerRole = roles.find((role) =>
    [role.slug, role.name].some((value) => /^manager$/i.test(String(value || ""))),
  );
  const ownerRoles = roles.filter((role) =>
    [role.slug, role.name].some((value) => /^owner$/i.test(String(value || ""))),
  );
  const ownerRoleIds = new Set(ownerRoles.map((role) => id(role._id)));
  const existingByKey = new Map(
    memberships.map((membership) => [
      `${id(membership.brandId)}:${id(membership.userId)}`,
      membership,
    ]),
  );
  const managerByRestaurant = new Map();

  for (const membership of memberships) {
    if (membership.status !== "active" || membership.role !== "manager") continue;
    for (const restaurantId of membership.restaurantIds || []) {
      managerByRestaurant.set(id(restaurantId), id(membership.userId));
    }
  }

  const candidates = new Map();
  const addCandidate = ({ brandId, userId, role, restaurantIds = [] }) => {
    if (!id(brandId) || !id(userId)) {
      report.conflicts.push({
        type: "invalid_candidate",
        brandId: id(brandId),
        userId: id(userId),
        role,
      });
      return;
    }

    const key = `${id(brandId)}:${id(userId)}`;
    const current = candidates.get(key);
    const priority = { owner: 4, admin: 3, manager: 2, staff: 1 };
    if (current && priority[current.role] >= priority[role]) return;
    candidates.set(key, { brandId, userId, role, restaurantIds });
  };

  for (const brand of brands) {
    if (!brand.ownerId) {
      report.conflicts.push({
        type: "brand_missing_owner",
        brandId: id(brand._id),
        name: brand.name || "",
      });
      continue;
    }
    addCandidate({ brandId: brand._id, userId: brand.ownerId, role: "owner" });
    report.ownerCandidates += 1;
  }

  for (const restaurant of restaurants) {
    const effectiveBrandId = restaurant.brandId || onlyBrandId;

    if (!restaurant.brandId) {
      if (!onlyBrandId) {
        report.conflicts.push({
          type: "restaurant_missing_brand",
          restaurantId: id(restaurant._id),
          name: restaurant.name || "",
          brandCount: brands.length,
        });
        continue;
      }
      missingBrandAssignments.push({
        restaurantId: restaurant._id,
        brandId: onlyBrandId,
      });
      report.restaurantsAssignedToOnlyBrand += 1;
    }

    if (!restaurant.managerId) continue;

    const currentManagerId = managerByRestaurant.get(id(restaurant._id));
    if (currentManagerId && currentManagerId !== id(restaurant.managerId)) {
      report.conflicts.push({
        type: "restaurant_manager_conflict",
        restaurantId: id(restaurant._id),
        currentManagerId,
        legacyManagerId: id(restaurant.managerId),
      });
      continue;
    }

    addCandidate({
      brandId: effectiveBrandId,
      userId: restaurant.managerId,
      role: "manager",
      restaurantIds: [restaurant._id],
    });
    report.managerCandidates += 1;
  }

  const ownerUsers = users.filter((user) => ownerRoleIds.has(id(user.role)));
  if (ownerUsers.length && !managerRole) {
    report.conflicts.push({
      type: "manager_system_role_missing",
      userIds: ownerUsers.map((user) => id(user._id)),
    });
  }

  logger.log(JSON.stringify({ dryRun, ...report }, null, 2));
  if (dryRun || report.conflicts.length) {
    if (!dryRun && report.conflicts.length) {
      throw new Error(`Cleanup blocked by ${report.conflicts.length} conflict(s).`);
    }
    return report;
  }

  const backupFile = await backupLegacyData({
    brands,
    restaurants,
    users,
    roles,
    memberships,
  });
  logger.log(`Backup written: ${backupFile}`);

  if (missingBrandAssignments.length) {
    const result = await models.Restaurant.collection.updateMany(
      {
        _id: { $in: missingBrandAssignments.map((item) => item.restaurantId) },
        $or: [
          { brandId: { $exists: false } },
          { brandId: null },
        ],
      },
      { $set: { brandId: onlyBrandId } },
    );
    report.restaurantsAssignedToOnlyBrand = result.modifiedCount || 0;
  }

  for (const candidate of candidates.values()) {
    const key = `${id(candidate.brandId)}:${id(candidate.userId)}`;
    const existing = existingByKey.get(key);
    await models.BrandMembership.updateOne(
      { brandId: candidate.brandId, userId: candidate.userId },
      {
        $set: {
          role: candidate.role,
          status: "active",
          restaurantIds: candidate.role === "manager" ? candidate.restaurantIds : [],
        },
        $setOnInsert: { createdBy: candidate.userId },
      },
      { upsert: true },
    );
    if (existing) report.membershipsUpdated += 1;
    else report.membershipsCreated += 1;
  }

  if (ownerUsers.length) {
    const result = await models.User.updateMany(
      { _id: { $in: ownerUsers.map((user) => user._id) } },
      { $set: { role: managerRole._id, userType: "MANAGER" } },
    );
    report.ownerUsersMigrated = result.modifiedCount || 0;
  }

  const restaurantCleanup = await models.Restaurant.collection.updateMany(
    { managerId: { $exists: true } },
    { $unset: { managerId: "" } },
  );
  report.restaurantsCleaned = restaurantCleanup.modifiedCount || 0;

  const userCleanup = await models.User.collection.updateMany(
    {
      $or: [
        { restaurantId: { $exists: true } },
        { restaurantIds: { $exists: true } },
        { restaurants: { $exists: true } },
      ],
    },
    {
      $unset: {
        restaurantId: "",
        restaurantIds: "",
        restaurants: "",
      },
    },
  );
  report.usersCleaned = userCleanup.modifiedCount || 0;

  const indexes = await models.Restaurant.collection.indexes();
  for (const index of indexes) {
    if (!Object.prototype.hasOwnProperty.call(index.key || {}, "managerId")) continue;
    await models.Restaurant.collection.dropIndex(index.name);
    report.droppedIndexes.push(index.name);
  }

  if (ownerRoles.length) {
    const result = await models.Role.deleteMany({
      _id: { $in: ownerRoles.map((role) => role._id) },
    });
    report.ownerRolesRemoved = result.deletedCount || 0;
  }

  logger.log(JSON.stringify({ dryRun, ...report }, null, 2));
  return report;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const confirmCleanup = process.argv.includes("--confirm-cleanup");

  if (apply && !confirmCleanup) {
    throw new Error("Use --apply --confirm-cleanup.");
  }
  if (
    apply &&
    process.env.NODE_ENV === "production" &&
    !process.argv.includes("--allow-production")
  ) {
    throw new Error("Refusing production cleanup without --allow-production.");
  }

  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  try {
    await migrateRestaurantManagersToBrandMembership({
      dryRun: !apply,
      confirmCleanup,
      dbName: DB_NAME,
    });
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
