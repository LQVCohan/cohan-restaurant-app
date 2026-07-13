import "dotenv/config.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  Brand,
  BrandMembership,
  Category,
  Coupon,
  Customer,
  Menu,
  MenuItem,
  Order,
  PerformanceIncident,
  PerformanceIncidentAppeal,
  Promotion,
  Restaurant,
  Shift,
  StaffPerformanceScoreAdjustment,
  StaffPerformanceSnapshot,
  Timesheet,
  User,
} from "../models/index.js";
import {
  assertDemoScriptAllowed,
  getDemoPassword,
  safeDbInfo,
} from "./lib/scriptSafety.js";

const DEFAULT_BRAND_SLUG = "cohan-demo-business";
const DEFAULT_RESTAURANT_NAME = "COHAN Defense Demo Restaurant";
const SECONDARY_RESTAURANT_NAME =
  "COHAN Defense Demo Restaurant - Quận 1";
const DEFENSE_CUSTOMER_EMAIL = "customer.demo@cohan.local";
const SOURCE_CUSTOMER_EMAIL = /@customer-demo\.cohan\.local$/i;
const SCOPED_DEMO_EMAIL = /\.demo@cohan\.local$/i;
const CUSTOMER_DEMO_TAG = "customer-manager-demo";
const scriptPath = fileURLToPath(import.meta.url);

const idString = (value) => String(value?._id || value?.id || value || "");
const uniqueIds = (values = []) => [
  ...new Map(values.filter(Boolean).map((value) => [idString(value), value])).values(),
];

function integrityError(message) {
  return new Error(`DEFENSE_DATA_INTEGRITY_FAILED: ${message}`);
}

function ensure(condition, message) {
  if (!condition) throw integrityError(message);
}

export function customerTypeFromSpending(totalSpending) {
  const points = Math.floor(Number(totalSpending || 0) / 1_000_000);
  if (points >= 20) return "VIP";
  if (points >= 5) return "OFTEN";
  return "NEW";
}

export function resolveAssignedRestaurantIds(
  user,
  { primaryRestaurantId, secondaryRestaurantId },
) {
  const allowed = new Map(
    [primaryRestaurantId, secondaryRestaurantId].map((value) => [
      idString(value),
      value,
    ]),
  );
  const candidates = [
    user?.restaurantForStaff,
    ...(Array.isArray(user?.refRestaurants) ? user.refRestaurants : []),
  ];
  return uniqueIds(
    candidates.map((value) => allowed.get(idString(value))).filter(Boolean),
  );
}

export function buildScopedDemoMembershipDefinitions({
  brandId,
  primaryRestaurantId,
  secondaryRestaurantId,
  users = [],
}) {
  return users
    .map((user) => ({
      brandId,
      userId: user._id || user.id,
      email: user.email,
      role: "staff",
      restaurantIds: resolveAssignedRestaurantIds(user, {
        primaryRestaurantId,
        secondaryRestaurantId,
      }),
      status: "active",
    }))
    .filter(
      (membership) =>
        membership.userId && membership.email && membership.restaurantIds.length,
    );
}

async function resolveDefenseContext() {
  const [brand, primary, secondary] = await Promise.all([
    Brand.findOne({ slug: DEFAULT_BRAND_SLUG }),
    Restaurant.findOne({ name: DEFAULT_RESTAURANT_NAME }),
    Restaurant.findOne({ name: SECONDARY_RESTAURANT_NAME }),
  ]);

  ensure(brand, `missing Brand ${DEFAULT_BRAND_SLUG}`);
  ensure(primary, `missing primary restaurant ${DEFAULT_RESTAURANT_NAME}`);
  ensure(
    secondary,
    `missing secondary restaurant ${SECONDARY_RESTAURANT_NAME}`,
  );

  return { brand, primary, secondary };
}

async function normalizeDefenseCustomer(primaryRestaurantId) {
  const passwordHash = await bcrypt.hash(getDemoPassword(), 10);
  let target = await Customer.findOne({ email: DEFENSE_CUSTOMER_EMAIL });
  const source = await Customer.findOne({
    email: SOURCE_CUSTOMER_EMAIL,
    refRestaurants: primaryRestaurantId,
    totalOrders: { $gt: 0 },
  }).sort({ totalSpending: -1, totalOrders: -1, createdAt: 1 });

  ensure(
    target || source,
    "no seeded customer is available for customer.demo@cohan.local",
  );

  let reassignedOrders = 0;
  if (!target) {
    target = source;
  } else if (source && idString(source) !== idString(target)) {
    const result = await Order.updateMany(
      {
        restaurantId: primaryRestaurantId,
        userId: source._id,
        "clientMeta.demoTag": CUSTOMER_DEMO_TAG,
      },
      { $set: { userId: target._id } },
    );
    reassignedOrders = result.modifiedCount || 0;

    const remainingOrders = await Order.countDocuments({ userId: source._id });
    if (!remainingOrders) await Customer.deleteOne({ _id: source._id });
  }

  const targetId = target._id;
  const [stats] = await Order.aggregate([
    {
      $match: {
        restaurantId: new mongoose.Types.ObjectId(primaryRestaurantId),
        userId: new mongoose.Types.ObjectId(targetId),
        "clientMeta.demoTag": CUSTOMER_DEMO_TAG,
      },
    },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpending: { $sum: { $ifNull: ["$totals.grandTotal", 0] } },
      },
    },
  ]);

  ensure(stats?.totalOrders > 0, `${DEFENSE_CUSTOMER_EMAIL} has no demo orders`);
  const loyaltyPoints = Math.floor(Number(stats.totalSpending || 0) / 1_000_000);
  const verifiedAt = new Date();
  target = await Customer.findByIdAndUpdate(
    targetId,
    {
      $set: {
        email: DEFENSE_CUSTOMER_EMAIL,
        username: "customer.demo",
        fullName: "COHAN Demo Customer",
        provider: "local",
        passwordHash,
        status: "active",
        userType: "CUSTOMER",
        refRestaurants: [primaryRestaurantId],
        isGuest: false,
        emailVerified: true,
        emailVerifiedAt: verifiedAt,
        phoneVerified: true,
        phoneVerifiedAt: verifiedAt,
        verifiedAt,
        verificationLastChannel: "both",
        verificationLastStatus: "verified",
        forcePasswordChange: false,
        totalOrders: stats.totalOrders,
        totalSpending: stats.totalSpending,
        loyaltyPoints,
        customerType: customerTypeFromSpending(stats.totalSpending),
        updatedAt: verifiedAt,
      },
      $setOnInsert: { registeredAt: verifiedAt, createdAt: verifiedAt },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return { customer: target, reassignedOrders };
}

async function upsertScopedDemoMemberships({ brand, primary, secondary }) {
  const scopedUsers = await User.find({
    email: SCOPED_DEMO_EMAIL,
    userType: { $in: ["STAFF", "HR", "ACCOUNTANT"] },
    status: "active",
    $or: [
      { restaurantForStaff: { $in: [primary._id, secondary._id] } },
      { refRestaurants: { $in: [primary._id, secondary._id] } },
    ],
  })
    .select("_id email userType restaurantForStaff refRestaurants")
    .lean();

  const memberships = buildScopedDemoMembershipDefinitions({
    brandId: brand._id,
    primaryRestaurantId: primary._id,
    secondaryRestaurantId: secondary._id,
    users: scopedUsers,
  });

  for (const membership of memberships) {
    await BrandMembership.findOneAndUpdate(
      { brandId: brand._id, userId: membership.userId },
      {
        $set: {
          role: membership.role,
          restaurantIds: membership.restaurantIds,
          status: "active",
          updatedBy: brand.ownerId,
        },
        $setOnInsert: {
          createdBy: brand.ownerId,
          invitedBy: brand.ownerId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  return memberships;
}

function membershipIncludes(membership, restaurantId) {
  return (membership?.restaurantIds || []).some(
    (value) => idString(value) === idString(restaurantId),
  );
}

export async function verifyDefenseDataset(context = null) {
  const { brand, primary, secondary } = context || (await resolveDefenseContext());

  ensure(
    idString(primary.brandId) === idString(brand._id),
    "primary restaurant is not linked to the defense Brand",
  );
  ensure(
    idString(secondary.brandId) === idString(brand._id),
    "secondary restaurant is not linked to the defense Brand",
  );

  const coreRequirements = [
    ["business.owner.demo@cohan.local", "owner", null],
    ["admin.demo@cohan.local", "admin", null],
    ["manager.demo@cohan.local", "manager", primary._id],
    ["manager.branch2.demo@cohan.local", "manager", secondary._id],
    ["staff.server.demo@cohan.local", "staff", primary._id],
    ["staff.branch2.demo@cohan.local", "staff", secondary._id],
  ];
  const coreUsers = await User.find({
    email: { $in: coreRequirements.map(([email]) => email) },
  })
    .select("_id email")
    .lean();
  const coreUserByEmail = new Map(coreUsers.map((user) => [user.email, user]));
  const coreMemberships = await BrandMembership.find({
    brandId: brand._id,
    userId: { $in: coreUsers.map((user) => user._id) },
    status: "active",
  }).lean();
  const coreMembershipByUser = new Map(
    coreMemberships.map((membership) => [idString(membership.userId), membership]),
  );

  for (const [email, role, restaurantId] of coreRequirements) {
    const user = coreUserByEmail.get(email);
    ensure(user, `missing core defense account ${email}`);
    const membership = coreMembershipByUser.get(idString(user._id));
    ensure(membership, `missing active BrandMembership for ${email}`);
    ensure(membership.role === role, `${email} has Brand role ${membership.role}, expected ${role}`);
    if (restaurantId) {
      ensure(
        membershipIncludes(membership, restaurantId),
        `${email} is not assigned to the expected restaurant`,
      );
    }
  }

  const scopedUsers = await User.find({
    email: SCOPED_DEMO_EMAIL,
    userType: { $in: ["STAFF", "HR", "ACCOUNTANT"] },
    status: "active",
    $or: [
      { restaurantForStaff: { $in: [primary._id, secondary._id] } },
      { refRestaurants: { $in: [primary._id, secondary._id] } },
    ],
  })
    .select("_id email restaurantForStaff refRestaurants")
    .lean();
  ensure(scopedUsers.length > 0, "no scoped demo staff accounts were found");
  const scopedMemberships = await BrandMembership.find({
    brandId: brand._id,
    userId: { $in: scopedUsers.map((user) => user._id) },
    role: "staff",
    status: "active",
  }).lean();
  const scopedMembershipByUser = new Map(
    scopedMemberships.map((membership) => [idString(membership.userId), membership]),
  );
  for (const user of scopedUsers) {
    const expectedRestaurantIds = resolveAssignedRestaurantIds(user, {
      primaryRestaurantId: primary._id,
      secondaryRestaurantId: secondary._id,
    });
    const membership = scopedMembershipByUser.get(idString(user._id));
    ensure(membership, `missing staff BrandMembership for ${user.email}`);
    for (const restaurantId of expectedRestaurantIds) {
      ensure(
        membershipIncludes(membership, restaurantId),
        `${user.email} membership is missing restaurant ${idString(restaurantId)}`,
      );
    }
  }

  const customer = await Customer.findOne({ email: DEFENSE_CUSTOMER_EMAIL })
    .select("_id totalOrders totalSpending")
    .lean();
  ensure(customer, `missing ${DEFENSE_CUSTOMER_EMAIL}`);
  const customerOrderCount = await Order.countDocuments({
    restaurantId: primary._id,
    userId: customer._id,
    "clientMeta.demoTag": CUSTOMER_DEMO_TAG,
  });
  ensure(customerOrderCount > 0, `${DEFENSE_CUSTOMER_EMAIL} has no linked orders`);
  ensure(
    Number(customer.totalOrders || 0) === customerOrderCount,
    `${DEFENSE_CUSTOMER_EMAIL} totalOrders does not match linked orders`,
  );

  const menuItems = await MenuItem.find({
    restaurantId: primary._id,
    status: "available",
    menuId: { $ne: null },
    categoryId: { $ne: null },
  })
    .select("_id menuId categoryId")
    .lean();
  ensure(menuItems.length > 0, "primary restaurant has no available linked menu items");
  const menuIds = uniqueIds(menuItems.map((item) => item.menuId));
  const categoryIds = uniqueIds(menuItems.map((item) => item.categoryId));
  const [menuCount, categoryCount] = await Promise.all([
    Menu.countDocuments({ _id: { $in: menuIds } }),
    Category.countDocuments({ _id: { $in: categoryIds } }),
  ]);
  ensure(menuCount === menuIds.length, "one or more MenuItem.menuId values are dangling");
  ensure(
    categoryCount === categoryIds.length,
    "one or more MenuItem.categoryId values are dangling",
  );

  const orders = await Order.find({
    restaurantId: primary._id,
    "clientMeta.demoTag": CUSTOMER_DEMO_TAG,
  })
    .select("userId items")
    .lean();
  ensure(orders.length > 0, "primary restaurant has no customer demo orders");
  const orderCustomerIds = uniqueIds(orders.map((order) => order.userId));
  const orderCustomerCount = await Customer.countDocuments({
    _id: { $in: orderCustomerIds },
  });
  ensure(
    orderCustomerCount === orderCustomerIds.length,
    "one or more demo orders reference a missing customer",
  );
  const menuItemById = new Map(menuItems.map((item) => [idString(item._id), item]));
  for (const order of orders) {
    for (const item of order.items || []) {
      const menuItem = menuItemById.get(idString(item.dishId));
      ensure(menuItem, `order ${idString(order._id)} references missing dish ${idString(item.dishId)}`);
      ensure(
        idString(item.menuId) === idString(menuItem.menuId),
        `order ${idString(order._id)} has a mismatched menuId for dish ${idString(item.dishId)}`,
      );
      ensure(
        idString(item.categoryId) === idString(menuItem.categoryId),
        `order ${idString(order._id)} has a mismatched categoryId for dish ${idString(item.dishId)}`,
      );
    }
  }

  const [couponCount, promotionCount, shiftCount, timesheetCount] =
    await Promise.all([
      Coupon.countDocuments({ restaurantId: primary._id }),
      Promotion.countDocuments({ restaurantId: primary._id }),
      Shift.countDocuments({ restaurantId: primary._id }),
      Timesheet.countDocuments({ restaurantId: primary._id }),
    ]);
  ensure(couponCount > 0, "primary restaurant has no coupons");
  ensure(promotionCount > 0, "primary restaurant has no promotions");
  ensure(shiftCount > 0, "primary restaurant has no shifts");
  ensure(timesheetCount > 0, "primary restaurant has no timesheets");

  const appliedIncident = await PerformanceIncident.findOne({
    restaurantId: primary._id,
    scoreImpactStatus: "applied",
  }).lean();
  ensure(appliedIncident, "no applied performance incident was seeded");
  const [snapshot, adjustment, appeal] = await Promise.all([
    StaffPerformanceSnapshot.findOne({
      restaurantId: primary._id,
      employeeId: appliedIncident.employeeId,
      periodStart: { $lte: appliedIncident.occurredAt },
      periodEnd: { $gte: appliedIncident.occurredAt },
    }).lean(),
    StaffPerformanceScoreAdjustment.findOne({
      incidentId: appliedIncident._id,
    }).lean(),
    PerformanceIncidentAppeal.findOne({
      incidentId: appliedIncident._id,
      status: "accepted",
    }).lean(),
  ]);
  ensure(snapshot, "applied incident has no covering performance snapshot");
  ensure(adjustment, "applied incident has no score adjustment");
  ensure(appeal, "applied incident has no accepted appeal");

  return {
    brandId: idString(brand._id),
    primaryRestaurantId: idString(primary._id),
    secondaryRestaurantId: idString(secondary._id),
    scopedDemoUsers: scopedUsers.length,
    menuItems: menuItems.length,
    demoOrders: orders.length,
    customerDemoOrders: customerOrderCount,
    coupons: couponCount,
    promotions: promotionCount,
    shifts: shiftCount,
    timesheets: timesheetCount,
  };
}

export async function finalizeDefenseDataset({ verifyOnly = false } = {}) {
  const context = await resolveDefenseContext();
  let customerResult = null;
  let memberships = [];

  if (!verifyOnly) {
    customerResult = await normalizeDefenseCustomer(context.primary._id);
    memberships = await upsertScopedDemoMemberships(context);
  }

  const verification = await verifyDefenseDataset(context);
  return { context, customerResult, memberships, verification };
}

async function main() {
  assertDemoScriptAllowed("finalizeDefenseDemoDataset.js");
  const mongoUri =
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB";
  const dbName = process.env.MONGO_DB || "RestaurantDB";
  const verifyOnly = process.argv.includes("--verify-only");

  console.log(
    verifyOnly ? "Verifying COHAN defense dataset:" : "Finalizing COHAN defense dataset:",
    safeDbInfo(),
  );
  await mongoose.connect(mongoUri, { dbName });
  const result = await finalizeDefenseDataset({ verifyOnly });
  await mongoose.disconnect();

  console.log(
    verifyOnly
      ? "\n✅ COHAN defense dataset integrity verified"
      : "\n✅ COHAN defense dataset links finalized and verified",
  );
  if (result.customerResult) {
    console.log(
      `Customer demo linked orders: ${result.verification.customerDemoOrders}; reassigned this run: ${result.customerResult.reassignedOrders}`,
    );
  }
  if (result.memberships.length) {
    console.log(`Scoped demo memberships normalized: ${result.memberships.length}`);
  }
  console.table(result.verification);
}

if (path.resolve(process.argv[1] || "") === scriptPath) {
  main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}
