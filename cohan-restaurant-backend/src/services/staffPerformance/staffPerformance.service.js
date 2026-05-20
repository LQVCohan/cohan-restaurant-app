import mongoose from "mongoose";
import {
  AttendanceCorrectionRequest,
  Order,
  Review,
  Shift,
  Staff,
  StaffPerformanceReview,
  StaffPerformanceSnapshot,
  Timesheet,
} from "../../../models/index.js";

const { Types } = mongoose;

export const PERFORMANCE_WEIGHTS = {
  productivity: 25,
  punctuality: 25,
  quality: 20,
  managerReview: 20,
  compliance: 10,
};

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new Types.ObjectId(value);
}

function toValidDate(value, fieldName) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} không hợp lệ.`);
  }
  return date;
}

function toStartOfDay(value) {
  const date = toValidDate(value, "Ngày bắt đầu");
  date.setHours(0, 0, 0, 0);
  return date;
}

function toEndOfDay(value) {
  const date = toValidDate(value, "Ngày kết thúc");
  date.setHours(23, 59, 59, 999);
  return date;
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getActorId(ctx) {
  return toObjectId(ctx?.user?.id || ctx?.user?._id);
}

function getActorName(ctx) {
  return (
    ctx?.user?.fullName ||
    ctx?.user?.name ||
    ctx?.user?.username ||
    ctx?.user?.email ||
    "Người dùng"
  );
}

function getActorRole(ctx) {
  return normalizeRole(
    ctx?.user?.roleName ||
      ctx?.user?.userType ||
      ctx?.user?.role?.slug ||
      ctx?.user?.role ||
      "",
  );
}

function assertCanManagePerformance(ctx) {
  const role = getActorRole(ctx);
  if (!["admin", "manager", "hr"].includes(role)) {
    throw new Error("Bạn không có quyền cập nhật hiệu suất nhân viên.");
  }
}

function assertCanViewPerformance(ctx, employeeId) {
  const role = getActorRole(ctx);
  const actorId = getActorId(ctx);

  if (["admin", "manager", "hr", "accountant"].includes(role)) return;

  if (role === "staff" && actorId && String(actorId) === String(employeeId)) {
    return;
  }

  throw new Error("Bạn không có quyền xem hiệu suất nhân viên này.");
}

function clampScore(value, fallback = 75) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function weightedFinalScore(components) {
  const totalWeight = Object.values(PERFORMANCE_WEIGHTS).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );

  if (totalWeight <= 0) return 75;

  const raw =
    (components.productivity.score * PERFORMANCE_WEIGHTS.productivity +
      components.punctuality.score * PERFORMANCE_WEIGHTS.punctuality +
      components.quality.score * PERFORMANCE_WEIGHTS.quality +
      components.managerReview.score * PERFORMANCE_WEIGHTS.managerReview +
      components.compliance.score * PERFORMANCE_WEIGHTS.compliance) /
    totalWeight;

  return clampScore(raw);
}

export function resolvePerformanceLevel(score) {
  const n = Number(score || 0);

  if (n >= 90) return "excellent";
  if (n >= 80) return "good";
  if (n >= 65) return "average";
  if (n >= 50) return "needs_attention";
  return "poor";
}

function mapSnapshot(doc) {
  if (!doc) return null;

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

function mapReview(doc) {
  if (!doc) return null;

  const employee = doc.employeeId;

  return {
    id: String(doc._id),

    employeeId: String(employee?._id || employee),
    employeeName: employee?.fullName || null,
    employeeCode: employee?.employeeCode || null,

    restaurantId: String(doc.restaurantId),
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,

    managerRatingScore: Number(doc.managerRatingScore || 0),
    attitudeScore: Number(doc.attitudeScore || 0),
    teamworkScore: Number(doc.teamworkScore || 0),
    skillScore: Number(doc.skillScore || 0),

    note: doc.note || "",

    reviewedBy: doc.reviewedBy ? String(doc.reviewedBy) : null,
    reviewedByName: doc.reviewedByName || "",

    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

async function getPeerOrderBenchmark({ restaurantId, periodStart, periodEnd }) {
  const rows = await Order.aggregate([
    {
      $match: {
        restaurantId,
        userId: { $ne: null },
        createdAt: { $gte: periodStart, $lte: periodEnd },
        currentStatus: { $in: ["served", "completed", "paid"] },
      },
    },
    {
      $group: {
        _id: "$userId",
        orderCount: { $sum: 1 },
      },
    },
    {
      $sort: { orderCount: -1 },
    },
  ]);

  const maxOrders = Number(rows?.[0]?.orderCount || 0);

  return {
    maxOrders,
    byEmployeeId: new Map(
      rows.map((row) => [String(row._id), Number(row.orderCount || 0)]),
    ),
  };
}

async function calculateSnapshotForEmployee({
  employeeId,
  restaurantId,
  periodStart,
  periodEnd,
  ctx,
}) {
  const staff = await Staff.findById(employeeId).lean();

  if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
    throw new Error("Không tìm thấy nhân viên.");
  }

  const [timesheets, shiftsCount, correctionsCount, review, benchmark, customerRatingAgg] =
    await Promise.all([
      Timesheet.find({
        employeeId,
        restaurantId,
        workDate: { $gte: periodStart, $lte: periodEnd },
      }).lean(),

      Shift.countDocuments({
        employeeId,
        restaurantId,
        startTime: { $lte: periodEnd },
        endTime: { $gte: periodStart },
        status: { $ne: "cancelled" },
      }),

      AttendanceCorrectionRequest.countDocuments({
        employeeId,
        restaurantId,
        workDate: { $gte: periodStart, $lte: periodEnd },
        status: { $in: ["pending", "approved", "applied", "rejected"] },
      }),

      StaffPerformanceReview.findOne({
        employeeId,
        restaurantId,
        periodStart,
        periodEnd,
      }).lean(),

      getPeerOrderBenchmark({
        restaurantId,
        periodStart,
        periodEnd,
      }),
      Review.aggregate([
        {
          $match: {
            staffId: employeeId,
            restaurantId,
            createdAt: { $gte: periodStart, $lte: periodEnd },
            status: "published",
            rating: { $gte: 1, $lte: 5 },
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
    ]);

  const staffRateRaw = Number(customerRatingAgg?.[0]?.averageRating || 0);
  const staffRate = Number.isFinite(staffRateRaw)
    ? Math.round(staffRateRaw * 100) / 100
    : 0;
  const staffRateCount = Number(customerRatingAgg?.[0]?.totalReviews || 0);
  const customerRatingScore = clampScore(staffRate * 20, 0);

  const orderCount = benchmark.byEmployeeId.get(String(employeeId)) || 0;

  const productivityScore =
    benchmark.maxOrders > 0
      ? clampScore((orderCount / benchmark.maxOrders) * 100, 75)
      : shiftsCount > 0
        ? 75
        : 65;

  const recordCount = timesheets.length;
  const lateEvents = timesheets.filter(
    (row) => Number(row.latenessMinutes || 0) > 0,
  ).length;
  const earlyEvents = timesheets.filter(
    (row) => Number(row.earlyLeaveMinutes || 0) > 0,
  ).length;
  const absenceEvents = timesheets.filter((row) => !row.actualCheckInAt).length;

  const totalLateMinutes = timesheets.reduce(
    (sum, row) => sum + Number(row.latenessMinutes || 0),
    0,
  );
  const totalEarlyMinutes = timesheets.reduce(
    (sum, row) => sum + Number(row.earlyLeaveMinutes || 0),
    0,
  );

  const punctualityPenalty =
    lateEvents * 6 +
    earlyEvents * 5 +
    absenceEvents * 12 +
    totalLateMinutes * 0.15 +
    totalEarlyMinutes * 0.12;

  const punctualityScore =
    recordCount > 0 ? clampScore(100 - punctualityPenalty, 75) : 75;

  const qualityScore = review
    ? clampScore(
        (Number(review.skillScore || 75) +
          Number(review.attitudeScore || 75) +
          Number(review.teamworkScore || 75)) /
          3,
        75,
      )
    : 75;

  const managerBaseScore = review
    ? clampScore(
        (Number(review.managerRatingScore || 75) +
          Number(review.attitudeScore || 75) +
          Number(review.teamworkScore || 75) +
          Number(review.skillScore || 75)) /
          4,
        75,
      )
    : 75;

  const compliancePenalty = correctionsCount * 7;
  const complianceScore = clampScore(100 - compliancePenalty, 75);

  const components = {
    productivity: {
      score: productivityScore,
      weight: PERFORMANCE_WEIGHTS.productivity,
      note: "Dựa trên số order/khối lượng xử lý trong kỳ so với nhân viên cùng nhà hàng.",
    },
    punctuality: {
      score: punctualityScore,
      weight: PERFORMANCE_WEIGHTS.punctuality,
      note: "Dựa trên đi trễ, về sớm, vắng mặt và tổng số phút vi phạm.",
    },
    quality: {
      score: qualityScore,
      weight: PERFORMANCE_WEIGHTS.quality,
      note: "Dựa trên đánh giá chất lượng hiện có của nhân viên.",
    },
    managerReview: {
      score: managerBaseScore,
      weight: PERFORMANCE_WEIGHTS.managerReview,
      note: review
        ? "Dựa trên đánh giá quản lý trong kỳ."
        : "Chưa có đánh giá quản lý, dùng điểm trung lập.",
    },
    compliance: {
      score: complianceScore,
      weight: PERFORMANCE_WEIGHTS.compliance,
      note: "Dựa trên số yêu cầu chỉnh công và mức độ tuân thủ quy trình.",
    },
  };

  const finalPerformanceScore = weightedFinalScore(components);

  const actorId = getActorId(ctx);

  const doc = await StaffPerformanceSnapshot.findOneAndUpdate(
    {
      employeeId,
      restaurantId,
      periodStart,
      periodEnd,
    },
    {
      $set: {
        ...components,
        finalPerformanceScore,
        performanceLevel: resolvePerformanceLevel(finalPerformanceScore),
        factors: {
          orderCount,
          peerMaxOrderCount: benchmark.maxOrders,
          shiftsCount,
          recordCount,
          lateEvents,
          earlyEvents,
          absenceEvents,
          totalLateMinutes,
          totalEarlyMinutes,
          correctionsCount,
          staffRate,
          staffRateCount,
          customerRatingScore,
          hasManagerReview: Boolean(review),
        },
        generatedBy: actorId,
        generatedByName: getActorName(ctx),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  )
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .lean();

  return mapSnapshot(doc);
}

export async function upsertStaffPerformanceReview({ input, ctx }) {
  assertCanManagePerformance(ctx);

  const employeeId = toObjectId(input.employeeId);
  const restaurantId = toObjectId(input.restaurantId);

  if (!employeeId) throw new Error("employeeId không hợp lệ.");
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");

  const periodStart = toStartOfDay(input.periodStart);
  const periodEnd = toEndOfDay(input.periodEnd);

  if (periodEnd < periodStart) {
    throw new Error("Khoảng thời gian đánh giá không hợp lệ.");
  }

  const doc = await StaffPerformanceReview.findOneAndUpdate(
    {
      employeeId,
      restaurantId,
      periodStart,
      periodEnd,
    },
    {
      $set: {
        managerRatingScore: clampScore(input.managerRatingScore, 75),
        attitudeScore: clampScore(input.attitudeScore, 75),
        teamworkScore: clampScore(input.teamworkScore, 75),
        skillScore: clampScore(input.skillScore, 75),
        note: String(input.note || "").trim(),
        reviewedBy: getActorId(ctx),
        reviewedByName: getActorName(ctx),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  )
    .populate("employeeId", "fullName employeeCode")
    .lean();

  return mapReview(doc);
}

export async function recalculateStaffPerformanceSnapshots({ input, ctx }) {
  assertCanManagePerformance(ctx);

  const restaurantId = toObjectId(input.restaurantId);
  if (!restaurantId) throw new Error("restaurantId không hợp lệ.");

  const periodStart = toStartOfDay(input.periodStart);
  const periodEnd = toEndOfDay(input.periodEnd);

  if (periodEnd < periodStart) {
    throw new Error("Khoảng thời gian đánh giá không hợp lệ.");
  }

  const employeeId = toObjectId(input.employeeId);

  const staffFilter = {
    userType: "STAFF",
    deletedAt: null,
    $or: [
      { restaurantForStaff: restaurantId },
    ],
  };

  if (employeeId) {
    staffFilter._id = employeeId;
    delete staffFilter.$or;
  }

  const staffList = await Staff.find(staffFilter).select({ _id: 1 }).lean();

  const results = [];

  for (const staff of staffList) {
    const result = await calculateSnapshotForEmployee({
      employeeId: staff._id,
      restaurantId,
      periodStart,
      periodEnd,
      ctx,
    });

    results.push(result);
  }

  return results;
}

export async function listStaffPerformanceSnapshots({ filter = {}, ctx }) {
  const query = {};

  const restaurantId = toObjectId(filter.restaurantId);
  const employeeId = toObjectId(filter.employeeId);

  if (restaurantId) query.restaurantId = restaurantId;
  if (employeeId) query.employeeId = employeeId;

  if (filter.periodStart || filter.periodEnd) {
    query.periodStart = {};
    if (filter.periodStart)
      query.periodStart.$gte = toStartOfDay(filter.periodStart);
    if (filter.periodEnd) query.periodStart.$lte = toEndOfDay(filter.periodEnd);
  }

  if (employeeId) {
    assertCanViewPerformance(ctx, employeeId);
  }

  const rows = await StaffPerformanceSnapshot.find(query)
    .populate(
      "employeeId",
      "fullName employeeCode positionTitle roleName avatarUrl avatar",
    )
    .sort({ periodEnd: -1, finalPerformanceScore: -1 })
    .limit(1000)
    .lean();

  return rows.map(mapSnapshot);
}

export async function getLatestStaffPerformanceSnapshot({
  employeeId,
  restaurantId,
  atDate,
}) {
  const eid = toObjectId(employeeId);
  const rid = toObjectId(restaurantId);

  if (!eid || !rid) return null;

  const date = atDate ? new Date(atDate) : new Date();

  const exact = await StaffPerformanceSnapshot.findOne({
    employeeId: eid,
    restaurantId: rid,
    periodStart: { $lte: date },
    periodEnd: { $gte: date },
  })
    .sort({ periodEnd: -1, createdAt: -1 })
    .lean();

  if (exact) return exact;

  return StaffPerformanceSnapshot.findOne({
    employeeId: eid,
    restaurantId: rid,
    periodEnd: { $lte: date },
  })
    .sort({ periodEnd: -1, createdAt: -1 })
    .lean();
}
