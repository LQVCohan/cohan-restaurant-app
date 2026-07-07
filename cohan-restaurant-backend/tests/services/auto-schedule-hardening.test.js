import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Shift: { find: vi.fn(), create: vi.fn() },
  Staff: { find: vi.fn() },
  SchedulePublication: { findOne: vi.fn() },
  LeaveRequest: {},
  SchedulingPolicy: { findOne: vi.fn(), create: vi.fn() },
}));

const validationMocks = vi.hoisted(() => ({
  validateShiftAssignment: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock(
  "../../src/services/scheduling/shiftAssignmentValidation.service.js",
  () => validationMocks,
);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(v) {
        this.value = v;
        this.toString = () => String(v);
      },
    },
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
    modelMocks.Staff.find.mockReturnValue(
      q([
        {
          _id: oid("cook1"),
          fullName: "Cook",
          userType: "STAFF",
          restaurantForStaff: "r1",
          department: "kitchen",
          employmentStatus: "working",
        },
        {
          _id: oid("cash1"),
          fullName: "Cashier",
          userType: "STAFF",
          restaurantForStaff: "r1",
          department: "cashier",
          employmentStatus: "working",
        },
      ]),
    );
    modelMocks.Shift.find.mockReturnValue(q([]));
    modelMocks.SchedulePublication.findOne.mockReturnValue(q(null));
    modelMocks.SchedulingPolicy.findOne.mockResolvedValue({
      _id: "policy1",
      restaurantId: "r1",
      mandatoryShiftRoles: ["kitchen"],
      shiftTemplates: [],
      laborRules: {},
      scoringWeights: {},
      availabilityRegistrationPolicy: {},
    });
    modelMocks.SchedulingPolicy.create.mockResolvedValue({
      _id: "policy1",
      restaurantId: "r1",
      mandatoryShiftRoles: ["kitchen"],
      shiftTemplates: [],
      laborRules: {},
      scoringWeights: {},
      availabilityRegistrationPolicy: {},
    });
    validationMocks.validateShiftAssignment.mockResolvedValue(validResult());
  });

  it("preview does not recommend employees with overlapping shifts", async () => {
    validationMocks.validateShiftAssignment.mockImplementation(
      async ({ input }) =>
        String(input.employeeId) === "cook1"
          ? validResult({
              blockingErrors: [
                {
                  code: "SHIFT_OVERLAP",
                  severity: "error",
                  message: "overlap",
                },
              ],
            })
          : validResult(),
    );
    const { buildAutoSchedulePreviewBackend } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const preview = await buildAutoSchedulePreviewBackend({
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      requiredRoles: { morning: ["kitchen"] },
      shiftTemplates: [
        { shiftType: "morning", startTime: "08:00", endTime: "12:00" },
      ],
    });
    expect(preview.plannedAssignments).toHaveLength(0);
    const validationInput =
      validationMocks.validateShiftAssignment.mock.calls[0][0].input;
    expect(String(validationInput.employeeId)).toBe("cook1");
    expect(String(validationInput.restaurantId)).toBe("r1");
    expect(validationInput.shiftType).toBe("morning");
    expect(validationInput.startTime).toBeInstanceOf(Date);
    expect(validationInput.endTime).toBeInstanceOf(Date);
    expect(
      preview.blockedCandidates.some((row) =>
        row.issues.some((issue) => issue.code === "SHIFT_OVERLAP"),
      ),
    ).toBe(true);
  });

  it("preview does not recommend employees on leave", async () => {
    validationMocks.validateShiftAssignment.mockResolvedValue(
      validResult({
        blockingErrors: [
          { code: "LEAVE_CONFLICT", severity: "error", message: "leave" },
        ],
      }),
    );
    const { buildAutoSchedulePreviewBackend } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const preview = await buildAutoSchedulePreviewBackend({
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      requiredRoles: { morning: ["kitchen"] },
      shiftTemplates: [
        { shiftType: "morning", startTime: "08:00", endTime: "12:00" },
      ],
    });
    expect(preview.plannedAssignments).toHaveLength(0);
    expect(preview.unfilledRoles[0].reason).toBe("NO_ELIGIBLE_CANDIDATE");
  });

  it("preview does not recommend employees with the wrong mandatory role", async () => {
    const { buildAutoSchedulePreviewBackend } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const preview = await buildAutoSchedulePreviewBackend({
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      requiredRoles: { morning: ["bar"] },
      shiftTemplates: [
        { shiftType: "morning", startTime: "08:00", endTime: "12:00" },
      ],
    });
    expect(preview.plannedAssignments).toHaveLength(0);
    expect(
      preview.blockedCandidates.every(
        (row) => row.issues[0].code === "ROLE_MISMATCH",
      ),
    ).toBe(true);
  });

  it("preview respects weeklyHoursCap when avoidOvertime is enabled", async () => {
    validationMocks.validateShiftAssignment.mockResolvedValue(
      validResult({ metrics: { weeklyHoursAfter: 41 } }),
    );
    const { buildAutoSchedulePreviewBackend } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const preview = await buildAutoSchedulePreviewBackend({
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      weeklyHoursCap: 40,
      avoidOvertime: true,
      requiredRoles: { morning: ["kitchen"] },
      shiftTemplates: [
        { shiftType: "morning", startTime: "08:00", endTime: "12:00" },
      ],
    });
    expect(preview.plannedAssignments).toHaveLength(0);
    expect(
      preview.blockedCandidates.some((row) =>
        row.issues.some((issue) => issue.code === "WEEKLY_HOURS_CAP_EXCEEDED"),
      ),
    ).toBe(true);
  });

  it("uses template.type to resolve shift type for preview and apply", async () => {
    const { buildAutoSchedulePreviewBackend, buildAutoScheduleCreateInputs } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const input = {
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      requiredRoles: { afternoon: ["cashier"] },
      shiftTemplates: [
        {
          type: "afternoon",
          label: "Ca chiều",
          startTime: "13:00",
          endTime: "17:00",
        },
      ],
    };

    const preview = await buildAutoSchedulePreviewBackend(input);
    const rows = await buildAutoScheduleCreateInputs(input);

    expect(preview.items[0].shiftType).toBe("afternoon");
    expect(rows[0].shiftType).toBe("afternoon");
  });

  it("supports overnight templates by rolling endTime to the next day", async () => {
    const { buildAutoSchedulePreviewBackend, buildAutoScheduleCreateInputs } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const input = {
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      requiredRoles: { night: ["kitchen"] },
      shiftTemplates: [{ type: "night", startTime: "22:00", endTime: "06:00" }],
    };

    const preview = await buildAutoSchedulePreviewBackend(input);
    const rows = await buildAutoScheduleCreateInputs(input);
    const item = preview.items[0];
    const durationHours =
      (new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) /
      3600000;

    expect(item.shiftType).toBe("night");
    expect(new Date(item.endTime).getTime()).toBeGreaterThan(
      new Date(item.startTime).getTime(),
    );
    expect(durationHours).toBe(8);
    const rowStart = new Date(rows[0].startTime);
    const rowEnd = new Date(rows[0].endTime);
    const rowDurationHours = (rowEnd.getTime() - rowStart.getTime()) / 3600000;

    expect(rowEnd.getTime()).toBeGreaterThan(rowStart.getTime());
    expect(rowDurationHours).toBe(8);
  });

  it("apply rebuilds preview server-side instead of trusting client preview data", async () => {
    const { buildAutoScheduleCreateInputs } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const inputs = await buildAutoScheduleCreateInputs({
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      requiredRoles: { morning: ["kitchen"] },
      shiftTemplates: [
        { shiftType: "morning", startTime: "08:00", endTime: "12:00" },
      ],
      items: [{ employeeId: "tampered" }],
    });
    expect(inputs[0].employeeId).toBe("cook1");
  });

  it("apply only creates backend-validated rows selected by the manager", async () => {
    const { buildAutoSchedulePreviewBackend, buildAutoScheduleCreateInputs } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const input = {
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      requiredRoles: { morning: ["kitchen"], afternoon: ["cashier"] },
      shiftTemplates: [
        { shiftType: "morning", startTime: "08:00", endTime: "12:00" },
        { shiftType: "afternoon", startTime: "13:00", endTime: "17:00" },
      ],
    };
    const preview = await buildAutoSchedulePreviewBackend(input);
    const selectedShiftKey = preview.plannedAssignments[0].shiftKey;

    const inputs = await buildAutoScheduleCreateInputs({
      ...input,
      selectedShiftKeys: [selectedShiftKey],
    });

    expect(inputs).toHaveLength(1);
    expect(inputs[0].startTime.toISOString()).toBe(
      preview.plannedAssignments[0].startTime.toISOString(),
    );
  });

  it("apply rejects stale selectedShiftKeys that are not in the regenerated preview", async () => {
    const { buildAutoScheduleCreateInputs } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const input = {
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      requiredRoles: { morning: ["kitchen"] },
      shiftTemplates: [
        { shiftType: "morning", startTime: "08:00", endTime: "12:00" },
      ],
    };

    await expect(
      buildAutoScheduleCreateInputs({
        ...input,
        selectedShiftKeys: ["stale-shift-key"],
        allowPartialApply: true,
      }),
    ).rejects.toThrow(
      "Một số ca được chọn không còn hợp lệ, vui lòng tạo preview lại.",
    );
  });

  it("apply rejects selectedShiftKeys that only point to blocked/unfilled items", async () => {
    const { buildAutoSchedulePreviewBackend, buildAutoScheduleCreateInputs } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const input = {
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      requiredRoles: { morning: ["bar"] },
      shiftTemplates: [
        { shiftType: "morning", startTime: "08:00", endTime: "12:00" },
      ],
    };
    const preview = await buildAutoSchedulePreviewBackend(input);

    await expect(
      buildAutoScheduleCreateInputs({
        ...input,
        selectedShiftKeys: [preview.items[0].shiftKey],
        allowPartialApply: true,
      }),
    ).rejects.toThrow(
      "Không có ca hợp lệ nào được chọn để áp dụng auto schedule.",
    );
  });

  it("apply rejects unresolved roles even when the client requests partial apply", async () => {
    const { buildAutoScheduleCreateInputs } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const input = {
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      requiredRoles: { morning: ["kitchen", "bar"] },
      shiftTemplates: [
        { shiftType: "morning", startTime: "08:00", endTime: "12:00" },
      ],
    };

    await expect(buildAutoScheduleCreateInputs(input)).rejects.toThrow(
      "Không thể áp dụng auto schedule vì vẫn còn ca/vai trò chưa được xếp đủ.",
    );

    await expect(
      buildAutoScheduleCreateInputs({
        ...input,
        allowPartialApply: true,
      }),
    ).rejects.toThrow(
      "Không thể áp dụng auto schedule vì vẫn còn ca/vai trò chưa được xếp đủ.",
    );
  });

  it("apply preserves valid override fields in generated create shift rows", async () => {
    const { buildAutoScheduleCreateInputs } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    const inputs = await buildAutoScheduleCreateInputs({
      restaurantId: "r1",
      periodStart: "2026-05-18",
      periodEnd: "2026-05-18",
      requiredRoles: { morning: ["kitchen"] },
      shiftTemplates: [
        { shiftType: "morning", startTime: "08:00", endTime: "12:00" },
      ],
      allowOverride: true,
      overrideReason: "Manager approved availability override",
    });

    expect(inputs[0]).toMatchObject({
      allowOverride: true,
      overrideReason: "Manager approved availability override",
    });
  });

  it("apply rejects override when overrideReason is missing or too short", async () => {
    const { buildAutoScheduleCreateInputs } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    await expect(
      buildAutoScheduleCreateInputs({
        restaurantId: "r1",
        periodStart: "2026-05-18",
        periodEnd: "2026-05-18",
        requiredRoles: { morning: ["kitchen"] },
        shiftTemplates: [
          { shiftType: "morning", startTime: "08:00", endTime: "12:00" },
        ],
        allowOverride: true,
        overrideReason: "ok",
      }),
    ).rejects.toThrow("Cần nhập lý do override hợp lệ");
  });

  it("locked/active/closed schedules cannot be auto-applied directly", async () => {
    modelMocks.SchedulePublication.findOne.mockReturnValue(
      q({
        status: "locked",
        periodStart: new Date("2026-05-18"),
        periodEnd: new Date("2026-05-24"),
      }),
    );
    const { assertAutoSchedulePeriodCanEdit } =
      await import("../../src/services/scheduling/autoSchedule.service.js");
    await expect(
      assertAutoSchedulePeriodCanEdit({
        restaurantId: "r1",
        periodStart: "2026-05-18",
        periodEnd: "2026-05-24",
      }),
    ).rejects.toThrow("Không thể áp dụng");
  });

  it("publish validation includes overnight shifts that overlap the period", async () => {
    const overnightShift = {
      _id: "shift1",
      employeeId: "cook1",
      restaurantId: "r1",
      shiftType: "evening",
      startTime: new Date("2026-05-17T22:00:00Z"),
      endTime: new Date("2026-05-18T02:00:00Z"),
    };
    modelMocks.Shift.find.mockReturnValueOnce(q([overnightShift]));
    modelMocks.Staff.find.mockReturnValueOnce(
      q([
        {
          _id: oid("cook1"),
          restaurantForStaff: "r1",
          department: "kitchen",
          employmentStatus: "working",
        },
      ]),
    );
    validationMocks.validateShiftAssignment.mockResolvedValueOnce(
      validResult(),
    );

    const { validateScheduleBeforePublish } =
      await import("../../src/services/scheduling/schedulePublishValidation.service.js");
    const result = await validateScheduleBeforePublish({
      restaurantId: "r1",
      periodStart: new Date("2026-05-18T00:00:00Z"),
      periodEnd: new Date("2026-05-24T23:59:59Z"),
    });

    expect(modelMocks.Shift.find).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: { $lte: new Date("2026-05-24T23:59:59Z") },
        endTime: { $gte: new Date("2026-05-18T00:00:00Z") },
      }),
    );
    expect(result.errorCount).toBe(0);
  });

  it("publish validation loads mandatory roles from scheduling policy when caller does not provide roles", async () => {
    const overnightShift = {
      _id: "shift-policy",
      employeeId: "cash1",
      restaurantId: "r1",
      shiftType: "evening",
      startTime: new Date("2026-05-17T22:00:00Z"),
      endTime: new Date("2026-05-18T02:00:00Z"),
    };
    modelMocks.Shift.find.mockReturnValueOnce(q([overnightShift]));
    modelMocks.Staff.find.mockReturnValueOnce(
      q([
        {
          _id: oid("cash1"),
          restaurantForStaff: "r1",
          department: "cashier",
          employmentStatus: "working",
        },
      ]),
    );
    modelMocks.SchedulingPolicy.findOne.mockResolvedValueOnce({
      _id: "policy1",
      restaurantId: "r1",
      mandatoryShiftRoles: ["kitchen"],
      shiftTemplates: [],
      laborRules: {},
      scoringWeights: {},
      availabilityRegistrationPolicy: {},
    });
    validationMocks.validateShiftAssignment.mockResolvedValueOnce(
      validResult(),
    );

    const { validateScheduleBeforePublish } =
      await import("../../src/services/scheduling/schedulePublishValidation.service.js");
    const result = await validateScheduleBeforePublish({
      restaurantId: "r1",
      periodStart: new Date("2026-05-18T00:00:00Z"),
      periodEnd: new Date("2026-05-24T23:59:59Z"),
    });

    expect(
      result.issues.some(
        (issue) => issue.code === "MANDATORY_ROLE_MISSING_ON_SHIFT",
      ),
    ).toBe(true);
  });

  it("publish validation blocks missing mandatory role on overnight shifts", async () => {
    const overnightShift = {
      _id: "shift2",
      employeeId: "cash1",
      restaurantId: "r1",
      shiftType: "evening",
      startTime: new Date("2026-05-17T22:00:00Z"),
      endTime: new Date("2026-05-18T02:00:00Z"),
    };
    modelMocks.Shift.find.mockReturnValueOnce(q([overnightShift]));
    modelMocks.Staff.find.mockReturnValueOnce(
      q([
        {
          _id: oid("cash1"),
          restaurantForStaff: "r1",
          department: "cashier",
          employmentStatus: "working",
        },
      ]),
    );
    validationMocks.validateShiftAssignment.mockResolvedValueOnce(
      validResult(),
    );

    const { validateScheduleBeforePublish } =
      await import("../../src/services/scheduling/schedulePublishValidation.service.js");
    const result = await validateScheduleBeforePublish({
      restaurantId: "r1",
      periodStart: new Date("2026-05-18T00:00:00Z"),
      periodEnd: new Date("2026-05-24T23:59:59Z"),
      mandatoryShiftRoles: { evening: ["kitchen"] },
    });

    expect(
      result.issues.some(
        (issue) => issue.code === "MANDATORY_ROLE_MISSING_ON_SHIFT",
      ),
    ).toBe(true);
    expect(result.errorCount).toBeGreaterThan(0);
  });
});
