import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  },
  KitchenOrderWorkItem: { find: vi.fn() },
  PrintSetting: { findOne: vi.fn(), updateOne: vi.fn() },
}));
const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({
  emitOrderEvent: vi.fn(),
}));
const kitchenMocks = vi.hoisted(() => ({
  syncKitchenOrderWorkItemsForKitchenEntry: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => eventMocks);
vi.mock("../../src/services/kitchen/kitchenOrderWorkItem.service.js", () => kitchenMocks);

const restaurantId = "64b000000000000000000001";
const orderId = "64b000000000000000000002";
const kitchenItemId = "64b000000000000000000003";
const barItemId = "64b000000000000000000004";
const staffId = "64b000000000000000000009";

function mockWorkItems(rows) {
  modelMocks.KitchenOrderWorkItem.find.mockReturnValue({
    select: vi.fn(() => ({ lean: vi.fn(async () => rows) })),
  });
}

function mockOrderReads(confirmedOrder) {
  modelMocks.Order.findById
    .mockResolvedValueOnce({
      _id: orderId,
      restaurantId,
      currentStatus: "pending",
    })
    .mockResolvedValueOnce(confirmedOrder);
  modelMocks.Order.findOneAndUpdate.mockResolvedValue({
    _id: orderId,
    restaurantId,
    currentStatus: "pending",
    clientMeta: { acceptedBy: staffId },
  });
}

describe("ConfirmedOrderPrintMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue(true);
    eventMocks.emitOrderEvent.mockResolvedValue(undefined);
    kitchenMocks.syncKitchenOrderWorkItemsForKitchenEntry.mockResolvedValue({ syncedCount: 2 });
    modelMocks.Order.updateOne.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.PrintSetting.findOne.mockReturnValue({
      lean: vi.fn(async () => ({
        _id: "print-setting-1",
        stations: {
          kitchen: ["printer-kitchen"],
          bar: ["printer-bar"],
        },
      })),
    });
    modelMocks.PrintSetting.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("claims once, creates kitchen work and groups tickets by stored station", async () => {
    mockWorkItems([
      { orderItemId: kitchenItemId, station: "kitchen" },
      { orderItemId: barItemId, station: "bar" },
    ]);

    const updatedOrder = {
      _id: orderId,
      restaurantId,
      orderCode: "ORD-1",
      tableCode: "T01",
      currentStatus: "confirmed",
      items: [
        {
          _id: kitchenItemId,
          dishId: "64b000000000000000000005",
          name: "Món bếp",
          quantity: 1,
          status: "pending",
        },
        {
          _id: barItemId,
          dishId: "64b000000000000000000006",
          name: "Món bar",
          quantity: 2,
          status: "pending",
        },
      ],
    };
    mockOrderReads(updatedOrder);
    const updateOrderStatus = vi.fn(async () => updatedOrder);
    const { ConfirmedOrderPrintMutation } = await import(
      "../../graphql/resolvers/order/confirmedOrderPrintMutation.js"
    );

    const result = await ConfirmedOrderPrintMutation.confirmIncomingOrder.call(
      { updateOrderStatus },
      null,
      { input: { id: orderId, restaurantId } },
      { user: { id: staffId } },
    );

    expect(result).toEqual({ order: updatedOrder });
    expect(modelMocks.Order.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: orderId, currentStatus: "pending" }),
      expect.objectContaining({
        $set: expect.objectContaining({ "clientMeta.acceptedBy": expect.anything() }),
      }),
      { new: true },
    );
    expect(updateOrderStatus).toHaveBeenCalledOnce();
    expect(kitchenMocks.syncKitchenOrderWorkItemsForKitchenEntry).toHaveBeenCalledWith(
      expect.objectContaining({ order: updatedOrder }),
    );
    expect(modelMocks.PrintSetting.updateOne).toHaveBeenCalledOnce();

    const jobs =
      modelMocks.PrintSetting.updateOne.mock.calls[0][1].$push.jobs.$each;
    expect(jobs).toHaveLength(2);
    expect(jobs.map((job) => job.stationId).sort()).toEqual([
      "bar",
      "kitchen",
    ]);
    expect(
      jobs.find((job) => job.stationId === "bar").items[0].orderItemId,
    ).toBe(barItemId);
    expect(eventMocks.emitOrderEvent).toHaveBeenCalledWith(
      expect.anything(),
      restaurantId,
      "ORDER_PRINT_JOBS_CREATED",
      expect.objectContaining({ orderId, printJobs: jobs }),
    );
  });

  it("rejects a second staff/POS acceptance before status mutation", async () => {
    modelMocks.Order.findById.mockResolvedValue({
      _id: orderId,
      restaurantId,
      currentStatus: "pending",
    });
    modelMocks.Order.findOneAndUpdate.mockResolvedValue(null);
    const updateOrderStatus = vi.fn();
    const { ConfirmedOrderPrintMutation } = await import(
      "../../graphql/resolvers/order/confirmedOrderPrintMutation.js"
    );

    await expect(
      ConfirmedOrderPrintMutation.confirmIncomingOrder.call(
        { updateOrderStatus },
        null,
        { input: { id: orderId, restaurantId } },
        { user: { id: staffId } },
      ),
    ).rejects.toThrow("Đơn đã được nhân viên/POS khác tiếp nhận");

    expect(updateOrderStatus).not.toHaveBeenCalled();
    expect(kitchenMocks.syncKitchenOrderWorkItemsForKitchenEntry).not.toHaveBeenCalled();
  });

  it("fails instead of guessing when an active item has no station snapshot", async () => {
    mockWorkItems([]);
    const updatedOrder = {
      _id: orderId,
      restaurantId,
      currentStatus: "confirmed",
      items: [
        {
          _id: kitchenItemId,
          dishId: "64b000000000000000000005",
          name: "Không rõ quầy",
          quantity: 1,
          status: "pending",
        },
      ],
    };
    mockOrderReads(updatedOrder);
    const { ConfirmedOrderPrintMutation } = await import(
      "../../graphql/resolvers/order/confirmedOrderPrintMutation.js"
    );

    await expect(
      ConfirmedOrderPrintMutation.confirmIncomingOrder.call(
        { updateOrderStatus: vi.fn(async () => updatedOrder) },
        null,
        { input: { id: orderId, restaurantId } },
        { user: { id: staffId } },
      ),
    ).rejects.toThrow("missing a valid preparation-station snapshot");

    expect(kitchenMocks.syncKitchenOrderWorkItemsForKitchenEntry).toHaveBeenCalledOnce();
    expect(modelMocks.PrintSetting.updateOne).not.toHaveBeenCalled();
  });
});
