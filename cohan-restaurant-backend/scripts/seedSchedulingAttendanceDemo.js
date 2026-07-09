import "dotenv/config.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  Role,
  User,
  Staff,
  Restaurant,
  SchedulingPolicy,
  Shift,
  SchedulePublication,
  ShiftAcknowledgement,
  Timesheet,
  AttendanceCorrectionRequest,
  OvertimeRequest,
  PayrollPeriod,
  PerformanceIncident,
  Notification,
  StaffPerformanceSnapshot,
  AvailabilityRegistrationWindow,
  StaffAvailabilitySubmission,
  LeaveRequest,
  PerformanceIncidentAppeal,
} from "../models/index.js";
import {
  applyPerformanceIncidentScore,
  markPerformanceIncidentEligible,
  waivePerformanceIncident,
} from "../src/services/performance/performanceIncident.service.js";
import {
  createPerformanceIncidentAppeal,
  reviewPerformanceIncidentAppeal,
  reverseScoreForAcceptedAppeal,
} from "../src/services/performance/performanceAppeal.service.js";

import {
  assertDemoScriptAllowed,
  getDemoPassword,
  safeDbInfo,
} from "./lib/scriptSafety.js";

const DEMO_PASSWORD = getDemoPassword();
const RESET = process.argv.includes("--reset");
const DEMO_TAG = "[demo-scheduling-pr21]";
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";

const CONCRETE_STAFF_ROLE_CONTRACT = [
  {
    slug: "server",
    department: "service",
    email: "staff.server.demo@cohan.local",
    fullName: "Demo Server",
    employmentType: "full_time",
    workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
  },
  {
    slug: "supervisor",
    department: "service",
    email: "staff.supervisor.demo@cohan.local",
    fullName: "Demo Supervisor",
    employmentType: "full_time",
    workingDays: ["mon", "tue", "wed", "thu", "fri"],
  },
  {
    slug: "host",
    department: "service",
    email: "staff.host.demo@cohan.local",
    fullName: "Demo Host",
    employmentType: "part_time",
    workingDays: ["fri", "sat", "sun"],
  },
  {
    slug: "cashier",
    department: "cashier",
    email: "staff.cashier.demo@cohan.local",
    fullName: "Demo Cashier",
    employmentType: "part_time",
    workingDays: ["tue", "thu", "sat"],
  },
  {
    slug: "chef",
    department: "kitchen",
    email: "staff.chef.demo@cohan.local",
    fullName: "Demo Chef",
    employmentType: "full_time",
    workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
  },
  {
    slug: "cook",
    department: "kitchen",
    email: "staff.cook.demo@cohan.local",
    fullName: "Demo Cook",
    employmentType: "full_time",
    workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
  },
  {
    slug: "kitchen_helper",
    department: "kitchen",
    email: "staff.kitchenhelper.demo@cohan.local",
    fullName: "Demo Kitchen Helper",
    employmentType: "part_time",
    workingDays: ["wed", "fri", "sat"],
  },
  {
    slug: "cleaner",
    department: "cleaning",
    email: "staff.cleaner.demo@cohan.local",
    fullName: "Demo Cleaner",
    employmentType: "part_time",
    workingDays: ["mon", "wed", "fri", "sun"],
  },
  {
    slug: "shipper",
    department: "delivery",
    email: "staff.shipper.demo@cohan.local",
    fullName: "Demo Shipper",
    employmentType: "part_time",
    workingDays: ["mon", "tue", "wed", "thu", "fri"],
  },
  {
    slug: "storekeeper",
    department: "inventory",
    email: "staff.storekeeper.demo@cohan.local",
    fullName: "Demo Storekeeper",
    employmentType: "full_time",
    workingDays: ["mon", "tue", "wed", "thu", "fri"],
  },
  {
    slug: "bartender",
    department: "bar",
    email: "staff.bartender.demo@cohan.local",
    fullName: "Demo Bartender",
    employmentType: "part_time",
    workingDays: ["thu", "fri", "sat", "sun"],
  },
];

const DEMO_STAFF_EMAILS = [
  ...CONCRETE_STAFF_ROLE_CONTRACT.map((item) => item.email),
  "staff.fulltime.demo@cohan.local",
  "staff.parttime.demo@cohan.local",
  "staff.exception.demo@cohan.local",
];

const startOfNextWeek = () => {
  const n = new Date();
  const d = new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()),
  );
  const day = d.getUTCDay();
  const add = 8 - (day || 7);
  d.setUTCDate(d.getUTCDate() + add);
  return d;
};
const at = (base, dayOffset, h, m = 0) =>
  new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate() + dayOffset,
      h,
      m,
      0,
      0,
    ),
  );
const staffByEmail = (staffList, email) =>
  staffList.find((staff) => staff.email === email);

async function upsertRole(slug, name) {
  return Role.findOneAndUpdate(
    { slug },
    { $setOnInsert: { slug, name, isSystem: true } },
    { upsert: true, new: true },
  );
}
async function upsertBaseUser({
  email,
  fullName,
  userType,
  roleId,
  extra = {},
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return User.findOneAndUpdate(
    { email },
    {
      $set: {
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

async function upsertStaffUser({
  email,
  fullName,
  roleId,
  restaurantId,
  employmentType,
  workingDays,
  department,
}) {
  const existingUser = await User.findOne({ email })
    .select("_id userType")
    .lean();
  if (existingUser && existingUser.userType !== "STAFF") {
    throw new Error(`DEMO_EMAIL_CONFLICT_NOT_STAFF: ${email}`);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return Staff.findOneAndUpdate(
    { email },
    {
      $set: {
        fullName,
        userType: "STAFF",
        role: roleId,
        status: "active",
        provider: "local",
        restaurantForStaff: restaurantId,
        refRestaurants: [restaurantId],
        employmentType,
        workingDays,
        primaryRestaurant: restaurantId,
        department,
      },
      $setOnInsert: { passwordHash },
    },
    { upsert: true, new: true },
  );
}

async function resolveDemoRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID);
    if (!restaurant) {
      throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${DEMO_RESTAURANT_ID}`);
    }
    console.log(
      `Using existing restaurant: ${restaurant._id} - not modifying restaurant profile`,
    );
    return restaurant;
  }

  const restaurant = await Restaurant.findOneAndUpdate(
    {
      name: "Cohan Demo Restaurant - District 1",
      description: { $regex: DEMO_TAG },
    },
    {
      $set: {
        name: "Cohan Demo Restaurant - District 1",
        address: {
          line1: "123 Demo Street",
          district: "District 1",
          city: "Ho Chi Minh City",
          country: "Vietnam",
        },
        description: `PR21 demo ${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true },
  );
  console.log("Created/reused demo restaurant");
  return restaurant;
}
async function main() {
  assertDemoScriptAllowed("seedSchedulingAttendanceDemo.js");
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
  const DB_NAME = process.env.MONGO_DB || "cohan";
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log("Connected Mongo for demo seed (local/dev only).");

  const [adminR, managerR, hrR, accR, staffR] = await Promise.all([
    upsertRole("admin", "Admin"),
    upsertRole("manager", "Manager"),
    upsertRole("hr", "HR"),
    upsertRole("accountant", "Accountant"),
    upsertRole("staff", "Staff"),
  ]);

  const restaurant = await resolveDemoRestaurant();

  const admin = await upsertBaseUser({
    email: "admin.demo@cohan.local",
    fullName: "Demo Admin",
    userType: "ADMIN",
    roleId: adminR._id,
  });
  const manager = await upsertBaseUser({
    email: "manager.demo@cohan.local",
    fullName: "Demo Manager",
    userType: "MANAGER",
    roleId: managerR._id,
    extra: {
      restaurantForStaff: restaurant._id,
      refRestaurants: [restaurant._id],
    },
  });
  await Restaurant.findByIdAndUpdate(restaurant._id, {
    $set: { managerId: manager._id },
  });
  const hr = await upsertBaseUser({
    email: "hr.demo@cohan.local",
    fullName: "Demo HR",
    userType: "HR",
    roleId: hrR._id,
    extra: {
      restaurantForStaff: restaurant._id,
      refRestaurants: [restaurant._id],
    },
  });
  const accountant = await upsertBaseUser({
    email: "accountant.demo@cohan.local",
    fullName: "Demo Accountant",
    userType: "ACCOUNTANT",
    roleId: accR._id,
    extra: {
      restaurantForStaff: restaurant._id,
      refRestaurants: [restaurant._id],
    },
  });
  const concreteRoleDocs = await Role.find({
    slug: { $in: CONCRETE_STAFF_ROLE_CONTRACT.map((item) => item.slug) },
  })
    .select("_id slug")
    .lean();
  const concreteRoleBySlug = new Map(
    concreteRoleDocs.map((item) => [item.slug, item]),
  );
  const missingConcreteRoleSlugs = CONCRETE_STAFF_ROLE_CONTRACT.map(
    (item) => item.slug,
  ).filter((slug) => !concreteRoleBySlug.has(slug));
  if (missingConcreteRoleSlugs.length) {
    throw new Error(
      `MISSING_CONCRETE_STAFF_ROLES: please run seedRoles before demo scheduling seed. missing=${missingConcreteRoleSlugs.join(",")}`,
    );
  }

  const seededConcreteStaff = [];
  for (const item of CONCRETE_STAFF_ROLE_CONTRACT) {
    const roleDoc = concreteRoleBySlug.get(item.slug);
    seededConcreteStaff.push(
      await upsertStaffUser({
        ...item,
        roleId: roleDoc._id,
        restaurantId: restaurant._id,
      }),
    );
  }

  const fulltime = await upsertStaffUser({
    email: "staff.fulltime.demo@cohan.local",
    fullName: "Demo Staff Fulltime",
    roleId: concreteRoleBySlug.get("server")._id,
    restaurantId: restaurant._id,
    employmentType: "full_time",
    workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    department: "service",
  });
  const parttime = await upsertStaffUser({
    email: "staff.parttime.demo@cohan.local",
    fullName: "Demo Staff Parttime",
    roleId: concreteRoleBySlug.get("cashier")._id,
    restaurantId: restaurant._id,
    employmentType: "part_time",
    workingDays: ["tue", "thu", "sat"],
    department: "cashier",
  });
  const exception = await upsertStaffUser({
    email: "staff.exception.demo@cohan.local",
    fullName: "Demo Staff Exception",
    roleId: concreteRoleBySlug.get("cook")._id,
    restaurantId: restaurant._id,
    employmentType: "part_time",
    workingDays: ["wed", "fri", "sat"],
    department: "kitchen",
  });

  const weekStart = startOfNextWeek();
  const weekEnd = at(weekStart, 6, 23, 59);
  if (RESET) {
    await Promise.all([
      StaffAvailabilitySubmission.deleteMany({
        restaurantId: restaurant._id,
        periodStart: weekStart,
        periodEnd: weekEnd,
      }),
      AvailabilityRegistrationWindow.deleteMany({
        restaurantId: restaurant._id,
        periodStart: weekStart,
        periodEnd: weekEnd,
      }),
      LeaveRequest.deleteMany({
        restaurantId: restaurant._id,
        reason: { $regex: DEMO_TAG },
        startDate: { $gte: weekStart, $lte: weekEnd },
      }),
      Shift.deleteMany({
        restaurantId: restaurant._id,
        notes: { $regex: DEMO_TAG },
      }),
      Timesheet.deleteMany({
        restaurantId: restaurant._id,
        note: { $regex: DEMO_TAG },
      }),
      AttendanceCorrectionRequest.deleteMany({
        restaurantId: restaurant._id,
        $or: [
          { note: { $regex: DEMO_TAG } },
          { reason: { $regex: DEMO_TAG } },
          { evidenceNote: { $regex: DEMO_TAG } },
        ],
      }),
      OvertimeRequest.deleteMany({
        restaurantId: restaurant._id,
        note: { $regex: DEMO_TAG },
      }),
      PerformanceIncident.deleteMany({
        restaurantId: restaurant._id,
        note: { $regex: DEMO_TAG },
      }),
      Notification.deleteMany({
        restaurantId: restaurant._id,
        type: {
          $regex: "demo_|appeal|off_schedule|correction|overtime|incident",
        },
      }),
      ShiftAcknowledgement.deleteMany({
        restaurantId: restaurant._id,
        $or: [{ reason: { $regex: DEMO_TAG } }, { note: { $regex: DEMO_TAG } }],
      }),
    ]);
  }

  await SchedulingPolicy.findOneAndUpdate(
    { restaurantId: restaurant._id },
    {
      $set: {
        mandatoryShiftRoles: ["cashier", "kitchen", "server"],
        "employmentTypePolicy.part_time.minWeeklyHours": 12,
        "laborRules.weeklyHoursCap": 48,
        "laborRules.maxShiftsPerDay": 2,
        "availabilityRegistrationPolicy.treatMissingPartTimeSubmissionAsUnavailable": true,
        shiftTemplates: [
          {
            key: "morning",
            label: "Morning",
            startTime: "08:00",
            endTime: "14:00",
            enabled: true,
          },
          {
            key: "evening",
            label: "Evening",
            startTime: "16:00",
            endTime: "22:00",
            enabled: true,
          },
        ],
      },
    },
    { upsert: true, new: true },
  );

  const host = staffByEmail(seededConcreteStaff, "staff.host.demo@cohan.local");
  const cashier = staffByEmail(
    seededConcreteStaff,
    "staff.cashier.demo@cohan.local",
  );
  const cleaner = staffByEmail(
    seededConcreteStaff,
    "staff.cleaner.demo@cohan.local",
  );
  const bartender = staffByEmail(
    seededConcreteStaff,
    "staff.bartender.demo@cohan.local",
  );
  const shipper = staffByEmail(
    seededConcreteStaff,
    "staff.shipper.demo@cohan.local",
  );

  const availabilityWindow =
    await AvailabilityRegistrationWindow.findOneAndUpdate(
      {
        restaurantId: restaurant._id,
        periodStart: weekStart,
        periodEnd: weekEnd,
      },
      {
        $set: {
          openAt: at(weekStart, -7, 9),
          closeAt: at(weekStart, -1, 20),
          registrationModeSnapshot: "manual",
          status: "open",
          targetEmploymentTypes: [
            "part_time",
            "seasonal",
            "probation",
            "contract",
          ],
          allowFullTimeUnavailableException: true,
          lateChangeRequiresApproval: true,
          createdBy: manager._id,
        },
      },
      { upsert: true, new: true },
    );

  const availabilitySubmissions = [
    {
      employee: parttime,
      employmentType: "part_time",
      submissionType: "weekly_availability",
      status: "approved",
      slots: [
        {
          date: at(weekStart, 1, 0),
          shiftType: "evening",
          status: "available",
          note: `${DEMO_TAG} available`,
        },
        {
          date: at(weekStart, 3, 0),
          shiftType: "morning",
          status: "available",
          note: `${DEMO_TAG} preferred`,
        },
      ],
      reviewedBy: manager._id,
      reviewedAt: new Date(),
      reviewNote: `${DEMO_TAG} approved availability`,
    },
    {
      employee: host,
      employmentType: "part_time",
      submissionType: "weekly_availability",
      status: "pending",
      slots: [
        {
          date: at(weekStart, 4, 0),
          shiftType: "evening",
          status: "available",
          note: `${DEMO_TAG} pending availability`,
        },
      ],
    },
    {
      employee: cashier,
      employmentType: "part_time",
      submissionType: "weekly_availability",
      status: "rejected",
      slots: [
        {
          date: at(weekStart, 5, 0),
          shiftType: "morning",
          status: "unavailable",
          note: `${DEMO_TAG} rejected availability`,
        },
      ],
      reviewedBy: manager._id,
      reviewedAt: new Date(),
      reviewNote: `${DEMO_TAG} rejected for coverage gap`,
    },
    {
      employee: fulltime,
      employmentType: "full_time",
      submissionType: "unavailable_exception",
      status: "approved",
      slots: [
        {
          date: at(weekStart, 4, 0),
          shiftType: "morning",
          status: "unavailable",
          note: `${DEMO_TAG} full-time unavailable exception`,
        },
      ],
      reviewedBy: manager._id,
      reviewedAt: new Date(),
      reviewNote: `${DEMO_TAG} approved exception`,
    },
    {
      employee: bartender,
      employmentType: "part_time",
      submissionType: "weekly_availability",
      status: "late_change_requested",
      slots: [
        {
          date: at(weekStart, 5, 0),
          shiftType: "evening",
          status: "available",
          note: `${DEMO_TAG} original slot`,
        },
      ],
      pendingSubmissionType: "weekly_availability",
      pendingSlots: [
        {
          date: at(weekStart, 6, 0),
          shiftType: "evening",
          status: "unavailable",
          note: `${DEMO_TAG} late change requested`,
        },
      ],
      pendingSubmittedAt: new Date(),
      previousStatusBeforeLateChange: "approved",
      pendingSource: "employee",
      pendingNote: `${DEMO_TAG} late change requested`,
    },
  ];
  for (const submission of availabilitySubmissions) {
    await StaffAvailabilitySubmission.findOneAndUpdate(
      {
        availabilityWindowId: availabilityWindow._id,
        employeeId: submission.employee._id,
      },
      {
        $set: {
          restaurantId: restaurant._id,
          availabilityWindowId: availabilityWindow._id,
          employeeId: submission.employee._id,
          periodStart: weekStart,
          periodEnd: weekEnd,
          employmentType: submission.employmentType,
          submissionType: submission.submissionType,
          status: submission.status,
          slots: submission.slots,
          pendingSubmissionType: submission.pendingSubmissionType || null,
          pendingSlots: submission.pendingSlots || [],
          submittedAt: submission.submittedAt || new Date(),
          pendingSubmittedAt: submission.pendingSubmittedAt || null,
          previousStatusBeforeLateChange:
            submission.previousStatusBeforeLateChange || null,
          reviewedBy: submission.reviewedBy || null,
          reviewedAt: submission.reviewedAt || null,
          reviewNote: submission.reviewNote || "",
          source: "employee",
          pendingSource: submission.pendingSource || null,
          pendingNote: submission.pendingNote || "",
        },
      },
      { upsert: true, new: true },
    );
  }

  const shifts = [];
  for (let i = 0; i < 3; i++)
    shifts.push(
      await Shift.findOneAndUpdate(
        {
          restaurantId: restaurant._id,
          employeeId: fulltime._id,
          startTime: at(weekStart, i, 8, 0),
        },
        {
          $set: {
            shiftType: "morning",
            startTime: at(weekStart, i, 8, 0),
            endTime: at(weekStart, i, 14, 0),
            notes: `${DEMO_TAG} valid shift`,
          },
        },
        { upsert: true, new: true },
      ),
    );
  const partShift = await Shift.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: parttime._id,
      startTime: at(weekStart, 1, 16, 0),
    },
    {
      $set: {
        shiftType: "evening",
        startTime: at(weekStart, 1, 16, 0),
        endTime: at(weekStart, 1, 22, 0),
        notes: `${DEMO_TAG} parttime available`,
      },
    },
    { upsert: true, new: true },
  );
  const exceptionShift = await Shift.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: exception._id,
      startTime: at(weekStart, 2, 16, 0),
    },
    {
      $set: {
        shiftType: "evening",
        startTime: at(weekStart, 2, 16, 0),
        endTime: at(weekStart, 2, 22, 0),
        notes: `${DEMO_TAG} unavailable warning demo`,
      },
    },
    { upsert: true, new: true },
  );

  const absentShift = await Shift.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: cleaner._id,
      startTime: at(weekStart, 3, 8, 0),
    },
    {
      $set: {
        shiftType: "morning",
        startTime: at(weekStart, 3, 8, 0),
        endTime: at(weekStart, 3, 14, 0),
        notes: `${DEMO_TAG} scheduled absent demo`,
      },
    },
    { upsert: true, new: true },
  );
  const missedCheckoutShift = await Shift.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: host._id,
      startTime: at(weekStart, 4, 16, 0),
    },
    {
      $set: {
        shiftType: "evening",
        startTime: at(weekStart, 4, 16, 0),
        endTime: at(weekStart, 4, 22, 0),
        notes: `${DEMO_TAG} missed checkout demo`,
      },
    },
    { upsert: true, new: true },
  );
  const lateEarlyShift = await Shift.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: cashier._id,
      startTime: at(weekStart, 5, 8, 0),
    },
    {
      $set: {
        shiftType: "morning",
        startTime: at(weekStart, 5, 8, 0),
        endTime: at(weekStart, 5, 14, 0),
        notes: `${DEMO_TAG} late and early demo`,
      },
    },
    { upsert: true, new: true },
  );
  const overnightShift = await Shift.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: shipper._id,
      startTime: at(weekStart, 5, 22, 0),
    },
    {
      $set: {
        shiftType: "evening",
        startTime: at(weekStart, 5, 22, 0),
        endTime: at(weekStart, 6, 6, 0),
        notes: `${DEMO_TAG} overnight demo`,
      },
    },
    { upsert: true, new: true },
  );

  const publication = await SchedulePublication.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      periodStart: weekStart,
      periodEnd: weekEnd,
    },
    {
      $set: {
        status: "published",
        publishedAt: new Date(),
        publishedBy: manager._id,
        lastChangedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
  const ackBase = {
    restaurantId: restaurant._id,
    publicationId: publication._id,
    periodStart: weekStart,
    periodEnd: weekEnd,
    deadlineAt: at(weekStart, -1, 18),
    createdFrom: "publish",
    createdBy: manager._id,
  };
  await ShiftAcknowledgement.findOneAndUpdate(
    { shiftId: shifts[0]._id, employeeId: fulltime._id },
    {
      $set: {
        ...ackBase,
        shiftId: shifts[0]._id,
        employeeId: fulltime._id,
        status: "accepted",
        respondedAt: new Date(),
        reason: `${DEMO_TAG} accepted`,
      },
    },
    { upsert: true, new: true },
  );
  await ShiftAcknowledgement.findOneAndUpdate(
    { shiftId: partShift._id, employeeId: parttime._id },
    {
      $set: {
        ...ackBase,
        shiftId: partShift._id,
        employeeId: parttime._id,
        status: "pending",
        respondedAt: null,
        reason: `${DEMO_TAG} pending`,
      },
    },
    { upsert: true, new: true },
  );
  await ShiftAcknowledgement.findOneAndUpdate(
    { shiftId: shifts[1]._id, employeeId: fulltime._id },
    {
      $set: {
        ...ackBase,
        shiftId: shifts[1]._id,
        employeeId: fulltime._id,
        status: "expired",
        respondedAt: null,
        reason: `${DEMO_TAG} expired`,
      },
    },
    { upsert: true, new: true },
  );
  await ShiftAcknowledgement.findOneAndUpdate(
    { shiftId: exceptionShift._id, employeeId: exception._id },
    {
      $set: {
        ...ackBase,
        shiftId: exceptionShift._id,
        employeeId: exception._id,
        status: "declined",
        respondedAt: new Date(),
        reason: `${DEMO_TAG} unavailable valid decline`,
        reasonCategory: "schedule_conflict",
        declineClassification: "valid",
      },
    },
    { upsert: true, new: true },
  );
  await ShiftAcknowledgement.findOneAndUpdate(
    { shiftId: absentShift._id, employeeId: cleaner._id },
    {
      $set: {
        ...ackBase,
        shiftId: absentShift._id,
        employeeId: cleaner._id,
        status: "declined",
        respondedAt: new Date(),
        reason: `${DEMO_TAG} late decline`,
        reasonCategory: "transportation",
        declineClassification: "late",
      },
    },
    { upsert: true, new: true },
  );
  await ShiftAcknowledgement.findOneAndUpdate(
    { shiftId: lateEarlyShift._id, employeeId: cashier._id },
    {
      $set: {
        ...ackBase,
        shiftId: lateEarlyShift._id,
        employeeId: cashier._id,
        status: "declined",
        respondedAt: new Date(),
        reason: `${DEMO_TAG} valid decline`,
        reasonCategory: "sick",
        declineClassification: "valid",
      },
    },
    { upsert: true, new: true },
  );
  await ShiftAcknowledgement.findOneAndUpdate(
    { shiftId: missedCheckoutShift._id, employeeId: host._id },
    {
      $set: {
        ...ackBase,
        shiftId: missedCheckoutShift._id,
        employeeId: host._id,
        status: "declined",
        respondedAt: new Date(),
        reason: `${DEMO_TAG} invalid decline`,
        reasonCategory: "no_reason",
        declineClassification: "invalid",
      },
    },
    { upsert: true, new: true },
  );

  const tNormal = await Timesheet.findOneAndUpdate(
    {
      employeeId: fulltime._id,
      shiftId: shifts[0]._id,
      workDate: at(weekStart, 0, 0, 0),
    },
    {
      $set: {
        restaurantId: restaurant._id,
        plannedStartTime: at(weekStart, 0, 8),
        plannedEndTime: at(weekStart, 0, 14),
        actualCheckInAt: at(weekStart, 0, 8),
        actualCheckOutAt: at(weekStart, 0, 14),
        status: "completed",
        workedMinutes: 360,
        hours: 6,
        approved: true,
        note: `${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true },
  );
  const tLate = await Timesheet.findOneAndUpdate(
    {
      employeeId: parttime._id,
      shiftId: partShift._id,
      workDate: at(weekStart, 1, 0, 0),
    },
    {
      $set: {
        restaurantId: restaurant._id,
        plannedStartTime: at(weekStart, 1, 16),
        plannedEndTime: at(weekStart, 1, 22),
        actualCheckInAt: at(weekStart, 1, 16, 15),
        actualCheckOutAt: at(weekStart, 1, 22),
        latenessMinutes: 15,
        status: "late",
        workedMinutes: 345,
        hours: 5.75,
        approved: true,
        note: `${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true },
  );
  const tEarly = await Timesheet.findOneAndUpdate(
    {
      employeeId: fulltime._id,
      shiftId: shifts[1]._id,
      workDate: at(weekStart, 1, 0, 0),
    },
    {
      $set: {
        restaurantId: restaurant._id,
        plannedStartTime: at(weekStart, 1, 8),
        plannedEndTime: at(weekStart, 1, 14),
        actualCheckInAt: at(weekStart, 1, 8),
        actualCheckOutAt: at(weekStart, 1, 13, 40),
        latenessMinutes: 0,
        earlyLeaveMinutes: 20,
        status: "early_leave",
        workedMinutes: 340,
        hours: 5.66,
        approved: true,
        isOffSchedule: false,
        note: `${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true },
  );
  await Timesheet.findOneAndUpdate(
    {
      employeeId: cleaner._id,
      shiftId: absentShift._id,
      workDate: at(weekStart, 3, 0, 0),
    },
    {
      $set: {
        restaurantId: restaurant._id,
        plannedStartTime: at(weekStart, 3, 8),
        plannedEndTime: at(weekStart, 3, 14),
        actualCheckInAt: null,
        actualCheckOutAt: null,
        latenessMinutes: 0,
        earlyLeaveMinutes: 0,
        status: "scheduled_absent",
        workedMinutes: 0,
        hours: 0,
        approved: false,
        isOffSchedule: false,
        note: `${DEMO_TAG} scheduled_absent no-show`,
      },
    },
    { upsert: true, new: true },
  );
  const tMissedCheckout = await Timesheet.findOneAndUpdate(
    {
      employeeId: host._id,
      shiftId: missedCheckoutShift._id,
      workDate: at(weekStart, 4, 0, 0),
    },
    {
      $set: {
        restaurantId: restaurant._id,
        plannedStartTime: at(weekStart, 4, 16),
        plannedEndTime: at(weekStart, 4, 22),
        actualCheckInAt: at(weekStart, 4, 16),
        actualCheckOutAt: null,
        latenessMinutes: 0,
        earlyLeaveMinutes: 0,
        status: "missed_checkout",
        workedMinutes: 0,
        hours: 0,
        approved: false,
        isOffSchedule: false,
        note: `${DEMO_TAG} missed_checkout`,
      },
    },
    { upsert: true, new: true },
  );
  const tLateEarly = await Timesheet.findOneAndUpdate(
    {
      employeeId: cashier._id,
      shiftId: lateEarlyShift._id,
      workDate: at(weekStart, 5, 0, 0),
    },
    {
      $set: {
        restaurantId: restaurant._id,
        plannedStartTime: at(weekStart, 5, 8),
        plannedEndTime: at(weekStart, 5, 14),
        actualCheckInAt: at(weekStart, 5, 8, 20),
        actualCheckOutAt: at(weekStart, 5, 13, 30),
        latenessMinutes: 20,
        earlyLeaveMinutes: 30,
        status: "late_early_leave",
        workedMinutes: 310,
        hours: 5.17,
        approved: true,
        isOffSchedule: false,
        note: `${DEMO_TAG} late_early_leave`,
      },
    },
    { upsert: true, new: true },
  );
  await Timesheet.findOneAndUpdate(
    {
      employeeId: shipper._id,
      shiftId: overnightShift._id,
      workDate: at(weekStart, 5, 0, 0),
    },
    {
      $set: {
        restaurantId: restaurant._id,
        plannedStartTime: at(weekStart, 5, 22),
        plannedEndTime: at(weekStart, 6, 6),
        actualCheckInAt: at(weekStart, 5, 21, 58),
        actualCheckOutAt: at(weekStart, 6, 6, 3),
        latenessMinutes: 0,
        earlyLeaveMinutes: 0,
        status: "completed",
        workedMinutes: 485,
        hours: 8.08,
        approved: true,
        isOffSchedule: false,
        note: `${DEMO_TAG} overnight completed`,
      },
    },
    { upsert: true, new: true },
  );
  const offPending = await Timesheet.findOneAndUpdate(
    {
      employeeId: exception._id,
      isOffSchedule: true,
      workDate: at(weekStart, 3, 0, 0),
    },
    {
      $set: {
        restaurantId: restaurant._id,
        actualCheckInAt: at(weekStart, 3, 9),
        actualCheckOutAt: at(weekStart, 3, 12),
        isOffSchedule: true,
        offScheduleApprovalStatus: "pending",
        approved: false,
        status: "unscheduled_completed",
        note: `${DEMO_TAG} off_schedule pending`,
      },
    },
    { upsert: true, new: true },
  );
  await Timesheet.findOneAndUpdate(
    {
      employeeId: bartender._id,
      isOffSchedule: true,
      workDate: at(weekStart, 2, 0, 0),
    },
    {
      $set: {
        restaurantId: restaurant._id,
        actualCheckInAt: at(weekStart, 2, 18),
        actualCheckOutAt: at(weekStart, 2, 22),
        isOffSchedule: true,
        offScheduleApprovalStatus: "approved",
        offScheduleReviewedBy: manager._id,
        offScheduleReviewedAt: new Date(),
        offScheduleReviewNote: `${DEMO_TAG} approved`,
        approved: true,
        status: "unscheduled_completed",
        workedMinutes: 240,
        hours: 4,
        note: `${DEMO_TAG} off_schedule approved`,
      },
    },
    { upsert: true, new: true },
  );
  await Timesheet.findOneAndUpdate(
    {
      employeeId: host._id,
      isOffSchedule: true,
      workDate: at(weekStart, 2, 0, 0),
    },
    {
      $set: {
        restaurantId: restaurant._id,
        actualCheckInAt: at(weekStart, 2, 10),
        actualCheckOutAt: at(weekStart, 2, 12),
        isOffSchedule: true,
        offScheduleApprovalStatus: "rejected",
        offScheduleReviewedBy: manager._id,
        offScheduleReviewedAt: new Date(),
        offScheduleReviewNote: `${DEMO_TAG} rejected`,
        approved: false,
        status: "unscheduled_completed",
        workedMinutes: 120,
        hours: 2,
        note: `${DEMO_TAG} off_schedule rejected`,
      },
    },
    { upsert: true, new: true },
  );

  const correctionPending = await AttendanceCorrectionRequest.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: fulltime._id,
      workDate: at(weekStart, 1, 0, 0),
      status: "pending",
    },
    {
      $set: {
        restaurantId: restaurant._id,
        employeeId: fulltime._id,
        requestedBy: fulltime._id,
        timesheetId: tNormal._id,
        shiftId: shifts[0]._id,
        workDate: at(weekStart, 1, 0, 0),
        correctionType: "missing_check_out",
        status: "pending",
        reason: `${DEMO_TAG} Need checkout fix`,
        evidenceNote: `${DEMO_TAG} pending correction`,
        note: `${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true },
  );
  await AttendanceCorrectionRequest.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: parttime._id,
      workDate: at(weekStart, 1, 0, 0),
      status: "applied",
    },
    {
      $set: {
        restaurantId: restaurant._id,
        employeeId: parttime._id,
        requestedBy: parttime._id,
        timesheetId: tLate._id,
        shiftId: partShift._id,
        workDate: at(weekStart, 1, 0, 0),
        correctionType: "wrong_check_in",
        status: "applied",
        reason: `${DEMO_TAG} Applied lateness correction`,
        evidenceNote: `${DEMO_TAG} applied correction`,
        reviewedBy: manager._id,
        reviewedAt: new Date(),
        appliedBy: manager._id,
        appliedAt: new Date(),
        note: `${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true },
  );
  await AttendanceCorrectionRequest.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: host._id,
      workDate: at(weekStart, 4, 0, 0),
      status: "rejected",
    },
    {
      $set: {
        restaurantId: restaurant._id,
        employeeId: host._id,
        requestedBy: host._id,
        timesheetId: tMissedCheckout._id,
        shiftId: missedCheckoutShift._id,
        workDate: at(weekStart, 4, 0, 0),
        correctionType: "missing_check_out",
        status: "rejected",
        reason: `${DEMO_TAG} rejected missed checkout request`,
        evidenceNote: `${DEMO_TAG} insufficient evidence`,
        reviewedBy: manager._id,
        reviewedAt: new Date(),
        rejectionReason: `${DEMO_TAG} Camera log did not match`,
        auditLogs: [
          {
            action: "attendance_correction.reject",
            actorId: manager._id,
            actorName: "Demo Manager",
            note: `${DEMO_TAG} rejected`,
            at: new Date(),
          },
        ],
        note: `${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true },
  );
  await AttendanceCorrectionRequest.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: cashier._id,
      workDate: at(weekStart, 5, 0, 0),
      status: "cancelled",
    },
    {
      $set: {
        restaurantId: restaurant._id,
        employeeId: cashier._id,
        requestedBy: cashier._id,
        timesheetId: tLateEarly._id,
        shiftId: lateEarlyShift._id,
        workDate: at(weekStart, 5, 0, 0),
        correctionType: "wrong_check_in_out",
        status: "cancelled",
        reason: `${DEMO_TAG} cancelled late+early request`,
        evidenceNote: `${DEMO_TAG} staff cancelled`,
        auditLogs: [
          {
            action: "attendance_correction.cancel",
            actorId: cashier._id,
            actorName: "Demo Cashier",
            note: `${DEMO_TAG} cancelled`,
            at: new Date(),
            meta: { cancelledAt: new Date(), cancelledBy: String(cashier._id) },
          },
        ],
        note: `${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true },
  );

  await LeaveRequest.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: fulltime._id,
      startDate: at(weekStart, 4, 0, 0),
      endDate: at(weekStart, 4, 23, 59),
      status: "approved",
    },
    {
      $set: {
        restaurantId: restaurant._id,
        employeeId: fulltime._id,
        leaveType: "annual",
        startDate: at(weekStart, 4, 0, 0),
        endDate: at(weekStart, 4, 23, 59),
        startSession: "full",
        endSession: "full",
        requestedDays: 1,
        requestedHours: 8,
        reason: `${DEMO_TAG} approved leave affecting schedule`,
        status: "approved",
        approverId: manager._id,
        approvedAt: new Date(),
        replacementStatus: "not_required",
        quotaImpact: {
          deductAnnualDays: 1,
          deductSickDays: 0,
          deductCompensatoryDays: 0,
          totalDeductDays: 1,
        },
        auditLogs: [
          {
            action: "approved",
            actorId: manager._id,
            actorName: "Demo Manager",
            note: `${DEMO_TAG} approved leave`,
            at: new Date(),
          },
        ],
      },
    },
    { upsert: true, new: true },
  );
  await LeaveRequest.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: parttime._id,
      startDate: at(weekStart, 6, 0, 0),
      endDate: at(weekStart, 6, 23, 59),
      status: "pending",
    },
    {
      $set: {
        restaurantId: restaurant._id,
        employeeId: parttime._id,
        leaveType: "unpaid",
        startDate: at(weekStart, 6, 0, 0),
        endDate: at(weekStart, 6, 23, 59),
        startSession: "full",
        endSession: "full",
        requestedDays: 1,
        requestedHours: 8,
        reason: `${DEMO_TAG} pending leave affecting schedule`,
        status: "pending",
        replacementStatus: "pending",
        quotaImpact: {
          deductAnnualDays: 0,
          deductSickDays: 0,
          deductCompensatoryDays: 0,
          totalDeductDays: 0,
        },
        auditLogs: [
          {
            action: "created",
            actorId: parttime._id,
            actorName: "Demo Staff Parttime",
            note: `${DEMO_TAG} pending leave`,
            at: new Date(),
          },
        ],
      },
    },
    { upsert: true, new: true },
  );

  const otPending = await OvertimeRequest.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: fulltime._id,
      workDate: at(weekStart, 2, 0, 0),
      status: "approved",
    },
    {
      $setOnInsert: {
        restaurantId: restaurant._id,
        employeeId: fulltime._id,
        requestedBy: fulltime._id,
        workDate: at(weekStart, 2, 0, 0),
        plannedOvertimeMinutes: 60,
        approvedOvertimeMinutes: 60,
        status: "approved",
        note: `${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true },
  );
  await OvertimeRequest.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      employeeId: parttime._id,
      workDate: at(weekStart, 4, 0, 0),
      status: "completed",
    },
    {
      $setOnInsert: {
        restaurantId: restaurant._id,
        employeeId: parttime._id,
        requestedBy: parttime._id,
        workDate: at(weekStart, 4, 0, 0),
        plannedOvertimeMinutes: 45,
        actualOvertimeMinutes: 40,
        approvedOvertimeMinutes: 40,
        status: "completed",
        reviewedBy: manager._id,
        note: `${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true },
  );

  const periodStart = at(weekStart, 0, 0, 0),
    periodEnd = at(weekStart, 6, 23, 59);
  await PayrollPeriod.findOneAndUpdate(
    {
      restaurantId: restaurant._id,
      startDate: periodStart,
      endDate: periodEnd,
    },
    { $set: { status: "open", lockedAt: null } },
    { upsert: true, new: true },
  );

  const incidentLate = await PerformanceIncident.findOneAndUpdate(
    {
      sourceType: "timesheet",
      sourceId: String(tLate._id),
      eventType: "ATTENDANCE_LATE",
    },
    {
      $setOnInsert: {
        restaurantId: restaurant._id,
        employeeId: parttime._id,
        actorId: manager._id,
        actorRole: "MANAGER",
        sourceType: "timesheet",
        sourceId: String(tLate._id),
        uniqueKey: `timesheet:${tLate._id}:ATTENDANCE_LATE`,
        eventType: "ATTENDANCE_LATE",
        severity: "warning",
        responsibilityStatus: "pending_review",
        scoreImpactStatus: "pending",
        note: DEMO_TAG,
      },
    },
    { upsert: true, new: true },
  );
  const incidentOffReject = await PerformanceIncident.findOneAndUpdate(
    {
      sourceType: "off_schedule_attendance",
      sourceId: String(offPending._id),
      eventType: "OFF_SCHEDULE_REJECTED",
    },
    {
      $setOnInsert: {
        restaurantId: restaurant._id,
        employeeId: exception._id,
        actorId: manager._id,
        actorRole: "MANAGER",
        sourceType: "off_schedule_attendance",
        sourceId: String(offPending._id),
        uniqueKey: `off_schedule_attendance:${offPending._id}:OFF_SCHEDULE_REJECTED`,
        eventType: "OFF_SCHEDULE_REJECTED",
        severity: "warning",
        responsibilityStatus: "staff_responsible",
        scoreImpactStatus: "pending",
        note: DEMO_TAG,
      },
    },
    { upsert: true, new: true },
  );

  const ctx = {
    user: {
      id: manager._id,
      _id: manager._id,
      userType: "MANAGER",
      restaurantForStaff: restaurant._id,
      refRestaurants: [restaurant._id],
      roleName: "manager",
    },
  };
  let scoredIncidentLate = incidentLate;
  if (!["applied"].includes(scoredIncidentLate.scoreImpactStatus)) {
    scoredIncidentLate = await markPerformanceIncidentEligible({
      input: {
        incidentId: scoredIncidentLate._id,
        responsibilityStatus: "staff_responsible",
        proposedScoreDelta: -5,
        note: "Demo eligible",
      },
      ctx,
    });
    scoredIncidentLate = await applyPerformanceIncidentScore({
      incidentId: scoredIncidentLate._id,
      actor: ctx.user,
      note: "Demo apply",
    });
  }
  if (incidentOffReject.scoreImpactStatus !== "waived") {
    await waivePerformanceIncident({
      incidentId: incidentOffReject._id,
      reason: "Demo waived",
      ctx,
    });
  }

  await StaffPerformanceSnapshot.findOneAndUpdate(
    {
      employeeId: fulltime._id,
      restaurantId: restaurant._id,
      periodStart: new Date(
        Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), 1),
      ),
      periodEnd: new Date(
        Date.UTC(
          weekStart.getUTCFullYear(),
          weekStart.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      ),
    },
    { $setOnInsert: { finalPerformanceScore: 100 } },
    { upsert: true, new: true },
  );

  const appealReason = `${DEMO_TAG} Xin xem xét do kẹt xe demo`;
  let appeal = await PerformanceIncidentAppeal.findOne({
    incidentId: scoredIncidentLate._id,
    reason: appealReason,
  });
  if (!appeal) {
    appeal = await createPerformanceIncidentAppeal(
      { incidentId: scoredIncidentLate._id, reason: appealReason },
      {
        id: parttime._id,
        _id: parttime._id,
        userType: "STAFF",
        restaurantForStaff: restaurant._id,
        refRestaurants: [restaurant._id],
      },
    );
  }
  if (appeal.status !== "accepted") {
    appeal = await reviewPerformanceIncidentAppeal(
      {
        appealId: appeal._id,
        status: "accepted",
        decisionReason: "Accepted for demo",
        reviewNote: "ok",
      },
      ctx.user,
    );
  }
  scoredIncidentLate = await PerformanceIncident.findById(
    scoredIncidentLate._id,
  );
  if (
    appeal.scoreReversalStatus !== "reversed" &&
    !appeal.scoreReversalId &&
    scoredIncidentLate.scoreReversalStatus !== "reversed"
  ) {
    await reverseScoreForAcceptedAppeal({
      appealId: appeal._id,
      actor: ctx.user,
      reversalDelta: 5,
      note: "reverse demo",
    });
  }

  console.log(
    "Seeded/Reused demo scheduling-attendance-performance data successfully.",
  );
  console.log("Checklist:");
  console.log("- Availability window/submissions seeded");
  console.log("- Published shifts seeded");
  console.log(
    "- Attendance: completed, late, early_leave, late_early_leave, scheduled_absent, missed_checkout, overnight, off_schedule pending/approved/rejected",
  );
  console.log("- Corrections: pending/applied/rejected/cancelled");
  console.log("- Overtime: approved/completed");
  console.log("- Leave: approved/pending");
  console.log(
    "- Acknowledgements: accepted/pending/expired/declined valid/invalid/late",
  );
  console.log("- Performance incidents/appeal/reversal seeded");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
