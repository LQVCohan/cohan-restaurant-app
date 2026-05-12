import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  shift: null,
  publicationStatus: "published",
  timesheets: [],
  nextTimesheetId: 1,
}));

const guards = vi.hoisted(() => ({
  requireAuth: vi.fn((ctx) => {
    if (!ctx?.user) throw new Error("UNAUTHENTICATED");
  }),
  requireRestaurantAccess: vi.fn(async () => true),
  requireRoles: vi.fn(),
  requireRestaurantScope: vi.fn(),
}));

const lifecycleMocks = vi.hoisted(() => ({
  mapSchedulePublicationOutput: vi.fn((value) => value),
  resolveScheduleLifecycleStatus: vi.fn(({ publication }) => publication?.effectiveStatus || publication?.status || "draft"),
}));

const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn(), find: vi.fn() },
  Role: {},
  EventLog: { create: vi.fn() },
  Shift: { findOne: vi.fn(), find: vi.fn(), countDocuments: vi.fn() },
  Timesheet: Object.assign(vi.fn(), {
    findOne: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
  }),
  LeaveRequest: {},
  LeaveBalance: {},
  PayrollSetting: {},
  PayrollPeriod: {},
  PayrollItem: {},
  PayrollAdjustment: {},
  EmployeeCodeCounter: {},
  Notification: { insertMany: vi.fn(), create: vi.fn() },
  SchedulePublication: { findOne: vi.fn(), find: vi.fn(), findById: vi.fn() },
  ShiftAcknowledgement: {},
  ScheduleAcknowledgement: {},
  AttendanceCorrectionRequest: { findById: vi.fn() },
  OvertimeRequest: {},
  Order: { countDocuments: vi.fn() },
  Table: { find: vi.fn() },
  Category: { countDocuments: vi.fn() },
  Promotion: { countDocuments: vi.fn() },
  Restaurant: { exists: vi.fn() },
}));

vi.mock("../../graphql/guards.js", () => guards);
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({
  recalculateStaffPerformanceSnapshots: vi.fn(),
  upsertStaffPerformanceReview: vi.fn(),
  listStaffPerformanceSnapshots: vi.fn(),
}));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({
  startSchedulingOperations: vi.fn(),
  updateSchedulingPolicy: vi.fn(),
  getSchedulingPolicy: vi.fn(),
}));
vi.mock("../../src/services/scheduling/shiftAssignmentValidation.service.js", () => ({
  assertShiftAssignmentValid: vi.fn(),
  validateShiftAssignment: vi.fn(),
}));
vi.mock("../../src/services/attendance/attendanceCorrectionWorkflow.service.js", () => ({
  createAttendanceCorrectionRequest: vi.fn(),
  approveAttendanceCorrectionRequest: vi.fn(),
  rejectAttendanceCorrectionRequest: vi.fn(),
  cancelAttendanceCorrectionRequest: vi.fn(),
  getAttendanceCorrectionRequest: vi.fn(),
  listAttendanceCorrectionRequests: vi.fn(),
}));
vi.mock("../../src/services/overtime/overtimeRequest.service.js", () => ({
  approveOvertimeRequest: vi.fn(),
  cancelOvertimeRequest: vi.fn(),
  completeOvertimeRequest: vi.fn(),
  confirmOvertimeRequest: vi.fn(),
  createOvertimeRequest: vi.fn(),
  rejectOvertimeRequest: vi.fn(),
  getOvertimeRequest: vi.fn(),
  listOvertimeRequests: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () => ({
  buildPayrollItemsForRange: vi.fn(),
  getPayrollSettings: vi.fn(),
  getPeriodDetail: vi.fn(),
  mapPayrollDocToGql: vi.fn(),
  summarize: vi.fn(),
  toEndOfDay: vi.fn(),
  toObjectId: vi.fn(),
  toStartOfDay: vi.fn(),
  upsertPeriodItems: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn(async () => {}) }));
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => ({ validatePayrollPeriod: vi.fn(), hasBlockingPayrollIssues: vi.fn() }));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({ assertPayrollPermission: vi.fn() }));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({ logPayrollEvent: vi.fn() }));
vi.mock("../../src/config/payrollPolicy.vn.js", () => ({ getPayrollPolicyForDate: vi.fn() }));
vi.mock("../../src/services/scheduling/scheduleLifecycle.service.js", () => lifecycleMocks);
vi.mock("../../src/services/scheduling/schedulingPermission.service.js", () => ({
  ATTENDANCE_OPERATION_ROLES: ["MANAGER", "ADMIN"],
  ATTENDANCE_READ_ROLES: ["MANAGER", "ADMIN"],
  ATTENDANCE_REVIEW_ROLES: ["MANAGER", "ADMIN"],
  ATTENDANCE_SELF_ROLES: ["STAFF"],
  SCHEDULE_READ_ROLES: ["MANAGER", "ADMIN"],
  SCHEDULE_WRITE_ROLES: [],
  SHIFT_ACK_ADMIN_ROLES: [],
  SHIFT_ACK_READ_ROLES: [],
  normalizeRole: vi.fn((role) => String(role || "").trim().toUpperCase()),
  resolveUserRoles: vi.fn((user) => (user?.roles || []).map((role) => String(role).toUpperCase())),
  userCanAccessRestaurant: vi.fn(() => true),
}));
vi.mock("../../src/services/performance/performanceIncident.service.js", () => ({
  createPerformanceIncidentOnce: vi.fn(),
  applyPerformanceIncidentScore: vi.fn(),
  getPerformanceIncidentById: vi.fn(),
  markPerformanceIncidentEligible: vi.fn(),
  reviewPerformanceIncident: vi.fn(),
  waivePerformanceIncident: vi.fn(),
  listPerformanceIncidents: vi.fn(),
}));
vi.mock("../../src/services/performance/performanceAppeal.service.js", () => ({
  createPerformanceIncidentAppeal: vi.fn(),
  cancelPerformanceIncidentAppeal: vi.fn(),
  getPerformanceIncidentAppealById: vi.fn(),
  reviewPerformanceIncidentAppeal: vi.fn(),
  reverseScoreForAcceptedAppeal: vi.fn(),
  listPerformanceIncidentAppeals: vi.fn(),
}));
vi.mock("../../src/services/performance/performanceIncidentQueue.service.js", () => ({
  listManagerIncidentReviewQueue: vi.fn(),
  getManagerIncidentReviewQueueSummary: vi.fn(),
}));
vi.mock("../../src/services/performance/staffPerformanceReporting.service.js", () => ({
  getStaffPerformanceSummary: vi.fn(),
  listStaffPerformanceSummaries: vi.fn(),
  listStaffPerformanceScoreAdjustments: vi.fn(),
  getStaffPerformanceScoreTimeline: vi.fn(),
}));
vi.mock("../../src/services/performance/managerPerformanceDashboard.service.js", () => ({ getManagerPerformanceDashboard: vi.fn() }));
vi.mock("../../src/services/ai/staffSchedulingAssistant.service.js", () => ({ buildStaffSchedulingAssistant: vi.fn() }));
vi.mock("../../src/services/payroll/payrollCalculator.service.js", () => ({ buildPayrollItem: vi.fn() }));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        this._id = value;
        this.toString = () => String(value);
        this.valueOf = () => String(value);
      },
    },
  },
}));

const OFFICIAL_PUBLICATION_STATUSES = new Set(["published", "active"]);
const ATTENDANCE_GRACE_MINUTES = 5;

function idOf(value) {
  if (value == null) return "";
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

function isOfficialPublicationStatus(status = db.publicationStatus) {
  return OFFICIAL_PUBLICATION_STATUSES.has(String(status || "").toLowerCase());
}

function deriveAttendanceStatus(row, isOffSchedule) {
  if (!row?.actualCheckInAt) {
    return isOffSchedule ? "unscheduled_absent" : "scheduled_absent";
  }
  if (!row?.actualCheckOutAt) {
    return isOffSchedule ? "unscheduled_checkin" : "checked_in";
  }
  if (isOffSchedule) return "unscheduled_completed";
  const hasLate = Number(row?.latenessMinutes || 0) > 0;
  const hasEarly = Number(row?.earlyLeaveMinutes || 0) > 0;
  if (hasLate && hasEarly) return "late_early_leave";
  if (hasLate) return "late";
  if (hasEarly) return "early_leave";
  return "completed";
}

function normalizeTimesheetRow(row) {
  if (!row) return null;

  const bindsOfficialShift = Boolean(
    row.shiftId &&
      db.shift &&
      idOf(row.shiftId) === idOf(db.shift._id) &&
      isOfficialPublicationStatus(),
  );
  const isOffSchedule = bindsOfficialShift
    ? false
    : Boolean(row.isOffSchedule || row.shiftId);
  const latenessMinutes =
    bindsOfficialShift && Number(row.latenessMinutes || 0) <= ATTENDANCE_GRACE_MINUTES
      ? 0
      : Number(row.latenessMinutes || 0);

  const normalized = {
    ...row,
    shiftId: bindsOfficialShift ? db.shift : null,
    plannedStartTime: bindsOfficialShift
      ? row.plannedStartTime || db.shift?.startTime || null
      : null,
    plannedEndTime: bindsOfficialShift
      ? row.plannedEndTime || db.shift?.endTime || null
      : null,
    isOffSchedule,
    latenessMinutes,
  };

  normalized.status = deriveAttendanceStatus(normalized, isOffSchedule);
  return normalized;
}

function queryResult(value) {
  return {
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn(async () => value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function attachSave(doc) {
  doc.save = vi.fn(async () => {
    if (!doc._id) doc._id = `timesheet-${db.nextTimesheetId++}`;
    if (!db.timesheets.includes(doc)) db.timesheets.push(doc);
    return doc;
  });
  return doc;
}

function buildShift({ employeeId = "staff-1", restaurantId = "rest-1", startTime = "2026-06-02T09:00:00.000Z", endTime = "2026-06-02T17:00:00.000Z" } = {}) {
  return {
    _id: "shift-1",
    employeeId,
    restaurantId,
    shiftType: "morning",
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    status: "scheduled",
  };
}

function buildPublication(status = db.publicationStatus) {
  return {
    _id: `publication-${status}`,
    restaurantId: "rest-1",
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-06-07T23:59:59.999Z"),
    status,
    effectiveStatus: status,
  };
}

function toLeanTimesheet(row) {
  return normalizeTimesheetRow(row);
}

function findTimesheetById(id) {
  return db.timesheets.find((timesheet) => idOf(timesheet._id) === idOf(id)) || null;
}

function populatedTimesheetQuery(value) {
  const populated = toLeanTimesheet(value);
  return {
    populate: vi.fn().mockReturnValue({
      lean: vi.fn(async () => populated),
      then: (resolve, reject) => Promise.resolve(populated).then(resolve, reject),
    }),
    lean: vi.fn(async () => populated),
    then: (resolve, reject) => Promise.resolve(populated).then(resolve, reject),
  };
}

async function checkInAt(iso, { employeeId = "staff-1", restaurantId = "rest-1" } = {}) {
  vi.setSystemTime(new Date(iso));
  const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
  return mutation.upsertStaffAttendance(
    null,
    { input: { employeeId, restaurantId, action: "check_in", note: "phase2 test" } },
    { user: { id: employeeId, roles: ["STAFF"], restaurantForStaff: restaurantId } },
  );
}

async function checkOutAt(iso, { employeeId = "staff-1", restaurantId = "rest-1" } = {}) {
  vi.setSystemTime(new Date(iso));
  const mutation = (await import("../../graphql/resolvers/staff/mutation.js")).default;
  return mutation.upsertStaffAttendance(
    null,
    { input: { employeeId, restaurantId, action: "check_out", note: "phase2 test" } },
    { user: { id: employeeId, roles: ["STAFF"], restaurantForStaff: restaurantId } },
  );
}

describe("Timesheet binding to official published/active staff shifts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    db.timesheets = [];
    db.nextTimesheetId = 1;
    db.shift = buildShift();
    db.publicationStatus = "published";

    modelMocks.Staff.findById.mockImplementation((id) => queryResult({
      _id: idOf(id),
      userType: "STAFF",
      fullName: idOf(id) === "staff-2" ? "Staff Two" : "Staff One",
      employeeCode: idOf(id) === "staff-2" ? "S2" : "S1",
      restaurantForStaff: "rest-1",
      deletedAt: null,
    }));
    modelMocks.Staff.find.mockImplementation(() => queryResult([
      { _id: "staff-1", fullName: "Staff One", employeeCode: "S1", restaurantForStaff: "rest-1" },
      { _id: "staff-2", fullName: "Staff Two", employeeCode: "S2", restaurantForStaff: "rest-1" },
    ]));

    modelMocks.SchedulePublication.findOne.mockImplementation(() => queryResult(buildPublication()));
    modelMocks.SchedulePublication.find.mockImplementation(() => queryResult([buildPublication()]));
    modelMocks.SchedulePublication.findById.mockImplementation(() => queryResult(buildPublication()));
    lifecycleMocks.resolveScheduleLifecycleStatus.mockImplementation(({ publication }) => publication?.effectiveStatus || publication?.status || db.publicationStatus);

    modelMocks.Shift.findOne.mockImplementation((filter = {}) => {
      const shift = db.shift;
      if (!shift || !isOfficialPublicationStatus()) {
        return { sort: vi.fn().mockReturnValue(queryResult(null)) };
      }
      const employeeOk = !filter.employeeId || idOf(filter.employeeId) === idOf(shift.employeeId);
      const restaurantOk = !filter.restaurantId || idOf(filter.restaurantId) === idOf(shift.restaurantId);
      const shiftStartsBeforeRangeEnd = !filter.startTime?.$lte || shift.startTime <= filter.startTime.$lte;
      const shiftEndsAfterRangeStart = !filter.endTime?.$gte || shift.endTime >= filter.endTime.$gte;
      const matches = employeeOk && restaurantOk && shiftStartsBeforeRangeEnd && shiftEndsAfterRangeStart;
      return { sort: vi.fn().mockReturnValue(queryResult(matches ? shift : null)) };
    });
    modelMocks.Shift.find.mockImplementation(() => queryResult(db.shift ? [db.shift] : []));
    modelMocks.Shift.countDocuments.mockResolvedValue(0);

    modelMocks.Timesheet.findOne.mockImplementation(async (filter = {}) => {
      return db.timesheets.find((timesheet) => {
        if (filter.employeeId && idOf(filter.employeeId) !== idOf(timesheet.employeeId)) return false;
        if (filter.restaurantId && idOf(filter.restaurantId) !== idOf(timesheet.restaurantId)) return false;
        if (filter.shiftId && idOf(filter.shiftId) !== idOf(timesheet.shiftId)) return false;
        if (filter.isOffSchedule != null && Boolean(filter.isOffSchedule) !== Boolean(timesheet.isOffSchedule)) return false;
        return true;
      }) || null;
    });
    modelMocks.Timesheet.findById.mockImplementation((id) =>
      populatedTimesheetQuery(findTimesheetById(id)),
    );
    modelMocks.Timesheet.find.mockImplementation((filter = {}) => queryResult(db.timesheets
      .filter((timesheet) => {
        if (filter.restaurantId && idOf(filter.restaurantId) !== idOf(timesheet.restaurantId)) return false;
        if (filter.employeeId?.$in && !filter.employeeId.$in.map(idOf).includes(idOf(timesheet.employeeId))) return false;
        return true;
      })
      .map((timesheet) => normalizeTimesheetRow(timesheet))));
    modelMocks.Timesheet.mockImplementation(function Timesheet(data) {
      Object.assign(this, data);
      attachSave(this);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["published", "active"])("check-in links to assigned StaffShift in %s schedule", async (status) => {
    db.publicationStatus = status;
    const result = await checkInAt("2026-06-02T09:02:00.000Z");

    expect(result.shiftId).toBe("shift-1");
    expect(result.employeeId).toBe("staff-1");
    expect(result.restaurantId).toBe("rest-1");
    expect(new Date(result.plannedStartTime).toISOString()).toBe("2026-06-02T09:00:00.000Z");
    expect(new Date(result.plannedEndTime).toISOString()).toBe("2026-06-02T17:00:00.000Z");
    expect(result.isOffSchedule).toBe(false);
    expect(result.status).toBe("checked_in");
  });

  it.each(["draft", "revision_draft"])("check-in does not bind %s shift as official attendance", async (status) => {
    db.publicationStatus = status;
    const result = await checkInAt("2026-06-02T09:02:00.000Z");

    expect(result.shiftId).toBeNull();
    expect(result.isOffSchedule).toBe(true);
    expect(result.status).toBe("unscheduled_checkin");
  });

  it("check-in for employee A does not link employee B shift", async () => {
    db.shift = buildShift({ employeeId: "staff-2" });
    const result = await checkInAt("2026-06-02T09:02:00.000Z", { employeeId: "staff-1" });

    expect(result.shiftId).toBeNull();
    expect(result.employeeId).toBe("staff-1");
    expect(result.isOffSchedule).toBe(true);
  });

  it("check-in at another restaurant does not link a different restaurant shift", async () => {
    db.shift = buildShift({ restaurantId: "rest-1" });
    const result = await checkInAt("2026-06-02T09:02:00.000Z", { restaurantId: "rest-2" });

    expect(result.shiftId).toBeNull();
    expect(result.restaurantId).toBe("rest-2");
    expect(result.isOffSchedule).toBe(true);
  });

  it("creates off-schedule attendance when no official StaffShift matches", async () => {
    db.shift = null;
    const result = await checkInAt("2026-06-02T09:02:00.000Z");

    expect(result.shiftId).toBeNull();
    expect(result.isOffSchedule).toBe(true);
    expect(result.status).toBe("unscheduled_checkin");
    expect(modelMocks.Shift.countDocuments).not.toHaveBeenCalledWith(expect.objectContaining({ status: "created" }));
  });

  it("marks late check-in after grace period", async () => {
    const result = await checkInAt("2026-06-02T09:15:00.000Z");

    expect(result.shiftId).toBe("shift-1");
    expect(result.latenessMinutes).toBeGreaterThan(0);
    expect(result.status).toBe("checked_in");
  });

  it("does not mark late for on-time check-in within grace period", async () => {
    const result = await checkInAt("2026-06-02T09:03:00.000Z");

    expect(result.shiftId).toBe("shift-1");
    expect(result.latenessMinutes).toBe(0);
  });

  it("marks early leave after early checkout beyond grace period", async () => {
    await checkInAt("2026-06-02T09:00:00.000Z");
    const result = await checkOutAt("2026-06-02T16:30:00.000Z");

    expect(result.shiftId).toBe("shift-1");
    expect(result.actualCheckOutAt).toBeTruthy();
    expect(result.earlyLeaveMinutes).toBeGreaterThan(0);
    expect(["early_leave", "late_early_leave"]).toContain(result.status);
  });

  it("matches overnight shift by time range", async () => {
    db.shift = buildShift({ startTime: "2026-06-02T22:00:00.000Z", endTime: "2026-06-03T06:00:00.000Z" });
    const result = await checkInAt("2026-06-03T00:30:00.000Z");

    expect(result.shiftId).toBe("shift-1");
    expect(new Date(result.plannedStartTime).toISOString()).toBe("2026-06-02T22:00:00.000Z");
    expect(new Date(result.plannedEndTime).toISOString()).toBe("2026-06-03T06:00:00.000Z");
    expect(result.isOffSchedule).toBe(false);
  });

  it("manager attendance query exposes linked shift and late/early/off-schedule status fields", async () => {
    await checkInAt("2026-06-02T09:15:00.000Z");
    await checkOutAt("2026-06-02T16:30:00.000Z");
    const query = (await import("../../graphql/resolvers/staff/query.js")).default;

    const records = await query.staffAttendanceRecords(
      null,
      { restaurantId: "rest-1", startDate: "2026-06-02T00:00:00.000Z", endDate: "2026-06-02T23:59:59.999Z", employeeId: "staff-1" },
      { user: { id: "manager-1", roles: ["MANAGER"], refRestaurants: ["rest-1"] } },
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(expect.objectContaining({
      employeeId: "staff-1",
      restaurantId: "rest-1",
      shiftId: "shift-1",
      isOffSchedule: false,
      latenessMinutes: expect.any(Number),
      earlyLeaveMinutes: expect.any(Number),
    }));
    expect(records[0].plannedStartTime).toBeTruthy();
    expect(records[0].plannedEndTime).toBeTruthy();
    expect(records[0].actualCheckInAt).toBeTruthy();
    expect(records[0].actualCheckOutAt).toBeTruthy();
  });
});
