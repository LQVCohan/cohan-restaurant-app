import mongoose from "mongoose";
import { Order, Shift, Staff } from "../../../models/index.js";
import { buildDemandForecast } from "./demandForecast.service.js";
import { getSchedulingPolicy } from "../scheduling/schedulingPolicy.service.js";
import { resolveStaffAvailabilityForShift } from "../scheduling/staffAvailabilityContext.service.js";
import { listStaffPerformanceSummaries } from "../performance/staffPerformanceReporting.service.js";

const ROLE_BY_DEPARTMENT = {
  management: "host",
  kitchen: "cook",
  service: "server",
  cashier: "cashier",
  cleaning: "cleaner",
  delivery: "shipper",
  inventory: "storekeeper",
  bar: "bartender",
};

const SHIFT_WINDOWS = {
  morning: { startHour: 6, endHour: 12 },
  afternoon: { startHour: 12, endHour: 18 },
  evening: { startHour: 18, endHour: 23 },
  full_day: { startHour: 6, endHour: 23 },
};

const ACTIVE_EMPLOYMENT = new Set(["working", "on_leave"]);
const SUGGESTIBLE_EMPLOYMENT = new Set(["working"]);
const DEFAULT_PERFORMANCE_SCORE = 75;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toDate = (value) => {
  const d = value ? new Date(value) : null;
  return d && Number.isFinite(d.getTime()) ? d : null;
};

const resolvePerformanceScore = (value, fallback = DEFAULT_PERFORMANCE_SCORE) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const toId = (value) => {
  if (!value) return null;
  return String(value);
};

const toIsoDay = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
};
const toBusinessShiftDate = (dateKey, hour, timezone) => {
  const safeHour = String(Math.max(0, Math.min(23, Number(hour) || 0))).padStart(2, "0");
  if (timezone === "Asia/Ho_Chi_Minh") return new Date(`${dateKey}T${safeHour}:00:00+07:00`);
  return new Date(`${dateKey}T${safeHour}:00:00Z`);
};

const getHour = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  });
  const hour = Number.parseInt(formatter.format(date), 10);
  return Number.isFinite(hour) ? hour : date.getHours();
};

const normalizeShiftType = (value) => {
  const key = String(value || "").toLowerCase();
  if (SHIFT_WINDOWS[key]) return key;
  if (["rotating", "night"].includes(key)) return "evening";
  return "morning";
};

const roleFromDepartment = (department) =>
  ROLE_BY_DEPARTMENT[String(department || "").toLowerCase()] || "server";

function buildBaseRoleNeed(expectedOrders, expectedGuests, demandLevel) {
  const server = Math.max(
    1,
    Math.ceil(expectedGuests / (demandLevel === "high" ? 22 : 26)),
  );
  const cook = Math.max(
    1,
    Math.ceil(expectedOrders / (demandLevel === "high" ? 16 : 20)),
  );
  const cashier = expectedOrders > 0 ? 1 : 0;
  const cleaner = demandLevel === "high" ? 1 : expectedOrders >= 8 ? 1 : 0;
  const host = expectedGuests >= 28 ? 1 : demandLevel === "high" ? 1 : 0;
  const bartender = expectedGuests >= 35 || demandLevel === "high" ? 1 : 0;

  return { server, cook, cashier, cleaner, host, bartender };
}

function demandLevelFromExpected(expectedOrders, expectedGuests) {
  if (expectedOrders >= 24 || expectedGuests >= 65) return "high";
  if (expectedOrders >= 10 || expectedGuests >= 28) return "medium";
  return "low";
}

function resolveShiftStatus(deltaStaff) {
  if (deltaStaff <= -3) return { status: "understaffed", severity: "high" };
  if (deltaStaff === -2 || deltaStaff === -1)
    return { status: "understaffed", severity: "medium" };
  if (deltaStaff >= 3) return { status: "overstaffed", severity: "high" };
  if (deltaStaff >= 1) return { status: "overstaffed", severity: "low" };
  return { status: "balanced", severity: "low" };
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function buildFallbackDemandByShift(orders, timezone, horizonDays, startDate) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 28);

  const buckets = new Map();

  for (const order of orders || []) {
    const createdAt = toDate(order?.createdAt);
    if (!createdAt || createdAt < start) continue;
    const hour = getHour(createdAt, timezone);

    let shiftType = "morning";
    if (hour >= 12 && hour < 18) shiftType = "afternoon";
    if (hour >= 18 || hour < 6) shiftType = "evening";

    const dayKey = toIsoDay(createdAt, timezone);
    const key = `${dayKey}|${shiftType}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        shiftType,
        expectedOrders: 0,
        expectedGuests: 0,
        points: 0,
      });
    }

    const row = buckets.get(key);
    row.expectedOrders += 1;
    row.expectedGuests += Math.max(1, Number(order?.guestCount || 2));
    row.points += 1;
  }

  const byShift = new Map();
  for (const row of buckets.values()) {
    const shiftType = row.shiftType || "morning";
    if (!byShift.has(shiftType))
      byShift.set(shiftType, { orders: [], guests: [] });
    byShift.get(shiftType).orders.push(row.expectedOrders);
    byShift.get(shiftType).guests.push(row.expectedGuests);
  }

  const template = {};
  for (const key of Object.keys(SHIFT_WINDOWS)) {
    const agg = byShift.get(key) || { orders: [4], guests: [10] };
    const avgOrders =
      agg.orders.reduce((a, b) => a + b, 0) / Math.max(1, agg.orders.length);
    const avgGuests =
      agg.guests.reduce((a, b) => a + b, 0) / Math.max(1, agg.guests.length);
    template[key] = {
      expectedOrders: Number(avgOrders.toFixed(2)),
      expectedGuests: Number(avgGuests.toFixed(2)),
      confidence: 0.45,
    };
  }

  const fallbackShiftDemand = [];
  const anchorDate = toDate(startDate) || now;
  for (let i = 0; i < horizonDays; i += 1) {
    const date = new Date(anchorDate);
    date.setDate(date.getDate() + i);
    const dateKey = toIsoDay(date, timezone);
    for (const shiftType of ["morning", "afternoon", "evening"]) {
      fallbackShiftDemand.push({
        date: dateKey,
        shiftType,
        ...template[shiftType],
      });
    }
  }

  return fallbackShiftDemand;
}

function convertHourlyForecastToShiftDemand(hourlyForecast = []) {
  const grouped = new Map();

  for (const row of hourlyForecast || []) {
    const hourLabel = String(row?.hourLabel || "00:00");
    const hour = Number.parseInt(hourLabel.slice(0, 2), 10);
    if (!Number.isFinite(hour)) continue;

    let shiftType = "morning";
    if (hour >= 12 && hour < 18) shiftType = "afternoon";
    if (hour >= 18 || hour < 6) shiftType = "evening";

    const date = String(row?.date || "");
    if (!date) continue;

    const key = `${date}|${shiftType}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        shiftKey: key,
        date,
        shiftType,
        expectedOrders: 0,
        expectedGuests: 0,
        confidence: 0,
        points: 0,
      });
    }

    const g = grouped.get(key);
    g.expectedOrders += Number(row?.expectedOrders || 0);
    g.expectedGuests += Number(row?.expectedGuests || 0);
    g.confidence += Number(row?.confidence || 0);
    g.points += 1;
  }

  return [...grouped.values()]
    .map((g) => ({
      shiftKey: g.shiftKey,
      date: g.date,
      shiftType: g.shiftType,
      expectedOrders: Number(g.expectedOrders.toFixed(2)),
      expectedGuests: Number(g.expectedGuests.toFixed(2)),
      confidence: Number((g.confidence / Math.max(1, g.points)).toFixed(3)),
    }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.shiftType.localeCompare(b.shiftType),
    );
}

export async function buildStaffSchedulingAssistant({
  restaurantId,
  timezone = "Asia/Ho_Chi_Minh",
  horizonDays = 2,
  periodStart = null,
  periodEnd = null,
  actor = null,
}) {
  const safeHorizonDays = clamp(Number(horizonDays || 2), 1, 7);
  const requestedStart = toDate(periodStart);
  const requestedEnd = toDate(periodEnd);

  let startDate;
  let endDate;

  if (requestedStart && requestedEnd && requestedEnd >= requestedStart) {
    startDate = new Date(requestedStart);
    startDate.setHours(0, 0, 0, 0);

    endDate = new Date(requestedEnd);
    endDate.setHours(23, 59, 59, 999);
  } else {
    const now = new Date();
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + safeHorizonDays - 1);
    endDate.setHours(23, 59, 59, 999);
  }

  const requestedSpanDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const effectiveHorizonDays = clamp(requestedSpanDays, 1, 7);
  const now = new Date();

  const rid = mongoose.isValidObjectId(restaurantId)
    ? new mongoose.Types.ObjectId(restaurantId)
    : null;
  if (!rid) {
    throw new Error("Invalid restaurantId");
  }

  const [staffList, shifts, recentOrders, schedulingPolicy] = await Promise.all([
    Staff.find({
      userType: "STAFF",
      deletedAt: null,
      $or: [
        { restaurantForStaff: rid },
        { refRestaurants: rid },
        { restaurantForStaff: rid },
      ],
      employmentStatus: { $in: [...ACTIVE_EMPLOYMENT] },
    })
      .select({
        fullName: 1,
        department: 1,
        employmentType: 1,
        employmentStatus: 1,
        workingDays: 1,
        positionTitle: 1,
        baseSalary: 1,
        restaurantForStaff: 1,
        restaurantForStaff: 1,
        refRestaurants: 1,
      })
      .lean(),
    Shift.find({
      restaurantId: rid,
      startTime: { $gte: startDate, $lte: endDate },
    })
      .select({
        employeeId: 1,
        shiftType: 1,
        startTime: 1,
        endTime: 1,
        status: 1,
        notes: 1,
      })
      .lean(),
    Order.find({
      restaurantId: rid,
      createdAt: { $gte: new Date(now.getTime() - 35 * 86400000), $lte: now },
      currentStatus: { $nin: ["cancelled", "failed"] },
    })
      .select({ createdAt: 1, guestCount: 1, createdBy: 1 })
      .lean(),
    getSchedulingPolicy({ restaurantId: rid }),
  ]);

  const performanceByStaff = new Map();
  let usedPerformanceFallback = false;
  if (actor) {
    try {
      const perfRows = await listStaffPerformanceSummaries(
        { restaurantId: rid, fromDate: new Date(now.getTime() - 30 * 86400000), toDate: now, limit: 500, offset: 0 },
        actor,
      );
      for (const row of perfRows || []) {
        performanceByStaff.set(
          String(row.employeeId),
          resolvePerformanceScore(row.finalPerformanceScore),
        );
      }
    } catch {
      usedPerformanceFallback = true;
    }
  } else {
    usedPerformanceFallback = true;
  }

  let shiftDemand = [];
  let basedOnForecast = true;
  try {
    const forecast = await buildDemandForecast({
      restaurantId: rid,
      timezone,
      horizonDays: effectiveHorizonDays,
      forecastStart: requestedStart || startDate,
    });
    shiftDemand = convertHourlyForecastToShiftDemand(
      forecast?.hourlyForecast || [],
    ).filter((row) => {
      const d = toDate(row?.date ? `${row.date}T00:00:00` : null);
      return d && d >= startDate && d <= endDate;
    });
    if (!shiftDemand.length) {
      basedOnForecast = false;
      shiftDemand = buildFallbackDemandByShift(
        recentOrders,
        timezone,
        effectiveHorizonDays,
        startDate,
      );
    }
  } catch {
    basedOnForecast = false;
    shiftDemand = buildFallbackDemandByShift(
      recentOrders,
      timezone,
      effectiveHorizonDays,
      startDate,
    );
  }

  const staffById = new Map(
    (staffList || []).map((s) => {
      const staffId = String(s._id);
      const hasPerformanceScore = performanceByStaff.has(staffId);
      const performanceScore = hasPerformanceScore
        ? resolvePerformanceScore(performanceByStaff.get(staffId))
        : DEFAULT_PERFORMANCE_SCORE;
      if (!hasPerformanceScore) usedPerformanceFallback = true;

      return [
        staffId,
        {
          id: staffId,
          fullName: s.fullName || "Nhân viên",
          department: String(s.department || "service").toLowerCase(),
          role: roleFromDepartment(s.department),
          employmentType: String(s.employmentType || "full_time").toLowerCase(),
          workingDays: Array.isArray(s.workingDays)
            ? s.workingDays.map((day) => String(day || "").toUpperCase())
            : [],
          employmentStatus: String(s.employmentStatus || "working").toLowerCase(),
          score: performanceScore,
          performanceSource: hasPerformanceScore ? "snapshot" : "fallback",
        },
      ];
    }),
  );

  const shiftMap = new Map();
  for (const row of shifts || []) {
    if (String(row?.status || "").toLowerCase() === "cancelled") continue;
    const start = toDate(row?.startTime);
    const end = toDate(row?.endTime);
    if (!start || !end) continue;

    const date = toIsoDay(start, timezone);
    const shiftType = normalizeShiftType(row?.shiftType);
    const key = `${date}|${shiftType}`;

    if (!shiftMap.has(key)) {
      shiftMap.set(key, {
        shiftKey: key,
        date,
        shiftType,
        records: [],
        staffIds: new Set(),
      });
    }

    const g = shiftMap.get(key);
    g.records.push({ ...row, start, end });
    if (row?.employeeId) g.staffIds.add(String(row.employeeId));
  }

  for (const row of shiftDemand) {
    if (!shiftMap.has(row.shiftKey)) {
      shiftMap.set(row.shiftKey, {
        shiftKey: row.shiftKey,
        date: row.date,
        shiftType: row.shiftType,
        records: [],
        staffIds: new Set(),
      });
    }
  }

  const shiftsOutput = [];

  for (const group of [...shiftMap.values()].sort((a, b) =>
    a.shiftKey.localeCompare(b.shiftKey),
  )) {
    const demand = shiftDemand.find((x) => x.shiftKey === group.shiftKey) || {
      expectedOrders: 4,
      expectedGuests: 12,
      confidence: 0.4,
    };

    const demandLevel = demandLevelFromExpected(
      demand.expectedOrders,
      demand.expectedGuests,
    );
    const baseRoles = buildBaseRoleNeed(
      demand.expectedOrders,
      demand.expectedGuests,
      demandLevel,
    );

    const roleRows = Object.entries(baseRoles).map(([role, required]) => ({
      role,
      required: Math.max(0, Number(required || 0)),
      assigned: 0,
      delta: 0,
    }));

    const roleMap = new Map(roleRows.map((r) => [r.role, r]));

    for (const staffId of group.staffIds) {
      const person = staffById.get(String(staffId));
      if (!person) continue;
      const role = person.role;
      if (!roleMap.has(role)) {
        roleMap.set(role, { role, required: 0, assigned: 0, delta: 0 });
      }
      roleMap.get(role).assigned += 1;
    }

    const recommendedRoles = [...roleMap.values()].map((row) => ({
      role: row.role,
      required: row.required,
      assigned: row.assigned,
      delta: row.assigned - row.required,
    }));

    const recommendedTotalStaff = recommendedRoles.reduce(
      (sum, r) => sum + r.required,
      0,
    );
    const currentAssignedStaff = group.staffIds.size;
    const deltaStaff = currentAssignedStaff - recommendedTotalStaff;
    const { status, severity } = resolveShiftStatus(deltaStaff);

    const shiftWindow = SHIFT_WINDOWS[group.shiftType] || SHIFT_WINDOWS.morning;
    const shiftStart = toBusinessShiftDate(group.date, shiftWindow.startHour, timezone);
    const shiftEnd = toBusinessShiftDate(group.date, shiftWindow.endHour, timezone);

    const assignedIds = new Set([...group.staffIds].map(String));
    const suggestedCandidates = [];

    const missingRoles = recommendedRoles
      .filter((r) => r.delta < 0)
      .sort((a, b) => a.delta - b.delta);

    for (const missing of missingRoles) {
      const needed = Math.abs(missing.delta);
      const pool = [...staffById.values()]
        .filter((p) => p.role === missing.role)
        .filter((p) => SUGGESTIBLE_EMPLOYMENT.has(p.employmentStatus))
        .filter((p) => !assignedIds.has(p.id))
        .filter((p) => {
          const personShifts = shifts.filter(
            (s) => String(s.employeeId) === p.id,
          );
          return !personShifts.some((s) => {
            const sStart = toDate(s.startTime);
            const sEnd = toDate(s.endTime);
            if (!sStart || !sEnd) return false;
            return overlaps(shiftStart, shiftEnd, sStart, sEnd);
          });
        });

      const evaluatedPool = await Promise.all(
        pool.map(async (candidate) => {
          try {
            const availability = await resolveStaffAvailabilityForShift({
              restaurantId: rid,
              employeeId: candidate.id,
              staff: candidate,
              shiftDate: shiftStart,
              shiftType: group.shiftType,
              policy: schedulingPolicy,
            });

            return {
              ...candidate,
              availabilityIssues: availability.issues || [],
            };
          } catch {
            return {
              ...candidate,
              availabilityIssues: [],
            };
          }
        }),
      );

      const selectedPool = evaluatedPool
        .sort((a, b) => {
          const leftHardBlock = (a.availabilityIssues || []).some((i) => i?.severity === "high" || i?.hardBlock === true) ? 1 : 0;
          const rightHardBlock = (b.availabilityIssues || []).some((i) => i?.severity === "high" || i?.hardBlock === true) ? 1 : 0;
          if (leftHardBlock !== rightHardBlock) return leftHardBlock - rightHardBlock;
          const leftWarn = (a.availabilityIssues || []).length > 0 ? 1 : 0;
          const rightWarn = (b.availabilityIssues || []).length > 0 ? 1 : 0;
          if (leftWarn !== rightWarn) return leftWarn - rightWarn;
          return b.score - a.score;
        })
        .slice(0, needed);

      for (const candidate of selectedPool) {
        const availabilityText = (candidate.availabilityIssues || [])
          .map((issue) => issue.message)
          .filter(Boolean)
          .slice(0, 1)
          .join("; ");

        const performanceText =
          candidate.performanceSource === "fallback"
            ? `Hiệu suất gần đây: ${candidate.score}/100 (điểm trung lập)`
            : `Hiệu suất gần đây: ${candidate.score}/100`;
        const baseReason = [
          "Đúng vai trò",
          "đang làm việc",
          "không trùng ca hiện tại",
          performanceText,
          availabilityText,
        ]
          .filter(Boolean)
          .join("; ");

        suggestedCandidates.push({
          staffId: candidate.id,
          fullName: candidate.fullName,
          role: candidate.role,
          reason: baseReason,
        });
      }
    }

    shiftsOutput.push({
      shiftKey: group.shiftKey,
      date: group.date,
      shiftType: group.shiftType,
      demandLevel,
      expectedOrders: Number((demand.expectedOrders || 0).toFixed(2)),
      expectedGuests: Number((demand.expectedGuests || 0).toFixed(2)),
      recommendedTotalStaff,
      currentAssignedStaff,
      deltaStaff,
      status,
      severity,
      confidence: Number(
        clamp(Number(demand.confidence || 0.45), 0.35, 0.95).toFixed(3),
      ),
      recommendedRoles,
      suggestedCandidates,
    });
  }

  const underStaffed = shiftsOutput.filter((s) => s.status === "understaffed");
  const overStaffed = shiftsOutput.filter((s) => s.status === "overstaffed");

  const highestRiskShift =
    shiftsOutput
      .filter((s) => s.status !== "balanced")
      .sort(
        (a, b) =>
          a.deltaStaff - b.deltaStaff || b.expectedGuests - a.expectedGuests,
      )[0]?.shiftKey || null;

  const summaryNotes = [];
  if (underStaffed.length) {
    const missingRoles = new Map();
    for (const shift of underStaffed) {
      for (const role of shift.recommendedRoles) {
        if (role.delta < 0) {
          missingRoles.set(
            role.role,
            (missingRoles.get(role.role) || 0) + Math.abs(role.delta),
          );
        }
      }
    }
    const topMissing = [...missingRoles.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([role]) => role)
      .join(", ");
    if (topMissing) summaryNotes.push(`Vai trò thiếu nổi bật: ${topMissing}.`);
  }
  if (overStaffed.length)
    summaryNotes.push("Có ca đang overstaff, cân nhắc điều chuyển nhân sự.");
  if (!summaryNotes.length)
    summaryNotes.push("Phân bổ ca hiện tại tương đối cân bằng với dự báo.");
  if (usedPerformanceFallback) {
    summaryNotes.push(
      "Thiếu dữ liệu performance xác thực, đang dùng điểm trung lập 75/100 cho gợi ý nhân sự.",
    );
  }

  return {
    summary: {
      totalShiftGroups: shiftsOutput.length,
      underStaffedShifts: underStaffed.length,
      overStaffedShifts: overStaffed.length,
      highestRiskShift,
      notes: summaryNotes,
    },
    shifts: shiftsOutput,
    meta: {
      method: "staff_scheduling_v1",
      basedOnForecast,
      fallbackUsed: !basedOnForecast,
      generatedAt: new Date().toISOString(),
      timezone,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      effectiveHorizonDays,
    },
  };
}
