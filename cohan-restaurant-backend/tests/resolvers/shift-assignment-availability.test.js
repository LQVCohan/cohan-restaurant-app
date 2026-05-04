import { describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Staff: {
    findById: vi.fn(),
  },
  SchedulingPolicy: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
  LeaveRequest: {
    find: vi.fn(),
  },
  Shift: {
    find: vi.fn(),
  },
  AvailabilityRegistrationWindow: {
    findOne: vi.fn(),
  },
  StaffAvailabilitySubmission: {
    findOne: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        return value;
      },
    },
  },
}));
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () => ({
  assertNoLockedPayrollPeriodOverlap: vi.fn(async () => {}),
}));
vi.mock("../../src/services/staffPerformance/staffPerformance.service.js", () => ({
  getLatestStaffPerformanceSnapshot: vi.fn(async () => null),
}));
vi.mock("../../src/services/scheduling/schedulingPolicy.service.js", () => ({
  getDefaultSchedulingPolicyPayload: vi.fn(() => ({})),
  mapSchedulingPolicy: vi.fn((policy) => policy),
  isFirstOperationalWeek: vi.fn(() => ({ active: false })),
}));

const restaurantId = "507f1f77bcf86cd799439011";
const employeeId = "507f1f77bcf86cd799439012";
const windowId = "507f1f77bcf86cd799439013";
const shiftDate = "2026-04-20T06:00:00.000Z";
const shiftEnd = "2026-04-20T12:00:00.000Z";

const policy = {
  laborRules: {
    respectWorkingDays: true,
    workingDaysRuleLevel: "warning",
    respectLeaveRequests: true,
    leaveConflictRuleLevel: "hard",
    preventShiftOverlap: true,
    maxShiftsPerDay: 2,
    maxShiftsPerDayRuleLevel: "warning",
    weeklyHoursCap: 48,
    recommendedWeeklyHoursCap: 40,
    weeklyHoursRuleLevel: "warning",
    minRestHoursBetweenShifts: 0,
    minRestRuleLevel: "off",
    maxConsecutiveWorkingDays: 6,
    hardMaxConsecutiveWorkingDays: 7,
    consecutiveDaysRuleLevel: "warning",
    allowManagerOverride: true,
    overrideRequiresReason: true,
  },
  scoringWeights: {
    roleFit: 20,
    availabilityFit: 15,
    workloadBalance: 15,
    employmentTypeFit: 10,
    costEfficiency: 5,
    performance: 10,
    reliability: 5,
    fatiguePenalty: 20,
    overtimePenalty: 15,
    ruleRiskPenalty: 30,
  },
  employmentTypePolicy: {
    full_time: { weeklyHoursTarget: 40, weeklyHoursCap: 48, priorityWeight: 1 },
    part_time: {
      weeklyHoursTarget: 20,
      weeklyHoursCap: 28,
      priorityWeight: 0.85,
      requireAvailability: true,
    },
  },
  availabilityRegistrationPolicy: {
    enabled: true,
    targetEmploymentTypes: ["part_time", "seasonal"],
    treatMissingPartTimeSubmissionAsUnavailable: true,
  },
};

const lean = (value) => ({ lean: vi.fn(async () => value) });
const sortLean = (value) => ({
  sort: vi.fn(() => lean(value)),
  lean: vi.fn(async () => value),
});

function setupBase({ staff, leaveRows = [], windowDoc = null, submission = null }) {
  vi.resetModules();
  vi.clearAllMocks();

  modelMocks.SchedulingPolicy.findOne.mockResolvedValue(policy);
  modelMocks.Staff.findById.mockReturnValue(lean(staff));
  modelMocks.LeaveRequest.find.mockReturnValue(lean(leaveRows));
  modelMocks.Shift.find.mockReturnValue(sortLean([]));
  modelMocks.AvailabilityRegistrationWindow.findOne.mockReturnValue(sortLean(windowDoc));
  modelMocks.StaffAvailabilitySubmission.findOne.mockReturnValue(
    lean(submission),
  );
}

async function validate(input = {}) {
  const { validateShiftAssignment } = await import(
    "../../src/services/scheduling/shiftAssignmentValidation.service.js"
  );

  return validateShiftAssignment({
    input: {
      employeeId,
      restaurantId,
      shiftType: "MORNING",
      startTime: shiftDate,
      endTime: shiftEnd,
      ...input,
    },
    ctx: {},
  });
}

const closedWindow = {
  _id: windowId,
  id: windowId,
  restaurantId,
  periodStart: new Date("2026-04-20T00:00:00.000Z"),
  periodEnd: new Date("2026-04-26T23:59:59.999Z"),
  openAt: new Date("2026-04-13T00:00:00.000Z"),
  closeAt: new Date("2026-04-19T23:59:59.999Z"),
  status: "closed",
  targetEmploymentTypes: ["part_time", "seasonal"],
};

describe("validateShiftAssignment availability rules", () => {
  it("passes part-time staff with submitted available slot", async () => {
    setupBase({
      staff: {
        _id: employeeId,
        userType: "STAFF",
        employmentStatus: "working",
        employmentType: "part_time",
        workingDays: ["MON"],
      },
      windowDoc: closedWindow,
      submission: {
        _id: "submission-1",
        availabilityWindowId: windowId,
        employeeId,
        employmentType: "part_time",
        submissionType: "weekly_availability",
        status: "locked",
        slots: [
          {
            date: new Date("2026-04-20T00:00:00.000Z"),
            shiftType: "morning",
            status: "available",
          },
        ],
      },
    });

    const result = await validate();

    expect(result.ok).toBe(true);
    expect(result.warnings.map((warning) => warning.code)).not.toContain(
      "OUTSIDE_SUBMITTED_AVAILABILITY",
    );
  });

  it("warns when part-time staff has no submission after the window closes", async () => {
    setupBase({
      staff: {
        _id: employeeId,
        userType: "STAFF",
        employmentStatus: "working",
        employmentType: "part_time",
        workingDays: ["MON"],
      },
      windowDoc: closedWindow,
      submission: null,
    });

    const result = await validate();

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PART_TIME_AVAILABILITY_REQUIRED",
          severity: "risk",
        }),
      ]),
    );
  });

  it("warns when full-time staff has an unavailable exception", async () => {
    setupBase({
      staff: {
        _id: employeeId,
        userType: "STAFF",
        employmentStatus: "working",
        employmentType: "full_time",
        workingDays: ["MON"],
      },
      windowDoc: closedWindow,
      submission: {
        _id: "submission-2",
        availabilityWindowId: windowId,
        employeeId,
        employmentType: "full_time",
        submissionType: "unavailable_exception",
        status: "locked",
        slots: [
          {
            date: new Date("2026-04-20T00:00:00.000Z"),
            shiftType: "morning",
            status: "unavailable",
          },
        ],
      },
    });

    const result = await validate();

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "FULL_TIME_UNAVAILABLE_EXCEPTION",
          severity: "warning",
        }),
      ]),
    );
  });

  it("returns pending/info before registration window closes when part-time has not submitted", async () => {
    setupBase({
      staff: {
        _id: employeeId,
        userType: "STAFF",
        employmentStatus: "working",
        employmentType: "part_time",
        workingDays: ["MON"],
      },
      windowDoc: {
        ...closedWindow,
        status: "open",
        closeAt: new Date("2099-04-30T23:59:59.999Z"),
      },
      submission: null,
    });

    const result = await validate();

    expect(result.ok).toBe(true);
    expect(result.blockingErrors).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "AVAILABILITY_PENDING_SUBMISSION",
          severity: "info",
        }),
      ]),
    );
  });

  it("warns OUTSIDE_SUBMITTED_AVAILABILITY when part-time submitted without matching slot after close", async () => {
    setupBase({
      staff: {
        _id: employeeId,
        userType: "STAFF",
        employmentStatus: "working",
        employmentType: "part_time",
        workingDays: ["MON"],
      },
      windowDoc: closedWindow,
      submission: {
        _id: "submission-3",
        availabilityWindowId: windowId,
        employeeId,
        employmentType: "part_time",
        submissionType: "weekly_availability",
        status: "locked",
        slots: [
          {
            date: new Date("2026-04-21T00:00:00.000Z"),
            shiftType: "evening",
            status: "available",
          },
        ],
      },
    });

    const result = await validate();
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "OUTSIDE_SUBMITTED_AVAILABILITY",
          severity: "risk",
        }),
      ]),
    );
  });

  it("hard-blocks approved leave even when override is allowed", async () => {
    setupBase({
      staff: {
        _id: employeeId,
        userType: "STAFF",
        employmentStatus: "working",
        employmentType: "full_time",
        workingDays: ["MON"],
      },
      leaveRows: [
        {
          employeeId,
          restaurantId,
          status: "approved",
          startDate: new Date("2026-04-20T00:00:00.000Z"),
          endDate: new Date("2026-04-20T00:00:00.000Z"),
          startSession: "full",
          endSession: "full",
        },
      ],
      windowDoc: null,
      submission: null,
    });

    const result = await validate({
      allowOverride: true,
      overrideReason: "manager override",
    });

    expect(result.ok).toBe(false);
    expect(result.blockingErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "LEAVE_CONFLICT",
          severity: "error",
        }),
      ]),
    );
  });
  it("does not use pendingSlots for late_change_requested submission", async () => {
    setupBase({
      staff: {
        _id: employeeId,
        userType: "STAFF",
        employmentStatus: "working",
        employmentType: "part_time",
        workingDays: ["MON"],
      },
      windowDoc: closedWindow,
      submission: {
        _id: "submission-4",
        availabilityWindowId: windowId,
        employeeId,
        employmentType: "part_time",
        submissionType: "weekly_availability",
        status: "late_change_requested",
        slots: [],
        pendingSlots: [{ date: new Date("2026-04-20T00:00:00.000Z"), shiftType: "morning", status: "available" }],
      },
    });
    const result = await validate();
    expect(result.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining([
        "LATE_AVAILABILITY_CHANGE_PENDING",
        "PART_TIME_AVAILABILITY_REQUIRED",
      ]),
    );
  });
  it("uses approved official slots after late change approval", async () => {
    setupBase({
      staff: {
        _id: employeeId,
        userType: "STAFF",
        employmentStatus: "working",
        employmentType: "part_time",
        workingDays: ["MON"],
      },
      windowDoc: closedWindow,
      submission: {
        _id: "submission-5",
        availabilityWindowId: windowId,
        employeeId,
        employmentType: "part_time",
        submissionType: "weekly_availability",
        status: "approved",
        slots: [{ date: new Date("2026-04-20T00:00:00.000Z"), shiftType: "morning", status: "available" }],
        pendingSlots: [],
      },
    });
    const result = await validate();
    expect(result.ok).toBe(true);
    expect(result.warnings.map((w) => w.code)).not.toContain("OUTSIDE_SUBMITTED_AVAILABILITY");
  });
});
