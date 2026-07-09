import "dotenv/config.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  AttendanceCorrectionRequest,
  OvertimeRequest,
  PayrollItem,
  PayrollPeriod,
  PayrollSetting,
  Restaurant,
  Role,
  ScheduleAcknowledgement,
  SchedulePublication,
  Shift,
  ShiftAcknowledgement,
  Staff,
  Timesheet,
  User,
} from "../models/index.js";

import {
  assertDemoScriptAllowed,
  getDemoPassword,
  safeDbInfo,
} from "./lib/scriptSafety.js";

const DEMO_PASSWORD = getDemoPassword();
const RESET = process.argv.includes("--reset");
const DEMO_TAG = "[demo-payroll-readiness]";
const READY_START = new Date("2026-06-01T00:00:00.000Z");
const BLOCKED_START = new Date("2026-06-08T00:00:00.000Z");

const at = (base, dayOffset, hour = 0, minute = 0) =>
  new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + dayOffset,
      hour,
      minute,
      0,
      0,
    ),
  );

const endOfWeek = (base) => at(base, 6, 23, 59);

const DEMO_PERIOD_STARTS = [READY_START, BLOCKED_START];
const DEMO_PERIOD_ENDS = [endOfWeek(READY_START), endOfWeek(BLOCKED_START)];

async function upsertRole(slug, name) {
  return Role.findOneAndUpdate(
    { slug },
    { $setOnInsert: { slug, name, isSystem: true } },
    { upsert: true, new: true },
  );
}

async function upsertUser({ email, fullName, userType, roleId, extra = {} }) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return User.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        fullName,
        userType,
        role: roleId,
        status: "active",
        provider: "local",
        ...extra,
      },
      $setOnInsert: { passwordHash },
    },
    { upsert: true, new: true },
  );
}

async function upsertStaff({
  email,
  fullName,
  roleId,
  restaurantId,
  code,
  department,
  positionTitle,
  baseSalary,
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return Staff.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        fullName,
        userType: "STAFF",
        role: roleId,
        status: "active",
        provider: "local",
        restaurantForStaff: restaurantId,
        primaryRestaurant: restaurantId,
        refRestaurants: [restaurantId],
        employeeCode: code,
        employmentStatus: "working",
        employmentType: "full_time",
        workingDays: ["mon", "tue", "wed", "thu", "fri"],
        department,
        positionTitle,
        baseSalary,
      },
      $setOnInsert: { passwordHash },
    },
    { upsert: true, new: true },
  );
}

async function resolveDemoRestaurant(managerId = null) {
  return Restaurant.findOneAndUpdate(
    {
      name: "Cohan Payroll Readiness Demo",
      description: { $regex: DEMO_TAG },
    },
    {
      $set: {
        name: "Cohan Payroll Readiness Demo",
        description: `${DEMO_TAG} Schedule → Attendance → Payroll readiness demo`,
        address: {
          line1: "88 Demo Payroll Street",
          district: "District 1",
          city: "Ho Chi Minh City",
          country: "Vietnam",
        },
        ...(managerId ? { managerId } : {}),
      },
    },
    { upsert: true, new: true },
  );
}

async function resetScenario(restaurantId) {
  if (!RESET) return;

  await Promise.all([
    Shift.deleteMany({
      restaurantId,
      notes: { $regex: DEMO_TAG },
    }),
    Timesheet.deleteMany({
      restaurantId,
      note: { $regex: DEMO_TAG },
    }),
    AttendanceCorrectionRequest.deleteMany({
      restaurantId,
      workDate: { $gte: READY_START, $lte: endOfWeek(BLOCKED_START) },
    }),
    OvertimeRequest.deleteMany({
      restaurantId,
      workDate: { $gte: READY_START, $lte: endOfWeek(BLOCKED_START) },
    }),
    SchedulePublication.deleteMany({
      restaurantId,
      periodStart: { $in: DEMO_PERIOD_STARTS },
      periodEnd: { $in: DEMO_PERIOD_ENDS },
    }),
    ShiftAcknowledgement.deleteMany({
      restaurantId,
      periodStart: { $in: DEMO_PERIOD_STARTS },
      periodEnd: { $in: DEMO_PERIOD_ENDS },
    }),
    ScheduleAcknowledgement.deleteMany({
      restaurantId,
      periodStart: { $in: DEMO_PERIOD_STARTS },
      periodEnd: { $in: DEMO_PERIOD_ENDS },
    }),
    PayrollItem.deleteMany({
      restaurantId,
      employeeName: { $regex: "Demo Payroll" },
    }),
    PayrollPeriod.deleteMany({
      restaurantId,
      name: { $regex: "Payroll Readiness Demo" },
    }),
  ]);
}

async function upsertPayrollSettings({
  restaurantId,
  currentPayrollPeriodId,
  actorId,
}) {
  return PayrollSetting.findOneAndUpdate(
    { restaurantId },
    {
      $set: {
        currentPayrollPeriodId,
        standardWorkDaysPerMonth: 26,
        standardHoursPerDay: 8,
        overtimeMultiplierWeekday: 1.5,
        overtimeMultiplierWeekend: 2,
        overtimeMultiplierHoliday: 3,
        latenessPenaltyPerMinute: 1000,
        earlyLeavePenaltyPerMinute: 1000,
        defaultAllowance: 0,
        defaultBonus: 0,
        defaultDeduction: 0,
        weekendDays: ["SUN"],
        holidayDates: [],
        nightShiftStart: "22:00",
        nightShiftEnd: "06:00",
        nightShiftAllowanceRate: 0.3,
        notes: `${DEMO_TAG} valid payroll readiness settings`,
        updatedBy: actorId,
      },
    },
    { upsert: true, new: true },
  );
}

async function upsertPeriod({ restaurantId, name, startDate }) {
  return PayrollPeriod.findOneAndUpdate(
    { restaurantId, startDate, endDate: endOfWeek(startDate) },
    {
      $set: {
        name,
        status: "draft",
        finalizedAt: null,
        finalizedBy: null,
        lockedAt: null,
        lockedBy: null,
        paidAt: null,
        paidBy: null,
        calculationVersion: "payroll_readiness_demo_v1",
      },
    },
    { upsert: true, new: true },
  );
}

async function upsertPublication({
  restaurantId,
  managerId,
  startDate,
  status = "published",
}) {
  return SchedulePublication.findOneAndUpdate(
    { restaurantId, periodStart: startDate, periodEnd: endOfWeek(startDate) },
    {
      $set: {
        status,
        periodStart: startDate,
        periodEnd: endOfWeek(startDate),
        publishedAt: status === "published" ? new Date() : null,
        publishedBy: status === "published" ? managerId : null,
        lastChangedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
}

async function upsertShift({
  restaurantId,
  employeeId,
  start,
  end,
  shiftType = "morning",
}) {
  return Shift.findOneAndUpdate(
    { restaurantId, employeeId, startTime: start, endTime: end },
    {
      $set: {
        restaurantId,
        employeeId,
        shiftType,
        startTime: start,
        endTime: end,
        status: "scheduled",
        notes: `${DEMO_TAG} demo shift`,
      },
    },
    { upsert: true, new: true },
  );
}

async function upsertScheduleAck({
  restaurantId,
  publicationId,
  employeeId,
  periodStart,
  periodEnd,
  status = "acknowledged",
}) {
  return ScheduleAcknowledgement.findOneAndUpdate(
    { restaurantId, schedulePublicationId: publicationId, employeeId },
    {
      $set: {
        restaurantId,
        schedulePublicationId: publicationId,
        employeeId,
        periodStart,
        periodEnd,
        status,
        acknowledgedAt: new Date(),
        changedAfterAcknowledgement: false,
        lastChangedAt: null,
      },
    },
    { upsert: true, new: true },
  );
}

async function upsertTimesheet({
  restaurantId,
  employeeId,
  shiftId = null,
  workDate,
  plannedStart,
  plannedEnd,
  checkIn,
  checkOut,
  status = "completed",
  isOffSchedule = false,
  approved = true,
  extra = {},
}) {
  return Timesheet.findOneAndUpdate(
    {
      restaurantId,
      employeeId,
      workDate,
      ...(shiftId ? { shiftId } : { isOffSchedule: true }),
    },
    {
      $set: {
        restaurantId,
        employeeId,
        shiftId,
        workDate,
        plannedStartTime: plannedStart || null,
        plannedEndTime: plannedEnd || null,
        actualCheckInAt: checkIn || null,
        actualCheckOutAt: checkOut || null,
        status,
        source: "quick",
        workedMinutes:
          checkIn && checkOut
            ? Math.max(Math.round((checkOut - checkIn) / 60000), 0)
            : 0,
        hours:
          checkIn && checkOut
            ? Number(((checkOut - checkIn) / 60000 / 60).toFixed(2))
            : 0,
        approved,
        isOffSchedule,
        note: `${DEMO_TAG} demo timesheet`,
        ...extra,
      },
    },
    { upsert: true, new: true },
  );
}

async function upsertPayrollItem({
  periodId,
  restaurantId,
  staff,
  status = "draft",
}) {
  return PayrollItem.findOneAndUpdate(
    { periodId, employeeId: staff._id },
    {
      $set: {
        periodId,
        restaurantId,
        employeeId: staff._id,
        employeeName: staff.fullName,
        employeeCode: staff.employeeCode,
        role: staff.positionTitle || "",
        department: staff.department || "",
        status,
        warningMessages: [],
        breakdown: {
          baseSalary: staff.baseSalary,
          grossSalary: staff.baseSalary,
          netSalary: staff.baseSalary,
          standardWorkDays: 26,
          actualWorkDays: 1,
          totalWorkHours: 8,
          overtimeNormalHours: 0,
          overtimeWeekendHours: 0,
          overtimeHolidayHours: 0,
          nightHours: 0,
          latenessDeduction: 0,
          earlyLeaveDeduction: 0,
          allowance: 0,
          bonus: 0,
          deduction: 0,
          minimumWageViolation: false,
        },
      },
    },
    { upsert: true, new: true },
  );
}

async function seedReadyScenario({ restaurant, manager, staff }) {
  const period = await upsertPeriod({
    restaurantId: restaurant._id,
    name: "Payroll Readiness Demo - READY",
    startDate: READY_START,
  });

  const publication = await upsertPublication({
    restaurantId: restaurant._id,
    managerId: manager._id,
    startDate: READY_START,
    status: "published",
  });

  for (const [index, employee] of staff.entries()) {
    const shift = await upsertShift({
      restaurantId: restaurant._id,
      employeeId: employee._id,
      start: at(READY_START, index, 8, 0),
      end: at(READY_START, index, 16, 0),
      shiftType: "morning",
    });

    await upsertScheduleAck({
      restaurantId: restaurant._id,
      publicationId: publication._id,
      employeeId: employee._id,
      periodStart: READY_START,
      periodEnd: endOfWeek(READY_START),
    });

    await upsertTimesheet({
      restaurantId: restaurant._id,
      employeeId: employee._id,
      shiftId: shift._id,
      workDate: at(READY_START, index, 0, 0),
      plannedStart: at(READY_START, index, 8, 0),
      plannedEnd: at(READY_START, index, 16, 0),
      checkIn: at(READY_START, index, 8, 0),
      checkOut: at(READY_START, index, 16, 0),
      status: "completed",
      approved: true,
    });

    await upsertPayrollItem({
      periodId: period._id,
      restaurantId: restaurant._id,
      staff: employee,
    });
  }

  return period;
}

async function seedBlockedScenario({ restaurant, staff }) {
  const period = await upsertPeriod({
    restaurantId: restaurant._id,
    name: "Payroll Readiness Demo - BLOCKED",
    startDate: BLOCKED_START,
  });

  await SchedulePublication.deleteOne({
    restaurantId: restaurant._id,
    periodStart: BLOCKED_START,
    periodEnd: endOfWeek(BLOCKED_START),
  });

  const [cleanStaff, issueStaff] = staff;

  await upsertShift({
    restaurantId: restaurant._id,
    employeeId: cleanStaff._id,
    start: at(BLOCKED_START, 0, 8, 0),
    end: at(BLOCKED_START, 0, 16, 0),
    shiftType: "morning",
  });

  await upsertTimesheet({
    restaurantId: restaurant._id,
    employeeId: issueStaff._id,
    workDate: at(BLOCKED_START, 1, 0, 0),
    checkIn: at(BLOCKED_START, 1, 9, 0),
    checkOut: at(BLOCKED_START, 1, 12, 0),
    status: "unscheduled_completed",
    isOffSchedule: true,
    approved: false,
    extra: {
      offScheduleApprovalStatus: "pending",
      offScheduleReasonCategory: "other",
      offScheduleReason: `${DEMO_TAG} pending off-schedule demo`,
    },
  });

  await AttendanceCorrectionRequest.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: cleanStaff._id,
      workDate: at(BLOCKED_START, 2, 0, 0),
      status: "pending",
    },
    {
      $setOnInsert: {
        restaurantId: restaurant._id,
        employeeId: cleanStaff._id,
        requestedBy: cleanStaff._id,
        requestedByRole: "STAFF",
        workDate: at(BLOCKED_START, 2, 0, 0),
        correctionType: "missing_check_out",
        originalCheckInAt: at(BLOCKED_START, 2, 8, 0),
        originalCheckOutAt: null,
        requestedCheckInAt: at(BLOCKED_START, 2, 8, 0),
        requestedCheckOutAt: at(BLOCKED_START, 2, 16, 0),
        originalWorkedMinutes: 0,
        requestedWorkedMinutes: 480,
        status: "pending",
        reason: "Demo pending correction before payroll finalize",
        evidenceNote: `${DEMO_TAG} pending correction`,
        requestedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  await OvertimeRequest.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: issueStaff._id,
      workDate: at(BLOCKED_START, 3, 0, 0),
      status: "approved",
    },
    {
      $setOnInsert: {
        restaurantId: restaurant._id,
        employeeId: issueStaff._id,
        requestedBy: issueStaff._id,
        requestedByRole: "STAFF",
        workDate: at(BLOCKED_START, 3, 0, 0),
        plannedStartTime: at(BLOCKED_START, 3, 17, 0),
        plannedEndTime: at(BLOCKED_START, 3, 18, 30),
        plannedOvertimeMinutes: 90,
        approvedOvertimeMinutes: 90,
        overtimeType: "weekday",
        status: "approved",
        reason: "Demo approved overtime not completed before payroll finalize",
        approvalNote: `${DEMO_TAG} approved but not completed overtime`,
        requestedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  return period;
}

async function main() {
  assertDemoScriptAllowed("seedPayrollReadinessDemo.js");
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.MONGO_DB || "cohan";

  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log("Connected Mongo for payroll readiness demo seed.");

  const [managerRole, accountantRole, staffRole] = await Promise.all([
    upsertRole("manager", "Manager"),
    upsertRole("accountant", "Accountant"),
    upsertRole("staff", "Staff"),
  ]);

  const restaurant = await resolveDemoRestaurant();
  await resetScenario(restaurant._id);

  const manager = await upsertUser({
    email: "payroll.ready.manager.demo@cohan.local",
    fullName: "Demo Payroll Readiness Manager",
    userType: "MANAGER",
    roleId: managerRole._id,
    extra: {
      restaurantForStaff: restaurant._id,
      refRestaurants: [restaurant._id],
    },
  });

  const accountant = await upsertUser({
    email: "payroll.ready.accountant.demo@cohan.local",
    fullName: "Demo Payroll Readiness Accountant",
    userType: "ACCOUNTANT",
    roleId: accountantRole._id,
    extra: {
      restaurantForStaff: restaurant._id,
      refRestaurants: [restaurant._id],
    },
  });

  await resolveDemoRestaurant(manager._id);

  const cleanStaff = await upsertStaff({
    email: "payroll.ready.clean.staff.demo@cohan.local",
    fullName: "Demo Payroll Clean Staff",
    roleId: staffRole._id,
    restaurantId: restaurant._id,
    code: "PRD001",
    department: "service",
    positionTitle: "Server",
    baseSalary: 9000000,
  });

  const issueStaff = await upsertStaff({
    email: "payroll.ready.issue.staff.demo@cohan.local",
    fullName: "Demo Payroll Issue Staff",
    roleId: staffRole._id,
    restaurantId: restaurant._id,
    code: "PRD002",
    department: "kitchen",
    positionTitle: "Cook",
    baseSalary: 9500000,
  });

  const readyPeriod = await seedReadyScenario({
    restaurant,
    manager,
    staff: [cleanStaff, issueStaff],
  });

  const blockedPeriod = await seedBlockedScenario({
    restaurant,
    staff: [cleanStaff, issueStaff],
  });

  await upsertPayrollSettings({
    restaurantId: restaurant._id,
    currentPayrollPeriodId: blockedPeriod._id,
    actorId: accountant._id,
  });

  console.log("Seeded payroll readiness demo data successfully.");
  console.log("Restaurant:", String(restaurant._id), restaurant.name);
  console.log(
    "Ready period:",
    String(readyPeriod._id),
    readyPeriod.name,
    readyPeriod.startDate.toISOString(),
    readyPeriod.endDate.toISOString(),
  );
  console.log(
    "Blocked period:",
    String(blockedPeriod._id),
    blockedPeriod.name,
    blockedPeriod.startDate.toISOString(),
    blockedPeriod.endDate.toISOString(),
  );
  console.log("Manager:", "payroll.ready.manager.demo@cohan.local");
  console.log("Accountant:", "payroll.ready.accountant.demo@cohan.local");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
