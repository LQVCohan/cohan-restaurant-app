import "dotenv/config.js";
import mongoose from "mongoose";
import {
  PerformanceIncident,
  PerformanceIncidentAppeal,
  Restaurant,
  Staff,
  StaffPerformanceScoreAdjustment,
  StaffPerformanceScoreReversal,
  StaffPerformanceSnapshot,
  User,
} from "../models/index.js";
import { recalculateStaffPerformanceSnapshots } from "../src/services/staffPerformance/staffPerformance.service.js";

const DEMO_TAG = "[demo-scheduling-pr21]";
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const TARGET_EMAILS = [
  "staff.parttime.demo@cohan.local",
  "staff.cashier.demo@cohan.local",
  "staff.fulltime.demo@cohan.local",
];

const state = { pass: 0, warn: 0, fail: 0 };
function pass(msg) { state.pass += 1; console.log(`PASS ${msg}`); }
function warn(msg) { state.warn += 1; console.warn(`WARN ${msg}`); }
function fail(msg) { state.fail += 1; console.error(`FAIL ${msg}`); }
const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

async function resolveDemoRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const byId = await Restaurant.findById(DEMO_RESTAURANT_ID).lean();
    if (!byId) throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${DEMO_RESTAURANT_ID}`);
    return byId;
  }
  return Restaurant.findOne({
    name: "Cohan Demo Restaurant - District 1",
    description: { $regex: DEMO_TAG },
  }).lean();
}

async function run() {
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.MONGO_DB || "foodhub";
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  pass(`Connected MongoDB db=${DB_NAME}`);

  const restaurant = await resolveDemoRestaurant();
  if (!restaurant) throw new Error("DEMO_RESTAURANT_NOT_FOUND_BY_TAG");
  pass(`Resolved demo restaurant ${restaurant._id}`);

  const demoStaff = await Staff.find({ email: { $in: TARGET_EMAILS } })
    .select("_id email fullName")
    .lean();
  const byEmail = new Map(demoStaff.map((s) => [s.email, s]));
  if (!byEmail.get("staff.parttime.demo@cohan.local")) fail("Missing demo staff: staff.parttime.demo@cohan.local");
  else pass("Found demo staff parttime");
  if (!byEmail.get("staff.fulltime.demo@cohan.local")) fail("Missing demo staff: staff.fulltime.demo@cohan.local");
  else pass("Found demo staff fulltime");
  if (!byEmail.get("staff.cashier.demo@cohan.local")) warn("Optional demo staff not present: staff.cashier.demo@cohan.local");
  else pass("Found demo staff cashier");

  const staffIds = demoStaff.map((s) => s._id);
  const snapshots = await StaffPerformanceSnapshot.find({
    restaurantId: restaurant._id,
    employeeId: { $in: staffIds },
  }).sort({ periodEnd: -1 }).lean();
  if (!snapshots.length) fail("No staff performance snapshots for demo staff.");
  else pass(`Found ${snapshots.length} demo snapshots`);

  const latestByEmployee = new Map();
  for (const row of snapshots) {
    const key = String(row.employeeId);
    if (!latestByEmployee.has(key)) latestByEmployee.set(key, row);
  }
  for (const staff of demoStaff) {
    const snap = latestByEmployee.get(String(staff._id));
    if (!snap) {
      fail(`Missing snapshot for ${staff.email}`);
      continue;
    }
    if (typeof snap.finalPerformanceScore !== "number") fail(`Snapshot missing finalPerformanceScore for ${staff.email}`);
    else pass(`Snapshot has finalPerformanceScore for ${staff.email}`);
    if (!snap.performanceLevel) fail(`Snapshot missing performanceLevel for ${staff.email}`);
    else pass(`Snapshot has performanceLevel for ${staff.email}`);
    if (!snap.factors || typeof snap.factors !== "object") fail(`Snapshot missing factors for ${staff.email}`);
    else pass(`Snapshot has factors for ${staff.email}`);
    if (typeof snap?.factors?.baseFormulaScore !== "number") fail(`Snapshot missing factors.baseFormulaScore for ${staff.email}`);
    else pass(`Snapshot has factors.baseFormulaScore for ${staff.email}`);
    if (typeof snap?.factors?.finalAdjustmentDelta !== "number") fail(`Snapshot missing factors.finalAdjustmentDelta for ${staff.email}`);
    else pass(`Snapshot has factors.finalAdjustmentDelta for ${staff.email}`);
  }

  const appliedIncidents = await PerformanceIncident.find({
    restaurantId: restaurant._id,
    scoreImpactStatus: "applied",
  }).lean();
  if (!appliedIncidents.length) fail("No applied incidents found in demo restaurant.");
  else pass(`Found ${appliedIncidents.length} applied incidents`);

  const appliedIncidentIds = appliedIncidents.map((i) => i._id);
  const adjustments = await StaffPerformanceScoreAdjustment.find({
    incidentId: { $in: appliedIncidentIds },
  }).lean();
  if (!adjustments.length) fail("No StaffPerformanceScoreAdjustment found for applied incidents.");
  else pass(`Found ${adjustments.length} score adjustments for applied incidents`);

  const appeals = await PerformanceIncidentAppeal.find({
    incidentId: { $in: appliedIncidentIds },
    status: "accepted",
  }).lean();
  if (!appeals.length) warn("No accepted appeals found for applied incidents.");
  else pass(`Found ${appeals.length} accepted appeals`);

  const reversals = await StaffPerformanceScoreReversal.find({
    incidentId: { $in: appliedIncidentIds },
  }).lean();
  if (!reversals.length) warn("No score reversals found for applied incidents.");
  else pass(`Found ${reversals.length} score reversals`);

  const incidentsByEmployee = new Map();
  for (const incident of appliedIncidents) {
    const key = String(incident.employeeId);
    const list = incidentsByEmployee.get(key) || [];
    list.push(incident);
    incidentsByEmployee.set(key, list);
  }
  for (const staff of demoStaff) {
    const snap = latestByEmployee.get(String(staff._id));
    if (!snap) continue;
    const employeeIncidents = incidentsByEmployee.get(String(staff._id)) || [];
    if (!employeeIncidents.length) {
      warn(`No applied incidents in demo period for ${staff.email}`);
      continue;
    }
    const incidentIdSet = new Set(employeeIncidents.map((x) => String(x._id)));
    const totalIncidentDelta = adjustments
      .filter((adj) => incidentIdSet.has(String(adj.incidentId)))
      .reduce((sum, adj) => sum + Number(adj.scoreDelta || 0), 0);
    const totalReversalDelta = reversals
      .filter((rev) => incidentIdSet.has(String(rev.incidentId)))
      .reduce((sum, rev) => sum + Number(rev.reversalDelta || 0), 0);
    const finalAdjustmentDelta = Number(snap?.factors?.finalAdjustmentDelta || 0);
    const expectedFinal = clampScore(Number(snap?.factors?.baseFormulaScore || 0) + finalAdjustmentDelta);

    if (Number(snap?.factors?.incidentAdjustmentDelta || 0) !== totalIncidentDelta) fail(`incidentAdjustmentDelta mismatch for ${staff.email}`);
    else pass(`incidentAdjustmentDelta matches for ${staff.email}`);
    if (Number(snap?.factors?.appealReversalDelta || 0) !== totalReversalDelta) fail(`appealReversalDelta mismatch for ${staff.email}`);
    else pass(`appealReversalDelta matches for ${staff.email}`);
    if (Number(snap.finalPerformanceScore || 0) !== expectedFinal) fail(`finalPerformanceScore != clamp(baseFormulaScore + finalAdjustmentDelta) for ${staff.email}`);
    else pass(`finalPerformanceScore formula check passes for ${staff.email}`);
  }

  const manager = await User.findOne({ email: "manager.demo@cohan.local" }).select("_id fullName userType").lean();
  if (!manager) {
    fail("Missing manager.demo@cohan.local, cannot verify recalculate stability.");
  } else if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    warn("NODE_ENV=production, skipping recalculate mutation safety check.");
  } else {
    const candidate = snapshots[0];
    if (!candidate) {
      fail("No candidate snapshot for recalculate stability.");
    } else {
      const before = await StaffPerformanceSnapshot.findById(candidate._id).lean();
      await recalculateStaffPerformanceSnapshots({
        input: {
          restaurantId: String(restaurant._id),
          employeeId: String(candidate.employeeId),
          periodStart: before.periodStart,
          periodEnd: before.periodEnd,
        },
        ctx: { user: { id: manager._id, _id: manager._id, roleName: "manager", userType: manager.userType, fullName: manager.fullName } },
      });
      const after = await StaffPerformanceSnapshot.findById(candidate._id).lean();
      if (Number(before.finalPerformanceScore || 0) !== Number(after.finalPerformanceScore || 0)) fail("Recalculate stability failed: finalPerformanceScore changed.");
      else pass("Recalculate stability: finalPerformanceScore preserved.");
      if (Number(before?.factors?.finalAdjustmentDelta || 0) !== Number(after?.factors?.finalAdjustmentDelta || 0)) fail("Recalculate stability failed: finalAdjustmentDelta changed.");
      else pass("Recalculate stability: finalAdjustmentDelta preserved.");
    }
  }

  for (const staff of demoStaff) {
    if (!staff.email.includes("cashier") && staff.email !== "staff.parttime.demo@cohan.local") continue;
    const snap = latestByEmployee.get(String(staff._id));
    if (!snap) continue;
    const cashierMetrics = snap?.factors?.cashierMetrics;
    const qualityEvidence = snap?.factors?.qualityEvidence;
    if (!cashierMetrics) {
      warn(`No cashierMetrics in snapshot factors for ${staff.email}`);
      continue;
    }
    pass(`cashierMetrics exists for ${staff.email}`);
    if (!qualityEvidence) {
      fail(`Missing qualityEvidence for ${staff.email}`);
      continue;
    }
    pass(`qualityEvidence exists for ${staff.email}`);
    if (Number(qualityEvidence.cashierOperationalPenalty || 0) > 0) {
      if (qualityEvidence.hasCashierOperationalEvidence !== true) fail(`cashierOperationalPenalty > 0 but hasCashierOperationalEvidence != true for ${staff.email}`);
      else pass(`cashier operational evidence consistency check passes for ${staff.email}`);
    } else {
      warn(`No cashier operational issues seeded for ${staff.email} (optional demo condition).`);
    }
  }

  console.log(`\nSummary: PASS=${state.pass} WARN=${state.warn} FAIL=${state.fail}`);
  process.exit(state.fail > 0 ? 1 : 0);
}

run().catch(async (error) => {
  fail(error?.message || String(error));
  console.log(`\nSummary: PASS=${state.pass} WARN=${state.warn} FAIL=${state.fail}`);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
}).finally(async () => {
  try { await mongoose.disconnect(); } catch {}
});
