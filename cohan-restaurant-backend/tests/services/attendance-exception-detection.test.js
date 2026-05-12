import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  publications: [],
  shifts: [],
  timesheets: [],
  nextTimesheetId: 1,
  lastTimesheetFindQuery: null,
}));

const modelMocks = vi.hoisted(() => ({
  SchedulePublication: { find: vi.fn() },
  Shift: { find: vi.fn() },
  Timesheet: Object.assign(vi.fn(), { find: vi.fn() }),
}));

vi.mock("../../models/index.js", () => modelMocks);

function idOf(value) {
  if (value == null) return "";
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

function queryResult(value) {
  return {
    lean: vi.fn(async () => value),
    setOptions: vi.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function stripSave(value) {
  if (!value || typeof value !== "object") return value;
  const clone = { ...value };
  delete clone.save;
  return clone;
}

function mutableTimesheetQuery(value) {
  const query = {
    lean: vi.fn(async () => value.map((row) => stripSave(row))),
    setOptions: vi.fn().mockReturnThis(),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  db.lastTimesheetFindQuery = query;
  return query;
}

function buildPublication(overrides = {}) {
  return {
    _id: `publication-${overrides.status || "published"}`,
    restaurantId: "rest-1",
    periodStart: new Date("2026-05-10T17:00:00.000Z"),
    periodEnd: new Date("2026-05-17T16:59:59.999Z"),
    status: "published",
    ...overrides,
  };
}

function buildShift(overrides = {}) {
  return {
    _id: `shift-${Math.random().toString(16).slice(2, 8)}`,
    employeeId: "staff-1",
    restaurantId: "rest-1",
    shiftType: "morning",
    startTime: new Date("2026-05-11T02:00:00.000Z"),
    endTime: new Date("2026-05-11T10:00:00.000Z"),
    status: "scheduled",
    ...overrides,
  };
}

function buildTimesheet(overrides = {}) {
  return {
    _id: `timesheet-${db.nextTimesheetId++}`,
    employeeId: "staff-1",
    restaurantId: "rest-1",
    shiftId: "shift-1",
    workDate: new Date("2026-05-10T17:00:00.000Z"),
    plannedStartTime: new Date("2026-05-11T02:00:00.000Z"),
    plannedEndTime: new Date("2026-05-11T10:00:00.000Z"),
    actualCheckInAt: null,
    actualCheckOutAt: null,
    status: "scheduled_absent",
    isOffSchedule: false,
    source: "system",
    workedMinutes: 0,
    hours: 0,
    latenessMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    save: vi.fn(async function save() {
      return this;
    }),
    ...overrides,
  };
}

describe("attendance exception detection service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    db.publications = [buildPublication()];
    db.shifts = [buildShift({ _id: "shift-1" })];
    db.timesheets = [];
    db.nextTimesheetId = 1;
    db.lastTimesheetFindQuery = null;

    modelMocks.SchedulePublication.find.mockImplementation((filter = {}) =>
      queryResult(
        db.publications.filter(
          (row) =>
            (!filter.restaurantId ||
              idOf(filter.restaurantId) === idOf(row.restaurantId)) &&
            (!filter.status?.$in ||
              filter.status.$in.includes(String(row.status || ""))) &&
            (!filter.periodStart?.$lte || row.periodStart <= filter.periodStart.$lte) &&
            (!filter.periodEnd?.$gte || row.periodEnd >= filter.periodEnd.$gte),
        ),
      ),
    );

    modelMocks.Shift.find.mockImplementation((filter = {}) =>
      queryResult(
        db.shifts.filter((row) => {
          if (
            filter.restaurantId &&
            idOf(filter.restaurantId) !== idOf(row.restaurantId)
          ) {
            return false;
          }
          if (
            filter.employeeId?.$ne === null &&
            (row.employeeId === null || row.employeeId === undefined)
          ) {
            return false;
          }
          if (
            filter.status?.$nin &&
            filter.status.$nin.includes(String(row.status || ""))
          ) {
            return false;
          }
          if (filter.startTime?.$lte && row.startTime > filter.startTime.$lte) {
            return false;
          }
          if (filter.endTime?.$gte && row.endTime < filter.endTime.$gte) {
            return false;
          }
          return true;
        }),
      ),
    );

    modelMocks.Timesheet.find.mockImplementation((filter = {}) =>
      mutableTimesheetQuery(
        db.timesheets.filter((row) => {
          if (
            filter.restaurantId &&
            idOf(filter.restaurantId) !== idOf(row.restaurantId)
          ) {
            return false;
          }
          if (
            filter.shiftId?.$in &&
            !filter.shiftId.$in.map(idOf).includes(idOf(row.shiftId))
          ) {
            return false;
          }
          return true;
        }),
      ),
    );

    modelMocks.Timesheet.mockImplementation(function Timesheet(data) {
      Object.assign(this, data);
      this._id = this._id || `timesheet-${db.nextTimesheetId++}`;
      this.save = vi.fn(async () => {
        const existing = db.timesheets.find(
          (row) => idOf(row._id) === idOf(this._id),
        );
        if (!existing) {
          db.timesheets.push(this);
        }
        return this;
      });
    });
  });

  it("creates no-show for published scheduled shift with no timesheet after grace", async () => {
    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T02:16:00.000Z",
    });

    expect(summary.noShowCreated).toBe(1);
    expect(db.timesheets).toHaveLength(1);
    expect(db.timesheets[0]).toMatchObject({
      shiftId: "shift-1",
      employeeId: "staff-1",
      restaurantId: "rest-1",
      status: "scheduled_absent",
      actualCheckInAt: null,
      actualCheckOutAt: null,
      isOffSchedule: false,
    });
  });

  it("creates no-show for active scheduled shift with no timesheet after grace", async () => {
    db.publications = [buildPublication({ status: "active" })];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T02:16:00.000Z",
    });

    expect(summary.noShowCreated).toBe(1);
  });

  it("does not create no-show for draft or revision_draft shift publications", async () => {
    db.publications = [
      buildPublication({ status: "draft" }),
      buildPublication({ _id: "publication-revision", status: "revision_draft" }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T04:00:00.000Z",
    });

    expect(summary.noShowCreated).toBe(0);
    expect(db.timesheets).toHaveLength(0);
  });

  it("does not create no-show before grace window", async () => {
    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T02:10:00.000Z",
    });

    expect(summary.noShowCreated).toBe(0);
  });

  it("does not create duplicate no-show on repeated detection", async () => {
    db.timesheets = [buildTimesheet()];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T02:20:00.000Z",
    });

    expect(summary.noShowCreated).toBe(0);
    expect(db.timesheets).toHaveLength(1);
  });

  it("does not mark no-show when timesheet has actualCheckInAt for the shift", async () => {
    db.timesheets = [
      buildTimesheet({
        actualCheckInAt: new Date("2026-05-11T02:01:00.000Z"),
        status: "checked_in",
      }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T03:00:00.000Z",
    });

    expect(summary.noShowCreated).toBe(0);
    expect(db.timesheets[0].status).toBe("checked_in");
  });

  it("does not link unrelated off-schedule timesheet as scheduled attendance", async () => {
    db.timesheets = [
      buildTimesheet({
        _id: "timesheet-offschedule",
        shiftId: null,
        isOffSchedule: true,
        actualCheckInAt: new Date("2026-05-11T02:01:00.000Z"),
      }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T03:00:00.000Z",
    });

    expect(summary.noShowCreated).toBe(1);
    expect(db.timesheets).toHaveLength(2);
  });

  it("guards across employees", async () => {
    db.shifts = [buildShift({ _id: "shift-employee-a", employeeId: "staff-a" })];
    db.timesheets = [
      buildTimesheet({
        shiftId: "shift-other",
        employeeId: "staff-b",
        actualCheckInAt: new Date("2026-05-11T02:01:00.000Z"),
      }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T03:00:00.000Z",
    });

    expect(summary.noShowCreated).toBe(1);
  });

  it("guards across restaurants", async () => {
    db.shifts = [
      buildShift({ _id: "shift-rest-2", restaurantId: "rest-2", employeeId: "staff-2" }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T03:00:00.000Z",
    });

    expect(summary.scannedShifts).toBe(0);
    expect(summary.noShowCreated).toBe(0);
  });

  it("detects overnight no-show after overnight end window", async () => {
    db.shifts = [
      buildShift({
        _id: "shift-overnight",
        startTime: new Date("2026-05-11T15:00:00.000Z"),
        endTime: new Date("2026-05-11T23:00:00.000Z"),
      }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-12T23:59:59.999Z",
      now: "2026-05-11T23:20:00.000Z",
    });

    expect(summary.noShowCreated).toBe(1);
    expect(db.timesheets[0].workDate.toISOString()).toBe(
      "2026-05-10T17:00:00.000Z",
    );
  });

  it("updates missed checkout using mutable timesheet docs instead of lean objects", async () => {
    db.timesheets = [
      buildTimesheet({
        actualCheckInAt: new Date("2026-05-11T02:00:00.000Z"),
        status: "checked_in",
      }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T10:31:00.000Z",
    });

    expect(summary.missedCheckoutUpdated).toBe(1);
    expect(db.timesheets[0].status).toBe("missed_checkout");
    expect(db.timesheets[0].save).toHaveBeenCalledTimes(1);
    expect(db.lastTimesheetFindQuery.lean).not.toHaveBeenCalled();
  });

  it("updates existing scheduled no-show records without failing on lean/plain-object mutation", async () => {
    db.timesheets = [
      buildTimesheet({
        status: "checked_in",
        actualCheckInAt: null,
        plannedStartTime: null,
        plannedEndTime: null,
      }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T02:20:00.000Z",
    });

    expect(summary.noShowUpdated).toBe(1);
    expect(db.timesheets[0].status).toBe("scheduled_absent");
    expect(db.timesheets[0].plannedStartTime?.toISOString()).toBe(
      "2026-05-11T02:00:00.000Z",
    );
    expect(db.timesheets[0].plannedEndTime?.toISOString()).toBe(
      "2026-05-11T10:00:00.000Z",
    );
    expect(db.timesheets[0].save).toHaveBeenCalledTimes(1);
    expect(db.lastTimesheetFindQuery.lean).not.toHaveBeenCalled();
  });

  it("does not silently fail when an existing timesheet requires update", async () => {
    db.timesheets = [
      buildTimesheet({
        actualCheckInAt: new Date("2026-05-11T02:00:00.000Z"),
        status: "checked_in",
      }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    await expect(
      detectAttendanceExceptionsForRange({
        restaurantId: "rest-1",
        startDate: "2026-05-11T00:00:00.000Z",
        endDate: "2026-05-11T23:59:59.999Z",
        now: "2026-05-11T10:31:00.000Z",
      }),
    ).resolves.toMatchObject({
      missedCheckoutUpdated: 1,
    });
  });

  it("does not mark missed checkout before grace", async () => {
    db.timesheets = [
      buildTimesheet({
        actualCheckInAt: new Date("2026-05-11T02:00:00.000Z"),
        status: "checked_in",
      }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T10:15:00.000Z",
    });

    expect(summary.missedCheckoutUpdated).toBe(0);
    expect(db.timesheets[0].status).toBe("checked_in");
  });

  it("does not overwrite actualCheckOutAt if it already exists", async () => {
    db.timesheets = [
      buildTimesheet({
        actualCheckInAt: new Date("2026-05-11T02:00:00.000Z"),
        actualCheckOutAt: new Date("2026-05-11T10:05:00.000Z"),
        status: "completed",
      }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T12:00:00.000Z",
    });

    expect(summary.missedCheckoutUpdated).toBe(0);
    expect(db.timesheets[0].actualCheckOutAt.toISOString()).toBe(
      "2026-05-11T10:05:00.000Z",
    );
  });

  it("keeps missed checkout detection idempotent", async () => {
    db.timesheets = [
      buildTimesheet({
        actualCheckInAt: new Date("2026-05-11T02:00:00.000Z"),
        status: "missed_checkout",
      }),
    ];

    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    const summary = await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T12:00:00.000Z",
    });

    expect(summary.missedCheckoutUpdated).toBe(0);
    expect(db.timesheets[0].save).not.toHaveBeenCalled();
  });

  it("preserves skipAttendanceExceptionDetection on internal timesheet queries", async () => {
    const { detectAttendanceExceptionsForRange } = await import(
      "../../src/services/attendance/attendanceExceptionDetection.service.js"
    );

    await detectAttendanceExceptionsForRange({
      restaurantId: "rest-1",
      startDate: "2026-05-11T00:00:00.000Z",
      endDate: "2026-05-11T23:59:59.999Z",
      now: "2026-05-11T02:16:00.000Z",
    });

    expect(db.lastTimesheetFindQuery?.setOptions).toHaveBeenCalledWith({
      skipAttendanceExceptionDetection: true,
    });
  });
});
