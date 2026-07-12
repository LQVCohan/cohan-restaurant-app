import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  AttendanceCorrectionRequest: { find: vi.fn() },
  OvertimeRequest: { find: vi.fn() },
  PayrollPeriod: { findById: vi.fn() },
  ScheduleAcknowledgement: { find: vi.fn() },
  SchedulePublication: { find: vi.fn() },
  Shift: { find: vi.fn() },
  ShiftAcknowledgement: { find: vi.fn() },
  Timesheet: { find: vi.fn() },
}));
const payrollValidation = vi.hoisted(() => ({
  validatePayrollPeriod: vi.fn(),
}));

vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(Boolean),
    Types: {
      ObjectId: function ObjectId(value) {
        this.toString = () => String(value);
      },
    },
  },
}));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/payroll/payrollValidation.service.js", () =>
  payrollValidation,
);

const period = {
  _id: "p1",
  restaurantId: "r1",
  startDate: new Date("2026-04-01T00:00:00.000Z"),
  endDate: new Date("2026-04-30T00:00:00.000Z"),
  status: "draft",
};
const chain = (value) => ({
  select: vi.fn().mockReturnThis(),
  populate: vi.fn().mockReturnThis(),
  sort: vi.fn().mockReturnThis(),
  lean: vi.fn(async () => value),
});

function publishedSchedule(options = {}) {
  modelMocks.SchedulePublication.find.mockReturnValue(
    chain([{ _id: "pub1", status: "published" }]),
  );
  modelMocks.Shift.find.mockReturnValue(chain(options.shifts || []));
  modelMocks.ScheduleAcknowledgement.find.mockReturnValue(
    chain(options.scheduleAcknowledgements || []),
  );
  modelMocks.ShiftAcknowledgement.find.mockReturnValue(
    chain(options.shiftAcknowledgements || []),
  );
}

function cleanAttendanceAndApprovals() {
  modelMocks.Timesheet.find
    .mockReturnValueOnce(chain([]))
    .mockReturnValueOnce(chain([]))
    .mockReturnValueOnce(chain([]));
  modelMocks.AttendanceCorrectionRequest.find.mockReturnValue(chain([]));
  modelMocks.OvertimeRequest.find.mockReturnValue(chain([]));
}

describe("buildPayrollReadiness", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.PayrollPeriod.findById.mockReturnValue(chain(period));
    modelMocks.SchedulePublication.find.mockReturnValue(chain([]));
    modelMocks.Shift.find.mockReturnValue(chain([]));
    modelMocks.ScheduleAcknowledgement.find.mockReturnValue(chain([]));
    modelMocks.ShiftAcknowledgement.find.mockReturnValue(chain([]));
    modelMocks.Timesheet.find.mockReturnValue(chain([]));
    modelMocks.AttendanceCorrectionRequest.find.mockReturnValue(chain([]));
    modelMocks.OvertimeRequest.find.mockReturnValue(chain([]));
    payrollValidation.validatePayrollPeriod.mockResolvedValue({
      errorCount: 0,
      warningCount: 0,
      issues: [],
    });
  });

  it("throws PAYROLL_PERIOD_NOT_FOUND", async () => {
    modelMocks.PayrollPeriod.findById.mockReturnValueOnce(chain(null));
    const { buildPayrollReadiness } = await import(
      "../../src/services/payroll/payrollReadiness.service.js"
    );
    await expect(
      buildPayrollReadiness({ periodId: "missing" }),
    ).rejects.toThrow("PAYROLL_PERIOD_NOT_FOUND");
  });

  it("blocks when schedule is not published", async () => {
    const { buildPayrollReadiness } = await import(
      "../../src/services/payroll/payrollReadiness.service.js"
    );
    const result = await buildPayrollReadiness({ periodId: "p1" });
    expect(result.readyToFinalize).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "SCHEDULE_NOT_PUBLISHED" }),
      ]),
    );
  });

  it("blocks pending attendance correction", async () => {
    publishedSchedule();
    modelMocks.Timesheet.find
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]));
    modelMocks.AttendanceCorrectionRequest.find.mockReturnValue(
      chain([{ _id: "acr1", employeeId: { _id: "e1", fullName: "An" } }]),
    );
    const { buildPayrollReadiness } = await import(
      "../../src/services/payroll/payrollReadiness.service.js"
    );
    const result = await buildPayrollReadiness({ periodId: "p1" });
    expect(result.sections.approvals.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ATTENDANCE_CORRECTION_PENDING",
          targetRoute: "attendance_correction",
        }),
      ]),
    );
    expect(result.readyToFinalize).toBe(false);
  });

  it("does not block placeholder off-schedule timesheets without worked evidence", async () => {
    publishedSchedule();
    modelMocks.Timesheet.find
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]));
    const { buildPayrollReadiness } = await import(
      "../../src/services/payroll/payrollReadiness.service.js"
    );
    const result = await buildPayrollReadiness({ periodId: "p1" });
    expect(result.sections.approvals.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OFF_SCHEDULE_ATTENDANCE_PENDING" }),
      ]),
    );
    expect(result.readyToFinalize).toBe(true);
    const offScheduleQuery = modelMocks.Timesheet.find.mock.calls[1][0];
    expect(offScheduleQuery).toEqual(
      expect.objectContaining({
        isOffSchedule: true,
        approved: { $ne: true },
        $and: expect.arrayContaining([
          expect.objectContaining({
            $or: expect.arrayContaining([
              { workedMinutes: { $gt: 0 } },
              { hours: { $gt: 0 } },
              { amount: { $gt: 0 } },
              { actualCheckInAt: { ["$" + "exists"]: true } },
              { actualCheckOutAt: { ["$" + "exists"]: true } },
            ]),
          }),
        ]),
      }),
    );
  });

  it("blocks pending off-schedule attendance with worked evidence", async () => {
    publishedSchedule();
    modelMocks.Timesheet.find
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(
        chain([
          {
            _id: "ts1",
            employeeId: {
              _id: "e1",
              fullName: "An",
              employeeCode: "E001",
            },
            isOffSchedule: true,
            workedMinutes: 120,
            offScheduleApprovalStatus: "pending",
          },
        ]),
      )
      .mockReturnValueOnce(chain([]));
    const { buildPayrollReadiness } = await import(
      "../../src/services/payroll/payrollReadiness.service.js"
    );
    const result = await buildPayrollReadiness({ periodId: "p1" });
    expect(result.sections.approvals.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OFF_SCHEDULE_ATTENDANCE_PENDING",
          targetRoute: "off_schedule",
        }),
      ]),
    );
    expect(result.readyToFinalize).toBe(false);
  });

  it("blocks pending overtime", async () => {
    publishedSchedule();
    cleanAttendanceAndApprovals();
    modelMocks.OvertimeRequest.find.mockReturnValue(
      chain([{ _id: "ot1", employeeId: { _id: "e1" } }]),
    );
    const { buildPayrollReadiness } = await import(
      "../../src/services/payroll/payrollReadiness.service.js"
    );
    const result = await buildPayrollReadiness({ periodId: "p1" });
    expect(result.sections.approvals.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OVERTIME_PENDING",
          targetRoute: "overtime",
        }),
      ]),
    );
    expect(result.readyToFinalize).toBe(false);
  });

  it("queries only unresolved timesheet overtime states", async () => {
    publishedSchedule();
    cleanAttendanceAndApprovals();
    const { buildPayrollReadiness } = await import(
      "../../src/services/payroll/payrollReadiness.service.js"
    );
    const result = await buildPayrollReadiness({ periodId: "p1" });
    const overtimeQuery = modelMocks.Timesheet.find.mock.calls[2][0];

    expect(overtimeQuery.$or).toEqual(
      expect.arrayContaining([
        { overtimeApprovalStatus: "pending" },
        {
          overtimeApprovalStatus: "approved",
          approvedOvertimeMinutes: { $lte: 0 },
        },
      ]),
    );
    expect(overtimeQuery.$or).not.toContainEqual({
      overtimeApprovalStatus: { $ne: "approved" },
    });
    expect(result.sections.approvals.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "OVERTIME_PENDING" }),
      ]),
    );
    expect(result.readyToFinalize).toBe(true);
  });

  it("maps payroll validation errors", async () => {
    publishedSchedule();
    cleanAttendanceAndApprovals();
    payrollValidation.validatePayrollPeriod.mockResolvedValueOnce({
      errorCount: 1,
      warningCount: 0,
      issues: [
        { code: "PAYROLL_PERIOD_EMPTY", severity: "error", message: "empty" },
      ],
    });
    const { buildPayrollReadiness } = await import(
      "../../src/services/payroll/payrollReadiness.service.js"
    );
    const result = await buildPayrollReadiness({ periodId: "p1" });
    expect(result.sections.payroll.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PAYROLL_PERIOD_EMPTY",
          targetRoute: "payroll",
        }),
      ]),
    );
    expect(result.readyToFinalize).toBe(false);
  });

  it("filters approval validation issues from payroll section", async () => {
    publishedSchedule();
    cleanAttendanceAndApprovals();
    payrollValidation.validatePayrollPeriod.mockResolvedValueOnce({
      errorCount: 2,
      warningCount: 0,
      issues: [
        {
          code: "OFF_SCHEDULE_ATTENDANCE_PENDING_APPROVAL",
          severity: "error",
          message: "off schedule pending",
        },
        { code: "PAYROLL_PERIOD_EMPTY", severity: "error", message: "empty" },
      ],
    });
    const { buildPayrollReadiness } = await import(
      "../../src/services/payroll/payrollReadiness.service.js"
    );
    const result = await buildPayrollReadiness({ periodId: "p1" });
    expect(result.sections.payroll.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "PAYROLL_PERIOD_EMPTY" }),
      ]),
    );
    expect(result.sections.payroll.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OFF_SCHEDULE_ATTENDANCE_PENDING_APPROVAL",
        }),
      ]),
    );
  });

  it("allows finalize with acknowledgement warnings only", async () => {
    publishedSchedule({ shifts: [{ _id: "s1", employeeId: "e1" }] });
    cleanAttendanceAndApprovals();
    const { buildPayrollReadiness } = await import(
      "../../src/services/payroll/payrollReadiness.service.js"
    );
    const result = await buildPayrollReadiness({ periodId: "p1" });
    expect(result.readyToFinalize).toBe(true);
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.sections.schedule.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SCHEDULE_ACK_PENDING",
          targetRoute: "schedule",
        }),
      ]),
    );
  });

  it("is ready when all sections are clean", async () => {
    publishedSchedule();
    cleanAttendanceAndApprovals();
    const { buildPayrollReadiness } = await import(
      "../../src/services/payroll/payrollReadiness.service.js"
    );
    const result = await buildPayrollReadiness({ periodId: "p1" });
    expect(result.readyToFinalize).toBe(true);
    expect(result.blockingCount).toBe(0);
  });
});
