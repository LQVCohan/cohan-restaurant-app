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

  it("preparing -> ready computes actualPrepMinutes", async () => {
    modelMocks.KitchenOrderWorkItem.findOne.mockReturnValue({
      lean: vi.fn(() =>
        makeSessionChain({ kitchenEnteredAt: new Date("2026-05-20T09:00:00.000Z"), preparingAt: new Date("2026-05-20T09:05:00.000Z") }),
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
        $set: expect.objectContaining({ actualPrepMinutes: 15 }),
      }),
      expect.anything(),
    );
  });

  it("ready -> served updates servedAt", async () => {
    const { upsertKitchenOrderWorkItemForStatusChange } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );
    const now = new Date("2026-05-20T09:30:00.000Z");
    await upsertKitchenOrderWorkItemForStatusChange({ order: { _id: "o1", restaurantId: "r1" }, item: { _id: "i1" }, previousStatus: "ready", nextStatus: "served", now, session: {} });

    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ servedAt: now }) }),
      expect.anything(),
    );
  });

  it("no roster still creates with noRoster", async () => {
    const { upsertKitchenOrderWorkItemForStatusChange } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );
    await upsertKitchenOrderWorkItemForStatusChange({ order: { _id: "o1", restaurantId: "r1" }, item: { _id: "i1" }, previousStatus: "pending", nextStatus: "preparing", now: new Date(), session: {} });
    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ noRoster: true, noRosterReason: expect.stringContaining("Không tìm thấy roster") }),
      }),
      expect.anything(),
    );
  });

  it("resolves bar station from item name", async () => {
    const { resolveOrderItemStation } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );
    expect(resolveOrderItemStation({ name: "Trà đào" })).toBe("bar");
    expect(resolveOrderItemStation({ name: "Coffee" })).toBe("bar");
  });

  it("groups roster team with head and assistants", async () => {
    modelMocks.KitchenShiftRosterSnapshot.find.mockReturnValue({
      sort: vi.fn(() => ({
        lean: vi.fn(async () => [
          { _id: "r1", shiftId: "s1", employeeId: "u1", kitchenDutyRole: "head_chef", startTime: new Date("2026-05-20T08:00:00.000Z") },
          { _id: "r2", shiftId: "s1", employeeId: "u2", kitchenDutyRole: "assistant_chef", startTime: new Date("2026-05-20T08:00:00.000Z") },
          { _id: "r3", shiftId: "s1", employeeId: "u3", kitchenDutyRole: "helper", startTime: new Date("2026-05-20T08:00:00.000Z") },
        ]),
      })),
    });
    const { findKitchenRosterForOrderItem } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    const roster = await findKitchenRosterForOrderItem({ restaurantId: "r1", station: "kitchen", at: new Date() });
    expect(roster.headChefId).toBe("u1");
    expect(roster.assistantChefIds).toEqual(expect.arrayContaining(["u2", "u3"]));
    expect(roster.teamEmployeeIds).toEqual(expect.arrayContaining(["u1", "u2", "u3"]));
  });

  it("does not throw when optional fields are missing", async () => {
    const { upsertKitchenOrderWorkItemForStatusChange } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );
    await expect(
      upsertKitchenOrderWorkItemForStatusChange({
        order: { _id: "o1", restaurantId: "r1" },
        item: { _id: "i1" },
        nextStatus: "preparing",
        session: {},
      }),
    ).resolves.toBeTruthy();
  });
});
