import { beforeEach, describe, expect, it, vi } from "vitest";

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn().mockResolvedValue(undefined),
}));

const queryChain = (value) => ({
  sort: vi.fn().mockResolvedValue(value),
});

const orderDocFactory = (overrides = {}) => ({
  _id: overrides._id || "valid-order-1",
  orderCode: overrides.orderCode || "ORD-001",
  orderKind: overrides.orderKind || "order_batch",
  currentStatus: overrides.currentStatus || "served",
  payment: overrides.payment || { status: "pending" },
  save: vi.fn().mockResolvedValue(true),
  ...overrides,
});

const modelMocks = vi.hoisted(() => ({
  Order: {
    findOne: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../models/index.js", () => modelMocks);
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

describe("requestTablePayment resolver", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
  });

  it("marks active parent session and child order batches as payment_requested", async () => {
    const session = orderDocFactory({
      _id: "valid-session-1",
      orderKind: "table_session",
      orderCode: "SESSION-001",
      payment: { status: "pending" },
    });
    const childA = orderDocFactory({ _id: "valid-child-1", orderCode: "ORD-101" });
    const childB = orderDocFactory({ _id: "valid-child-2", orderCode: "ORD-102" });

    modelMocks.Order.findOne.mockReturnValue(queryChain(session));
    modelMocks.Order.find.mockReturnValue(queryChain([childA, childB]));

    const { tablePaymentRequestMutations } = await import(
      "../../graphql/resolvers/order/tablePaymentRequest.js"
    );

    const result = await tablePaymentRequestMutations.requestTablePayment(
      null,
      {
        input: {
          restaurantId: "valid-restaurant-1",
          tableId: "valid-table-1",
          tableCode: "V101",
          source: "customer_table",
          requestedBy: "customer_session",
          note: "Khách yêu cầu thanh toán tại bàn",
        },
      },
      { user: { id: "valid-user-1" } },
    );

    expect(result.ok).toBe(true);
    expect(result.warning).toBe(false);
    expect(result.readyForPayment).toBe(true);
    expect(result.pendingOrderCodes).toEqual([]);
    expect(result.requestedAt).toBeTruthy();
    expect(session.payment.status).toBe("payment_requested");
    expect(session.orderPaymentStatus).toBe("payment_requested");
    expect(childA.payment.status).toBe("payment_requested");
    expect(childB.payment.status).toBe("payment_requested");
    expect(session.save).toHaveBeenCalled();
    expect(childA.save).toHaveBeenCalled();
    expect(childB.save).toHaveBeenCalled();
  });

  it("returns warning and pending order codes when one child is not ready, but still marks the request", async () => {
    const session = orderDocFactory({
      _id: "valid-session-2",
      orderKind: "table_session",
      orderCode: "SESSION-002",
    });
    const childReady = orderDocFactory({ _id: "valid-child-3", orderCode: "ORD-201" });
    const childPreparing = orderDocFactory({
      _id: "valid-child-4",
      orderCode: "ORD-202",
      currentStatus: "preparing",
    });

    modelMocks.Order.findOne.mockReturnValue(queryChain(session));
    modelMocks.Order.find.mockReturnValue(queryChain([childReady, childPreparing]));

    const { tablePaymentRequestMutations } = await import(
      "../../graphql/resolvers/order/tablePaymentRequest.js"
    );

    const result = await tablePaymentRequestMutations.requestTablePayment(
      null,
      {
        input: {
          restaurantId: "valid-restaurant-1",
          tableId: "valid-table-2",
        },
      },
      { user: { id: "valid-user-2" } },
    );

    expect(result.ok).toBe(true);
    expect(result.warning).toBe(true);
    expect(result.readyForPayment).toBe(false);
    expect(result.pendingOrderCodes).toEqual(["ORD-202"]);
    expect(session.payment.status).toBe("payment_requested");
    expect(childReady.payment.status).toBe("payment_requested");
    expect(childPreparing.payment.status).toBe("payment_requested");
  });

  it("throws a friendly error when no active table session exists", async () => {
    modelMocks.Order.findOne.mockReturnValue(queryChain(null));

    const { tablePaymentRequestMutations } = await import(
      "../../graphql/resolvers/order/tablePaymentRequest.js"
    );

    await expect(
      tablePaymentRequestMutations.requestTablePayment(
        null,
        {
          input: {
            restaurantId: "valid-restaurant-1",
            tableId: "valid-table-3",
          },
        },
        { user: { id: "valid-user-3" } },
      ),
    ).rejects.toThrow("Không tìm thấy phiên bàn đang hoạt động.");
  });

  it("throws a friendly error when the active session has no active child order batches", async () => {
    const session = orderDocFactory({
      _id: "valid-session-3",
      orderKind: "table_session",
      orderCode: "SESSION-003",
    });
    modelMocks.Order.findOne.mockReturnValue(queryChain(session));
    modelMocks.Order.find.mockReturnValue(queryChain([]));

    const { tablePaymentRequestMutations } = await import(
      "../../graphql/resolvers/order/tablePaymentRequest.js"
    );

    await expect(
      tablePaymentRequestMutations.requestTablePayment(
        null,
        {
          input: {
            restaurantId: "valid-restaurant-1",
            tableId: "valid-table-4",
          },
        },
        { user: { id: "valid-user-4" } },
      ),
    ).rejects.toThrow("Bàn chưa có món nào để yêu cầu thanh toán.");
  });

  it("does not update paid or inactive child orders when they appear defensively in the result set", async () => {
    const session = orderDocFactory({
      _id: "valid-session-4",
      orderKind: "table_session",
      orderCode: "SESSION-004",
    });
    const activeChild = orderDocFactory({ _id: "valid-child-5", orderCode: "ORD-301" });
    const paidChild = orderDocFactory({
      _id: "valid-child-6",
      orderCode: "ORD-302",
      payment: { status: "paid" },
    });
    const completedChild = orderDocFactory({
      _id: "valid-child-7",
      orderCode: "ORD-303",
      currentStatus: "completed",
    });

    modelMocks.Order.findOne.mockReturnValue(queryChain(session));
    modelMocks.Order.find.mockReturnValue(
      queryChain([activeChild, paidChild, completedChild]),
    );

    const { tablePaymentRequestMutations } = await import(
      "../../graphql/resolvers/order/tablePaymentRequest.js"
    );

    const result = await tablePaymentRequestMutations.requestTablePayment(
      null,
      {
        input: {
          restaurantId: "valid-restaurant-1",
          tableId: "valid-table-5",
        },
      },
      { user: { id: "valid-user-5" } },
    );

    expect(result.ok).toBe(true);
    expect(activeChild.payment.status).toBe("payment_requested");
    expect(activeChild.save).toHaveBeenCalled();
    expect(paidChild.payment.status).toBe("paid");
    expect(paidChild.save).not.toHaveBeenCalled();
    expect(completedChild.payment.status).toBe("pending");
    expect(completedChild.save).not.toHaveBeenCalled();
  });

  it("is idempotent when the table session and children are already payment_requested", async () => {
    const requestedAt = new Date("2026-05-10T09:00:00.000Z");
    const session = orderDocFactory({
      _id: "valid-session-5",
      orderKind: "table_session",
      orderCode: "SESSION-005",
      payment: { status: "payment_requested", requestedAt },
    });
    const child = orderDocFactory({
      _id: "valid-child-8",
      orderCode: "ORD-401",
      payment: { status: "payment_requested", requestedAt },
    });

    modelMocks.Order.findOne.mockReturnValue(queryChain(session));
    modelMocks.Order.find.mockReturnValue(queryChain([child]));

    const { tablePaymentRequestMutations } = await import(
      "../../graphql/resolvers/order/tablePaymentRequest.js"
    );

    const result = await tablePaymentRequestMutations.requestTablePayment(
      null,
      {
        input: {
          restaurantId: "valid-restaurant-1",
          tableId: "valid-table-6",
        },
      },
      { user: { id: "valid-user-6" } },
    );

    expect(result.ok).toBe(true);
    expect(result.warning).toBe(false);
    expect(result.readyForPayment).toBe(true);
    expect(result.pendingOrderCodes).toEqual([]);
    expect(result.requestedAt).toBe(requestedAt.toISOString());
    expect(session.payment.status).toBe("payment_requested");
    expect(child.payment.status).toBe("payment_requested");
  });

  it("clears only records currently marked as payment_requested", async () => {
    const session = orderDocFactory({
      _id: "valid-session-6",
      orderKind: "table_session",
      orderCode: "SESSION-006",
      payment: { status: "payment_requested" },
      orderPaymentStatus: "payment_requested",
    });
    const requestedChild = orderDocFactory({
      _id: "valid-child-9",
      orderCode: "ORD-501",
      payment: { status: "payment_requested" },
    });
    const paidChild = orderDocFactory({
      _id: "valid-child-10",
      orderCode: "ORD-502",
      payment: { status: "paid" },
    });

    modelMocks.Order.findOne.mockReturnValue(queryChain(session));
    modelMocks.Order.find.mockReturnValue(queryChain([requestedChild, paidChild]));

    const { tablePaymentRequestMutations } = await import(
      "../../graphql/resolvers/order/tablePaymentRequest.js"
    );

    const result = await tablePaymentRequestMutations.clearTablePaymentRequest(
      null,
      {
        input: {
          restaurantId: "valid-restaurant-1",
          tableId: "valid-table-7",
          reason: "Reset request",
        },
      },
      { user: { id: "valid-user-7" } },
    );

    expect(result.ok).toBe(true);
    expect(session.payment.status).toBe("pending");
    expect(session.orderPaymentStatus).toBe("unpaid");
    expect(requestedChild.payment.status).toBe("pending");
    expect(paidChild.payment.status).toBe("paid");
    expect(session.save).toHaveBeenCalled();
    expect(requestedChild.save).toHaveBeenCalled();
    expect(paidChild.save).not.toHaveBeenCalled();
  });
});
