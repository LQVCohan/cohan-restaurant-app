import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  publications: [],
  shifts: [],
  staff: [],
  shiftAcknowledgements: [],
  scheduleAcknowledgements: [],
  nextShift: 1,
  nextShiftAck: 1,
  nextScheduleAck: 1,
}));

const modelMocks = vi.hoisted(() => ({
  Staff: { findById: vi.fn(), find: vi.fn() },
  Role: {},
  EventLog: { create: vi.fn() },
  Shift: {
    create: vi.fn(),
    find: vi.fn(),
    exists: vi.fn(),
    countDocuments: vi.fn(),
  },
  Timesheet: { findOne: vi.fn() },
  LeaveRequest: {},
  LeaveBalance: {},
  PayrollSetting: {},
  PayrollPeriod: {},
  PayrollItem: {},
  PayrollAdjustment: {},
  EmployeeCodeCounter: {},
  Notification: { create: vi.fn(), insertMany: vi.fn() },
  Restaurant: { exists: vi.fn() },
  KitchenShiftRosterSnapshot: { updateMany: vi.fn(), insertMany: vi.fn() },
  SchedulePublication: {
    findOne: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  ShiftAcknowledgement: {
    findOneAndUpdate: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    updateMany: vi.fn(),
  },
  ScheduleAcknowledgement: {
    findOneAndUpdate: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    updateMany: vi.fn(),
  },
  AttendanceCorrectionRequest: {},
  OvertimeRequest: {},
  Order: { countDocuments: vi.fn() },
  Table: { find: vi.fn() },
  Category: { countDocuments: vi.fn() },
  Promotion: { countDocuments: vi.fn() },
}));

const validationMocks = vi.hoisted(() => ({
  assertShiftAssignmentValid: vi.fn(async () => ({})),
  validateShiftAssignment: vi.fn(async () => ({
    ok: true,
    blockingErrors: [],
    warnings: [],
  })),
}));

const scheduleLifecycleMocks = vi.hoisted(() => ({
  resolveScheduleLifecycleStatus: vi.fn(
    ({ publication }) =>
      publication?.effectiveStatus || publication?.status || "draft",
  ),
  mapSchedulePublicationOutput: vi.fn((publication) => ({
    id: String(publication?._id),
    restaurantId: String(publication?.restaurantId),
    periodStart: publication?.periodStart,
    periodEnd: publication?.periodEnd,
    status: publication?.status,
    effectiveStatus: publication?.effectiveStatus || publication?.status,
    publishedAt: publication?.publishedAt || null,
    lastChangedAt: publication?.lastChangedAt || null,
    permissions: {},
  })),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../lib/mailer.js", () => ({ mailer: { sendMail: vi.fn() } }));
vi.mock("../../graphql/guards.js", () => ({
  requireAuth: vi.fn((ctx) => {
    if (!ctx?.user) throw new Error("UNAUTHENTICATED");
  }),
  requireRestaurantAccess: vi.fn(async () => true),
  requireRoles: vi.fn((ctx, allowedRoles = []) => {
    const roles = (ctx?.user?.roles || []).map((role) =>
      String(role).toLowerCase(),
    );
    const allowed = (allowedRoles || []).map((role) =>
      String(role).toLowerCase(),
    );
    if (!roles.some((role) => allowed.includes(role)))
      throw new Error("FORBIDDEN");
    return true;
  }),
  requireRestaurantScope: vi.fn(() => true),
}));
vi.mock(
  "../../src/services/staffPerformance/staffPerformance.service.js",
  () => ({
    recalculateStaffPerformanceSnapshots: vi.fn(),
    upsertStaffPerformanceReview: vi.fn(),
    listStaffPerformanceSnapshots: vi.fn(),
  }),
);
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({
  startSchedulingOperations: vi.fn(),
  updateSchedulingPolicy: vi.fn(),
  getSchedulingPolicy: vi.fn(),
}));
vi.mock(
  "../../src/services/scheduling/shiftAssignmentValidation.service.js",
  () => validationMocks,
);
vi.mock(
  "../../src/services/attendance/attendanceCorrectionWorkflow.service.js",
  () => ({
    approveAttendanceCorrectionRequest: vi.fn(),
    cancelAttendanceCorrectionRequest: vi.fn(),
    createAttendanceCorrectionRequest: vi.fn(),
    rejectAttendanceCorrectionRequest: vi.fn(),
    getAttendanceCorrectionRequest: vi.fn(),
    listAttendanceCorrectionRequests: vi.fn(),
  }),
);
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
vi.mock("../../src/services/ai/staffSchedulingAssistant.service.js", () => ({
  buildStaffSchedulingAssistant: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollCalculator.service.js", () => ({
  buildPayrollItem: vi.fn(),
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
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({
  assertNoLockedPayrollPeriodOverlap: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollValidation.service.js", () => ({
  validatePayrollPeriod: vi.fn(),
  hasBlockingPayrollIssues: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollPermission.service.js", () => ({
  assertPayrollPermission: vi.fn(),
}));
vi.mock("../../src/services/payroll/payrollEventLog.service.js", () => ({
  logPayrollEvent: vi.fn(),
}));
vi.mock("../../src/config/payrollPolicy.vn.js", () => ({
  getPayrollPolicyForDate: vi.fn(),
}));
vi.mock(
  "../../src/services/scheduling/scheduleLifecycle.service.js",
  () => scheduleLifecycleMocks,
);
vi.mock(
  "../../src/services/scheduling/schedulingPermission.service.js",
  () => ({
    ATTENDANCE_REVIEW_ROLES: [],
    ATTENDANCE_OPERATION_ROLES: [],
    ATTENDANCE_SELF_ROLES: ["staff"],
    SCHEDULE_WRITE_ROLES: ["manager"],
    SCHEDULE_READ_ROLES: ["manager"],
    SHIFT_ACK_ADMIN_ROLES: ["manager"],
    SHIFT_ACK_READ_ROLES: ["manager"],
    resolveUserRoles: vi.fn((user) => user?.roles || []),
    userCanAccessRestaurant: vi.fn(() => true),
  }),
);
vi.mock(
  "../../src/services/performance/performanceIncident.service.js",
  () => ({
    createPerformanceIncidentOnce: vi.fn(),
    applyPerformanceIncidentScore: vi.fn(),
    getPerformanceIncidentById: vi.fn(),
    markPerformanceIncidentEligible: vi.fn(),
    reviewPerformanceIncident: vi.fn(),
    waivePerformanceIncident: vi.fn(),
  }),
);
vi.mock("../../src/services/performance/performanceAppeal.service.js", () => ({
  createPerformanceIncidentAppeal: vi.fn(),
  cancelPerformanceIncidentAppeal: vi.fn(),
  getPerformanceIncidentAppealById: vi.fn(),
  reviewPerformanceIncidentAppeal: vi.fn(),
  reverseScoreForAcceptedAppeal: vi.fn(),
}));
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        return { __oid: value, value, toString: () => String(value) };
      },
    },
  },
}));

const weekStart = new Date("2026-06-01T00:00:00.000Z");
const weekEnd = new Date("2026-06-07T23:59:59.999Z");
const managerCtx = {
  user: { id: "manager-1", roles: ["manager"], refRestaurants: ["rest-1"] },
};
const staff1Ctx = {
  user: { id: "staff-1", roles: ["staff"], restaurantForStaff: "rest-1" },
};
const staff2Ctx = {
  user: { id: "staff-2", roles: ["staff"], restaurantForStaff: "rest-1" },
};
const otherStaffCtx = {
  user: { id: "staff-3", roles: ["staff"], restaurantForStaff: "rest-1" },
};

function idOf(value) {
  if (value == null) return "";
  if (typeof value === "object" && "value" in value) return String(value.value);
  if (typeof value === "object" && "__oid" in value) return String(value.__oid);
  return String(value);
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

function matchesRange(value, range = {}) {
  const time = new Date(value).getTime();
  if (range.$gte && time < new Date(range.$gte).getTime()) return false;
  if (range.$lte && time > new Date(range.$lte).getTime()) return false;
  if (range.$lt && time >= new Date(range.$lt).getTime()) return false;
  if (range.$gt && time <= new Date(range.$gt).getTime()) return false;
  return true;
}

function publicationForFilter(filter = {}) {
  return (
    db.publications.find((publication) => {
      if (
        filter.restaurantId &&
        idOf(filter.restaurantId) !== idOf(publication.restaurantId)
      )
        return false;
      if (filter.status?.$in && !filter.status.$in.includes(publication.status))
        return false;
      if (
        filter.periodStart?.$lte &&
        new Date(publication.periodStart) > new Date(filter.periodStart.$lte)
      )
        return false;
      if (
        filter.periodEnd?.$gte &&
        new Date(publication.periodEnd) < new Date(filter.periodEnd.$gte)
      )
        return false;
      if (
        filter.periodStart &&
        !filter.periodStart.$lte &&
        new Date(publication.periodStart).getTime() !==
          new Date(filter.periodStart).getTime()
      )
        return false;
      if (
        filter.periodEnd &&
        !filter.periodEnd.$gte &&
        new Date(publication.periodEnd).getTime() !==
          new Date(filter.periodEnd).getTime()
      )
        return false;
      return true;
    }) || null
  );
}

function matchesShiftFilter(shift, filter = {}) {
  if (
    filter.restaurantId &&
    idOf(filter.restaurantId) !== idOf(shift.restaurantId)
  )
    return false;
  if (filter.employeeId && idOf(filter.employeeId) !== idOf(shift.employeeId))
    return false;
  if (filter.status?.$ne && shift.status === filter.status.$ne) return false;
  if (typeof filter.status === "string" && shift.status !== filter.status)
    return false;
  if (filter.startTime && !matchesRange(shift.startTime, filter.startTime))
    return false;
  return true;
}

function matchesAcknowledgementFilter(ack, filter = {}) {
  if (
    filter.restaurantId &&
    idOf(filter.restaurantId) !== idOf(ack.restaurantId)
  )
    return false;
  if (filter.employeeId && idOf(filter.employeeId) !== idOf(ack.employeeId))
    return false;
  if (filter.status && ack.status !== String(filter.status).toLowerCase())
    return false;
  if (filter.$and) {
    for (const condition of filter.$and) {
      if (
        condition.periodEnd?.$gte &&
        new Date(ack.periodEnd) < new Date(condition.periodEnd.$gte)
      )
        return false;
      if (
        condition.periodStart?.$lte &&
        new Date(ack.periodStart) > new Date(condition.periodStart.$lte)
      )
        return false;
    }
  }
  return true;
}

function attachSave(doc) {
  doc.save = vi.fn(async () => doc);
  return doc;
}

describe("auto-created shift publish and staff visibility regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.publications = [
      {
        _id: "pub-1",
        restaurantId: "rest-1",
        periodStart: weekStart,
        periodEnd: weekEnd,
        status: "draft",
        effectiveStatus: "draft",
      },
    ];
    db.shifts = [];
    db.shiftAcknowledgements = [];
    db.scheduleAcknowledgements = [];
    db.nextShift = 1;
    db.nextShiftAck = 1;
    db.nextScheduleAck = 1;
    db.staff = [
      {
        _id: "staff-1",
        id: "staff-1",
        userType: "STAFF",
        employmentStatus: "working",
        fullName: "Auto Staff One",
        restaurantForStaff: "rest-1",
      },
      {
        _id: "staff-2",
        id: "staff-2",
        userType: "STAFF",
        employmentStatus: "working",
        fullName: "Auto Staff Two",
        restaurantForStaff: "rest-1",
      },
      {
        _id: "staff-3",
        id: "staff-3",
        userType: "STAFF",
        employmentStatus: "working",
        fullName: "Other Staff",
        restaurantForStaff: "rest-1",
      },
    ];

    modelMocks.Restaurant.exists.mockResolvedValue(true);
    modelMocks.KitchenShiftRosterSnapshot.updateMany.mockResolvedValue({
      modifiedCount: 0,
    });
    modelMocks.KitchenShiftRosterSnapshot.insertMany.mockResolvedValue([]);
    modelMocks.Staff.findById.mockImplementation((id) => queryResult(db.staff.find((row) => idOf(row._id) === idOf(id)) || null));
    modelMocks.Staff.find.mockImplementation((filter = {}) => {
      const ids = Array.isArray(filter?._id?.$in)
        ? filter._id.$in.map(idOf)
        : [];

      const rows = db.staff
        .filter((staff) => !ids.length || ids.includes(idOf(staff._id)))
        .map((staff) => ({
          ...staff,
          employmentStatus: staff.employmentStatus || "working",
        }));

      return queryResult(rows);
    });
    modelMocks.SchedulePublication.findOne.mockImplementation((filter) => queryResult(publicationForFilter(filter)));
    modelMocks.SchedulePublication.find.mockImplementation((filter) => queryResult(db.publications.filter((publication) => {
      if (filter?.restaurantId && idOf(filter.restaurantId) !== idOf(publication.restaurantId)) return false;
      if (filter?.status?.$in && !filter.status.$in.includes(publication.status)) return false;
      return true;
    })));
    modelMocks.SchedulePublication.findById.mockImplementation((id) => queryResult(db.publications.find((publication) => idOf(publication._id) === idOf(id)) || null));
    modelMocks.SchedulePublication.findOneAndUpdate.mockImplementation((filter, update = {}) => {
      let publication = publicationForFilter(filter);
      if (!publication) {
        publication = { _id: `pub-${db.publications.length + 1}`, restaurantId: idOf(filter.restaurantId), periodStart: filter.periodStart || weekStart, periodEnd: filter.periodEnd || weekEnd };
        db.publications.push(publication);
      }
      Object.assign(publication, update.$setOnInsert || {}, update.$set || {});
      if (publication.status && !publication.effectiveStatus) publication.effectiveStatus = publication.status;
      if (publication.status === "published") publication.effectiveStatus = "published";
      return queryResult(publication);
    });
    modelMocks.SchedulePublication.findOne.mockImplementation((filter) =>
      queryResult(publicationForFilter(filter)),
    );
    modelMocks.SchedulePublication.find.mockImplementation((filter) =>
      queryResult(
        db.publications.filter((publication) => {
          if (
            filter?.restaurantId &&
            idOf(filter.restaurantId) !== idOf(publication.restaurantId)
          )
            return false;
          if (
            filter?.status?.$in &&
            !filter.status.$in.includes(publication.status)
          )
            return false;
          return true;
        }),
      ),
    );
    modelMocks.SchedulePublication.findById.mockImplementation((id) =>
      queryResult(
        db.publications.find(
          (publication) => idOf(publication._id) === idOf(id),
        ) || null,
      ),
    );
    modelMocks.SchedulePublication.findOneAndUpdate.mockImplementation(
      (filter, update = {}) => {
        let publication = publicationForFilter(filter);
        if (!publication) {
          publication = {
            _id: `pub-${db.publications.length + 1}`,
            restaurantId: idOf(filter.restaurantId),
            periodStart: filter.periodStart || weekStart,
            periodEnd: filter.periodEnd || weekEnd,
          };
          db.publications.push(publication);
        }
        Object.assign(
          publication,
          update.$setOnInsert || {},
          update.$set || {},
        );
        if (publication.status && !publication.effectiveStatus)
          publication.effectiveStatus = publication.status;
        if (publication.status === "published")
          publication.effectiveStatus = "published";
        return queryResult(publication);
      },
    );

    modelMocks.Shift.create.mockImplementation(async (input) => {
      const shift = attachSave({ _id: `shift-${db.nextShift++}`, ...input });
      db.shifts.push(shift);
      return shift;
    });
    modelMocks.Shift.find.mockImplementation((filter) =>
      queryResult(
        db.shifts.filter((shift) => matchesShiftFilter(shift, filter)),
      ),
    );
    modelMocks.Shift.exists.mockResolvedValue(true);
    modelMocks.Shift.countDocuments.mockImplementation(
      async (filter) =>
        db.shifts.filter((shift) => matchesShiftFilter(shift, filter)).length,
    );
    modelMocks.Timesheet.findOne.mockReturnValue(queryResult(null));
    modelMocks.Table.find.mockReturnValue(queryResult([]));
    modelMocks.Category.countDocuments.mockResolvedValue(0);
    modelMocks.Promotion.countDocuments.mockResolvedValue(0);

    modelMocks.ScheduleAcknowledgement.findOneAndUpdate.mockImplementation(
      (filter, update = {}) => {
        let ack = db.scheduleAcknowledgements.find(
          (row) =>
            idOf(row.restaurantId) === idOf(filter.restaurantId) &&
            idOf(row.employeeId) === idOf(filter.employeeId) &&
            idOf(row.schedulePublicationId) ===
              idOf(filter.schedulePublicationId),
        );
        if (!ack) {
          ack = attachSave({
            _id: `schedule-ack-${db.nextScheduleAck++}`,
            ...filter,
            ...(update.$setOnInsert || {}),
          });
          db.scheduleAcknowledgements.push(ack);
        }
        Object.assign(ack, update.$set || {});
        return queryResult(ack);
      },
    );
    modelMocks.ScheduleAcknowledgement.find.mockImplementation((filter) =>
      queryResult(
        db.scheduleAcknowledgements.filter((ack) => {
          if (
            filter?.restaurantId &&
            idOf(filter.restaurantId) !== idOf(ack.restaurantId)
          )
            return false;
          if (
            filter?.schedulePublicationId &&
            idOf(filter.schedulePublicationId) !==
              idOf(ack.schedulePublicationId)
          )
            return false;
          if (
            filter?.employeeId?.$in &&
            !filter.employeeId.$in.map(idOf).includes(idOf(ack.employeeId))
          )
            return false;
          return true;
        }),
      ),
    );
    modelMocks.ScheduleAcknowledgement.findOne.mockImplementation((filter) =>
      Promise.resolve(
        db.scheduleAcknowledgements.find(
          (ack) =>
            idOf(ack.restaurantId) === idOf(filter.restaurantId) &&
            idOf(ack.employeeId) === idOf(filter.employeeId) &&
            idOf(ack.schedulePublicationId) ===
              idOf(filter.schedulePublicationId),
        ) || null,
      ),
    );
    modelMocks.ScheduleAcknowledgement.updateMany.mockResolvedValue({
      modifiedCount: 0,
    });

    modelMocks.ShiftAcknowledgement.findOneAndUpdate.mockImplementation(
      (filter, update = {}) => {
        let ack = db.shiftAcknowledgements.find(
          (row) =>
            idOf(row.shiftId) === idOf(filter.shiftId) &&
            idOf(row.employeeId) === idOf(filter.employeeId),
        );
        if (!ack) {
          ack = attachSave({
            _id: `shift-ack-${db.nextShiftAck++}`,
            ...filter,
            ...(update.$setOnInsert || {}),
          });
          db.shiftAcknowledgements.push(ack);
        }
        Object.assign(ack, update.$set || {});
        return queryResult(ack);
      },
    );
    modelMocks.ShiftAcknowledgement.findById.mockImplementation((id) =>
      Promise.resolve(
        db.shiftAcknowledgements.find((ack) => idOf(ack._id) === idOf(id)) ||
          null,
      ),
    );
    modelMocks.ShiftAcknowledgement.findOne.mockImplementation((filter) =>
      Promise.resolve(
        db.shiftAcknowledgements.find((ack) => {
          if (filter.shiftId && idOf(filter.shiftId) !== idOf(ack.shiftId))
            return false;
          if (
            filter.employeeId &&
            idOf(filter.employeeId) !== idOf(ack.employeeId)
          )
            return false;
          return true;
        }) || null,
      ),
    );
    modelMocks.ShiftAcknowledgement.find.mockImplementation((filter) => ({
      sort: vi.fn(async () =>
        db.shiftAcknowledgements.filter((ack) =>
          matchesAcknowledgementFilter(ack, filter),
        ),
      ),
    }));
    modelMocks.ShiftAcknowledgement.updateMany.mockResolvedValue({
      modifiedCount: 0,
    });
  });

  it("publishes auto-created draft shifts, creates acknowledgements, exposes staff visibility, and preserves lifecycle guard", async () => {
    const mutation = (await import("../../graphql/resolvers/staff/mutation.js"))
      .default;
    const query = (await import("../../graphql/resolvers/staff/query.js"))
      .default;

    const batch = await mutation.createStaffShifts(
      null,
      {
        inputs: [
          {
            employeeId: "staff-1",
            restaurantId: "rest-1",
            shiftType: "MORNING",
            startTime: "2026-06-02T06:00:00.000Z",
            endTime: "2026-06-02T14:00:00.000Z",
            status: "scheduled",
            notes: "Auto scheduled staff one",
          },
          {
            employeeId: "staff-2",
            restaurantId: "rest-1",
            shiftType: "AFTERNOON",
            startTime: "2026-06-03T14:00:00.000Z",
            endTime: "2026-06-03T22:00:00.000Z",
            status: "scheduled",
            notes: "Auto scheduled staff two",
          },
        ],
      },
      managerCtx,
    );

    expect(batch.successCount).toBe(2);
    expect(batch.failedCount).toBe(0);
    expect(db.shifts).toHaveLength(2);

    const publication = await mutation.publishSchedule(
      null,
      {
        input: {
          restaurantId: "rest-1",
          periodStart: weekStart.toISOString(),
          periodEnd: weekEnd.toISOString(),
        },
      },
      managerCtx,
    );

    expect(["published", "active"]).toContain(
      publication.effectiveStatus || publication.status,
    );
    expect(db.publications[0].status).toBe("published");
    expect(
      db.shiftAcknowledgements.map((ack) => idOf(ack.shiftId)).sort(),
    ).toEqual(db.shifts.map((shift) => idOf(shift._id)).sort());
    expect(
      db.shiftAcknowledgements.every((ack) => ack.status === "pending"),
    ).toBe(true);

    const staffOneShifts = await query.staffShifts(
      null,
      {
        restaurantId: "rest-1",
        employeeId: "staff-1",
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
      },
      staff1Ctx,
    );

    expect(staffOneShifts).toHaveLength(1);
    expect(staffOneShifts[0]).toEqual(
      expect.objectContaining({
        employeeId: "staff-1",
        restaurantId: "rest-1",
        shiftType: "morning",
        status: "scheduled",
      }),
    );
    expect(new Date(staffOneShifts[0].startTime).toISOString()).toBe(
      "2026-06-02T06:00:00.000Z",
    );
    expect(new Date(staffOneShifts[0].endTime).toISOString()).toBe(
      "2026-06-02T14:00:00.000Z",
    );

    await expect(
      query.staffShifts(
        null,
        {
          restaurantId: "rest-1",
          employeeId: "staff-1",
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
        },
        otherStaffCtx,
      ),
    ).rejects.toThrow();

    const accepted = await mutation.acceptShiftAcknowledgement(
      null,
      { id: db.shiftAcknowledgements[0]._id, note: "accepted" },
      staff1Ctx,
    );
    expect(accepted.status).toBe("accepted");
    await expect(
      mutation.acceptShiftAcknowledgement(
        null,
        { id: accepted._id, note: "duplicate" },
        staff1Ctx,
      ),
    ).rejects.toThrow("SHIFT_ACKNOWLEDGEMENT_ALREADY_RESPONDED");
    expect(db.shiftAcknowledgements).toHaveLength(2);

    const declined = await mutation.declineShiftAcknowledgement(
      null,
      {
        id: db.shiftAcknowledgements[1]._id,
        reasonCategory: "personal",
        reason: "  busy family commitment  ",
      },
      staff2Ctx,
    );
    expect(declined.status).toBe("declined");
    expect(declined.reason).toBe("busy family commitment");

    const declinedForReview = await query.shiftAcknowledgements(
      null,
      {
        restaurantId: "rest-1",
        periodStart: weekStart.toISOString(),
        periodEnd: weekEnd.toISOString(),
        status: "declined",
      },
      managerCtx,
    );
    expect(declinedForReview).toHaveLength(1);
    expect(declinedForReview[0]).toEqual(
      expect.objectContaining({
        employeeId: expect.objectContaining({ __oid: "staff-2" }),
        status: "declined",
        reason: "busy family commitment",
      }),
    );

    await expect(
      mutation.createStaffShift(
        null,
        {
          input: {
            employeeId: "staff-1",
            restaurantId: "rest-1",
            shiftType: "EVENING",
            startTime: "2026-06-04T18:00:00.000Z",
            endTime: "2026-06-04T23:00:00.000Z",
          },
        },
        managerCtx,
      ),
    ).rejects.toThrow(
      "Không thể tạo ca trực tiếp khi lịch không còn ở trạng thái bản nháp.",
    );

    const blockedBatch = await mutation.createStaffShifts(
      null,
      {
        inputs: [
          {
            employeeId: "staff-1",
            restaurantId: "rest-1",
            shiftType: "EVENING",
            startTime: "2026-06-05T18:00:00.000Z",
            endTime: "2026-06-05T23:00:00.000Z",
          },
        ],
      },
      managerCtx,
    );
    expect(blockedBatch.successCount).toBe(0);
    expect(blockedBatch.failedCount).toBe(1);
    expect(blockedBatch.errors[0]).toEqual(
      expect.objectContaining({
        index: 0,
        employeeId: "staff-1",
        message: expect.stringContaining(
          "Không thể tạo ca trực tiếp khi lịch không còn ở trạng thái bản nháp.",
        ),
      }),
    );
  });
});
