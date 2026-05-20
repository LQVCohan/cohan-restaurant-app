import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  KitchenOrderWorkItem: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  KitchenShiftRosterSnapshot: {
    find: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);

function makeSessionChain(value) {
  return { session: vi.fn(async () => value) };
}

describe("kitchenOrderWorkItem service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.KitchenOrderWorkItem.findOne.mockReturnValue({
      lean: vi.fn(() => makeSessionChain(null)),
    });
    modelMocks.KitchenOrderWorkItem.findOneAndUpdate.mockReturnValue({
      session: vi.fn(async () => ({ _id: "work-1" })),
    });
    modelMocks.KitchenShiftRosterSnapshot.find.mockReturnValue({
      sort: vi.fn(() => ({ lean: vi.fn(async () => []) })),
    });
  });

  it("resolves target prep minutes from item overrides and defaults", async () => {
    const { resolveTargetPrepMinutes } = await import("../../src/services/kitchen/kitchenOrderWorkItem.service.js");

    expect(resolveTargetPrepMinutes({ targetPrepMinutes: 12 }, "kitchen")).toBe(12);
    expect(resolveTargetPrepMinutes({ prepTimeMinutes: 15 }, "kitchen")).toBe(15);
    expect(resolveTargetPrepMinutes({ estimatedPrepMinutes: 18 }, "kitchen")).toBe(18);
    expect(resolveTargetPrepMinutes({ servingVariant: { targetPrepMinutes: 9 } }, "kitchen")).toBe(9);
    expect(resolveTargetPrepMinutes({}, "bar")).toBe(10);
    expect(resolveTargetPrepMinutes({}, "kitchen")).toBe(20);
    expect(() => resolveTargetPrepMinutes(null, "kitchen")).not.toThrow();
  });

  it("resolves prep time level from actual and target values", async () => {
    const { resolvePrepTimeLevel } = await import("../../src/services/kitchen/kitchenOrderWorkItem.service.js");

    expect(resolvePrepTimeLevel(20, 20)).toBe("on_time");
    expect(resolvePrepTimeLevel(24, 20)).toBe("late");
    expect(resolvePrepTimeLevel(26, 20)).toBe("very_late");
    expect(resolvePrepTimeLevel(null, 20)).toBeNull();
    expect(resolvePrepTimeLevel("x", 20)).toBeNull();
    expect(resolvePrepTimeLevel(20, null)).toBeNull();
    expect(resolvePrepTimeLevel(20, 0)).toBeNull();
  });

  it("pending -> preparing creates work item and attaches roster", async () => {
    const now = new Date("2026-05-20T09:00:00.000Z");
    modelMocks.KitchenShiftRosterSnapshot.find.mockReturnValue({
      sort: vi.fn(() => ({
        lean: vi.fn(async () => [
          {
            _id: "row-1",
            shiftId: "shift-1",
            employeeId: "chef-1",
            kitchenDutyRole: "head_chef",
            startTime: new Date("2026-05-20T08:00:00.000Z"),
            schedulePublicationId: "pub-1",
            shiftType: "morning",
          },
        ]),
      })),
    });
    const { upsertKitchenOrderWorkItemForStatusChange } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await upsertKitchenOrderWorkItemForStatusChange({
      order: { _id: "o1", restaurantId: "r1", orderCode: "ORD-1", createdAt: now },
      item: { _id: "i1", name: "Cơm gà", quantity: 1 },
      previousStatus: "pending",
      nextStatus: "preparing",
      actorUserId: "u1",
      now,
      session: {},
    });

    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      { orderId: "o1", orderItemId: "i1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "preparing",
          station: "kitchen",
          kitchenEnteredAt: now,
          preparingAt: now,
          rosterSnapshotId: "row-1",
          shiftId: "shift-1",
        }),
      }),
      expect.objectContaining({ upsert: true, setDefaultsOnInsert: true }),
    );
  });

  it("preparing -> ready computes actualPrepMinutes with target and on_time", async () => {
    modelMocks.KitchenOrderWorkItem.findOne.mockReturnValue({
      lean: vi.fn(() =>
        makeSessionChain({
          kitchenEnteredAt: new Date("2026-05-20T09:00:00.000Z"),
          preparingAt: new Date("2026-05-20T09:05:00.000Z"),
        }),
      ),
    });
    const { upsertKitchenOrderWorkItemForStatusChange } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await upsertKitchenOrderWorkItemForStatusChange({
      order: { _id: "o1", restaurantId: "r1" },
      item: { _id: "i1" },
      previousStatus: "preparing",
      nextStatus: "ready",
      now: new Date("2026-05-20T09:20:00.000Z"),
      session: {},
    });

    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          actualPrepMinutes: 15,
          targetPrepMinutes: 20,
          timeLevel: "on_time",
        }),
      }),
      expect.anything(),
    );
  });

  it("ready computes very_late when prep duration exceeds late grace", async () => {
    modelMocks.KitchenOrderWorkItem.findOne.mockReturnValue({
      lean: vi.fn(() => makeSessionChain({ preparingAt: new Date("2026-05-20T09:00:00.000Z") })),
    });
    const { upsertKitchenOrderWorkItemForStatusChange } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await upsertKitchenOrderWorkItemForStatusChange({
      order: { _id: "o1", restaurantId: "r1" },
      item: { _id: "i1", name: "Cơm" },
      previousStatus: "preparing",
      nextStatus: "ready",
      now: new Date("2026-05-20T09:40:00.000Z"),
      session: {},
    });

    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          actualPrepMinutes: 40,
          targetPrepMinutes: 20,
          timeLevel: "very_late",
        }),
      }),
      expect.anything(),
    );
  });

  it("ready keeps existing targetPrepMinutes and does not overwrite", async () => {
    modelMocks.KitchenOrderWorkItem.findOne.mockReturnValue({
      lean: vi.fn(() =>
        makeSessionChain({
          preparingAt: new Date("2026-05-20T09:00:00.000Z"),
          targetPrepMinutes: 12,
        }),
      ),
    });
    const { upsertKitchenOrderWorkItemForStatusChange } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await upsertKitchenOrderWorkItemForStatusChange({
      order: { _id: "o1", restaurantId: "r1" },
      item: { _id: "i1", targetPrepMinutes: 20 },
      previousStatus: "preparing",
      nextStatus: "ready",
      now: new Date("2026-05-20T09:14:00.000Z"),
      session: {},
    });

    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          actualPrepMinutes: 14,
          targetPrepMinutes: 12,
          timeLevel: "late",
        }),
      }),
      expect.anything(),
    );
  });
});
