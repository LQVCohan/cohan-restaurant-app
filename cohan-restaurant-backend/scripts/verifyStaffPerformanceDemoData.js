import "dotenv/config.js";
import mongoose from "mongoose";
import {
  BrandMembership,
  KitchenOrderWorkItem,
  Order,
  PerformanceIncident,
  PerformanceIncidentAppeal,
  Restaurant,
  Review,
  Staff,
  StaffPerformanceScoreAdjustment,
  StaffPerformanceScoreReversal,
  StaffPerformanceSnapshot,
  User,
} from "../models/index.js";
import { canAccessRestaurant } from "../src/services/auth/restaurantScope.service.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const TAG = "[demo-staff-performance-2026-07]";
const BRAND_ID =
  process.env.DEMO_BRAND_ID?.trim() || "6a447f6bea9844b4c8544c49";
const RESTAURANT_ID =
  process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
const MANAGER_ID =
  process.env.DEMO_MANAGER_ID?.trim() || "69f7162dab80d0aaef80d5c8";
const PERIOD_START = new Date("2026-07-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-07-31T23:59:59.999Z");
const PREVIOUS_START = new Date("2026-06-01T00:00:00.000Z");
const PREVIOUS_END = new Date("2026-06-30T23:59:59.999Z");

const OPERATOR_EXPECTED = [
  ["hr.demo@cohan.local", "HR", "hr"],
  ["accountant.demo@cohan.local", "ACCOUNTANT", "accountant"],
];

const EXPECTED = [
  ["staff.server.demo@cohan.local", "excellent"],
  ["staff.supervisor.demo@cohan.local", "good"],
  ["staff.cashier.demo@cohan.local", "average"],
  ["staff.chef.demo@cohan.local", "needs_attention"],
  ["staff.kitchenhelper.demo@cohan.local", "average"],
  ["staff.exception.demo@cohan.local", "poor"],
  ["staff.parttime.demo@cohan.local", "good"],
];

const state = { pass: 0, fail: 0 };
const pass = (message) => {
  state.pass += 1;
  console.log(`PASS ${message}`);
};
const fail = (message) => {
  state.fail += 1;
  console.error(`FAIL ${message}`);
};
const assertCheck = (condition, message) =>
  condition ? pass(message) : fail(message);

function requireObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value))
    throw new Error(`${fieldName} không hợp lệ: ${value}`);
  return new mongoose.Types.ObjectId(value);
}

async function run() {
  assertDemoScriptAllowed("verifyStaffPerformanceDemoData.js");
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGO_DB || "cohan";
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });

  const brandId = requireObjectId(BRAND_ID, "DEMO_BRAND_ID");
  const restaurantId = requireObjectId(RESTAURANT_ID, "DEMO_RESTAURANT_ID");
  const managerId = requireObjectId(MANAGER_ID, "DEMO_MANAGER_ID");

  const [restaurant, manager, membership] = await Promise.all([
    Restaurant.findById(restaurantId).lean(),
    User.findById(managerId).populate("role", "slug name").lean(),
    BrandMembership.findOne({
      brandId,
      userId: managerId,
      status: "active",
    }).lean(),
  ]);

  assertCheck(Boolean(restaurant), "demo restaurant exists");
  assertCheck(Boolean(manager), "demo manager exists");
  assertCheck(Boolean(membership), "demo manager has active brand membership");
  assertCheck(
    String(restaurant?.brandId || "") === String(brandId),
    "restaurant belongs to the configured brand",
  );

  const managerUser = manager
    ? {
        id: manager._id,
        _id: manager._id,
        userType: manager.userType,
        roleName: manager?.role?.slug || "manager",
      }
    : null;
  assertCheck(
    Boolean(
      managerUser && (await canAccessRestaurant(managerUser, restaurantId)),
    ),
    "manager can access the demo restaurant",
  );

  const operatorAccounts = await User.find({
    email: { $in: OPERATOR_EXPECTED.map(([email]) => email) },
  })
    .populate("role", "slug")
    .select("email userType role status")
    .lean();
  const operatorByEmail = new Map(
    operatorAccounts.map((item) => [item.email, item]),
  );
  for (const [email, expectedUserType, expectedRoleSlug] of OPERATOR_EXPECTED) {
    const account = operatorByEmail.get(email);
    assertCheck(Boolean(account), `found ${email}`);
    assertCheck(
      account?.userType === expectedUserType,
      `${email} userType=${expectedUserType}`,
    );
    assertCheck(
      account?.role?.slug === expectedRoleSlug,
      `${email} role=${expectedRoleSlug}`,
    );
    assertCheck(account?.status === "active", `${email} is active`);
  }

  const staff = await Staff.find({
    email: { $in: EXPECTED.map(([email]) => email) },
  }).lean();
  const staffByEmail = new Map(staff.map((item) => [item.email, item]));
  for (const [email] of EXPECTED) {
    assertCheck(Boolean(staffByEmail.get(email)), `found ${email}`);
  }

  const staffIds = staff.map((item) => item._id);
  const [currentSnapshots, previousSnapshots] = await Promise.all([
    StaffPerformanceSnapshot.find({
      restaurantId,
      employeeId: { $in: staffIds },
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    }).lean(),
    StaffPerformanceSnapshot.find({
      restaurantId,
      employeeId: { $in: staffIds },
      periodStart: PREVIOUS_START,
      periodEnd: PREVIOUS_END,
    }).lean(),
  ]);

  assertCheck(
    currentSnapshots.length === EXPECTED.length,
    `current-period snapshot count is ${EXPECTED.length}`,
  );
  assertCheck(
    previousSnapshots.length === EXPECTED.length,
    `previous-period snapshot count is ${EXPECTED.length}`,
  );

  const currentByEmployee = new Map(
    currentSnapshots.map((snapshot) => [String(snapshot.employeeId), snapshot]),
  );
  for (const [email, expectedLevel] of EXPECTED) {
    const employee = staffByEmail.get(email);
    const snapshot = employee
      ? currentByEmployee.get(String(employee._id))
      : null;
    assertCheck(Boolean(snapshot), `current snapshot exists for ${email}`);
    if (!snapshot) continue;
    assertCheck(
      snapshot.performanceLevel === expectedLevel,
      `${email} level=${expectedLevel}`,
    );
    assertCheck(
      Number.isFinite(Number(snapshot.finalPerformanceScore)),
      `${email} has final score`,
    );
    assertCheck(
      snapshot?.factors?.demoTag === TAG,
      `${email} snapshot is tagged`,
    );
    assertCheck(
      snapshot?.factors?.insufficientData === false,
      `${email} has sufficient performance data`,
    );
  }

  const cashier = staffByEmail.get("staff.cashier.demo@cohan.local");
  const chef = staffByEmail.get("staff.chef.demo@cohan.local");
  const helper = staffByEmail.get("staff.kitchenhelper.demo@cohan.local");
  const exception = staffByEmail.get("staff.exception.demo@cohan.local");
  const parttime = staffByEmail.get("staff.parttime.demo@cohan.local");

  const cashierSnapshot = cashier
    ? currentByEmployee.get(String(cashier._id))
    : null;
  assertCheck(
    Number(
      cashierSnapshot?.factors?.cashierMetrics?.totalHandledPayments || 0,
    ) === 5,
    "cashier has five handled payment orders",
  );
  assertCheck(
    Number(
      cashierSnapshot?.factors?.qualityEvidence?.cashierOperationalPenalty || 0,
    ) > 0,
    "cashier operational evidence affects quality",
  );
  assertCheck(
    cashierSnapshot?.factors?.qualityEvidence?.affectsScore === true,
    "cashier quality evidence is marked score-affecting",
  );

  const chefSnapshot = chef ? currentByEmployee.get(String(chef._id)) : null;
  assertCheck(
    Number(chefSnapshot?.factors?.kitchenMetrics?.totalItems || 0) === 6,
    "head chef has six kitchen work items",
  );
  assertCheck(
    Number(chefSnapshot?.factors?.qualityEvidence?.kitchenPenalty || 0) > 0,
    "head chef has a kitchen quality penalty",
  );

  const helperSnapshot = helper
    ? currentByEmployee.get(String(helper._id))
    : null;
  assertCheck(
    Number(helperSnapshot?.factors?.kitchenMetrics?.totalItems || 0) === 6,
    "kitchen helper has six kitchen work items",
  );
  assertCheck(
    Number(helperSnapshot?.factors?.qualityEvidence?.kitchenPenalty || 0) > 0,
    "kitchen helper has a role-aware kitchen penalty",
  );

  const exceptionSnapshot = exception
    ? currentByEmployee.get(String(exception._id))
    : null;
  assertCheck(
    Number(exceptionSnapshot?.factors?.incidentAdjustmentDelta || 0) === -6,
    "poor scenario contains the -6 incident adjustment",
  );
  assertCheck(
    Number(exceptionSnapshot?.factors?.appealReversalDelta || 0) === 0,
    "rejected appeal does not reverse score",
  );

  const parttimeSnapshot = parttime
    ? currentByEmployee.get(String(parttime._id))
    : null;
  assertCheck(
    Number(parttimeSnapshot?.factors?.incidentAdjustmentDelta || 0) === -8,
    "appeal scenario contains the -8 incident adjustment",
  );
  assertCheck(
    Number(parttimeSnapshot?.factors?.appealReversalDelta || 0) === 8,
    "accepted appeal contains the +8 reversal",
  );
  assertCheck(
    Number(parttimeSnapshot?.factors?.finalAdjustmentDelta || 0) === 0,
    "appeal scenario nets to zero adjustment",
  );

  const incidents = await PerformanceIncident.find({
    restaurantId,
    employeeId: { $in: staffIds },
    note: { $regex: TAG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") },
  }).lean();
  assertCheck(
    incidents.filter((item) => item.scoreImpactStatus === "applied").length ===
      2,
    "two incidents are applied",
  );
  assertCheck(
    incidents.some((item) => item.scoreImpactStatus === "pending"),
    "pending-review incident exists",
  );
  assertCheck(
    incidents.some((item) => item.scoreImpactStatus === "waived"),
    "waived incident exists",
  );

  const incidentIds = incidents.map((item) => item._id);
  const [adjustments, appeals, reversals] = await Promise.all([
    StaffPerformanceScoreAdjustment.find({
      incidentId: { $in: incidentIds },
    }).lean(),
    PerformanceIncidentAppeal.find({ incidentId: { $in: incidentIds } }).lean(),
    StaffPerformanceScoreReversal.find({
      incidentId: { $in: incidentIds },
    }).lean(),
  ]);
  assertCheck(adjustments.length === 2, "two score adjustments exist");
  assertCheck(
    appeals.some((item) => item.status === "accepted"),
    "accepted appeal exists",
  );
  assertCheck(
    appeals.some((item) => item.status === "rejected"),
    "rejected appeal exists",
  );
  assertCheck(
    reversals.length === 1 && Number(reversals[0]?.reversalDelta || 0) === 8,
    "one +8 score reversal exists",
  );

  const [ordersCount, reviewsCount, kitchenCount] = await Promise.all([
    Order.countDocuments({ restaurantId, "clientMeta.demoTag": TAG }),
    Review.countDocuments({ restaurantId, tags: TAG }),
    KitchenOrderWorkItem.countDocuments({
      restaurantId,
      issueReviewNote: { $regex: TAG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") },
    }),
  ]);
  assertCheck(ordersCount === 17, "seventeen tagged operational orders exist");
  assertCheck(reviewsCount === 7, "seven tagged customer reviews exist");
  assertCheck(kitchenCount === 12, "twelve tagged kitchen work items exist");

  console.log(`\nSummary: PASS=${state.pass} FAIL=${state.fail}`);
  return state.fail > 0 ? 1 : 0;
}

let exitCode = 1;
try {
  exitCode = await run();
} catch (error) {
  fail(error?.message || String(error));
  console.log(`\nSummary: PASS=${state.pass} FAIL=${state.fail}`);
} finally {
  await mongoose.disconnect().catch(() => {});
}
process.exit(exitCode);
