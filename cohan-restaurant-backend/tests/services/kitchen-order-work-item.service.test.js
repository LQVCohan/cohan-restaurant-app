import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  KitchenOrderWorkItem: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  },
  KitchenShiftRosterSnapshot: {
    find: vi.fn(),
  },
  MenuItem: {
    findOne: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);

function makeAwaitableQuery(value) {
  const promise = Promise.resolve(value);
  return {
    session: vi.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
}

function mockExistingWorkItem(value) {
  modelMocks.KitchenOrderWorkItem.findOne.mockReturnValue({
    lean: vi.fn(() => makeAwaitableQuery(value)),
  });
}

function mockMenuItem(value) {
  modelMocks.MenuItem.findOne.mockReturnValue({
    select: vi.fn(() => ({
      lean: vi.fn(() => makeAwaitableQuery(value)),
    })),
  });
}

describe("kitchenOrderWorkItem service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistingWorkItem(null);
    mockMenuItem({ prepStation: "kitchen" });
    modelMocks.KitchenOrderWorkItem.find.mockReturnValue({
      session: vi.fn(async () => []),
    });
    modelMocks.KitchenOrderWorkItem.findOneAndUpdate.mockReturnValue({
      session: vi.fn(async () => ({ _id: "work-1" })),
    });
    modelMocks.KitchenOrderWorkItem.updateOne.mockResolvedValue({
      matchedCount: 1,
      modifiedCount: 1,
    });
    modelMocks.KitchenShiftRosterSnapshot.find.mockReturnValue({
      sort: vi.fn(() => ({ lean: vi.fn(async () => []) })),
    });
  });

  it("resolves prep timing helpers", async () => {
    const { resolvePrepTimeLevel, resolveTargetPrepMinutes } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    expect(resolveTargetPrepMinutes({ targetPrepMinutes: 12 }, "kitchen")).toBe(12);
    expect(resolveTargetPrepMinutes({}, "bar")).toBe(10);
    expect(resolveTargetPrepMinutes({}, "kitchen")).toBe(20);
    expect(resolvePrepTimeLevel(20, 20)).toBe("on_time");
    expect(resolvePrepTimeLevel(24, 20)).toBe("late");
    expect(resolvePrepTimeLevel(26, 20)).toBe("very_late");
  });

  it("loads the station from the order item snapshot for a new work item", async () => {
    const { resolveOrderItemStation } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await expect(
      resolveOrderItemStation({
        order: { restaurantId: "restaurant-1" },
        item: { dishId: "dish-1", prepStation: "bar" },
        session: {},
      }),
    ).resolves.toBe("bar");

    expect(modelMocks.MenuItem.findOne).not.toHaveBeenCalled();
  });

  it("keeps the existing work-item station after the menu item changes", async () => {
    const { resolveOrderItemStation } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await expect(
      resolveOrderItemStation({
        order: { restaurantId: "restaurant-1" },
        item: { dishId: "dish-1", prepStation: "kitchen" },
        existingWorkItem: { station: "bar" },
        session: {},
      }),
    ).resolves.toBe("bar");

    expect(modelMocks.MenuItem.findOne).not.toHaveBeenCalled();
  });

  it("fails clearly when a regular order item has no station snapshot", async () => {
    const { resolveOrderItemStation } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await expect(
      resolveOrderItemStation({
        order: { restaurantId: "restaurant-1" },
        item: { _id: "item-1", dishId: "dish-1", itemType: "MENU_ITEM" },
        session: {},
      }),
    ).rejects.toThrow("missing a valid prepStation snapshot");

    expect(modelMocks.MenuItem.findOne).not.toHaveBeenCalled();
  });

  it("uses the anchor dish only for the current single-line combo model", async () => {
    mockMenuItem({ prepStation: "bar" });
    const { resolveOrderItemStation } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await expect(
      resolveOrderItemStation({
        order: { restaurantId: "restaurant-1" },
        item: { dishId: "dish-1", itemType: "COMBO" },
        session: {},
      }),
    ).resolves.toBe("bar");

    expect(modelMocks.MenuItem.findOne).toHaveBeenCalledWith({
      _id: "dish-1",
      restaurantId: "restaurant-1",
    });
  });

  it("creates a bar work item and attaches the active bar roster", async () => {
    const now = new Date("2026-05-20T09:00:00.000Z");
    modelMocks.KitchenShiftRosterSnapshot.find.mockReturnValue({
      sort: vi.fn(() => ({
        lean: vi.fn(async () => [
          {
            _id: "row-1",
            shiftId: "shift-1",
            employeeId: "bar-1",
            kitchenDutyRole: "bar_lead",
            startTime: new Date("2026-05-20T08:00:00.000Z"),
            schedulePublicationId: "pub-1",
            shiftType: "morning",
          },
        ]),
      })),
    });

    const { upsertKitchenOrderWorkItemForKitchenEntry } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await upsertKitchenOrderWorkItemForKitchenEntry({
      order: {
        _id: "order-1",
        restaurantId: "restaurant-1",
        orderCode: "ORD-1",
        createdAt: now,
      },
      item: {
        _id: "item-1",
        dishId: "dish-1",
        prepStation: "bar",
        name: "Món dùng tại bar",
        quantity: 1,
        status: "pending",
      },
      actorUserId: "user-1",
      now,
      session: {},
    });

    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      { orderId: "order-1", orderItemId: "item-1" },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({ station: "bar" }),
        $set: expect.objectContaining({
          status: "pending",
          barLeadId: "bar-1",
          barStaffIds: ["bar-1"],
          noRoster: false,
        }),
      }),
      expect.objectContaining({ upsert: true, setDefaultsOnInsert: true }),
    );
  });

  it("uses the stored station during later status changes", async () => {
    const preparingAt = new Date("2026-05-20T09:00:00.000Z");
    mockExistingWorkItem({
      station: "bar",
      preparingAt,
      targetPrepMinutes: 10,
    });

    const { upsertKitchenOrderWorkItemForStatusChange } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await upsertKitchenOrderWorkItemForStatusChange({
      order: { _id: "order-1", restaurantId: "restaurant-1" },
      item: {
        _id: "item-1",
        dishId: "dish-1",
        prepStation: "kitchen",
      },
      previousStatus: "preparing",
      nextStatus: "ready",
      now: new Date("2026-05-20T09:08:00.000Z"),
      session: {},
    });

    expect(modelMocks.MenuItem.findOne).not.toHaveBeenCalled();
    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          station: "bar",
          actualPrepMinutes: 8,
          targetPrepMinutes: 10,
          timeLevel: "on_time",
        }),
      }),
      expect.anything(),
    );
  });

  it("syncs eligible kitchen-entry items and skips cancelled items", async () => {
    const { syncKitchenOrderWorkItemsForKitchenEntry } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    const result = await syncKitchenOrderWorkItemsForKitchenEntry({
      order: {
        _id: "order-1",
        restaurantId: "restaurant-1",
        items: [
          {
            _id: "item-1",
            dishId: "dish-1",
            prepStation: "kitchen",
            status: "pending",
          },
          { _id: "item-2", dishId: "dish-2", status: "cancelled" },
        ],
      },
      session: {},
    });

    expect(result).toEqual({ syncedCount: 1 });
    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it("records kitchen-related void metadata", async () => {
    mockExistingWorkItem({ station: "kitchen" });
    const { syncKitchenOrderWorkItemForVoidOrReturn } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await syncKitchenOrderWorkItemForVoidOrReturn({
      order: { _id: "order-1", restaurantId: "restaurant-1" },
      item: { _id: "item-1", dishId: "dish-1" },
      previousStatus: "served",
      nextStatus: "cancelled",
      issueType: "void",
      issueReason: "món cháy",
      session: {},
    });

    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { orderId: "order-1", orderItemId: "item-1" },
      expect.objectContaining({
        $set: expect.objectContaining({
          issueReasonCategory: "kitchen_quality",
          issueReasonKitchenRelated: true,
        }),
      }),
      { new: true },
    );
  });

  it("marks overdue pending items without changing their status", async () => {
    const now = new Date("2026-05-20T10:00:00.000Z");
    modelMocks.KitchenOrderWorkItem.find.mockReturnValue({
      session: vi.fn(async () => [
        {
          _id: "work-1",
          station: "bar",
          status: "pending",
          kitchenEnteredAt: new Date("2026-05-20T09:56:00.000Z"),
          barStaffIds: ["bar-1"],
        },
      ]),
    });

    const { markUnacceptedKitchenOrderWorkItems } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );
    const result = await markUnacceptedKitchenOrderWorkItems({
      restaurantId: "restaurant-1",
      now,
      session: {},
    });

    expect(result).toEqual({ matchedCount: 1, modifiedCount: 1 });
    const set = modelMocks.KitchenOrderWorkItem.updateOne.mock.calls[0][1].$set;
    expect(set).toMatchObject({
      unaccepted: true,
      unacceptedAfterMinutes: 3,
      unacceptedResponsibleEmployeeIds: ["bar-1"],
    });
    expect(set).not.toHaveProperty("status");
  });
});
