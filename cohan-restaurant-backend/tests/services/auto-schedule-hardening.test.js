import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Shift: { find: vi.fn(), create: vi.fn() },
  Staff: { find: vi.fn() },
  SchedulePublication: { findOne: vi.fn() },
  LeaveRequest: {},
  SchedulingPolicy: {},
}));

const validationMocks = vi.hoisted(() => ({
  validateShiftAssignment: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/scheduling/shiftAssignmentValidation.service.js", () => validationMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: { ObjectId: function ObjectId(v) { this.value = v; this.toString = () => String(v); } },
  },
}));

const q = (value) => ({ lean: vi.fn(async () => value) });
const oid = (value) => ({ toString: () => String(value) });

function validResult(overrides = {}) {
  return {
    ok: true,
    score: 80,
    blockingErrors: [],
    warnings: [],
    metrics: { weeklyHoursAfter: 8 },
    ...overrides,
  };
}

describe("auto schedule backend hardening", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Staff.find.mockReturnValue(q([
      { _id: oid("cook1"), fullName: "Cook", userType: "STAFF", restaurantForStaff: "r1", department: "kitchen", employmentStatus: "working" },
      { _id: oid("cash1"), fullName: "Cashier", userType: "STAFF", restaurantForStaff: "r1", department: "cashier", employmentStatus: "working" },
    ]));
    modelMocks.Shift.find.mockReturnValue(q([]));
    modelMocks.SchedulePublication.findOne.mockReturnValue(q(null));
    validationMocks.validateShiftAssignment.mockResolvedValue(validResult());
  });

  it("preview does not recommend employees with overlapping shifts", async () => {
    validationMocks.validateShiftAssignment.mockImplementation(async ({ input }) => String(input.employeeId) === "cook1"
      ? validResult({ blockingErrors: [{ code: "SHIFT_OVERLAP", severity: "error", message: "overlap" }] })
      : validResult());
    const { buildAutoSchedulePreviewBackend } = await import("../../src/services/scheduling/autoSchedule.service.js");
    const preview = await buildAutoSchedulePreviewBackend({ restaurantId: "r1", periodStart: "2026-05-18", periodEnd: "2026-05-18", requiredRoles: { morning: ["kitchen"] }, shiftTemplates: [{ shiftType: "morning", startTime: "08:00", endTime: "12:00" }] });
    expect(preview.plannedAssignments).toHaveLength(0);
    expect(preview.blockedCandidates.some((row) => row.issues.some((issue) => issue.code === "SHIFT_OVERLAP"))).toBe(true);
  });

  it("preview does not recommend employees on leave", async () => {
    validationMocks.validateShiftAssignment.mockResolvedValue(validResult({ blockingErrors: [{ code: "LEAVE_CONFLICT", severity: "error", message: "leave" }] }));
    const { buildAutoSchedulePreviewBackend } = await import("../../src/services/scheduling/autoSchedule.service.js");
    const preview = await buildAutoSchedulePreviewBackend({ restaurantId: "r1", periodStart: "2026-05-18", periodEnd: "2026-05-18", requiredRoles: { morning: ["kitchen"] }, shiftTemplates: [{ shiftType: "morning", startTime: "08:00", endTime: "12:00" }] });
    expect(preview.plannedAssignments).toHaveLength(0);
    expect(preview.unfilledRoles[0].reason).toBe("NO_ELIGIBLE_CANDIDATE");
  });

  it("preview does not recommend employees with the wrong mandatory role", async () => {
    const { buildAutoSchedulePreviewBackend } = await import("../../src/services/scheduling/autoSchedule.service.js");
    const preview = await buildAutoSchedulePreviewBackend({ restaurantId: "r1", periodStart: "2026-05-18", periodEnd: "2026-05-18", requiredRoles: { morning: ["bar"] }, shiftTemplates: [{ shiftType: "morning", startTime: "08:00", endTime: "12:00" }] });
    expect(preview.plannedAssignments).toHaveLength(0);
    expect(preview.blockedCandidates.every((row) => row.issues[0].code === "ROLE_MISMATCH")).toBe(true);
  });

  it("preview respects weeklyHoursCap when avoidOvertime is enabled", async () => {
    validationMocks.validateShiftAssignment.mockResolvedValue(validResult({ metrics: { weeklyHoursAfter: 41 } }));
    const { buildAutoSchedulePreviewBackend } = await import("../../src/services/scheduling/autoSchedule.service.js");
    const preview = await buildAutoSchedulePreviewBackend({ restaurantId: "r1", periodStart: "2026-05-18", periodEnd: "2026-05-18", weeklyHoursCap: 40, avoidOvertime: true, requiredRoles: { morning: ["kitchen"] }, shiftTemplates: [{ shiftType: "morning", startTime: "08:00", endTime: "12:00" }] });
    expect(preview.plannedAssignments).toHaveLength(0);
    expect(preview.blockedCandidates.some((row) => row.issues.some((issue) => issue.code === "WEEKLY_HOURS_CAP_EXCEEDED"))).toBe(true);
  });

  it("apply rebuilds preview server-side instead of trusting client preview data", async () => {
    const { buildAutoScheduleCreateInputs } = await import("../../src/services/scheduling/autoSchedule.service.js");
    const inputs = await buildAutoScheduleCreateInputs({ restaurantId: "r1", periodStart: "2026-05-18", periodEnd: "2026-05-18", requiredRoles: { morning: ["kitchen"] }, shiftTemplates: [{ shiftType: "morning", startTime: "08:00", endTime: "12:00" }], items: [{ employeeId: "tampered" }] });
    expect(inputs[0].employeeId).toBe("cook1");
  });

  it("locked/active/closed schedules cannot be auto-applied directly", async () => {
    modelMocks.SchedulePublication.findOne.mockReturnValue(q({ status: "locked", periodStart: new Date("2026-05-18"), periodEnd: new Date("2026-05-24") }));
    const { assertAutoSchedulePeriodCanEdit } = await import("../../src/services/scheduling/autoSchedule.service.js");
    await expect(assertAutoSchedulePeriodCanEdit({ restaurantId: "r1", periodStart: "2026-05-18", periodEnd: "2026-05-24" })).rejects.toThrow("Không thể áp dụng");
  });
});
