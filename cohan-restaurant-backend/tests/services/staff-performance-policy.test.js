import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  SystemSetting: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  AuditLog: { create: vi.fn() },
  StaffPerformanceSnapshot: { bulkWrite: vi.fn() },
}));
const roleMocks = vi.hoisted(() => ({ resolveUserRoles: vi.fn() }));

vi.mock("mongoose", () => {
  function ObjectId(value) {
    this.value = String(value);
    this.toString = () => this.value;
  }
  return {
    default: {
      isValidObjectId: vi.fn((value) => Boolean(value)),
      Types: { ObjectId },
    },
  };
});
vi.mock("../../models/index.js", () => modelMocks);
vi.mock(
  "../../src/services/scheduling/schedulingPermission.service.js",
  () => roleMocks,
);

const queryResult = (value) => {
  const query = {
    select: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  query.select.mockReturnValue(query);
  return query;
};

const managerContext = {
  user: { id: "manager-1", roleSlug: "manager", fullName: "Manager" },
};

const savedSetting = (thresholds = {}) => ({
  _id: "setting-1",
  restaurantId: "restaurant-1",
  performancePolicy: {
    levelThresholds: {
      excellentMin: 92,
      goodMin: 82,
      averageMin: 68,
      needsAttentionMin: 52,
      ...thresholds,
    },
  },
  updatedBy: "manager-1",
  updatedAt: new Date("2026-07-12T00:00:00.000Z"),
});

describe("staff performance policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roleMocks.resolveUserRoles.mockReturnValue(["MANAGER"]);
    modelMocks.SystemSetting.findOne.mockReturnValue(queryResult(null));
    modelMocks.SystemSetting.findOneAndUpdate.mockReturnValue(
      queryResult(savedSetting()),
    );
    modelMocks.AuditLog.create.mockResolvedValue({ _id: "audit-1" });
    modelMocks.StaffPerformanceSnapshot.bulkWrite.mockResolvedValue({
      modifiedCount: 1,
    });
  });

  it("returns safe defaults and classifies with supplied thresholds", async () => {
    const {
      getStaffPerformancePolicy,
      resolvePerformanceLevel,
    } = await import(
      "../../src/services/staffPerformance/staffPerformancePolicy.service.js"
    );

    await expect(
      getStaffPerformancePolicy({
        restaurantId: "restaurant-1",
        ctx: managerContext,
      }),
    ).resolves.toMatchObject({
      restaurantId: "restaurant-1",
      weights: {
        productivity: 25,
        punctuality: 25,
        quality: 20,
        managerReview: 20,
        compliance: 10,
      },
      levelThresholds: {
        excellentMin: 90,
        goodMin: 80,
        averageMin: 65,
        needsAttentionMin: 50,
      },
    });

    expect(
      resolvePerformanceLevel(88, {
        excellentMin: 95,
        goodMin: 85,
        averageMin: 70,
        needsAttentionMin: 55,
      }),
    ).toBe("good");
  });

  it("rejects non-manager roles before reading policy data", async () => {
    roleMocks.resolveUserRoles.mockReturnValue(["STAFF"]);
    const { getStaffPerformancePolicy } = await import(
      "../../src/services/staffPerformance/staffPerformancePolicy.service.js"
    );

    await expect(
      getStaffPerformancePolicy({
        restaurantId: "restaurant-1",
        ctx: { user: { id: "staff-1", roleName: "staff" } },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(modelMocks.SystemSetting.findOne).not.toHaveBeenCalled();
  });

  it("rejects unordered or non-integer thresholds", async () => {
    const { validatePerformanceLevelThresholds } = await import(
      "../../src/services/staffPerformance/staffPerformancePolicy.service.js"
    );

    expect(() =>
      validatePerformanceLevelThresholds({
        excellentMin: 90,
        goodMin: 90,
        averageMin: 65,
        needsAttentionMin: 50,
      }),
    ).toThrow("Xuất sắc > Tốt > Trung bình > Cần chú ý");

    expect(() =>
      validatePerformanceLevelThresholds({
        excellentMin: 90.5,
        goodMin: 80,
        averageMin: 65,
        needsAttentionMin: 50,
      }),
    ).toThrow("Mốc Xuất sắc phải là số nguyên");
  });

  it("persists only editable thresholds and creates an audit record", async () => {
    modelMocks.SystemSetting.findOne
      .mockReturnValueOnce(queryResult(null));
    const { updateStaffPerformancePolicy } = await import(
      "../../src/services/staffPerformance/staffPerformancePolicy.service.js"
    );

    const result = await updateStaffPerformancePolicy({
      input: {
        restaurantId: "restaurant-1",
        levelThresholds: {
          excellentMin: 92,
          goodMin: 82,
          averageMin: 68,
          needsAttentionMin: 52,
        },
        weights: { productivity: 100 },
      },
      ctx: managerContext,
    });

    expect(result.levelThresholds).toEqual({
      excellentMin: 92,
      goodMin: 82,
      averageMin: 68,
      needsAttentionMin: 52,
    });
    expect(modelMocks.SystemSetting.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({
          "performancePolicy.levelThresholds": {
            excellentMin: 92,
            goodMin: 82,
            averageMin: 68,
            needsAttentionMin: 52,
          },
        }),
      }),
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
    const update = modelMocks.SystemSetting.findOneAndUpdate.mock.calls[0][1];
    expect(JSON.stringify(update)).not.toContain("productivity");
    expect(modelMocks.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "STAFF_PERFORMANCE_POLICY_UPDATED",
        module: "staff_performance",
        before: expect.any(Object),
        after: expect.any(Object),
      }),
    );
  });

  it("reclassifies recalculated snapshots and stores the policy used", async () => {
    modelMocks.SystemSetting.findOne.mockReturnValue(
      queryResult(savedSetting()),
    );
    const { applyPerformancePolicyToRecalculationResult } = await import(
      "../../src/services/staffPerformance/staffPerformancePolicy.service.js"
    );

    const result = await applyPerformancePolicyToRecalculationResult({
      restaurantId: "restaurant-1",
      result: {
        id: "snapshot-1",
        finalPerformanceScore: 83,
        performanceLevel: "good",
        factors: { insufficientData: false },
      },
    });

    expect(result.performanceLevel).toBe("good");
    expect(result.factors.performanceLevelThresholds).toEqual({
      excellentMin: 92,
      goodMin: 82,
      averageMin: 68,
      needsAttentionMin: 52,
    });
    expect(modelMocks.StaffPerformanceSnapshot.bulkWrite).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          updateOne: expect.objectContaining({
            update: {
              $set: expect.objectContaining({
                performanceLevel: "good",
                "factors.performanceLevelThresholds": expect.any(Object),
              }),
            },
          }),
        }),
      ],
      { ordered: false },
    );
  });
});
