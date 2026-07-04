import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: { findById: vi.fn() },
  KitchenOrderWorkItem: { find: vi.fn() },
  PrintSetting: { findOne: vi.fn(), updateOne: vi.fn() },
}));
const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({
  emitOrderEvent: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => eventMocks);

const restaurantId = "64b000000000000000000001";
const orderId = "64b000000000000000000002";
const kitchenItemId = "64b000000000000000000003";
const barItemId = "64b000000000000000000004";

function mockWorkItems(rows) {
  modelMocks.KitchenOrderWorkItem.find.mockReturnValue({
    select: vi.fn(() => ({ lean: vi.fn(async () => rows) })),
  });
}

describe("ConfirmedOrderPrintMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue(true);
    eventMocks.emitOrderEvent.mockResolvedValue(undefined);
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
    modelMocks.Order.findById.mockResolvedValue({
      _id: orderId,
      restaurantId,
      currentStatus: "pending",
    });
  });

  it("groups confirmed tickets by the stored kitchen work-item station", async () => {
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
    const updateOrderStatus = vi.fn(async () => updatedOrder);
    const { ConfirmedOrderPrintMutation } = await import(
      "../../graphql/resolvers/order/confirmedOrderPrintMutation.js"
    );

    const result = await ConfirmedOrderPrintMutation.confirmIncomingOrder.call(
      { updateOrderStatus },
      null,
      { input: { id: orderId, restaurantId } },
      { user: { id: "user-1" } },
    );

    expect(result).toEqual({ order: updatedOrder });
    expect(updateOrderStatus).toHaveBeenCalledOnce();
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
    const { ConfirmedOrderPrintMutation } = await import(
      "../../graphql/resolvers/order/confirmedOrderPrintMutation.js"
    );

    await expect(
      ConfirmedOrderPrintMutation.confirmIncomingOrder.call(
        { updateOrderStatus: vi.fn(async () => updatedOrder) },
        null,
        { input: { id: orderId, restaurantId } },
        {},
      ),
    ).rejects.toThrow("missing a valid preparation-station snapshot");

    expect(modelMocks.PrintSetting.updateOne).not.toHaveBeenCalled();
  });
});
