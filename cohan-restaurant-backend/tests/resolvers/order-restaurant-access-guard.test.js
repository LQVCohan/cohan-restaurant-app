import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: {
    findById: vi.fn(),
    countDocuments: vi.fn(),
    findOne: vi.fn(),
  },
  KitchenOrderWorkItem: {
    find: vi.fn(),
  },
  PrintSetting: {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

const authorizationMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  emitOrderEvent: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authorizationMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => eventMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => String(value || "").startsWith("valid-")),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
        this.toString = () => String(value);
      },
    },
  },
}));

function leanResult(value) {
  return {
    lean: vi.fn().mockResolvedValue(value),
  };
}

function buildMutation() {
  return {
    createOffPremiseOrder: vi.fn().mockResolvedValue({ ok: true }),
    createOrderForTable: vi.fn().mockResolvedValue({ ok: true }),
    createStaffRemoteOrder: vi.fn().mockResolvedValue({ ok: true }),
    confirmIncomingOrder: vi.fn().mockResolvedValue({ legacy: true }),
    updateOrderStatus: vi.fn().mockResolvedValue({ ok: true }),
    rejectIncomingOrder: vi.fn().mockResolvedValue({ ok: true }),
    createTemporaryBillPrintJob: vi.fn().mockResolvedValue({ ok: true }),
    requestPaymentForOrder: vi.fn().mockResolvedValue({ ok: true }),
    requestPaymentForTable: vi.fn().mockResolvedValue({ ok: true }),
    remindOrderItem: vi.fn().mockResolvedValue({ ok: true }),
  };
}

describe("order mutation restaurant access guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
    authorizationMocks.requireRestaurantPermission.mockResolvedValue(undefined);
    eventMocks.emitOrderEvent.mockResolvedValue(undefined);
  });

  it("requires restaurant access before createOffPremiseOrder", async () => {
    const mutation = buildMutation();
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);

    await guarded.createOffPremiseOrder(
      null,
      { input: { restaurantId: "valid-restaurant-1" } },
      { user: { id: "manager-1" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ value: "valid-restaurant-1" }),
    );
    expect(mutation.createOffPremiseOrder).toHaveBeenCalled();
  });

  it("does not call wrapped mutation when restaurant access is denied", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const mutation = buildMutation();
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);

    await expect(
      guarded.createOffPremiseOrder(
        null,
        { input: { restaurantId: "valid-restaurant-2" } },
        { user: { id: "manager-1" } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");

    expect(mutation.createOffPremiseOrder).not.toHaveBeenCalled();
  });

  it("routes confirmIncomingOrder through the station-aware resolver, not the legacy method", async () => {
    const scopedOrder = {
      _id: "valid-order-1",
      restaurantId: "valid-restaurant-1",
    };
    const pendingOrder = {
      ...scopedOrder,
      currentStatus: "pending",
    };
    const confirmedOrder = {
      ...scopedOrder,
      currentStatus: "confirmed",
      orderCode: "ORD-1",
      items: [],
    };

    modelMocks.Order.findById
      .mockReturnValueOnce(leanResult(scopedOrder))
      .mockReturnValueOnce(pendingOrder);
    modelMocks.PrintSetting.findOne.mockReturnValue(leanResult(null));

    const mutation = buildMutation();
    mutation.updateOrderStatus.mockResolvedValue(confirmedOrder);
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);

    const result = await guarded.confirmIncomingOrder(
      null,
      {
        input: {
          id: "valid-order-1",
          restaurantId: "valid-restaurant-1",
        },
      },
      { user: { id: "manager-1" } },
    );

    expect(result).toEqual({ order: confirmedOrder });
    expect(mutation.confirmIncomingOrder).not.toHaveBeenCalled();
    expect(mutation.updateOrderStatus).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        input: expect.objectContaining({
          id: "valid-order-1",
          restaurantId: "valid-restaurant-1",
          status: "confirmed",
        }),
      }),
      expect.anything(),
    );
  });

  it("checks scoped order before creating a temporary bill print job", async () => {
    modelMocks.Order.findById.mockReturnValue(
      leanResult({ _id: "valid-order-1", restaurantId: "valid-restaurant-1" }),
    );
    const mutation = buildMutation();
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);

    await guarded.createTemporaryBillPrintJob(
      null,
      { input: { orderId: "valid-order-1", restaurantId: "valid-restaurant-1" } },
      { user: { id: "cashier-1" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(mutation.createTemporaryBillPrintJob).toHaveBeenCalled();
  });

  it("blocks requestPaymentForOrder when an order is outside the requested restaurant", async () => {
    modelMocks.Order.countDocuments.mockResolvedValue(1);
    const mutation = buildMutation();
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);

    await expect(
      guarded.requestPaymentForOrder(
        null,
        {
          input: {
            restaurantId: "valid-restaurant-1",
            orderIds: ["valid-order-1", "valid-order-2"],
          },
        },
        { user: { id: "cashier-1" } },
      ),
    ).rejects.toThrow("Order not found");

    expect(mutation.requestPaymentForOrder).not.toHaveBeenCalled();
  });

  it("allows requestPaymentForOrder when orderIds contain duplicates of valid scoped orders", async () => {
    modelMocks.Order.countDocuments.mockResolvedValue(1);
    const mutation = buildMutation();
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);

    await guarded.requestPaymentForOrder(
      null,
      {
        input: {
          restaurantId: "valid-restaurant-1",
          orderIds: ["valid-order-1", "valid-order-1"],
        },
      },
      { user: { id: "cashier-1" } },
    );

    expect(modelMocks.Order.countDocuments).toHaveBeenCalledTimes(1);
    expect(mutation.requestPaymentForOrder).toHaveBeenCalled();
  });

  it("checks order item ownership before sending a reminder", async () => {
    modelMocks.Order.findOne.mockReturnValue(leanResult({ _id: "valid-order-1" }));
    const mutation = buildMutation();
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);

    await guarded.remindOrderItem(
      null,
      {
        input: {
          restaurantId: "valid-restaurant-1",
          orderId: "valid-order-1",
          orderItemId: "valid-item-1",
        },
      },
      { user: { id: "staff-1" } },
    );

    expect(modelMocks.Order.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: expect.objectContaining({ value: "valid-restaurant-1" }),
        _id: expect.objectContaining({ value: "valid-order-1" }),
        "items._id": expect.objectContaining({ value: "valid-item-1" }),
      }),
    );
    expect(mutation.remindOrderItem).toHaveBeenCalled();
  });
});
