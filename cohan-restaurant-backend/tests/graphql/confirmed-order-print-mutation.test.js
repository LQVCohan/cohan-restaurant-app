import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  withTransaction: vi.fn(async (work) => work()),
  endSession: vi.fn(async () => {}),
}));
const mongooseMocks = vi.hoisted(() => ({
  startSession: vi.fn(async () => sessionMocks),
  isValidObjectId: vi.fn(() => true),
  Types: {
    ObjectId: class ObjectId {
      constructor(value) { this.value = String(value); }
      toString() { return this.value; }
    },
  },
}));
const modelMocks = vi.hoisted(() => ({
  Order: {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  KitchenOrderWorkItem: { find: vi.fn() },
  PrintSetting: { findOne: vi.fn(), updateOne: vi.fn() },
  Warehouse: { findOne: vi.fn() },
}));
const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));
const inventoryMocks = vi.hoisted(() => ({
  cancelReservationForOrderTx: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({
  emitOrderEvent: vi.fn(),
}));
const kitchenMocks = vi.hoisted(() => ({
  syncKitchenOrderWorkItemsForKitchenEntry: vi.fn(),
}));
const trackingMocks = vi.hoisted(() => ({
  emitCustomerTrackingUpdateIfChanged: vi.fn(),
  updatePublicStatusHistory: vi.fn((order) => {
    order.publicStatus = order.currentStatus === "cancelled" ? "CANCELLED" : "CONFIRMED";
  }),
}));

vi.mock("mongoose", () => ({ default: mongooseMocks }));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/inventory.service.js", () => inventoryMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => eventMocks);
vi.mock("../../src/services/kitchen/kitchenOrderWorkItem.service.js", () => kitchenMocks);
vi.mock("../../src/services/orderTracking.service.js", () => trackingMocks);

const restaurantId = "64b000000000000000000001";
const orderId = "64b000000000000000000002";
const kitchenItemId = "64b000000000000000000003";
const barItemId = "64b000000000000000000004";
const warehouseId = "64b000000000000000000007";
const staffId = "64b000000000000000000009";

function createOrderDocument(overrides = {}) {
  const document = {
    _id: orderId,
    restaurantId,
    orderCode: "ORD-1",
    tableCode: "T01",
    currentStatus: "customer_attached",
    kitchenStatus: "draft",
    sessionStatus: "dining",
    publicStatus: "ORDER_RECEIVED",
    statusTimeline: [],
    clientMeta: {},
    items: [
      {
        _id: kitchenItemId,
        dishId: "64b000000000000000000005",
        name: "Món bếp",
        quantity: 1,
        servingKey: "portion",
        servingVariant: { mode: "PORTION", name: "Tiêu chuẩn" },
        status: "pending",
      },
      {
        _id: barItemId,
        dishId: "64b000000000000000000006",
        name: "Món bar",
        quantity: 2,
        servingKey: "portion",
        servingVariant: { mode: "PORTION", name: "Tiêu chuẩn" },
        status: "pending",
      },
    ],
    save: vi.fn(async function save() { return this; }),
    toJSON: vi.fn(function toJSON() {
      return {
        id: String(this._id),
        restaurantId: String(this.restaurantId),
        orderCode: this.orderCode,
        tableCode: this.tableCode,
        currentStatus: this.currentStatus,
        kitchenStatus: this.kitchenStatus,
        sessionStatus: this.sessionStatus,
        items: this.items,
      };
    }),
    ...overrides,
  };
  return document;
}

function mockInitialPendingOrder() {
  modelMocks.Order.findById.mockResolvedValue({
    _id: orderId,
    restaurantId,
    currentStatus: "pending",
  });
}

function mockWorkItems(rows) {
  modelMocks.KitchenOrderWorkItem.find.mockReturnValue({
    select: vi.fn(() => ({ lean: vi.fn(async () => rows) })),
  });
}

function mockPrintSetting(overrides = {}) {
  modelMocks.PrintSetting.findOne.mockReturnValue({
    lean: vi.fn(async () => ({
      _id: "print-setting-1",
      printers: [
        { id: "printer-kitchen-a", name: "Bếp A", status: "configured" },
        { id: "printer-kitchen-b", name: "Bếp B", status: "configured" },
        { id: "printer-bar", name: "Quầy bar", status: "configured" },
      ],
      stations: {
        kitchen: ["printer-kitchen-a", "printer-kitchen-b"],
        bar: ["printer-bar"],
      },
      templates: [
        { key: "kitchen", enabled: true },
        { key: "bar", enabled: true },
      ],
      ...overrides,
    })),
  });
}

describe("ConfirmedOrderPrintMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMocks.withTransaction.mockImplementation(async (work) => work());
    sessionMocks.endSession.mockResolvedValue(undefined);
    mongooseMocks.startSession.mockResolvedValue(sessionMocks);
    authMocks.requireRestaurantPermission.mockResolvedValue(true);
    inventoryMocks.cancelReservationForOrderTx.mockResolvedValue(undefined);
    eventMocks.emitOrderEvent.mockResolvedValue(undefined);
    kitchenMocks.syncKitchenOrderWorkItemsForKitchenEntry.mockResolvedValue({ syncedCount: 2 });
    mockPrintSetting();
    modelMocks.PrintSetting.updateOne.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.Warehouse.findOne.mockReturnValue({
      sort: vi.fn(() => ({
        session: vi.fn(() => ({ lean: vi.fn(async () => ({ _id: warehouseId })) })),
      })),
      session: vi.fn(() => ({ lean: vi.fn(async () => ({ _id: warehouseId })) })),
    });
  });

  it("atomically claims, confirms, creates kitchen work and routes every assigned printer", async () => {
    mockInitialPendingOrder();
    const claimedOrder = createOrderDocument();
    modelMocks.Order.findOneAndUpdate.mockResolvedValue(claimedOrder);
    mockWorkItems([
      { orderItemId: kitchenItemId, station: "kitchen" },
      { orderItemId: barItemId, station: "bar" },
    ]);

    const { ConfirmedOrderPrintMutation } = await import(
      "../../graphql/resolvers/order/confirmedOrderPrintMutation.js"
    );
    const result = await ConfirmedOrderPrintMutation.confirmIncomingOrder(
      null,
      { input: { id: orderId, restaurantId } },
      { user: { id: staffId } },
    );

    expect(modelMocks.Order.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: expect.anything(), currentStatus: "pending" }),
      expect.objectContaining({
        $set: expect.objectContaining({
          currentStatus: "customer_attached",
          "clientMeta.acceptedBy": expect.anything(),
        }),
      }),
      { new: true, session: sessionMocks },
    );
    expect(claimedOrder.currentStatus).toBe("confirmed");
    expect(claimedOrder.kitchenStatus).toBe("confirmed");
    expect(claimedOrder.save).toHaveBeenCalledWith({ session: sessionMocks });
    expect(kitchenMocks.syncKitchenOrderWorkItemsForKitchenEntry).toHaveBeenCalledWith(
      expect.objectContaining({ order: claimedOrder, session: sessionMocks }),
    );
    expect(result.order.currentStatus).toBe("confirmed");

    const jobs = modelMocks.PrintSetting.updateOne.mock.calls[0][1].$push.jobs.$each;
    expect(jobs).toHaveLength(3);
    expect(jobs.map((job) => job.stationId).sort()).toEqual([
      "bar",
      "kitchen",
      "kitchen",
    ]);
    expect(jobs.map((job) => job.printerId).sort()).toEqual([
      "printer-bar",
      "printer-kitchen-a",
      "printer-kitchen-b",
    ]);
    expect(jobs.every((job) => job.items.length === 1)).toBe(true);
    expect(eventMocks.emitOrderEvent).toHaveBeenCalledWith(
      expect.anything(),
      restaurantId,
      "ORDER_STATUS_CHANGED",
      expect.objectContaining({
        meta: expect.objectContaining({ statusFrom: "pending", statusTo: "confirmed" }),
      }),
    );
  });

  it("does not enqueue a station whose template is disabled", async () => {
    mockPrintSetting({
      templates: [
        { key: "kitchen", enabled: false },
        { key: "bar", enabled: true },
      ],
    });
    mockInitialPendingOrder();
    const claimedOrder = createOrderDocument();
    modelMocks.Order.findOneAndUpdate.mockResolvedValue(claimedOrder);
    mockWorkItems([
      { orderItemId: kitchenItemId, station: "kitchen" },
      { orderItemId: barItemId, station: "bar" },
    ]);
    const { ConfirmedOrderPrintMutation } = await import(
      "../../graphql/resolvers/order/confirmedOrderPrintMutation.js"
    );

    await ConfirmedOrderPrintMutation.confirmIncomingOrder(
      null,
      { input: { id: orderId, restaurantId } },
      { user: { id: staffId } },
    );

    const jobs = modelMocks.PrintSetting.updateOne.mock.calls[0][1].$push.jobs.$each;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toEqual(expect.objectContaining({
      stationId: "bar",
      printerId: "printer-bar",
    }));
  });

  it("marks the ticket failed when an assigned printer is explicitly offline", async () => {
    mockPrintSetting({
      printers: [
        { id: "printer-kitchen-a", name: "Bếp A", status: "offline" },
        { id: "printer-bar", name: "Quầy bar", status: "configured" },
      ],
      stations: {
        kitchen: ["printer-kitchen-a"],
        bar: ["printer-bar"],
      },
    });
    mockInitialPendingOrder();
    const claimedOrder = createOrderDocument();
    modelMocks.Order.findOneAndUpdate.mockResolvedValue(claimedOrder);
    mockWorkItems([
      { orderItemId: kitchenItemId, station: "kitchen" },
      { orderItemId: barItemId, station: "bar" },
    ]);
    const { ConfirmedOrderPrintMutation } = await import(
      "../../graphql/resolvers/order/confirmedOrderPrintMutation.js"
    );

    await ConfirmedOrderPrintMutation.confirmIncomingOrder(
      null,
      { input: { id: orderId, restaurantId } },
      { user: { id: staffId } },
    );

    const jobs = modelMocks.PrintSetting.updateOne.mock.calls[0][1].$push.jobs.$each;
    expect(jobs.find((job) => job.printerId === "printer-kitchen-a")).toEqual(
      expect.objectContaining({ status: "failed", error: expect.any(String) }),
    );
  });

  it("rejects a second accept before kitchen work is created", async () => {
    mockInitialPendingOrder();
    modelMocks.Order.findOneAndUpdate.mockResolvedValue(null);
    const { ConfirmedOrderPrintMutation } = await import(
      "../../graphql/resolvers/order/confirmedOrderPrintMutation.js"
    );

    await expect(
      ConfirmedOrderPrintMutation.confirmIncomingOrder(
        null,
        { input: { id: orderId, restaurantId } },
        { user: { id: staffId } },
      ),
    ).rejects.toThrow("Đơn đã được nhân viên/POS khác tiếp nhận");

    expect(kitchenMocks.syncKitchenOrderWorkItemsForKitchenEntry).not.toHaveBeenCalled();
  });

  it("allows a POS cashier with payment.write to review incoming orders", async () => {
    mockInitialPendingOrder();
    const claimedOrder = createOrderDocument();
    modelMocks.Order.findOneAndUpdate.mockResolvedValue(claimedOrder);
    mockWorkItems([
      { orderItemId: kitchenItemId, station: "kitchen" },
      { orderItemId: barItemId, station: "bar" },
    ]);
    authMocks.requireRestaurantPermission
      .mockRejectedValueOnce(new Error("Missing order.update"))
      .mockResolvedValueOnce(true);

    const { ConfirmedOrderPrintMutation } = await import(
      "../../graphql/resolvers/order/confirmedOrderPrintMutation.js"
    );
    await ConfirmedOrderPrintMutation.confirmIncomingOrder(
      null,
      { input: { id: orderId, restaurantId } },
      { user: { id: staffId } },
    );

    expect(authMocks.requireRestaurantPermission).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      restaurantId,
      "order.update",
    );
    expect(authMocks.requireRestaurantPermission).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      restaurantId,
      "payment.write",
    );
  });

  it("atomically rejects a pending QR order and releases its inventory reservation", async () => {
    mockInitialPendingOrder();
    const claimedOrder = createOrderDocument();
    modelMocks.Order.findOneAndUpdate.mockResolvedValue(claimedOrder);

    const { ConfirmedOrderPrintMutation } = await import(
      "../../graphql/resolvers/order/confirmedOrderPrintMutation.js"
    );
    const result = await ConfirmedOrderPrintMutation.rejectIncomingOrder(
      null,
      {
        input: {
          id: orderId,
          restaurantId,
          reason: "Món vừa hết, vui lòng chọn món khác",
        },
      },
      { user: { id: staffId } },
    );

    expect(inventoryMocks.cancelReservationForOrderTx).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId,
        warehouseId,
        orderCode: "ORD-1",
        session: sessionMocks,
        lines: expect.arrayContaining([
          expect.objectContaining({
            menuItemId: "64b000000000000000000005",
            quantity: 1,
            servingKey: "portion",
          }),
        ]),
      }),
    );
    expect(claimedOrder.currentStatus).toBe("cancelled");
    expect(claimedOrder.kitchenStatus).toBe("cancelled");
    expect(result.order.currentStatus).toBe("cancelled");
    expect(eventMocks.emitOrderEvent).toHaveBeenCalledWith(
      expect.anything(),
      restaurantId,
      "ORDER_CANCELLED",
      claimedOrder,
    );
  });
});
