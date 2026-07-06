import "dotenv/config.js";
import mongoose from "mongoose";
import {
  AttendanceCorrectionRequest,
  BrandMembership,
  KitchenOrderWorkItem,
  MenuItem,
  Order,
  PerformanceIncident,
  PerformanceIncidentAppeal,
  Restaurant,
  Review,
  Shift,
  Staff,
  StaffPerformanceReview,
  StaffPerformanceScoreAdjustment,
  StaffPerformanceScoreReversal,
  StaffPerformanceSnapshot,
  Timesheet,
  User,
} from "../models/index.js";
import { recalculateStaffPerformanceSnapshots } from "../src/services/staffPerformance/staffPerformance.service.js";
import { canAccessRestaurant } from "../src/services/auth/restaurantScope.service.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const TAG = "[demo-staff-performance-2026-07]";
const BRAND_ID = process.env.DEMO_BRAND_ID?.trim() || "6a447f6bea9844b4c8544c49";
const RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "69ce9e2e8d8d711f12e251b1";
const MANAGER_ID = process.env.DEMO_MANAGER_ID?.trim() || "69f7162dab80d0aaef80d5c8";

const CURRENT_PERIOD = {
  start: new Date("2026-07-01T00:00:00.000Z"),
  end: new Date("2026-07-31T23:59:59.999Z"),
};

const PREVIOUS_PERIOD = {
  start: new Date("2026-06-01T00:00:00.000Z"),
  end: new Date("2026-06-30T23:59:59.999Z"),
};

const STAFF_SCENARIOS = [
  {
    key: "serverExcellent",
    email: "staff.server.demo@cohan.local",
    employeeCode: "PERF-SRV-01",
    positionTitle: "Phục vụ",
    expectedLevel: "excellent",
    previousReview: [86, 88],
    currentReview: [94, 95],
    currentWorkedMinutes: [480, 480, 480, 480],
    currentLateMinutes: [0, 0, 0, 0],
    currentEarlyMinutes: [0, 0, 0, 0],
    currentCorrectionCount: 0,
  },
  {
    key: "supervisorGood",
    email: "staff.supervisor.demo@cohan.local",
    employeeCode: "PERF-SUP-01",
    positionTitle: "Giám sát phục vụ",
    expectedLevel: "good",
    previousReview: [80, 82],
    currentReview: [86, 86],
    currentWorkedMinutes: [420, 420, 420, 420],
    currentLateMinutes: [20, 0, 0, 0],
    currentEarlyMinutes: [0, 0, 0, 0],
    currentCorrectionCount: 1,
  },
  {
    key: "cashierAverage",
    email: "staff.cashier.demo@cohan.local",
    employeeCode: "PERF-CSH-01",
    positionTitle: "Thu ngân",
    expectedLevel: "average",
    previousReview: [82, 80],
    currentReview: [75, 78],
    currentWorkedMinutes: [390, 390, 390, 390],
    currentLateMinutes: [20, 0, 0, 0],
    currentEarlyMinutes: [30, 0, 0, 0],
    currentCorrectionCount: 2,
  },
  {
    key: "chefAttention",
    email: "staff.chef.demo@cohan.local",
    employeeCode: "PERF-CHEF-01",
    positionTitle: "Bếp trưởng",
    expectedLevel: "needs_attention",
    previousReview: [78, 76],
    currentReview: [65, 65],
    currentWorkedMinutes: [360, 360, 360, 0],
    currentLateMinutes: [30, 0, 0, 0],
    currentEarlyMinutes: [0, 30, 0, 0],
    currentCorrectionCount: 3,
  },
  {
    key: "helperAverage",
    email: "staff.kitchenhelper.demo@cohan.local",
    employeeCode: "PERF-KH-01",
    positionTitle: "Phụ bếp",
    expectedLevel: "average",
    previousReview: [68, 70],
    currentReview: [70, 72],
    currentWorkedMinutes: [330, 330, 330, 330],
    currentLateMinutes: [20, 20, 0, 0],
    currentEarlyMinutes: [0, 0, 0, 0],
    currentCorrectionCount: 2,
  },
  {
    key: "exceptionPoor",
    email: "staff.exception.demo@cohan.local",
    employeeCode: "PERF-EXC-01",
    positionTitle: "Nhân viên bếp",
    expectedLevel: "poor",
    previousReview: [60, 60],
    currentReview: [45, 55],
    currentWorkedMinutes: [180, 0, 180, 0],
    currentLateMinutes: [45, 0, 0, 0],
    currentEarlyMinutes: [0, 0, 60, 0],
    currentCorrectionCount: 5,
  },
  {
    key: "parttimeAppeal",
    email: "staff.parttime.demo@cohan.local",
    employeeCode: "PERF-APL-01",
    positionTitle: "Thu ngân",
    expectedLevel: "good",
    previousReview: [76, 76],
    currentReview: [82, 80],
    currentWorkedMinutes: [420, 420, 420, 420],
    currentLateMinutes: [10, 0, 0, 0],
    currentEarlyMinutes: [0, 0, 0, 0],
    currentCorrectionCount: 1,
  },
];

const objectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new Error(`${fieldName} không hợp lệ: ${value}`);
  }
  return new mongoose.Types.ObjectId(value);
};

const atUtc = (year, monthIndex, day, hour = 0, minute = 0) =>
  new Date(Date.UTC(year, monthIndex, day, hour, minute, 0, 0));

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tagRegex = new RegExp(escapeRegExp(TAG));
const currentShiftDays = [1, 2, 3, 4];
const previousShiftDays = [2, 3, 4, 5];
const roundScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

function buildOrderItem(menuItem, { status = "served", voidRequests = [], returnRequests = [] } = {}) {
  const price = Number(menuItem.basePrice || 0);
  return {
    dishId: menuItem._id,
    menuId: menuItem.menuId,
    categoryId: menuItem.categoryId,
    prepStation: menuItem.prepStation || "kitchen",
    name: menuItem.name,
    unit: "portion",
    servingKey: menuItem.defaultServingKey || "default",
    servingVariant: {
      key: menuItem.defaultServingKey || "default",
      name: "Phần tiêu chuẩn",
      mode: "PORTION",
      price,
      sellQty: 1,
      sellUnit: "portion",
    },
    quantity: 1,
    baseUnitPrice: price,
    unitPrice: price,
    lineSubtotal: price,
    ingredientsSnapshot: [],
    priority: "MEDIUM",
    status,
    voidRequests,
    returnRequests,
  };
}

async function resolveContext() {
  const brandId = objectId(BRAND_ID, "DEMO_BRAND_ID");
  const restaurantId = objectId(RESTAURANT_ID, "DEMO_RESTAURANT_ID");
  const managerId = objectId(MANAGER_ID, "DEMO_MANAGER_ID");

  const [restaurant, manager, membership] = await Promise.all([
    Restaurant.findById(restaurantId).lean(),
    User.findById(managerId).populate("role", "slug name").lean(),
    BrandMembership.findOne({ brandId, userId: managerId, status: "active" }).lean(),
  ]);

  if (!restaurant) throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${RESTAURANT_ID}`);
  if (!manager) throw new Error(`DEMO_MANAGER_NOT_FOUND: ${MANAGER_ID}`);
  if (!membership) throw new Error(`DEMO_MANAGER_MEMBERSHIP_NOT_FOUND: manager=${MANAGER_ID} brand=${BRAND_ID}`);
  if (String(restaurant.brandId || "") !== String(brandId)) {
    throw new Error(`DEMO_RESTAURANT_BRAND_MISMATCH: restaurant.brandId=${restaurant.brandId || "null"} expected=${BRAND_ID}`);
  }

  const managerUser = {
    id: manager._id,
    _id: manager._id,
    userType: manager.userType,
    roleName: manager?.role?.slug || "manager",
    fullName: manager.fullName,
  };

  if (!(await canAccessRestaurant(managerUser, restaurantId))) {
    throw new Error("DEMO_MANAGER_CANNOT_ACCESS_RESTAURANT");
  }

  const staffDocs = await Staff.find({
    email: { $in: STAFF_SCENARIOS.map((item) => item.email) },
    userType: "STAFF",
    status: "active",
    deletedAt: null,
  }).lean();

  const staffByEmail = new Map(staffDocs.map((staff) => [staff.email, staff]));
  const missingEmails = STAFF_SCENARIOS.map((item) => item.email).filter((email) => !staffByEmail.has(email));
  if (missingEmails.length) {
    throw new Error(`DEMO_STAFF_ACCOUNTS_MISSING: ${missingEmails.join(", ")}`);
  }

  for (const scenario of STAFF_SCENARIOS) {
    const staff = staffByEmail.get(scenario.email);
    if (String(staff.restaurantForStaff || "") !== String(restaurantId)) {
      throw new Error(`DEMO_STAFF_RESTAURANT_MISMATCH: ${scenario.email}`);
    }
  }

  const menuItem = await MenuItem.findOne({
    restaurantId,
    status: "available",
    basePrice: { $gt: 0 },
    menuId: { $ne: null },
    categoryId: { $ne: null },
    isDeleted: { $ne: true },
  })
    .sort({ orderCounter: -1, createdAt: 1 })
    .lean();

  if (!menuItem) {
    throw new Error("DEMO_MENU_ITEM_NOT_FOUND: cần ít nhất một món available có giá, menuId và categoryId");
  }

  const customers = await User.find({
    userType: "CUSTOMER",
    status: "active",
    deletedAt: null,
    email: /@customer-demo\.cohan\.local$/i,
  })
    .sort({ email: 1 })
    .limit(12)
    .lean();

  if (customers.length < 5) {
    throw new Error(`DEMO_CUSTOMERS_INSUFFICIENT: found=${customers.length}, required=5`);
  }

  return {
    brandId,
    restaurantId,
    restaurant,
    manager,
    managerUser,
    menuItem,
    customers,
    staffByEmail,
    staffIds: STAFF_SCENARIOS.map((item) => staffByEmail.get(item.email)._id),
  };
}

async function resetTaggedData({ restaurantId, staffIds }) {
  const incidentDocs = await PerformanceIncident.find({
    restaurantId,
    employeeId: { $in: staffIds },
    note: tagRegex,
  })
    .select("_id")
    .lean();
  const incidentIds = incidentDocs.map((item) => item._id);

  const appealDocs = await PerformanceIncidentAppeal.find({
    $or: [
      { incidentId: { $in: incidentIds } },
      { restaurantId, reason: tagRegex },
    ],
  })
    .select("_id")
    .lean();
  const appealIds = appealDocs.map((item) => item._id);

  await StaffPerformanceScoreReversal.deleteMany({
    $or: [
      { appealId: { $in: appealIds } },
      { incidentId: { $in: incidentIds } },
      { restaurantId, employeeId: { $in: staffIds }, note: tagRegex },
    ],
  });
  await PerformanceIncidentAppeal.deleteMany({ _id: { $in: appealIds } });
  await StaffPerformanceScoreAdjustment.deleteMany({ incidentId: { $in: incidentIds } });
  await PerformanceIncident.deleteMany({ _id: { $in: incidentIds } });
  await KitchenOrderWorkItem.deleteMany({ restaurantId, issueReviewNote: tagRegex });
  await Review.deleteMany({ restaurantId, tags: TAG });
  await AttendanceCorrectionRequest.deleteMany({
    restaurantId,
    employeeId: { $in: staffIds },
    $or: [
      { reason: tagRegex },
      { evidenceNote: tagRegex },
      { reviewNote: tagRegex },
    ],
  });
  await Timesheet.deleteMany({
    restaurantId,
    employeeId: { $in: staffIds },
    note: tagRegex,
  });
  await Shift.deleteMany({
    restaurantId,
    employeeId: { $in: staffIds },
    notes: tagRegex,
  });
  await StaffPerformanceReview.deleteMany({
    restaurantId,
    employeeId: { $in: staffIds },
    periodStart: { $in: [PREVIOUS_PERIOD.start, CURRENT_PERIOD.start] },
    periodEnd: { $in: [PREVIOUS_PERIOD.end, CURRENT_PERIOD.end] },
  });
  await StaffPerformanceSnapshot.deleteMany({
    restaurantId,
    employeeId: { $in: staffIds },
    periodStart: { $in: [PREVIOUS_PERIOD.start, CURRENT_PERIOD.start] },
    periodEnd: { $in: [PREVIOUS_PERIOD.end, CURRENT_PERIOD.end] },
  });
  await Order.deleteMany({ restaurantId, "clientMeta.demoTag": TAG });
}

async function normalizeDemoStaff({ staffByEmail }) {
  for (const scenario of STAFF_SCENARIOS) {
    await Staff.updateOne(
      { _id: staffByEmail.get(scenario.email)._id },
      {
        $set: {
          employeeCode: scenario.employeeCode,
          positionTitle: scenario.positionTitle,
          employmentStatus: "working",
          noteInternal: `${TAG} performance demo profile`,
        },
      },
    );
  }
}

async function seedAttendancePeriod({
  restaurantId,
  managerId,
  staffByEmail,
  period,
  shiftDays,
  previous = false,
}) {
  for (const scenario of STAFF_SCENARIOS) {
    const staff = staffByEmail.get(scenario.email);
    const workedMinutes = previous ? [420, 420, 420, 420] : scenario.currentWorkedMinutes;
    const lateMinutes = previous ? [0, 0, 0, 0] : scenario.currentLateMinutes;
    const earlyMinutes = previous ? [0, 0, 0, 0] : scenario.currentEarlyMinutes;
    const correctionCount = previous ? 0 : scenario.currentCorrectionCount;
    const monthIndex = period.start.getUTCMonth();
    const year = period.start.getUTCFullYear();
    const timesheets = [];

    for (let index = 0; index < shiftDays.length; index += 1) {
      const day = shiftDays[index];
      const shiftStart = atUtc(year, monthIndex, day, 8, 0);
      const shiftEnd = atUtc(year, monthIndex, day, 16, 0);
      const workDate = atUtc(year, monthIndex, day, 0, 0);
      const minutesWorked = Number(workedMinutes[index] || 0);
      const late = Number(lateMinutes[index] || 0);
      const early = Number(earlyMinutes[index] || 0);
      const absent = minutesWorked <= 0;

      const shift = await Shift.create({
        restaurantId,
        employeeId: staff._id,
        shiftType: "morning",
        startTime: shiftStart,
        endTime: shiftEnd,
        status: "scheduled",
        notes: `${TAG} ${previous ? "previous" : "current"} ${scenario.key} shift ${index + 1}`,
      });

      const actualCheckInAt = absent ? null : new Date(shiftStart.getTime() + late * 60_000);
      const actualCheckOutAt = absent
        ? null
        : new Date(actualCheckInAt.getTime() + minutesWorked * 60_000);

      const timesheet = await Timesheet.create({
        restaurantId,
        employeeId: staff._id,
        shiftId: shift._id,
        workDate,
        plannedStartTime: shiftStart,
        plannedEndTime: shiftEnd,
        actualCheckInAt,
        actualCheckOutAt,
        latenessMinutes: late,
        earlyLeaveMinutes: early,
        workedMinutes: minutesWorked,
        hours: Number((minutesWorked / 60).toFixed(2)),
        status: absent
          ? "scheduled_absent"
          : late > 0 && early > 0
            ? "late_early_leave"
            : late > 0
              ? "late"
              : early > 0
                ? "early_leave"
                : "completed",
        approved: !absent,
        isOffSchedule: false,
        note: `${TAG} ${previous ? "previous" : "current"} ${scenario.key} timesheet ${index + 1}`,
      });

      timesheets.push(timesheet);
    }

    for (let index = 0; index < correctionCount; index += 1) {
      const target = timesheets[index % timesheets.length];
      await AttendanceCorrectionRequest.create({
        restaurantId,
        employeeId: staff._id,
        requestedBy: staff._id,
        requestedByRole: "STAFF",
        timesheetId: target._id,
        shiftId: target.shiftId,
        workDate: target.workDate,
        correctionType: "wrong_check_in_out",
        reason: `${TAG} ${scenario.key} correction ${index + 1}`,
        evidenceNote: `${TAG} deterministic demo correction`,
        status: index % 2 === 0 ? "applied" : "rejected",
        reviewedBy: managerId,
        reviewedAt: new Date(),
        reviewNote: `${TAG} reviewed demo correction`,
        appliedBy: index % 2 === 0 ? managerId : null,
        appliedAt: index % 2 === 0 ? new Date() : null,
      });
    }
  }
}

async function seedManagerReviews({ restaurantId, manager, staffByEmail }) {
  for (const scenario of STAFF_SCENARIOS) {
    const staff = staffByEmail.get(scenario.email);

    for (const [period, values, label] of [
      [PREVIOUS_PERIOD, scenario.previousReview, "previous"],
      [CURRENT_PERIOD, scenario.currentReview, "current"],
    ]) {
      const [managerRatingScore, skillScore] = values;
      await StaffPerformanceReview.findOneAndUpdate(
        {
          employeeId: staff._id,
          restaurantId,
          periodStart: period.start,
          periodEnd: period.end,
        },
        {
          $set: {
            managerRatingScore,
            attitudeScore: roundScore(managerRatingScore + 1),
            teamworkScore: roundScore(managerRatingScore),
            skillScore,
            note: `${TAG} ${label} manager review for ${scenario.key}`,
            reviewedBy: manager._id,
            reviewedByName: manager.fullName || "Demo Manager",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }
}

async function seedCustomerReviews({ restaurant, customers, staffByEmail }) {
  const definitions = [
    {
      email: "staff.server.demo@cohan.local",
      ratings: [5, 5, 4, 5],
      prefix: "Phục vụ nhanh, chủ động và thân thiện",
    },
    {
      email: "staff.cashier.demo@cohan.local",
      ratings: [3, 3, 3],
      prefix: "Thanh toán còn chậm trong giờ cao điểm",
    },
  ];

  let customerIndex = 0;
  for (const definition of definitions) {
    const staff = staffByEmail.get(definition.email);
    for (let index = 0; index < definition.ratings.length; index += 1) {
      const customer = customers[customerIndex % customers.length];
      customerIndex += 1;
      await Review.create({
        targetType: "service",
        targetId: restaurant._id,
        targetName: "Dịch vụ tại nhà hàng",
        restaurantId: restaurant._id,
        restaurantName: restaurant.name,
        customerId: customer._id,
        customerName: customer.fullName || customer.email,
        staffId: staff._id,
        staffName: staff.fullName,
        rating: definition.ratings[index],
        title: `${TAG} đánh giá nhân viên`,
        content: `${definition.prefix}. ${TAG}`,
        verifiedPurchase: true,
        verifiedSource: "manual",
        reliabilityScore: 80,
        reliabilityLevel: "high",
        sentiment: definition.ratings[index] >= 4 ? "positive" : "neutral",
        topicTags: ["service", "staff"],
        tags: [TAG],
        status: "published",
        createdAt: atUtc(2026, 6, 1 + index, 18, 0),
        updatedAt: atUtc(2026, 6, 1 + index, 18, 0),
      });
    }
  }
}

async function createOperationalOrder({
  restaurantId,
  customer,
  menuItem,
  cashierId = null,
  sequence,
  createdAt,
  paymentStatus = "paid",
  orderPaymentStatus = "paid",
  paymentNote = "",
  paymentClearReason = "",
  discount = 0,
  discountReason = "",
  voidReason = "",
  returnReason = "",
  customerRequest = null,
  itemStatus = "served",
}) {
  const voidRequests = voidReason
    ? [{
        requestId: `${TAG}-void-${sequence}`,
        quantity: 1,
        reason: voidReason,
        status: "approved",
        requestedBy: cashierId,
        requestedAt: createdAt,
        reviewedBy: cashierId,
        reviewedAt: createdAt,
        reviewNote: `${TAG} approved wrong-bill demo`,
      }]
    : [];
  const returnRequests = returnReason
    ? [{
        requestId: `${TAG}-return-${sequence}`,
        quantity: 1,
        reason: returnReason,
        refundMode: "refund_after_payment",
        status: "approved",
        requestedBy: cashierId,
        requestedAt: createdAt,
        reviewedBy: cashierId,
        reviewedAt: createdAt,
        reviewNote: `${TAG} approved refund demo`,
      }]
    : [];

  const requests = customerRequest
    ? [{
        requestId: `${TAG}-payment-${sequence}`,
        type: "PAYMENT_REQUEST",
        status: "RESOLVED",
        message: `${TAG} payment request`,
        source: "CUSTOMER_TRACKING",
        ...customerRequest,
      }]
    : [];

  const item = buildOrderItem(menuItem, { status: itemStatus, voidRequests, returnRequests });
  const subtotal = Number(menuItem.basePrice || 0);
  const grandTotal = Math.max(0, subtotal - discount);

  return Order.create({
    orderCode: `PERF-DEMO-${String(sequence).padStart(3, "0")}`,
    publicStatus: paymentStatus === "paid" ? "PAID" : "ISSUE_REPORTED",
    statusHistory: [{
      status: "PAID",
      displayMessage: `${TAG} demo order`,
      changedAt: createdAt,
      changedByRole: "SYSTEM",
      metadata: { demoTag: TAG },
    }],
    orderKind: "order_batch",
    sessionStatus: "closed",
    kitchenStatus: ["cancelled", "returned"].includes(itemStatus) ? "cancelled" : "served",
    orderPaymentStatus,
    openedAt: createdAt,
    closedAt: new Date(createdAt.getTime() + 60 * 60_000),
    dailySequence: sequence,
    guestCount: 2,
    userId: customer._id,
    restaurantId,
    orderType: "dine_in",
    items: [item],
    totals: {
      subtotal,
      discount,
      discountReason: discountReason || undefined,
      tax: 0,
      service: 0,
      grandTotal,
    },
    payment: {
      method: "cash",
      status: paymentStatus,
      paidAmount: paymentStatus === "failed" ? 0 : grandTotal,
      currency: "VND",
      requestedAt: createdAt,
      requestedBy: cashierId,
      requestNote: paymentNote,
      requestClearReason: paymentClearReason,
      paidAt: new Date(createdAt.getTime() + 20 * 60_000),
      paidBy: cashierId,
    },
    customerRequests: requests,
    statusTimeline: [{
      status: "completed",
      at: new Date(createdAt.getTime() + 60 * 60_000),
      note: TAG,
    }],
    currentStatus: "completed",
    priority: "MEDIUM",
    note: `${TAG} operational demo order`,
    clientMeta: { demoTag: TAG, seed: "seedStaffPerformanceDemo" },
    createdAt,
    updatedAt: new Date(createdAt.getTime() + 60 * 60_000),
  });
}

async function seedCashierEvidence({ restaurantId, customers, menuItem, staffByEmail }) {
  const cashier = staffByEmail.get("staff.cashier.demo@cohan.local");
  const base = atUtc(2026, 6, 1, 10, 0);

  const definitions = [
    { paymentStatus: "paid", orderPaymentStatus: "paid", voidReason: "Tính nhầm hóa đơn" },
    { paymentStatus: "failed", orderPaymentStatus: "failed", paymentNote: "Chọn sai phương thức thanh toán" },
    { paymentStatus: "refunded", orderPaymentStatus: "refunded", returnReason: "Sai hóa đơn do thu ngân" },
    {
      paymentStatus: "paid",
      orderPaymentStatus: "paid",
      customerRequest: {
        createdAt: new Date(base.getTime() + 3 * 24 * 60 * 60_000),
        acknowledgedAt: new Date(base.getTime() + 3 * 24 * 60 * 60_000 + 5 * 60_000),
        resolvedAt: new Date(base.getTime() + 3 * 24 * 60 * 60_000 + 10 * 60_000),
        acknowledgedBy: cashier._id,
        resolvedBy: cashier._id,
      },
    },
    { paymentStatus: "paid", orderPaymentStatus: "paid", discount: 10_000, discountReason: "Áp sai khuyến mãi" },
  ];

  for (let index = 0; index < definitions.length; index += 1) {
    await createOperationalOrder({
      restaurantId,
      customer: customers[index % customers.length],
      menuItem,
      cashierId: cashier._id,
      sequence: index + 1,
      createdAt: new Date(base.getTime() + index * 24 * 60 * 60_000),
      ...definitions[index],
    });
  }
}

async function seedKitchenEvidence({ restaurantId, customers, menuItem, staffByEmail }) {
  const chef = staffByEmail.get("staff.chef.demo@cohan.local");
  const helper = staffByEmail.get("staff.kitchenhelper.demo@cohan.local");

  const definitions = [
    { owner: "chef", timeLevel: "very_late", status: "served", actualPrepMinutes: 55, targetPrepMinutes: 25 },
    { owner: "chef", timeLevel: "very_late", status: "served", actualPrepMinutes: 50, targetPrepMinutes: 25 },
    { owner: "chef", timeLevel: "late", status: "served", actualPrepMinutes: 35, targetPrepMinutes: 25 },
    { owner: "chef", timeLevel: "on_time", status: "returned", issueType: "return", issueReasonKitchenRelated: true },
    { owner: "chef", timeLevel: "on_time", status: "cancelled", issueType: "void", issueReasonKitchenRelated: true },
    { owner: "chef", timeLevel: "on_time", status: "served", actualPrepMinutes: 22, targetPrepMinutes: 25 },
    { owner: "helper", timeLevel: "late", status: "served", unaccepted: true },
    { owner: "helper", timeLevel: "very_late", status: "served", unaccepted: true },
    { owner: "helper", timeLevel: "on_time", status: "returned", issueType: "return", issueReasonKitchenRelated: true },
    { owner: "helper", timeLevel: "on_time", status: "cancelled", issueType: "void", issueReasonKitchenRelated: true },
    { owner: "helper", timeLevel: "on_time", status: "served", actualPrepMinutes: 20, targetPrepMinutes: 25 },
    { owner: "helper", timeLevel: "on_time", status: "served", actualPrepMinutes: 21, targetPrepMinutes: 25 },
  ];

  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const createdAt = atUtc(2026, 6, 1 + (index % 5), 11, index);
    const owner = definition.owner === "chef" ? chef : helper;
    const itemStatus = definition.status === "returned"
      ? "returned"
      : definition.status === "cancelled"
        ? "cancelled"
        : "served";

    const order = await createOperationalOrder({
      restaurantId,
      customer: customers[(index + 5) % customers.length],
      menuItem,
      sequence: 20 + index,
      createdAt,
      itemStatus,
    });

    await KitchenOrderWorkItem.create({
      restaurantId,
      orderId: order._id,
      orderCode: order.orderCode,
      orderItemId: order.items[0]._id,
      dishId: menuItem._id,
      menuId: menuItem.menuId,
      categoryId: menuItem.categoryId,
      dishName: menuItem.name,
      quantity: 1,
      station: "kitchen",
      status: definition.status,
      kitchenEnteredAt: createdAt,
      preparingAt: new Date(createdAt.getTime() + 2 * 60_000),
      readyAt: ["served", "returned"].includes(definition.status)
        ? new Date(createdAt.getTime() + Number(definition.actualPrepMinutes || 30) * 60_000)
        : null,
      servedAt: definition.status === "served"
        ? new Date(createdAt.getTime() + Number(definition.actualPrepMinutes || 30) * 60_000 + 5 * 60_000)
        : null,
      cancelledAt: definition.status === "cancelled"
        ? new Date(createdAt.getTime() + 15 * 60_000)
        : null,
      returnedAt: definition.status === "returned"
        ? new Date(createdAt.getTime() + 45 * 60_000)
        : null,
      issueType: definition.issueType || null,
      issueReason: definition.issueReasonKitchenRelated ? "Món sai hoặc trễ do bếp" : "",
      issueReasonCategory: definition.issueReasonKitchenRelated ? "kitchen_quality" : null,
      issueReasonKitchenRelated: Boolean(definition.issueReasonKitchenRelated),
      issueReviewNote: `${TAG} ${definition.owner} kitchen evidence ${index + 1}`,
      headChefId: definition.owner === "chef" ? chef._id : null,
      assistantChefIds: definition.owner === "helper" ? [helper._id] : [],
      teamEmployeeIds: [owner._id],
      unaccepted: Boolean(definition.unaccepted),
      unacceptedAt: definition.unaccepted ? new Date(createdAt.getTime() + 20 * 60_000) : null,
      unacceptedAfterMinutes: definition.unaccepted ? 20 : null,
      unacceptedResponsibleEmployeeIds: definition.unaccepted ? [helper._id] : [],
      unacceptedReason: definition.unaccepted ? `${TAG} chưa nhận món đúng hạn` : "",
      actualPrepMinutes: Number(definition.actualPrepMinutes || 30),
      targetPrepMinutes: Number(definition.targetPrepMinutes || 25),
      timeLevel: definition.timeLevel,
      lastStatusChangedAt: new Date(createdAt.getTime() + 45 * 60_000),
    });
  }
}

async function recalculatePeriod({ restaurantId, managerUser, staffIds, period }) {
  for (const employeeId of staffIds) {
    await recalculateStaffPerformanceSnapshots({
      input: {
        restaurantId: String(restaurantId),
        employeeId: String(employeeId),
        periodStart: period.start,
        periodEnd: period.end,
      },
      ctx: { user: managerUser },
    });
  }
}

async function createAppliedIncident({
  restaurantId,
  employeeId,
  managerId,
  sourceId,
  eventType,
  severity,
  occurredAt,
  scoreDelta,
  snapshot,
  note,
}) {
  const incident = await PerformanceIncident.create({
    restaurantId,
    employeeId,
    actorId: managerId,
    actorRole: "MANAGER",
    sourceType: "system",
    sourceId,
    uniqueKey: `${TAG}:${sourceId}:${eventType}`,
    eventType,
    severity,
    responsibilityStatus: "staff_responsible",
    scoreImpactStatus: "applied",
    proposedScoreDelta: scoreDelta,
    scoreDelta,
    occurredAt,
    detectedAt: occurredAt,
    reviewedBy: managerId,
    reviewedAt: occurredAt,
    reviewNote: note,
    appliedBy: managerId,
    appliedAt: occurredAt,
    applyNote: note,
    resolvedAt: occurredAt,
    note: `${TAG} ${note}`,
  });

  const previousScore = Number(snapshot.finalPerformanceScore || 0);
  const newScore = Math.max(0, previousScore + scoreDelta);
  const adjustment = await StaffPerformanceScoreAdjustment.create({
    restaurantId,
    employeeId,
    incidentId: incident._id,
    sourceType: "performance_incident",
    scoreDelta,
    previousScore,
    newScore,
    appliedBy: managerId,
    appliedAt: occurredAt,
    reason: eventType,
    note: `${TAG} ${note}`,
    metadata: { demoTag: TAG },
  });

  incident.scoreAdjustmentId = adjustment._id;
  await incident.save();
  return { incident, adjustment, previousScore, newScore };
}

async function seedIncidentHistory({ restaurantId, manager, staffByEmail }) {
  const snapshots = await StaffPerformanceSnapshot.find({
    restaurantId,
    employeeId: {
      $in: [
        staffByEmail.get("staff.exception.demo@cohan.local")._id,
        staffByEmail.get("staff.parttime.demo@cohan.local")._id,
      ],
    },
    periodStart: CURRENT_PERIOD.start,
    periodEnd: CURRENT_PERIOD.end,
  }).lean();

  const snapshotByEmployee = new Map(snapshots.map((item) => [String(item.employeeId), item]));
  const exception = staffByEmail.get("staff.exception.demo@cohan.local");
  const parttime = staffByEmail.get("staff.parttime.demo@cohan.local");
  const supervisor = staffByEmail.get("staff.supervisor.demo@cohan.local");
  const chef = staffByEmail.get("staff.chef.demo@cohan.local");

  const exceptionApplied = await createAppliedIncident({
    restaurantId,
    employeeId: exception._id,
    managerId: manager._id,
    sourceId: "exception-absent-demo",
    eventType: "ATTENDANCE_ABSENT",
    severity: "violation",
    occurredAt: atUtc(2026, 6, 4, 16, 30),
    scoreDelta: -6,
    snapshot: snapshotByEmployee.get(String(exception._id)),
    note: "Áp dụng trừ điểm do vắng ca demo",
  });

  await PerformanceIncidentAppeal.create({
    restaurantId,
    incidentId: exceptionApplied.incident._id,
    employeeId: exception._id,
    submittedBy: exception._id,
    submittedAt: atUtc(2026, 6, 4, 18, 0),
    reason: `${TAG} Khiếu nại vắng ca không đủ bằng chứng`,
    evidenceNote: `${TAG} không có chứng từ bổ sung`,
    status: "rejected",
    reviewedBy: manager._id,
    reviewedAt: atUtc(2026, 6, 5, 9, 0),
    reviewNote: `${TAG} đã đối chiếu lịch và chấm công`,
    decisionReason: "Không có bằng chứng thay đổi trách nhiệm",
    scoreReversalStatus: "rejected",
  });

  const appealApplied = await createAppliedIncident({
    restaurantId,
    employeeId: parttime._id,
    managerId: manager._id,
    sourceId: "parttime-late-demo",
    eventType: "ATTENDANCE_LATE",
    severity: "warning",
    occurredAt: atUtc(2026, 6, 2, 8, 10),
    scoreDelta: -8,
    snapshot: snapshotByEmployee.get(String(parttime._id)),
    note: "Áp dụng trừ điểm đi trễ demo",
  });

  const appeal = await PerformanceIncidentAppeal.create({
    restaurantId,
    incidentId: appealApplied.incident._id,
    employeeId: parttime._id,
    submittedBy: parttime._id,
    submittedAt: atUtc(2026, 6, 2, 10, 0),
    reason: `${TAG} Khiếu nại do điều phối hỗ trợ ca trước`,
    evidenceNote: `${TAG} quản lý xác nhận điều phối`,
    status: "accepted",
    reviewedBy: manager._id,
    reviewedAt: atUtc(2026, 6, 3, 9, 0),
    reviewNote: `${TAG} chấp nhận khiếu nại`,
    decisionReason: "Đi trễ phát sinh do điều phối quản lý",
    scoreReversalStatus: "reversed",
    scoreReversedBy: manager._id,
    scoreReversedAt: atUtc(2026, 6, 3, 9, 5),
    scoreReversalNote: `${TAG} hoàn đủ điểm incident`,
    scoreReversalDelta: 8,
  });

  const reversal = await StaffPerformanceScoreReversal.create({
    restaurantId,
    employeeId: parttime._id,
    incidentId: appealApplied.incident._id,
    appealId: appeal._id,
    originalAdjustmentId: appealApplied.adjustment._id,
    reversalDelta: 8,
    previousScore: appealApplied.newScore,
    newScore: appealApplied.previousScore,
    reversedBy: manager._id,
    reversedAt: atUtc(2026, 6, 3, 9, 5),
    reason: "Accepted performance appeal",
    note: `${TAG} hoàn điểm khiếu nại`,
    metadata: { demoTag: TAG },
  });

  appeal.scoreReversalId = reversal._id;
  await appeal.save();
  appealApplied.incident.scoreReversalStatus = "reversed";
  appealApplied.incident.scoreReversalId = reversal._id;
  appealApplied.incident.scoreReversedAt = reversal.reversedAt;
  appealApplied.incident.scoreReversalNote = reversal.note;
  await appealApplied.incident.save();

  await PerformanceIncident.create({
    restaurantId,
    employeeId: supervisor._id,
    actorId: manager._id,
    actorRole: "MANAGER",
    sourceType: "system",
    sourceId: "supervisor-pending-demo",
    uniqueKey: `${TAG}:supervisor-pending-demo:ATTENDANCE_LATE`,
    eventType: "ATTENDANCE_LATE",
    severity: "warning",
    responsibilityStatus: "pending_review",
    scoreImpactStatus: "pending",
    proposedScoreDelta: -2,
    occurredAt: atUtc(2026, 6, 1, 8, 20),
    note: `${TAG} incident chờ xem xét`,
  });

  await PerformanceIncident.create({
    restaurantId,
    employeeId: chef._id,
    actorId: manager._id,
    actorRole: "MANAGER",
    sourceType: "system",
    sourceId: "chef-waived-demo",
    uniqueKey: `${TAG}:chef-waived-demo:ATTENDANCE_EARLY_LEAVE`,
    eventType: "ATTENDANCE_EARLY_LEAVE",
    severity: "info",
    responsibilityStatus: "no_fault",
    scoreImpactStatus: "waived",
    proposedScoreDelta: 0,
    occurredAt: atUtc(2026, 6, 3, 15, 30),
    reviewedBy: manager._id,
    reviewedAt: atUtc(2026, 6, 3, 17, 0),
    waivedBy: manager._id,
    waivedAt: atUtc(2026, 6, 3, 17, 0),
    waiveReason: "Quản lý điều động hỗ trợ kho",
    note: `${TAG} incident được bỏ qua`,
  });
}

async function tagSnapshots({ restaurantId, staffIds }) {
  await StaffPerformanceSnapshot.updateMany(
    {
      restaurantId,
      employeeId: { $in: staffIds },
      periodStart: { $in: [PREVIOUS_PERIOD.start, CURRENT_PERIOD.start] },
      periodEnd: { $in: [PREVIOUS_PERIOD.end, CURRENT_PERIOD.end] },
    },
    {
      $set: {
        "factors.demoTag": TAG,
        "factors.demoScenarioVersion": 1,
      },
    },
  );
}

async function printSummary({ restaurantId, staffByEmail }) {
  const snapshots = await StaffPerformanceSnapshot.find({
    restaurantId,
    employeeId: { $in: STAFF_SCENARIOS.map((item) => staffByEmail.get(item.email)._id) },
    periodStart: CURRENT_PERIOD.start,
    periodEnd: CURRENT_PERIOD.end,
  })
    .select("employeeId finalPerformanceScore performanceLevel factors")
    .lean();
  const byEmployee = new Map(snapshots.map((item) => [String(item.employeeId), item]));

  console.log("\nStaff performance demo summary:");
  for (const scenario of STAFF_SCENARIOS) {
    const staff = staffByEmail.get(scenario.email);
    const snapshot = byEmployee.get(String(staff._id));
    console.log(
      `- ${scenario.email}: score=${snapshot?.finalPerformanceScore ?? "missing"} level=${snapshot?.performanceLevel ?? "missing"} expected=${scenario.expectedLevel}`,
    );
  }
}

async function main() {
  assertDemoScriptAllowed("seedStaffPerformanceDemo.js");
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGO_DB || "foodhub";
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });

  const context = await resolveContext();
  await resetTaggedData(context);
  await normalizeDemoStaff(context);

  await seedAttendancePeriod({
    ...context,
    managerId: context.manager._id,
    period: PREVIOUS_PERIOD,
    shiftDays: previousShiftDays,
    previous: true,
  });
  await seedAttendancePeriod({
    ...context,
    managerId: context.manager._id,
    period: CURRENT_PERIOD,
    shiftDays: currentShiftDays,
    previous: false,
  });
  await seedManagerReviews(context);
  await seedCustomerReviews(context);
  await seedCashierEvidence(context);
  await seedKitchenEvidence(context);

  await recalculatePeriod({
    restaurantId: context.restaurantId,
    managerUser: context.managerUser,
    staffIds: context.staffIds,
    period: PREVIOUS_PERIOD,
  });
  await recalculatePeriod({
    restaurantId: context.restaurantId,
    managerUser: context.managerUser,
    staffIds: context.staffIds,
    period: CURRENT_PERIOD,
  });

  await seedIncidentHistory(context);

  await recalculatePeriod({
    restaurantId: context.restaurantId,
    managerUser: context.managerUser,
    staffIds: context.staffIds,
    period: CURRENT_PERIOD,
  });
  await tagSnapshots(context);
  await printSummary(context);

  console.log(`\nSeed completed. tag=${TAG}`);
  console.log(`Restaurant=${context.restaurant.name} (${context.restaurantId})`);
  console.log(`Period=${CURRENT_PERIOD.start.toISOString()} -> ${CURRENT_PERIOD.end.toISOString()}`);
  console.log("Next: npm run verify:demo:staff-performance-data");
}

main()
  .catch((error) => {
    console.error("[seed:demo:staff-performance] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
