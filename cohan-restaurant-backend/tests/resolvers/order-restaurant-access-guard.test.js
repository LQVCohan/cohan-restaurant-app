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

const incomingReviewMocks = vi.hoisted(() => ({
  confirmIncomingOrder: vi.fn(),
  rejectIncomingOrder: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authorizationMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => eventMocks);
vi.mock("../../graphql/resolvers/order/confirmedOrderPrintMutation.js", () => ({
  ConfirmedOrderPrintMutation: incomingReviewMocks,
}));
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
    adjustOrderItemQuantity: vi.fn().mockResolvedValue({ ok: true }),
    requestOrderItemVoid: vi.fn().mockResolvedValue({ ok: true }),
    reviewOrderItemVoid: vi.fn().mockResolvedValue({ ok: true }),
    requestOrderItemReturn: vi.fn().mockResolvedValue({ ok: true }),
    reviewOrderItemReturn: vi.fn().mockResolvedValue({ ok: true }),
  };
}

describe("order mutation restaurant access guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
    authorizationMocks.requireRestaurantPermission.mockResolvedValue(undefined);
    eventMocks.emitOrderEvent.mockResolvedValue(undefined);
    incomingReviewMocks.confirmIncomingOrder.mockResolvedValue({
      order: { id: "valid-order-1", currentStatus: "confirmed" },
    });
    incomingReviewMocks.rejectIncomingOrder.mockResolvedValue({
      order: { id: "valid-order-1", currentStatus: "cancelled" },
    });
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

  it("routes confirmIncomingOrder through the scoped atomic review resolver", async () => {
    const mutation = buildMutation();
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);
    const args = {
      input: {
        id: "valid-order-1",
        restaurantId: "valid-restaurant-1",
      },
    };
    const ctx = { user: { id: "manager-1" } };

    const result = await guarded.confirmIncomingOrder(null, args, ctx);

    expect(result).toEqual({
      order: { id: "valid-order-1", currentStatus: "confirmed" },
    });
    expect(incomingReviewMocks.confirmIncomingOrder).toHaveBeenCalledWith(
      null,
      args,
      ctx,
      undefined,
    );
    expect(mutation.confirmIncomingOrder).not.toHaveBeenCalled();
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
  });

  it("routes rejectIncomingOrder through the same scoped review boundary", async () => {
    const mutation = buildMutation();
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);
    const args = {
      input: {
        id: "valid-order-1",
        restaurantId: "valid-restaurant-1",
        reason: "Món đã hết",
      },
    };
    const ctx = { user: { id: "cashier-1" } };

    const result = await guarded.rejectIncomingOrder(null, args, ctx);

    expect(result).toEqual({
      order: { id: "valid-order-1", currentStatus: "cancelled" },
    });
    expect(incomingReviewMocks.rejectIncomingOrder).toHaveBeenCalledWith(
      null,
      args,
      ctx,
      undefined,
    );
    expect(mutation.rejectIncomingOrder).not.toHaveBeenCalled();
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

  it("requires order.update on the persisted restaurant before quantity adjustment", async () => {
    modelMocks.Order.findById.mockReturnValue(
      leanResult({ _id: "valid-order-1", restaurantId: "valid-restaurant-1" }),
    );
    const mutation = buildMutation();
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);
    const ctx = { user: { id: "server-1" } };

    await guarded.adjustOrderItemQuantity(
      null,
      { input: { orderId: "valid-order-1", orderItemId: "valid-item-1", quantity: 2 } },
      ctx,
    );

    expect(authorizationMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      ctx,
      "valid-restaurant-1",
      "order.update",
    );
    expect(mutation.adjustOrderItemQuantity).toHaveBeenCalled();
  });

  it("blocks a void request when persisted-order permission is denied", async () => {
    modelMocks.Order.findById.mockReturnValue(
      leanResult({ _id: "valid-order-1", restaurantId: "valid-restaurant-1" }),
    );
    authorizationMocks.requireRestaurantPermission.mockRejectedValue(
      new Error("FORBIDDEN"),
    );
    const mutation = buildMutation();
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);

    await expect(
      guarded.requestOrderItemVoid(
        null,
        { input: { orderId: "valid-order-1", orderItemId: "valid-item-1" } },
        { user: { id: "foreign-staff" } },
      ),
    ).rejects.toThrow("FORBIDDEN");

    expect(mutation.requestOrderItemVoid).not.toHaveBeenCalled();
  });

  it("requires order.cancel before reviewing a void request", async () => {
    modelMocks.Order.findById.mockReturnValue(
      leanResult({ _id: "valid-order-1", restaurantId: "valid-restaurant-1" }),
    );
    const mutation = buildMutation();
    const { withOrderRestaurantAccessGuards } = await import(
      "../../graphql/resolvers/order/accessGuard.js"
    );
    const guarded = withOrderRestaurantAccessGuards(mutation);
    const ctx = { user: { id: "supervisor-1" } };

    await guarded.reviewOrderItemVoid(
      null,
      { input: { orderId: "valid-order-1", orderItemId: "valid-item-1" } },
      ctx,
    );

    expect(authorizationMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      ctx,
      "valid-restaurant-1",
      "order.cancel",
    );
    expect(mutation.reviewOrderItemVoid).toHaveBeenCalled();
  });
});
