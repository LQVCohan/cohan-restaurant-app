import "dotenv/config.js";
import mongoose from "mongoose";
import {
  PerformanceIncident,
  PerformanceIncidentAppeal,
  Restaurant,
  Shift,
  Staff,
  StaffPerformanceScoreAdjustment,
  StaffPerformanceScoreReversal,
  StaffPerformanceSnapshot,
  User,
} from "../models/index.js";
import { recalculateStaffPerformanceSnapshots } from "../src/services/staffPerformance/staffPerformance.service.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const DEMO_TAG = "[demo-scheduling-pr21]";
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const TARGET_EMAILS = [
  "staff.parttime.demo@cohan.local",
  "staff.cashier.demo@cohan.local",
  "staff.fulltime.demo@cohan.local",
];

const state = { pass: 0, warn: 0, fail: 0 };
const pass = (msg) => {
  state.pass += 1;
  console.log(`PASS ${msg}`);
};
const warn = (msg) => {
  state.warn += 1;
  console.warn(`WARN ${msg}`);
};
const fail = (msg) => {
  state.fail += 1;
  console.error(`FAIL ${msg}`);
};
const clampScore = (value) =>
  Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

async function resolveDemoRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const byId = await Restaurant.findById(DEMO_RESTAURANT_ID).lean();
    if (!byId)
      throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${DEMO_RESTAURANT_ID}`);
    return byId;
  }
  return Restaurant.findOne({
    name: "Cohan Demo Restaurant - District 1",
    description: { $regex: DEMO_TAG },
  }).lean();
}

function isDemoRestaurant(restaurant) {
  if (!restaurant) return false;
  if (DEMO_RESTAURANT_ID) return true;
  const nameMatch = restaurant.name === "Cohan Demo Restaurant - District 1";
  const descMatch =
    typeof restaurant.description === "string" &&
    restaurant.description.includes(DEMO_TAG);
  return nameMatch || descMatch;
}

async function resolvePeriodBounds({ restaurantId, staffIds, snapshots }) {
  const bySnapshot = snapshots[0];
  if (bySnapshot?.periodStart && bySnapshot?.periodEnd) {
    return {
      periodStart: bySnapshot.periodStart,
      periodEnd: bySnapshot.periodEnd,
      source: "snapshot",
    };
  }

  const byIncident = await PerformanceIncident.findOne({
    restaurantId,
    employeeId: { $in: staffIds },
  })
    .sort({ occurredAt: -1 })
    .select("occurredAt")
    .lean();
  if (byIncident?.occurredAt) {
    const d = new Date(byIncident.occurredAt);
    return {
      periodStart: new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0),
      ),
      periodEnd: new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
      ),
      source: "incident",
    };
  }

  const byShift = await Shift.findOne({
    restaurantId,
    employeeId: { $in: staffIds },
  })
    .sort({ startTime: -1 })
    .select("startTime")
    .lean();
  if (byShift?.startTime) {
    const d = new Date(byShift.startTime);
    return {
      periodStart: new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0),
      ),
      periodEnd: new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999),
      ),
      source: "shift",
    };
  }

  return null;
}

async function run() {
  assertDemoScriptAllowed("verifyStaffPerformanceDemoRegression.js");
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.MONGO_DB || "cohan";
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  pass(`Connected MongoDB db=${DB_NAME}`);

  const restaurant = await resolveDemoRestaurant();
  if (!restaurant) throw new Error("DEMO_RESTAURANT_NOT_FOUND_BY_TAG");
  pass(`Resolved restaurant ${restaurant._id}`);

  const demoStaff = await Staff.find({ email: { $in: TARGET_EMAILS } })
    .select("_id email")
    .lean();
  const byEmail = new Map(demoStaff.map((s) => [s.email, s]));
  byEmail.get("staff.parttime.demo@cohan.local")
    ? pass("Found demo staff parttime")
    : fail("Missing demo staff parttime");
  byEmail.get("staff.fulltime.demo@cohan.local")
    ? pass("Found demo staff fulltime")
    : fail("Missing demo staff fulltime");
  byEmail.get("staff.cashier.demo@cohan.local")
    ? pass("Found demo staff cashier")
    : warn("Optional demo staff cashier missing");

  const staffIds = demoStaff.map((s) => s._id);
  let snapshots = await StaffPerformanceSnapshot.find({
    restaurantId: restaurant._id,
    employeeId: { $in: staffIds },
  })
    .sort({ periodEnd: -1 })
    .lean();
  snapshots.length
    ? pass(`Found ${snapshots.length} snapshots`)
    : fail("No snapshots for demo staff");

  const manager = await User.findOne({ email: "manager.demo@cohan.local" })
    .select("_id fullName userType")
    .lean();
  const periodBounds = await resolvePeriodBounds({
    restaurantId: restaurant._id,
    staffIds,
    snapshots,
  });
  if (periodBounds) pass(`Resolved demo period from ${periodBounds.source}`);
  else warn("Could not resolve demo period for recalculate");

  const safeToMutate =
    String(process.env.NODE_ENV || "").toLowerCase() !== "production" &&
    !!manager &&
    isDemoRestaurant(restaurant) &&
    !!periodBounds;

  if (!manager) {
    warn("manager.demo@cohan.local not found; skipping recalculate");
  }

  if (!safeToMutate) {
    warn(
      "Unsafe to recalculate (production, missing manager/period, or non-demo restaurant). Running read-only checks.",
    );
  } else {
    await recalculateStaffPerformanceSnapshots({
      input: {
        restaurantId: String(restaurant._id),
        periodStart: periodBounds.periodStart,
        periodEnd: periodBounds.periodEnd,
      },
      ctx: {
        user: {
          id: manager._id,
          _id: manager._id,
          roleName: "manager",
          userType: manager.userType,
          fullName: manager.fullName,
        },
      },
    });
    pass("Recalculated demo snapshots before hard checks");
    snapshots = await StaffPerformanceSnapshot.find({
      restaurantId: restaurant._id,
      employeeId: { $in: staffIds },
    })
      .sort({ periodEnd: -1 })
      .lean();
  }

  const latestByEmployee = new Map();
  for (const snap of snapshots)
    if (!latestByEmployee.has(String(snap.employeeId)))
      latestByEmployee.set(String(snap.employeeId), snap);

  for (const staff of demoStaff) {
    const snap = latestByEmployee.get(String(staff._id));
    if (!snap) {
      fail(`Missing snapshot for ${staff.email}`);
      continue;
    }
    if (typeof snap.finalPerformanceScore !== "number")
      fail(`Missing finalPerformanceScore for ${staff.email}`);
    else pass(`finalPerformanceScore present for ${staff.email}`);
    if (!snap.performanceLevel)
      fail(`Missing performanceLevel for ${staff.email}`);
    else pass(`performanceLevel present for ${staff.email}`);
    if (!snap.factors || typeof snap.factors !== "object") {
      fail(`Missing factors for ${staff.email}`);
      continue;
    }
    if (typeof snap.factors.baseFormulaScore !== "number")
      fail(`Missing factors.baseFormulaScore for ${staff.email}`);
    else pass(`baseFormulaScore present for ${staff.email}`);
    if (typeof snap.factors.finalAdjustmentDelta !== "number")
      fail(`Missing factors.finalAdjustmentDelta for ${staff.email}`);
    else pass(`finalAdjustmentDelta present for ${staff.email}`);

    const appliedIncidents = await PerformanceIncident.find({
      employeeId: staff._id,
      restaurantId: restaurant._id,
      scoreImpactStatus: "applied",
      occurredAt: { $gte: snap.periodStart, $lte: snap.periodEnd },
    })
      .select("_id")
      .lean();

    if (!appliedIncidents.length) {
      warn(`No applied incidents in snapshot period for ${staff.email}`);
    } else {
      const incidentIds = appliedIncidents.map((i) => i._id);
      const adjustments = await StaffPerformanceScoreAdjustment.find({
        incidentId: { $in: incidentIds },
      }).lean();
      const reversals = await StaffPerformanceScoreReversal.find({
        incidentId: { $in: incidentIds },
      }).lean();
      const appeals = await PerformanceIncidentAppeal.find({
        incidentId: { $in: incidentIds },
        status: "accepted",
      }).lean();
      adjustments.length
        ? pass(
            `Found ${adjustments.length} adjustments in-period for ${staff.email}`,
          )
        : fail(`Missing adjustments for applied incidents (${staff.email})`);
      appeals.length
        ? pass(
            `Found ${appeals.length} accepted appeals in-period for ${staff.email}`,
          )
        : warn(`No accepted appeals in-period for ${staff.email}`);
      reversals.length
        ? pass(
            `Found ${reversals.length} reversals in-period for ${staff.email}`,
          )
        : warn(`No reversals in-period for ${staff.email}`);

      const totalIncidentDelta = adjustments.reduce(
        (sum, x) => sum + Number(x.scoreDelta || 0),
        0,
      );
      const totalReversalDelta = reversals.reduce(
        (sum, x) => sum + Number(x.reversalDelta || 0),
        0,
      );
      if (
        Number(snap.factors.incidentAdjustmentDelta || 0) !== totalIncidentDelta
      )
        fail(`incidentAdjustmentDelta mismatch for ${staff.email}`);
      else pass(`incidentAdjustmentDelta matches for ${staff.email}`);
      if (Number(snap.factors.appealReversalDelta || 0) !== totalReversalDelta)
        fail(`appealReversalDelta mismatch for ${staff.email}`);
      else pass(`appealReversalDelta matches for ${staff.email}`);
    }

    const expectedFinal = clampScore(
      Number(snap.factors.baseFormulaScore || 0) +
        Number(snap.factors.finalAdjustmentDelta || 0),
    );
    if (Number(snap.finalPerformanceScore || 0) !== expectedFinal)
      fail(`final score formula mismatch for ${staff.email}`);
    else pass(`final score formula matches for ${staff.email}`);
  }

  if (safeToMutate) {
    const candidate = snapshots.find(
      (snap) => Number(snap?.factors?.incidentAdjustmentDelta || 0) !== 0,
    );
    if (!candidate) {
      warn(
        "No meaningful recalculate stability candidate with incident delta in same period",
      );
    } else {
      const before = await StaffPerformanceSnapshot.findById(
        candidate._id,
      ).lean();
      await recalculateStaffPerformanceSnapshots({
        input: {
          restaurantId: String(restaurant._id),
          employeeId: String(candidate.employeeId),
          periodStart: candidate.periodStart,
          periodEnd: candidate.periodEnd,
        },
        ctx: {
          user: {
            id: manager._id,
            _id: manager._id,
            roleName: "manager",
            userType: manager.userType,
            fullName: manager.fullName,
          },
        },
      });
      const after = await StaffPerformanceSnapshot.findById(
        candidate._id,
      ).lean();
      Number(before.finalPerformanceScore || 0) ===
      Number(after.finalPerformanceScore || 0)
        ? pass("Recalculate stability kept finalPerformanceScore")
        : fail("Recalculate stability changed finalPerformanceScore");
      Number(before?.factors?.finalAdjustmentDelta || 0) ===
      Number(after?.factors?.finalAdjustmentDelta || 0)
        ? pass("Recalculate stability kept finalAdjustmentDelta")
        : fail("Recalculate stability changed finalAdjustmentDelta");
      const expectedAfter = clampScore(
        Number(after?.factors?.baseFormulaScore || 0) +
          Number(after?.factors?.finalAdjustmentDelta || 0),
      );
      Number(after?.finalPerformanceScore || 0) === expectedAfter
        ? pass("Recalculate stability final score formula matches")
        : fail("Recalculate stability final score formula mismatch");
    }
  }

  for (const staff of demoStaff) {
    if (
      !staff.email.includes("cashier") &&
      staff.email !== "staff.parttime.demo@cohan.local"
    )
      continue;
    const snap = latestByEmployee.get(String(staff._id));
    if (!snap?.factors) continue;
    const cashierMetrics = snap.factors.cashierMetrics;
    const qualityEvidence = snap.factors.qualityEvidence;
    if (!cashierMetrics) {
      warn(
        `No cashierMetrics for ${staff.email} (optional when no cashier transactions exist)`,
      );
      continue;
    }
    pass(`cashierMetrics exists for ${staff.email}`);
    if (!qualityEvidence) {
      warn(`Missing qualityEvidence for ${staff.email}`);
      continue;
    }
    pass(`qualityEvidence exists for ${staff.email}`);
    if (Number(qualityEvidence.cashierOperationalPenalty || 0) > 0) {
      qualityEvidence.hasCashierOperationalEvidence === true
        ? pass(`Cashier evidence consistent for ${staff.email}`)
        : fail(
            `cashierOperationalPenalty > 0 but hasCashierOperationalEvidence != true for ${staff.email}`,
          );
    } else {
      warn(
        `No cashier operational issues seeded for ${staff.email} (optional demo condition)`,
      );
    }
  }

  console.log(
    `\nSummary: PASS=${state.pass} WARN=${state.warn} FAIL=${state.fail}`,
  );
  return state.fail > 0 ? 1 : 0;
}

(async () => {
  let exitCode = 1;
  try {
    exitCode = await run();
  } catch (error) {
    fail(error?.message || String(error));
    console.log(
      `\nSummary: PASS=${state.pass} WARN=${state.warn} FAIL=${state.fail}`,
    );
    exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {}
  }
  process.exit(exitCode);
})();
