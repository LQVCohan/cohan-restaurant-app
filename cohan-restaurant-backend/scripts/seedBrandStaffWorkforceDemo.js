process.env.TZ ||= "UTC";

import "dotenv/config.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import mongoose from "mongoose";

import {
  Brand,
  BrandMembership,
  PayrollItem,
  PayrollPeriod,
  PayrollSetting,
  Restaurant,
  Shift,
  Staff,
  Timesheet,
  User,
} from "../models/index.js";
import {
  getPeriodDetail,
  upsertPeriodItems,
} from "../src/services/payroll/payrollRuntime.service.js";
import {
  assertDemoScriptAllowed,
  safeDbInfo,
} from "./lib/scriptSafety.js";

export const DEFAULT_BRAND_ID = "6a5018c92a9577d6a9cf4bad";
export const DEFAULT_RESTAURANT_ID = "6a5018c92a9577d6a9cf4bb1";
export const DEFAULT_AS_OF_DATE = "2026-07-11";

const DEMO_TAG = "[demo-brand-staff-workforce-2026-07]";
const scriptPath = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(scriptPath);
const backendDir = path.dirname(scriptsDir);
const DAY_MS = 24 * 60 * 60 * 1000;

export const DEMO_WEEKS = [
  { start: "2026-06-29", end: "2026-07-05", name: "Tuần 29/06 - 05/07/2026" },
  { start: "2026-07-06", end: "2026-07-12", name: "Tuần 06/07 - 12/07/2026" },
];

const DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const toObjectId = (value, code) => {
  if (!mongoose.isValidObjectId(String(value || ""))) throw new Error(code);
  return new mongoose.Types.ObjectId(String(value));
};

const utcDay = (ymd) => new Date(`${ymd}T00:00:00.000Z`);
const utcDayEnd = (ymd) => new Date(`${ymd}T23:59:59.999Z`);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const isoDate = (date) => date.toISOString().slice(0, 10);
const hcmTime = (ymd, hour, minute = 0) => {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0, 0));
};

export function buildBaseSeedSteps({
  brandId = DEFAULT_BRAND_ID,
  restaurantId = DEFAULT_RESTAURANT_ID,
  asOfDate = DEFAULT_AS_OF_DATE,
  reset = false,
} = {}) {
  const env = {
    DEMO_BRAND_ID: String(brandId),
    DEMO_RESTAURANT_ID: String(restaurantId),
    DEMO_AS_OF_DATE: String(asOfDate),
  };
  return [
    { script: "seedPermissions.js", args: [], env },
    { script: "seedParentRoles.js", args: [], env },
    { script: "seedRoles.js", args: [], env },
    {
      script: "seedSchedulingAttendanceDemo.js",
      args: reset ? ["--reset"] : [],
      env,
    },
    { script: "seedStaffProfileDemoData.js", args: [], env },
  ];
}

export function buildRosterStep({
  brandId = DEFAULT_BRAND_ID,
  restaurantId = DEFAULT_RESTAURANT_ID,
  managerId,
  asOfDate = DEFAULT_AS_OF_DATE,
} = {}) {
  if (!managerId) throw new Error("DEMO_MANAGER_ID_REQUIRED");
  return {
    script: "seedStaffPerformanceWeekRosterUtc.js",
    args: [],
    env: {
      DEMO_BRAND_ID: String(brandId),
      DEMO_RESTAURANT_ID: String(restaurantId),
      DEMO_MANAGER_ID: String(managerId),
      DEMO_AS_OF_DATE: String(asOfDate),
    },
  };
}

function runSeedStep(step) {
  console.log(`\n▶ ${step.script} ${step.args.join(" ")}`.trim());
  const result = spawnSync(
    process.execPath,
    [path.join(scriptsDir, step.script), ...step.args],
    {
      cwd: backendDir,
      env: { ...process.env, ...step.env },
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${step.script} failed with exit code ${result.status}`);
  }
}

export function normalizeSalaryProfile({ employmentType, baseSalary, hourlyRate } = {}) {
  const normalizedType = String(employmentType || "full_time").toLowerCase();
  const salary = Math.max(Number(baseSalary || 0), 0);
  if (normalizedType !== "part_time") {
    return { salaryType: "monthly", baseSalary: salary, hourlyRate: null };
  }

  const derivedHourlyRate = Math.max(
    30_000,
    Math.round((salary > 0 ? salary / 208 : 30_000) / 1_000) * 1_000,
  );
  return {
    salaryType: "hourly",
    baseSalary: salary,
    hourlyRate: Math.max(Number(hourlyRate || 0), derivedHourlyRate),
  };
}

export function calculatePartTimePayrollBreakdown(
  breakdown = {},
  hourlyRate,
  settings = {},
) {
  const rate = Math.max(Number(hourlyRate || 0), 0);
  const totalHours = Math.max(Number(breakdown.totalHours || 0), 0);
  const normalHours = Math.max(Number(breakdown.overtimeNormalHours || 0), 0);
  const weekendHours = Math.max(Number(breakdown.overtimeWeekendHours || 0), 0);
  const holidayHours = Math.max(Number(breakdown.overtimeHolidayHours || 0), 0);
  const nightHours = Math.max(Number(breakdown.nightHours || 0), 0);

  const overtimeNormal = normalHours * rate * Number(settings.overtimeMultiplierWeekday || 1.5);
  const overtimeWeekend = weekendHours * rate * Number(settings.overtimeMultiplierWeekend || 2);
  const overtimeHoliday = holidayHours * rate * Number(settings.overtimeMultiplierHoliday || 3);
  const nightShiftExtra = nightHours * rate * Number(settings.nightShiftAllowanceRate ?? 0.3);
  const regularIncome = totalHours * rate;
  const grossIncome =
    regularIncome + overtimeNormal + overtimeWeekend + overtimeHoliday + nightShiftExtra;
  const totalIncome =
    grossIncome +
    Number(breakdown.allowance || 0) +
    Number(breakdown.bonus || 0) +
    Number(breakdown.otherAddition || 0);
  const totalDeduction = Math.max(
    Number(breakdown.totalDeduction || 0) - Number(breakdown.insuranceTotal || 0),
    0,
  );

  return {
    ...breakdown,
    hourlyRate: rate,
    grossIncome,
    overtime: overtimeNormal + overtimeWeekend + overtimeHoliday + nightShiftExtra,
    overtimeNormal,
    overtimeWeekend,
    overtimeHoliday,
    nightShiftExtra,
    insuranceSocial: 0,
    insuranceHealth: 0,
    insuranceUnemployment: 0,
    insuranceTotal: 0,
    insuranceEmployerTotal: 0,
    insuranceEligible: false,
    totalIncome,
    totalDeduction,
    netSalary: Math.max(totalIncome - totalDeduction, 0),
    coefficient: totalHours > 0 ? 1 : 0,
    minimumWageViolation:
      Number(breakdown.minimumWageHourly || 0) > 0 &&
      rate < Number(breakdown.minimumWageHourly || 0),
  };
}

function listDates(start, end) {
  const dates = [];
  for (let date = utcDay(start); date <= utcDay(end); date = addDays(date, 1)) {
    dates.push(isoDate(date));
  }
  return dates;
}

function getWorkingDays(staff) {
  const configured = (staff.workingDays || []).map((day) => String(day).toLowerCase());
  if (configured.length) return new Set(configured);
  return new Set(
    staff.employmentType === "part_time"
      ? ["tue", "thu", "sat"]
      : ["mon", "tue", "wed", "thu", "fri", "sat"],
  );
}

export function getShiftPlan(staff, ymd) {
  const type = String(staff.shiftType || "").toLowerCase();
  const isPartTime = staff.employmentType === "part_time";
  if (type === "afternoon") return { shiftType: "afternoon", startHour: 12, endHour: isPartTime ? 18 : 20 };
  if (type === "evening") return { shiftType: "evening", startHour: 16, endHour: 22 };
  if (type === "full_day") return { shiftType: "full_day", startHour: 8, endHour: 16 };
  if (type === "rotating") {
    const rotateEvening = utcDay(ymd).getUTCDate() % 2 === 0;
    return rotateEvening
      ? { shiftType: "evening", startHour: 16, endHour: 22 }
      : { shiftType: "morning", startHour: 8, endHour: isPartTime ? 14 : 16 };
  }
  return { shiftType: "morning", startHour: 8, endHour: isPartTime ? 14 : 16 };
}

async function connect() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017", {
    dbName: process.env.MONGO_DB || "cohan",
  });
}

async function disconnect() {
  await mongoose.disconnect().catch(() => {});
}

async function assertTargetScope({ brandId, restaurantId }) {
  const bid = toObjectId(brandId, "DEMO_BRAND_ID_INVALID");
  const rid = toObjectId(restaurantId, "DEMO_RESTAURANT_ID_INVALID");
  const [brand, restaurant] = await Promise.all([
    Brand.findById(bid).lean(),
    Restaurant.findById(rid).lean(),
  ]);
  if (!brand) throw new Error(`DEMO_BRAND_NOT_FOUND: ${brandId}`);
  if (!restaurant) throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${restaurantId}`);
  if (String(restaurant.brandId || "") !== String(bid)) {
    throw new Error(
      `DEMO_RESTAURANT_BRAND_MISMATCH: restaurant.brandId=${restaurant.brandId || "null"} expected=${brandId}`,
    );
  }
  return { bid, rid, brand, restaurant };
}

async function resolveManager({ restaurant, restaurantId, managerId }) {
  const candidates = [managerId, restaurant.managerId].filter(Boolean);
  let manager = null;
  for (const candidate of candidates) {
    if (!mongoose.isValidObjectId(String(candidate))) continue;
    manager = await User.findOne({
      _id: candidate,
      userType: { $in: ["MANAGER", "ADMIN"] },
      status: "active",
      deletedAt: null,
    }).lean();
    if (manager) break;
  }
  if (!manager) {
    manager = await User.findOne({
      email: "manager.demo@cohan.local",
      userType: "MANAGER",
      status: "active",
      deletedAt: null,
    }).lean();
  }
  if (!manager) throw new Error("DEMO_MANAGER_NOT_FOUND");

  const scoped =
    String(manager.restaurantForStaff || "") === String(restaurantId) ||
    (manager.refRestaurants || []).some((id) => String(id) === String(restaurantId));
  if (!scoped && manager.userType !== "ADMIN") {
    throw new Error(`DEMO_MANAGER_CANNOT_ACCESS_RESTAURANT: ${manager._id}`);
  }
  return manager;
}

async function upsertMembership({ brandId, userId, role, restaurantIds, actorId }) {
  return BrandMembership.findOneAndUpdate(
    { brandId, userId },
    {
      $set: {
        role,
        restaurantIds,
        status: "active",
        revokedAt: null,
        revokedBy: null,
        revokedReason: null,
        updatedBy: actorId,
      },
      $setOnInsert: {
        createdBy: actorId,
        invitedBy: actorId,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );
}

async function normalizeWorkforce({ brandId, restaurantId, manager }) {
  const [staff, operators] = await Promise.all([
    Staff.find({
      restaurantForStaff: restaurantId,
      userType: "STAFF",
      status: "active",
      deletedAt: null,
      email: /\.demo@cohan\.local$/i,
    }).lean(),
    User.find({
      email: {
        $in: [
          "admin.demo@cohan.local",
          "hr.demo@cohan.local",
          "accountant.demo@cohan.local",
        ],
      },
      status: "active",
      deletedAt: null,
    }).lean(),
  ]);
  if (!staff.length) throw new Error("DEMO_STAFF_NOT_FOUND");

  const fullTimeCount = staff.filter((row) => row.employmentType === "full_time").length;
  const partTimeCount = staff.filter((row) => row.employmentType === "part_time").length;
  if (!fullTimeCount || !partTimeCount) {
    throw new Error(
      `DEMO_EMPLOYMENT_TYPES_INCOMPLETE: full_time=${fullTimeCount} part_time=${partTimeCount}`,
    );
  }

  await upsertMembership({
    brandId,
    userId: manager._id,
    role: manager.userType === "ADMIN" ? "admin" : "manager",
    restaurantIds: manager.userType === "ADMIN" ? [] : [restaurantId],
    actorId: manager._id,
  });

  for (const operator of operators) {
    await upsertMembership({
      brandId,
      userId: operator._id,
      role: operator.userType === "ADMIN" ? "admin" : "staff",
      restaurantIds: operator.userType === "ADMIN" ? [] : [restaurantId],
      actorId: manager._id,
    });
  }

  for (const row of staff) {
    const salary = normalizeSalaryProfile(row);
    await Promise.all([
      Staff.updateOne(
        { _id: row._id, restaurantForStaff: restaurantId },
        {
          $set: {
            salaryType: salary.salaryType,
            baseSalary: salary.baseSalary,
            hourlyRate: salary.hourlyRate,
            primaryRestaurant: restaurantId,
            refRestaurants: [restaurantId],
          },
        },
        { runValidators: true },
      ),
      upsertMembership({
        brandId,
        userId: row._id,
        role: "staff",
        restaurantIds: [restaurantId],
        actorId: manager._id,
      }),
    ]);
  }

  return Staff.find({
    _id: { $in: staff.map((row) => row._id) },
    restaurantForStaff: restaurantId,
  }).lean();
}

async function ensureTwoWeekCoverage({ restaurantId, staff, asOfDate }) {
  let createdShifts = 0;
  let createdTimesheets = 0;

  for (const employee of staff) {
    const workingDays = getWorkingDays(employee);
    for (const week of DEMO_WEEKS) {
      for (const ymd of listDates(week.start, week.end)) {
        const dayCode = DAY_CODES[utcDay(ymd).getUTCDay()];
        if (!workingDays.has(dayCode)) continue;

        const plan = getShiftPlan(employee, ymd);
        let shift = await Shift.findOne({
          restaurantId,
          employeeId: employee._id,
          startTime: { $gte: utcDay(ymd), $lte: utcDayEnd(ymd) },
        });
        if (!shift) {
          shift = await Shift.create({
            restaurantId,
            employeeId: employee._id,
            shiftType: plan.shiftType,
            startTime: hcmTime(ymd, plan.startHour),
            endTime: hcmTime(ymd, plan.endHour),
            status: ymd < asOfDate ? "completed" : "scheduled",
            notes: `${DEMO_TAG} ${employee.email} ${ymd}`,
          });
          createdShifts += 1;
        }

        if (ymd >= asOfDate) continue;
        const existingTimesheet = await Timesheet.findOne({
          restaurantId,
          employeeId: employee._id,
          workDate: utcDay(ymd),
          isOffSchedule: { $ne: true },
        }).lean();
        if (existingTimesheet) continue;

        const workedMinutes = Math.max(
          Math.round((new Date(shift.endTime) - new Date(shift.startTime)) / 60000),
          0,
        );
        await Timesheet.create({
          restaurantId,
          employeeId: employee._id,
          shiftId: shift._id,
          workDate: utcDay(ymd),
          source: "system",
          plannedStartTime: shift.startTime,
          plannedEndTime: shift.endTime,
          actualCheckInAt: shift.startTime,
          actualCheckOutAt: shift.endTime,
          workedMinutes,
          hours: Number((workedMinutes / 60).toFixed(2)),
          status: "completed",
          approved: true,
          isOffSchedule: false,
          note: `${DEMO_TAG} completed attendance`,
        });
        createdTimesheets += 1;
      }
    }
  }

  return { createdShifts, createdTimesheets };
}

async function ensurePayrollSettings({ restaurantId, managerId }) {
  return PayrollSetting.findOneAndUpdate(
    { restaurantId },
    {
      $setOnInsert: {
        standardWorkDaysPerMonth: 26,
        standardHoursPerDay: 8,
        overtimeMultiplierWeekday: 1.5,
        overtimeMultiplierWeekend: 2,
        overtimeMultiplierHoliday: 3,
        latenessPenaltyPerMinute: 1_000,
        earlyLeavePenaltyPerMinute: 1_000,
        defaultAllowance: 0,
        defaultBonus: 0,
        defaultDeduction: 0,
        weekendDays: ["SUN"],
        holidayDates: [],
        nightShiftStart: "22:00",
        nightShiftEnd: "06:00",
        nightShiftAllowanceRate: 0.3,
        notes: `${DEMO_TAG} payroll settings`,
        updatedBy: managerId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function adjustPartTimePayroll({ period, staff, settings }) {
  const partTimeStaff = staff.filter((row) => row.employmentType === "part_time");
  for (const employee of partTimeStaff) {
    const item = await PayrollItem.findOne({
      periodId: period._id,
      employeeId: employee._id,
    }).lean();
    if (!item) continue;

    const salary = normalizeSalaryProfile(employee);
    const breakdown = calculatePartTimePayrollBreakdown(
      item.breakdown || {},
      salary.hourlyRate,
      settings,
    );
    const warnings = (item.warningMessages || []).filter(
      (message) =>
        !/lương cơ bản thấp hơn|bh bắt buộc/i.test(String(message || "")),
    );
    warnings.push(`Part-time tính theo ${salary.hourlyRate.toLocaleString("vi-VN")}đ/giờ.`);

    await PayrollItem.updateOne(
      { _id: item._id },
      { $set: { breakdown, warningMessages: [...new Set(warnings)] } },
    );
  }

  const detail = await getPeriodDetail(period._id);
  await PayrollPeriod.updateOne(
    { _id: period._id },
    { $set: { statsSnapshot: detail?.stats || {} } },
  );
}

async function seedPayroll({ restaurantId, manager, staff }) {
  const settings = await ensurePayrollSettings({
    restaurantId,
    managerId: manager._id,
  });
  const periods = [];

  for (const week of DEMO_WEEKS) {
    const period = await PayrollPeriod.findOneAndUpdate(
      {
        restaurantId,
        startDate: utcDay(week.start),
        endDate: utcDayEnd(week.end),
      },
      {
        $set: {
          name: `Lương demo ${week.name}`,
          status: "draft",
          finalizedAt: null,
          finalizedBy: null,
          lockedAt: null,
          lockedBy: null,
          paidAt: null,
          paidBy: null,
          calculationVersion: "brand_staff_workforce_demo_v1",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await upsertPeriodItems(period);
    await adjustPartTimePayroll({ period, staff, settings });
    periods.push(period);
  }
  return periods;
}

async function assertResult({ brandId, restaurantId, staff, periods }) {
  const membershipCount = await BrandMembership.countDocuments({
    brandId,
    userId: { $in: staff.map((row) => row._id) },
    role: "staff",
    status: "active",
    restaurantIds: restaurantId,
  });
  if (membershipCount !== staff.length) {
    throw new Error(
      `DEMO_BRAND_MEMBERSHIP_COUNT_MISMATCH: expected=${staff.length} actual=${membershipCount}`,
    );
  }

  for (const week of DEMO_WEEKS) {
    const coveredStaffIds = await Shift.distinct("employeeId", {
      restaurantId,
      employeeId: { $in: staff.map((row) => row._id) },
      startTime: { $gte: utcDay(week.start), $lte: utcDayEnd(week.end) },
    });
    if (coveredStaffIds.length !== staff.length) {
      throw new Error(
        `DEMO_SHIFT_COVERAGE_MISMATCH: week=${week.start} expected=${staff.length} actual=${coveredStaffIds.length}`,
      );
    }
  }

  for (const period of periods) {
    const itemCount = await PayrollItem.countDocuments({ periodId: period._id });
    if (itemCount !== staff.length) {
      throw new Error(
        `DEMO_PAYROLL_ITEM_COUNT_MISMATCH: period=${period._id} expected=${staff.length} actual=${itemCount}`,
      );
    }
  }
}

async function main() {
  assertDemoScriptAllowed("seedBrandStaffWorkforceDemo.js");
  const brandId = process.env.DEMO_BRAND_ID?.trim() || DEFAULT_BRAND_ID;
  const restaurantId =
    process.env.DEMO_RESTAURANT_ID?.trim() || DEFAULT_RESTAURANT_ID;
  const asOfDate = process.env.DEMO_AS_OF_DATE?.trim() || DEFAULT_AS_OF_DATE;
  const reset = process.argv.includes("--reset");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    throw new Error("DEMO_AS_OF_DATE_INVALID: expected YYYY-MM-DD");
  }

  console.log("Preparing complete brand workforce demo:", safeDbInfo());
  await connect();
  await assertTargetScope({ brandId, restaurantId });
  await disconnect();

  for (const step of buildBaseSeedSteps({ brandId, restaurantId, asOfDate, reset })) {
    runSeedStep(step);
  }

  await connect();
  let scope = await assertTargetScope({ brandId, restaurantId });
  let manager = await resolveManager({
    restaurant: scope.restaurant,
    restaurantId: scope.rid,
    managerId: process.env.DEMO_MANAGER_ID,
  });
  let staff = await normalizeWorkforce({
    brandId: scope.bid,
    restaurantId: scope.rid,
    manager,
  });
  await disconnect();

  runSeedStep(
    buildRosterStep({
      brandId,
      restaurantId,
      managerId: manager._id,
      asOfDate,
    }),
  );

  await connect();
  scope = await assertTargetScope({ brandId, restaurantId });
  manager = await resolveManager({
    restaurant: scope.restaurant,
    restaurantId: scope.rid,
    managerId: manager._id,
  });
  staff = await normalizeWorkforce({
    brandId: scope.bid,
    restaurantId: scope.rid,
    manager,
  });
  const coverage = await ensureTwoWeekCoverage({
    restaurantId: scope.rid,
    staff,
    asOfDate,
  });
  const periods = await seedPayroll({
    restaurantId: scope.rid,
    manager,
    staff,
  });
  await assertResult({
    brandId: scope.bid,
    restaurantId: scope.rid,
    staff,
    periods,
  });

  const fullTimeCount = staff.filter((row) => row.employmentType === "full_time").length;
  const partTimeCount = staff.filter((row) => row.employmentType === "part_time").length;
  console.log("Complete brand workforce demo seeded successfully.");
  console.log(`Brand=${brandId} Restaurant=${restaurantId}`);
  console.log(
    `Staff=${staff.length} full_time=${fullTimeCount} part_time=${partTimeCount}`,
  );
  console.log(
    `Two-week coverage added: shifts=${coverage.createdShifts} timesheets=${coverage.createdTimesheets}`,
  );
  console.log(`Payroll periods=${periods.length}`);
  await disconnect();
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch(async (error) => {
    console.error("[seed:demo:brand-staff-workforce] failed", error);
    await disconnect();
    process.exitCode = 1;
  });
}
