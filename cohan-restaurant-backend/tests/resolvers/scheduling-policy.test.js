import { describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  SchedulingPolicy: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: { ObjectId: function ObjectId(v) { return v; } },
  },
}));

import { endOfWeekMonday, isFirstOperationalWeek, startSchedulingOperations } from "../../src/services/scheduling/schedulingPolicy.service.js";

describe("scheduling policy onboarding", () => {
  it("computes first operational week correctly", () => {
    const start = new Date("2026-05-04T10:00:00.000Z");
    const policy = { schedulingOperationalStartAt: start, firstWeekGracePolicy: { enabled: true, appliedUntil: endOfWeekMonday(start) } };
    expect(isFirstOperationalWeek(policy, new Date("2026-05-06T10:00:00.000Z")).active).toBe(true);
    expect(isFirstOperationalWeek(policy, new Date("2026-05-12T10:00:00.000Z")).active).toBe(false);
  });

  it("startSchedulingOperations keeps existing start date", async () => {
    modelMocks.SchedulingPolicy.findOne.mockResolvedValueOnce({ schedulingOperationalStartAt: new Date("2026-05-04T00:00:00.000Z") });
    const policy = await startSchedulingOperations({ restaurantId: "507f1f77bcf86cd799439011" });
    expect(policy.schedulingOperationalStartAt).toBeTruthy();
  });
});
