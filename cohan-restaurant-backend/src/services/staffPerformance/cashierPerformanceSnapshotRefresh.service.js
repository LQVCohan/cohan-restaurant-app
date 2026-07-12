import mongoose from "mongoose";
import { StaffPerformanceSnapshot } from "../../../models/index.js";
import { applyPerformancePolicyToRecalculationResult } from "./staffPerformancePolicy.service.js";
import { enrichCashierPerformanceRecalculationResult } from "./cashierShiftReconciliation.service.js";

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function mapSnapshot(doc) {
  const employee = doc.employeeId;
  return {
    id: String(doc._id),
    employeeId: String(employee?._id || employee),
    employeeName: employee?.fullName || null,
    employeeCode: employee?.employeeCode || null,
    employeeRole: employee?.positionTitle || employee?.roleName || null,
    employeeAvatar: employee?.avatarUrl || employee?.avatar || null,
    restaurantId: String(doc.restaurantId),
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,
    productivity: doc.productivity,
    punctuality: doc.punctuality,
    quality: doc.quality,
    managerReview: doc.managerReview,
    compliance: doc.compliance,
    finalPerformanceScore: Number(doc.finalPerformanceScore || 0),
    performanceLevel: doc.performanceLevel || "average",
    factors: doc.factors || {},
    generatedBy: doc.generatedBy ? String(doc.generatedBy) : null,
    generatedByName: doc.generatedByName || "",
    reviewedBy: doc.reviewedBy ? String(doc.reviewedBy) : null,
    reviewedAt: doc.reviewedAt || null,
    lockedAt: doc.lockedAt || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

export async function refreshCashierPerformanceSnapshotsForReconciliation(
  reconciliation,
) {
  const restaurantId = toObjectId(reconciliation?.restaurantId);
  const cashierId = toObjectId(reconciliation?.cashierId);
  const openedAt = reconciliation?.openedAt
    ? new Date(reconciliation.openedAt)
    : null;
  const closedAt = reconciliation?.closedAt
    ? new Date(reconciliation.closedAt)
    : null;

  if (
    !restaurantId ||
    !cashierId ||
    !openedAt ||
    !closedAt ||
    Number.isNaN(openedAt.getTime()) ||
    Number.isNaN(closedAt.getTime())
  ) {
    return [];
  }

  const rows = await StaffPerformanceSnapshot.find({
    restaurantId,
    employeeId: cashierId,
    periodStart: { $lte: closedAt },
    periodEnd: { $gte: openedAt },
  })
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .lean();

  if (!rows.length) return [];
  const enriched = await enrichCashierPerformanceRecalculationResult({
    result: rows.map(mapSnapshot),
    restaurantId,
  });
  return applyPerformancePolicyToRecalculationResult({
    result: enriched,
    restaurantId,
  });
}
