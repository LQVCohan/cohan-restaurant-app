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

function makeSessionChain(value) {
  return { session: vi.fn(async () => value) };
}

function makeAwaitableQuery(value) {
  const promise = Promise.resolve(value);
  return {
    session: vi.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
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
    modelMocks.KitchenOrderWorkItem.findOne.mockReturnValue({
      lean: vi.fn(() => makeSessionChain(null)),
    });
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
    mockMenuItem({ prepStation: "kitchen" });
  });

  it("resolves target prep minutes from item overrides and defaults", async () => {
    const { resolveTargetPrepMinutes } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    expect(resolveTargetPrepMinutes({ targetPrepMinutes: 12 }, "kitchen")).toBe(12);
    expect(resolveTargetPrepMinutes({ prepTimeMinutes: 15 }, "kitchen")).toBe(15);
    expect(resolveTargetPrepMinutes({ estimatedPrepMinutes: 18 }, "kitchen")).toBe(18);
    expect(
      resolveTargetPrepMinutes(
        { servingVariant: { targetPrepMinutes: 9 } },
        "kitchen",
      ),
    ).toBe(9);
    expect(resolveTargetPrepMinutes({}, "bar")).toBe(10);
    expect(resolveTargetPrepMinutes({}, "kitchen")).toBe(20);
    expect(() => resolveTargetPrepMinutes(null, "kitchen")).not.toThrow();
  });

  it("resolves prep time level from actual and target values", async () => {
    const { resolvePrepTimeLevel } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    expect(resolvePrepTimeLevel(20, 20)).toBe("on_time");
    expect(resolvePrepTimeLevel(24, 20)).toBe("late");
    expect(resolvePrepTimeLevel(26, 20)).toBe("very_late");
    expect(resolvePrepTimeLevel(null, 20)).toBeNull();
    expect(resolvePrepTimeLevel("x", 20)).toBeNull();
    expect(resolvePrepTimeLevel(20, null)).toBeNull();
    expect(resolvePrepTimeLevel(20, 0)).toBeNull();
  });

  it("resolves a new regular item from its order snapshot", async () => {
    const { resolveOrderItemStation } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await expect(
      resolveOrderItemStation({
        order: { restaurantId: "r1" },
        item: { _id: "i1", prepStation: "bar" },
        session: {},
      }),
    ).resolves.toBe("bar");
    expect(modelMocks.MenuItem.findOne).not.toHaveBeenCalled();
  });

  it("keeps an existing work-item station when menu configuration changes", async () => {
    const { resolveOrderItemStation } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await expect(
      resolveOrderItemStation({
        order: { restaurantId: "r1" },
        item: { _id: "i1", prepStation: "kitchen" },
        existingWorkItem: { station: "bar" },
        session: {},
      }),
    ).resolves.toBe("bar");
    expect(modelMocks.MenuItem.findOne).not.toHaveBeenCalled();
  });

  it("rejects a regular item without a station snapshot", async () => {
    const { resolveOrderItemStation } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await expect(
      resolveOrderItemStation({
        order: { restaurantId: "r1" },
        item: { _id: "i1", itemType: "MENU_ITEM" },
        session: {},
      }),
    ).rejects.toThrow("missing a valid prepStation snapshot");
  });

  it("uses the anchor dish for the current single-line combo model", async () => {
    mockMenuItem({ prepStation: "bar" });
    const { resolveOrderItemStation } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    await expect(
      resolveOrderItemStation({
        order: { restaurantId: "r1" },
        item: { _id: "i1", itemType: "COMBO", dishId: "dish-1" },
        session: {},
      }),
    ).resolves.toBe("bar");
    expect(modelMocks.MenuItem.findOne).toHaveBeenCalledWith({
      _id: "dish-1",
      restaurantId: "r1",
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
      order: {
        _id: "o1",
        restaurantId: "r1",
        orderCode: "ORD-1",
        createdAt: now,
      },
      item: {
        _id: "i1",
        name: "Cơm gà",
        quantity: 1,
        prepStation: "kitchen",
      },
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
          station: "kitchen",
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
      lean: vi.fn(() =>
        makeSessionChain({
          station: "kitchen",
          preparingAt: new Date("2026-05-20T09:00:00.000Z"),
        }),
      ),
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
          station: "kitchen",
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

  it("ready -> served updates servedAt", async () => {
    const { upsertKitchenOrderWorkItemForStatusChange } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );
    const now = new Date("2026-05-20T09:30:00.000Z");
    await upsertKitchenOrderWorkItemForStatusChange({
      order: { _id: "o1", restaurantId: "r1" },
      item: { _id: "i1", prepStation: "kitchen" },
      previousStatus: "ready",
      nextStatus: "served",
      now,
      session: {},
    });

    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({ servedAt: now }),
      }),
      expect.anything(),
    );
  });

  it("no roster still creates with noRoster", async () => {
    const { upsertKitchenOrderWorkItemForStatusChange } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );
    await upsertKitchenOrderWorkItemForStatusChange({
      order: { _id: "o1", restaurantId: "r1" },
      item: { _id: "i1", prepStation: "kitchen" },
      previousStatus: "pending",
      nextStatus: "preparing",
      now: new Date(),
      session: {},
    });
    expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          noRoster: true,
          noRosterReason: expect.stringContaining("Không tìm thấy roster"),
        }),
      }),
      expect.anything(),
    );
  });

  it("groups roster team with head and assistants", async () => {
    modelMocks.KitchenShiftRosterSnapshot.find.mockReturnValue({
      sort: vi.fn(() => ({
        lean: vi.fn(async () => [
          {
            _id: "r1",
            shiftId: "s1",
            employeeId: "u1",
            kitchenDutyRole: "head_chef",
            startTime: new Date("2026-05-20T08:00:00.000Z"),
          },
          {
            _id: "r2",
            shiftId: "s1",
            employeeId: "u2",
            kitchenDutyRole: "assistant_chef",
            startTime: new Date("2026-05-20T08:00:00.000Z"),
          },
          {
            _id: "r3",
            shiftId: "s1",
            employeeId: "u3",
            kitchenDutyRole: "helper",
            startTime: new Date("2026-05-20T08:00:00.000Z"),
          },
        ]),
      })),
    });
    const { findKitchenRosterForOrderItem } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );

    const roster = await findKitchenRosterForOrderItem({
      restaurantId: "r1",
      station: "kitchen",
      at: new Date(),
    });
    expect(roster.headChefId).toBe("u1");
    expect(roster.assistantChefIds).toEqual(
      expect.arrayContaining(["u2", "u3"]),
    );
    expect(roster.teamEmployeeIds).toEqual(
      expect.arrayContaining(["u1", "u2", "u3"]),
    );
  });

  it("does not throw when optional fields are missing but station snapshot exists", async () => {
    const { upsertKitchenOrderWorkItemForStatusChange } = await import(
      "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
    );
    await expect(
      upsertKitchenOrderWorkItemForStatusChange({
        order: { _id: "o1", restaurantId: "r1" },
        item: { _id: "i1", prepStation: "kitchen" },
        nextStatus: "preparing",
        session: {},
      }),
    ).resolves.toBeTruthy();
  });

  describe("syncKitchenOrderWorkItemsForOrderStatusChange", () => {
    it("calls upsert for each valid transition", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );

      const now = new Date("2026-05-20T10:00:00.000Z");
      const order = { _id: "o1", restaurantId: "r1" };
      const itemTransitions = [
        {
          item: { _id: "i1", prepStation: "kitchen" },
          previousStatus: "pending",
          nextStatus: "preparing",
        },
        {
          item: { _id: "i2", prepStation: "bar" },
          previousStatus: "preparing",
          nextStatus: "ready",
        },
      ];

      const result = await service.syncKitchenOrderWorkItemsForOrderStatusChange({
        order,
        itemTransitions,
        actorUserId: "u1",
        now,
        session: {},
      });

      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(
        modelMocks.KitchenOrderWorkItem.findOneAndUpdate,
      ).toHaveBeenNthCalledWith(
        1,
        { orderId: "o1", orderItemId: "i1" },
        expect.anything(),
        expect.anything(),
      );
      expect(
        modelMocks.KitchenOrderWorkItem.findOneAndUpdate,
      ).toHaveBeenNthCalledWith(
        2,
        { orderId: "o1", orderItemId: "i2" },
        expect.anything(),
        expect.anything(),
      );
      expect(result).toEqual({ syncedCount: 2 });
    });

    it("skips transition missing item or nextStatus and returns accurate syncedCount", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );

      const result = await service.syncKitchenOrderWorkItemsForOrderStatusChange({
        order: { _id: "o1", restaurantId: "r1" },
        itemTransitions: [
          { item: null, previousStatus: "pending", nextStatus: "preparing" },
          { item: { _id: "i1" }, previousStatus: "pending" },
          {
            item: { _id: "i2", prepStation: "kitchen" },
            previousStatus: "pending",
            nextStatus: "preparing",
          },
        ],
        session: {},
      });

      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ syncedCount: 1 });
    });

    it("returns zero when order missing or transitions empty", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );

      await expect(
        service.syncKitchenOrderWorkItemsForOrderStatusChange({
          order: null,
          itemTransitions: [
            {
              item: { _id: "i1", prepStation: "kitchen" },
              nextStatus: "served",
            },
          ],
        }),
      ).resolves.toEqual({ syncedCount: 0 });

      await expect(
        service.syncKitchenOrderWorkItemsForOrderStatusChange({
          order: { _id: "o1" },
          itemTransitions: [],
        }),
      ).resolves.toEqual({ syncedCount: 0 });
    });

    it("processes transitions sequentially", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      const callOrder = [];
      modelMocks.KitchenOrderWorkItem.findOneAndUpdate.mockImplementation(
        ({ orderItemId }) => {
          callOrder.push(`start-${orderItemId}`);
          return {
            session: vi.fn(async () => {
              await new Promise((resolve) =>
                setTimeout(resolve, orderItemId === "i1" ? 15 : 0),
              );
              callOrder.push(`end-${orderItemId}`);
              return { _id: `work-${orderItemId}` };
            }),
          };
        },
      );

      await service.syncKitchenOrderWorkItemsForOrderStatusChange({
        order: { _id: "o1", restaurantId: "r1" },
        itemTransitions: [
          {
            item: { _id: "i1", prepStation: "kitchen" },
            previousStatus: "pending",
            nextStatus: "preparing",
          },
          {
            item: { _id: "i2", prepStation: "bar" },
            previousStatus: "pending",
            nextStatus: "preparing",
          },
        ],
        session: {},
      });

      expect(callOrder).toEqual([
        "start-i1",
        "end-i1",
        "start-i2",
        "end-i2",
      ]);
    });
  });

  describe("upsertKitchenOrderWorkItemForKitchenEntry", () => {
    it("creates pending work item with kitchenEnteredAt and no prep/ready metrics", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      const now = new Date("2026-05-20T10:00:00.000Z");
      await service.upsertKitchenOrderWorkItemForKitchenEntry({
        order: {
          _id: "o1",
          restaurantId: "r1",
          orderCode: "ORD-1",
          createdAt: now,
        },
        item: {
          _id: "i1",
          name: "Cơm gà",
          quantity: 2,
          status: "pending",
          prepStation: "kitchen",
        },
        actorUserId: "u1",
        now,
        session: {},
      });

      const updateArg =
        modelMocks.KitchenOrderWorkItem.findOneAndUpdate.mock.calls[0][1];
      expect(updateArg.$set).toMatchObject({
        status: "pending",
        kitchenEnteredAt: now,
        lastStatusChangedAt: now,
        updatedBy: "u1",
      });
      expect(updateArg.$set).not.toHaveProperty("preparingAt");
      expect(updateArg.$set).not.toHaveProperty("readyAt");
      expect(updateArg.$set).not.toHaveProperty("actualPrepMinutes");
      expect(updateArg.$set).not.toHaveProperty("timeLevel");
    });

    it("attaches roster when active snapshot exists", async () => {
      modelMocks.KitchenShiftRosterSnapshot.find.mockReturnValue({
        sort: vi.fn(() => ({
          lean: vi.fn(async () => [
            {
              _id: "row-1",
              shiftId: "shift-1",
              employeeId: "chef-1",
              kitchenDutyRole: "head_chef",
              startTime: new Date("2026-05-20T08:00:00.000Z"),
            },
          ]),
        })),
      });
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      await service.upsertKitchenOrderWorkItemForKitchenEntry({
        order: { _id: "o1", restaurantId: "r1" },
        item: {
          _id: "i1",
          name: "Cơm gà",
          status: "pending",
          prepStation: "kitchen",
        },
        now: new Date("2026-05-20T10:00:00.000Z"),
        session: {},
      });
      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            noRoster: false,
            rosterSnapshotId: "row-1",
            shiftId: "shift-1",
          }),
        }),
        expect.anything(),
      );
    });

    it("marks noRoster when no active roster is found", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      await service.upsertKitchenOrderWorkItemForKitchenEntry({
        order: { _id: "o1", restaurantId: "r1" },
        item: {
          _id: "i1",
          status: "pending",
          prepStation: "kitchen",
        },
        session: {},
      });
      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            noRoster: true,
            noRosterReason: expect.stringContaining("Không tìm thấy roster"),
          }),
        }),
        expect.anything(),
      );
    });

    it("does not overwrite existing kitchenEnteredAt", async () => {
      const existingAt = new Date("2026-05-20T09:00:00.000Z");
      modelMocks.KitchenOrderWorkItem.findOne.mockReturnValue({
        lean: vi.fn(() =>
          makeSessionChain({
            station: "kitchen",
            kitchenEnteredAt: existingAt,
            lastStatusChangedAt: existingAt,
          }),
        ),
      });
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      await service.upsertKitchenOrderWorkItemForKitchenEntry({
        order: {
          _id: "o1",
          restaurantId: "r1",
          createdAt: new Date("2026-05-20T08:00:00.000Z"),
        },
        item: { _id: "i1", status: "pending" },
        now: new Date("2026-05-20T10:00:00.000Z"),
        session: {},
      });
      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            kitchenEnteredAt: existingAt,
            lastStatusChangedAt: existingAt,
          }),
        }),
        expect.anything(),
      );
    });

    it("routes a bar item from its snapshot instead of its name", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      await service.upsertKitchenOrderWorkItemForKitchenEntry({
        order: { _id: "o1", restaurantId: "r1" },
        item: {
          _id: "i1",
          name: "Tên không có từ khóa đồ uống",
          status: "pending",
          prepStation: "bar",
        },
        session: {},
      });
      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $setOnInsert: expect.objectContaining({ station: "bar" }),
        }),
        expect.anything(),
      );
    });
  });

  describe("syncKitchenOrderWorkItemsForKitchenEntry", () => {
    it("syncs eligible items and returns syncedCount", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      const result = await service.syncKitchenOrderWorkItemsForKitchenEntry({
        order: {
          _id: "o1",
          restaurantId: "r1",
          items: [
            { _id: "i1", status: "pending", prepStation: "kitchen" },
            { _id: "i2", status: "preparing", prepStation: "bar" },
          ],
        },
        session: {},
      });
      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ syncedCount: 2 });
    });

    it("skips cancelled and returned items", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      const result = await service.syncKitchenOrderWorkItemsForKitchenEntry({
        order: {
          _id: "o1",
          restaurantId: "r1",
          items: [
            { _id: "i1", status: "cancelled" },
            { _id: "i2", status: "returned" },
            { _id: "i3", status: "pending", prepStation: "kitchen" },
          ],
        },
        session: {},
      });
      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ syncedCount: 1 });
    });

    it("returns zero when order missing or items invalid", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      await expect(
        service.syncKitchenOrderWorkItemsForKitchenEntry({ order: null }),
      ).resolves.toEqual({ syncedCount: 0 });
      await expect(
        service.syncKitchenOrderWorkItemsForKitchenEntry({
          order: { _id: "o1", items: null },
        }),
      ).resolves.toEqual({ syncedCount: 0 });
    });

    it("processes items sequentially", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      const callOrder = [];
      modelMocks.KitchenOrderWorkItem.findOneAndUpdate.mockImplementation(
        ({ orderItemId }) => {
          callOrder.push(`start-${orderItemId}`);
          return {
            session: vi.fn(async () => {
              await new Promise((resolve) =>
                setTimeout(resolve, orderItemId === "i1" ? 15 : 0),
              );
              callOrder.push(`end-${orderItemId}`);
              return { _id: `work-${orderItemId}` };
            }),
          };
        },
      );

      await service.syncKitchenOrderWorkItemsForKitchenEntry({
        order: {
          _id: "o1",
          restaurantId: "r1",
          items: [
            { _id: "i1", status: "pending", prepStation: "kitchen" },
            { _id: "i2", status: "pending", prepStation: "bar" },
          ],
        },
        session: {},
      });

      expect(callOrder).toEqual([
        "start-i1",
        "end-i1",
        "start-i2",
        "end-i2",
      ]);
    });
  });

  describe("syncKitchenOrderWorkItemForVoidOrReturn", () => {
    it("calls upsert for cancelled status", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );

      await service.syncKitchenOrderWorkItemForVoidOrReturn({
        order: { _id: "o1", restaurantId: "r1" },
        item: { _id: "i1", prepStation: "kitchen" },
        previousStatus: "served",
        nextStatus: "cancelled",
        actorUserId: "u1",
        now: new Date("2026-05-20T10:00:00.000Z"),
        session: {},
        issueType: "void",
        issueReason: "món cháy",
      });

      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(
        modelMocks.KitchenOrderWorkItem.findOneAndUpdate,
      ).toHaveBeenNthCalledWith(
        1,
        { orderId: "o1", orderItemId: "i1" },
        expect.objectContaining({
          $set: expect.objectContaining({ status: "cancelled" }),
        }),
        expect.anything(),
      );
      expect(
        modelMocks.KitchenOrderWorkItem.findOneAndUpdate,
      ).toHaveBeenNthCalledWith(
        2,
        { orderId: "o1", orderItemId: "i1" },
        expect.objectContaining({
          $set: expect.objectContaining({
            issueReasonCategory: "kitchen_quality",
            issueReasonKitchenRelated: true,
          }),
        }),
        expect.anything(),
      );
    });

    it("sync void with customer reason as non-kitchen", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      await service.syncKitchenOrderWorkItemForVoidOrReturn({
        order: { _id: "o1", restaurantId: "r1" },
        item: { _id: "i1", prepStation: "kitchen" },
        previousStatus: "served",
        nextStatus: "cancelled",
        issueType: "void",
        issueReason: "khách đổi ý",
        session: {},
      });
      const issueSet =
        modelMocks.KitchenOrderWorkItem.findOneAndUpdate.mock.calls[1][1].$set;
      expect(issueSet.issueReasonCategory).toBe("customer_request");
      expect(issueSet.issueReasonKitchenRelated).toBe(false);
    });

    it("calls upsert for returned status and kitchen reason", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );

      await service.syncKitchenOrderWorkItemForVoidOrReturn({
        order: { _id: "o1", restaurantId: "r1" },
        item: { _id: "i1", prepStation: "kitchen" },
        previousStatus: "served",
        nextStatus: "returned",
        actorUserId: "u1",
        now: new Date("2026-05-20T10:00:00.000Z"),
        session: {},
        issueType: "return",
        issueReason: "món nguội",
      });

      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).toHaveBeenCalledTimes(2);
      expect(
        modelMocks.KitchenOrderWorkItem.findOneAndUpdate,
      ).toHaveBeenNthCalledWith(
        1,
        { orderId: "o1", orderItemId: "i1" },
        expect.objectContaining({
          $set: expect.objectContaining({ status: "returned" }),
        }),
        expect.anything(),
      );
      const issueSet =
        modelMocks.KitchenOrderWorkItem.findOneAndUpdate.mock.calls[1][1].$set;
      expect(issueSet.issueReasonKitchenRelated).toBe(true);
    });

    it("returns null when missing order/item/nextStatus", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );

      await expect(
        service.syncKitchenOrderWorkItemForVoidOrReturn({
          order: null,
          item: { _id: "i1" },
          nextStatus: "cancelled",
        }),
      ).resolves.toBeNull();
      await expect(
        service.syncKitchenOrderWorkItemForVoidOrReturn({
          order: { _id: "o1" },
          item: null,
          nextStatus: "cancelled",
        }),
      ).resolves.toBeNull();
      await expect(
        service.syncKitchenOrderWorkItemForVoidOrReturn({
          order: { _id: "o1" },
          item: { _id: "i1" },
          nextStatus: null,
        }),
      ).resolves.toBeNull();

      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("returns null and skips upsert for unsupported status", async () => {
      const service = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );

      await expect(
        service.syncKitchenOrderWorkItemForVoidOrReturn({
          order: { _id: "o1", restaurantId: "r1" },
          item: { _id: "i1" },
          previousStatus: "served",
          nextStatus: "served",
          session: {},
        }),
      ).resolves.toBeNull();

      expect(modelMocks.KitchenOrderWorkItem.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("unaccepted helpers and marking", () => {
    it("resolveUnacceptedGraceMinutes returns 3 for bar and 5 for kitchen/default", async () => {
      const { resolveUnacceptedGraceMinutes } = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );

      expect(resolveUnacceptedGraceMinutes({ station: "bar" })).toBe(3);
      expect(resolveUnacceptedGraceMinutes({ station: "kitchen" })).toBe(5);
      expect(resolveUnacceptedGraceMinutes()).toBe(5);
    });

    it("resolveUnacceptedResponsibleEmployeeIds resolves by priority and de-duplicates", async () => {
      const { resolveUnacceptedResponsibleEmployeeIds } = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );

      expect(
        resolveUnacceptedResponsibleEmployeeIds({
          station: "kitchen",
          assistantChefIds: ["a1", "a1", null, "a2"],
          teamEmployeeIds: ["t1"],
          headChefId: "h1",
        }),
      ).toEqual(["a1", "a2"]);
      expect(
        resolveUnacceptedResponsibleEmployeeIds({
          station: "kitchen",
          teamEmployeeIds: ["t1", "t1", undefined],
        }),
      ).toEqual(["t1"]);
      expect(
        resolveUnacceptedResponsibleEmployeeIds({
          station: "kitchen",
          headChefId: "h1",
        }),
      ).toEqual(["h1"]);
      expect(
        resolveUnacceptedResponsibleEmployeeIds({
          station: "bar",
          barStaffIds: ["b1", "b1", null, "b2"],
          barLeadId: "l1",
        }),
      ).toEqual(["b1", "b2"]);
      expect(
        resolveUnacceptedResponsibleEmployeeIds({
          station: "bar",
          barLeadId: "l1",
          teamEmployeeIds: ["t1"],
        }),
      ).toEqual(["l1"]);
    });

    it("markUnacceptedKitchenOrderWorkItems marks overdue pending items and keeps status unchanged", async () => {
      const now = new Date("2026-05-20T10:00:00.000Z");
      modelMocks.KitchenOrderWorkItem.find.mockReturnValue({
        session: vi.fn(async () => [
          {
            _id: "w-k",
            station: "kitchen",
            status: "pending",
            kitchenEnteredAt: new Date("2026-05-20T09:54:00.000Z"),
            assistantChefIds: ["a1"],
          },
          {
            _id: "w-b",
            station: "bar",
            status: "pending",
            kitchenEnteredAt: new Date("2026-05-20T09:56:30.000Z"),
            barStaffIds: ["b1"],
          },
        ]),
      });
      const { markUnacceptedKitchenOrderWorkItems } = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );

      const result = await markUnacceptedKitchenOrderWorkItems({
        restaurantId: "r1",
        now,
        session: {},
      });
      expect(result).toEqual({ matchedCount: 2, modifiedCount: 2 });
      expect(modelMocks.KitchenOrderWorkItem.updateOne).toHaveBeenCalledTimes(2);
      expect(modelMocks.KitchenOrderWorkItem.updateOne).toHaveBeenNthCalledWith(
        1,
        { _id: "w-k", unaccepted: { $ne: true } },
        expect.objectContaining({
          $set: expect.objectContaining({
            unaccepted: true,
            unacceptedAfterMinutes: 5,
            unacceptedResponsibleEmployeeIds: ["a1"],
            unacceptedAt: now,
            updatedAt: now,
          }),
        }),
        { session: {} },
      );
      expect(modelMocks.KitchenOrderWorkItem.updateOne).toHaveBeenNthCalledWith(
        2,
        { _id: "w-b", unaccepted: { $ne: true } },
        expect.objectContaining({
          $set: expect.objectContaining({
            unaccepted: true,
            unacceptedAfterMinutes: 3,
            unacceptedResponsibleEmployeeIds: ["b1"],
          }),
        }),
        { session: {} },
      );
      const firstSet =
        modelMocks.KitchenOrderWorkItem.updateOne.mock.calls[0][1].$set;
      expect(firstSet).not.toHaveProperty("status");
    });

    it("does not mark pending items under threshold and skips non-modifying cases", async () => {
      const now = new Date("2026-05-20T10:00:00.000Z");
      modelMocks.KitchenOrderWorkItem.find.mockReturnValue({
        session: vi.fn(async () => [
          {
            _id: "w-1",
            station: "kitchen",
            status: "pending",
            kitchenEnteredAt: new Date("2026-05-20T09:56:00.000Z"),
          },
          {
            _id: "w-2",
            station: "bar",
            status: "pending",
            kitchenEnteredAt: new Date("2026-05-20T09:58:00.000Z"),
          },
        ]),
      });
      const { markUnacceptedKitchenOrderWorkItems } = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );

      const result = await markUnacceptedKitchenOrderWorkItems({
        restaurantId: "r1",
        now,
        session: {},
      });
      expect(result).toEqual({ matchedCount: 0, modifiedCount: 0 });
      expect(modelMocks.KitchenOrderWorkItem.updateOne).not.toHaveBeenCalled();
    });

    it("uses provided graceMinutes and builds threshold query", async () => {
      const now = new Date("2026-05-20T10:00:00.000Z");
      modelMocks.KitchenOrderWorkItem.find.mockReturnValue({
        session: vi.fn(async () => [
          {
            _id: "w-1",
            station: "kitchen",
            status: "pending",
            kitchenEnteredAt: new Date("2026-05-20T09:50:00.000Z"),
            headChefId: "h1",
          },
        ]),
      });
      const { markUnacceptedKitchenOrderWorkItems } = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      await markUnacceptedKitchenOrderWorkItems({
        restaurantId: "r1",
        now,
        graceMinutes: 7,
        session: {},
      });

      expect(modelMocks.KitchenOrderWorkItem.find).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "r1",
          status: "pending",
          unaccepted: { $ne: true },
          kitchenEnteredAt: expect.objectContaining({
            $exists: true,
            $lte: new Date("2026-05-20T09:53:00.000Z"),
          }),
        }),
      );
      expect(modelMocks.KitchenOrderWorkItem.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            unacceptedAfterMinutes: 7,
            unacceptedResponsibleEmployeeIds: ["h1"],
          }),
        }),
        expect.anything(),
      );
    });

    it("returns zero when restaurantId missing", async () => {
      const { markUnacceptedKitchenOrderWorkItems } = await import(
        "../../src/services/kitchen/kitchenOrderWorkItem.service.js"
      );
      await expect(
        markUnacceptedKitchenOrderWorkItems({
          now: new Date(),
          session: {},
        }),
      ).resolves.toEqual({
        matchedCount: 0,
        modifiedCount: 0,
      });
      expect(modelMocks.KitchenOrderWorkItem.find).not.toHaveBeenCalled();
    });
  });
});
