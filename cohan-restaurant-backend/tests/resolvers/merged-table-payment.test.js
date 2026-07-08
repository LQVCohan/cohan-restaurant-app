import { beforeEach, describe, expect, it, vi } from "vitest";

const invoiceMocks = vi.hoisted(() => ({ updateOne: vi.fn() }));
const orderMocks = vi.hoisted(() => ({
  find: vi.fn(),
  updateMany: vi.fn(),
}));
const tableMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateMany: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({ logEvent: vi.fn() }));
const strictPaymentMocks = vi.hoisted(() => ({
  payOrdersByTableId: vi.fn(),
  payOrdersByOrderIds: vi.fn(),
}));
const basePaymentMocks = vi.hoisted(() => ({
  requestTablePayment: vi.fn(),
  clearTablePaymentRequest: vi.fn(),
}));
const startSessionMock = vi.hoisted(() => vi.fn());

vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: (value) => String(value || "").startsWith("valid-"),
    startSession: startSessionMock,
    Types: {
      ObjectId: vi.fn(function ObjectId(value) {
        return {
          value: String(value),
          toString: () => String(value),
        };
      }),
    },
  },
}));
vi.mock("../../models/index.js", () => ({
  Invoice: invoiceMocks,
  Order: orderMocks,
  Table: tableMocks,
}));
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/eventLog.service.js", () => eventMocks);
vi.mock("../../graphql/resolvers/payment/mutation.js", () => ({
  default: basePaymentMocks,
}));
vi.mock("../../graphql/resolvers/payment/strictOrderPaymentMutation.js", () => ({
  default: strictPaymentMocks,
}));
vi.mock("../../utils/orderLifecycle.js", () => ({
  ACTIVE_SESSION_STATUSES: ["dining", "ready_to_pay"],
  ORDER_KIND: {
    TABLE_SESSION: "table_session",
    ORDER_BATCH: "order_batch",
  },
  ORDER_PAYMENT_STATUS: {
    UNPAID: "unpaid",
    PAYMENT_REQUESTED: "payment_requested",
    PAID: "paid",
  },
  SESSION_STATUS: {
    DINING: "dining",
    READY_TO_PAY: "ready_to_pay",
    CLOSED: "closed",
  },
  orderBatchOrLegacyFilter: () => ({
    orderKind: { $in: ["order_batch", null] },
  }),
}));

function queryResult(value) {
  const chain = {
    select: vi.fn(),
    sort: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  chain.select.mockReturnValue(chain);
  chain.sort.mockReturnValue(chain);
  return chain;
}

describe("merged table payment lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue();
    eventMocks.logEvent.mockResolvedValue();
    invoiceMocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
    orderMocks.updateMany.mockResolvedValue({ modifiedCount: 2 });
    tableMocks.updateMany.mockResolvedValue({ modifiedCount: 3 });
    startSessionMock.mockResolvedValue({
      withTransaction: vi.fn(async (callback) => callback()),
      endSession: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("pays every source order and closes each parent session", async () => {
    tableMocks.findOne.mockReturnValue(
      queryResult({
        _id: "valid-merged",
        code: "A1+A2",
        restaurantId: "valid-r1",
        joinGroupId: "group-1",
        mergedFromTableIds: ["valid-a1", "valid-a2"],
      }),
    );
    orderMocks.find
      .mockReturnValueOnce(
        queryResult([
          {
            _id: "valid-order-a1",
            tableId: "valid-a1",
            parentOrderId: "valid-session-a1",
            currentStatus: "served",
          },
          {
            _id: "valid-order-a2",
            tableId: "valid-a2",
            parentOrderId: "valid-session-a2",
            currentStatus: "served",
          },
        ]),
      )
      .mockReturnValueOnce(queryResult([]));

    const invoice = {
      _id: "valid-invoice",
      tableCode: "A1",
      totals: { grandTotal: 250000 },
    };
    strictPaymentMocks.payOrdersByOrderIds.mockResolvedValue({
      warning: false,
      pendingOrderCodes: [],
      invoice,
      transaction: { _id: "valid-payment" },
      cashflow: { _id: "valid-cashflow" },
    });

    const mutation = (
      await import(
        "../../graphql/resolvers/payment/mergedTablePaymentMutation.js"
      )
    ).default;
    const result = await mutation.payOrdersByTableId(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          tableId: "valid-merged",
          method: "cash",
          paidAmount: 250000,
        },
      },
      { user: { id: "valid-staff" }, req: { headers: {} } },
    );

    expect(strictPaymentMocks.payOrdersByOrderIds).toHaveBeenCalledWith(
      null,
      {
        input: expect.objectContaining({
          restaurantId: "valid-r1",
          tableId: undefined,
          orderIds: ["valid-order-a1", "valid-order-a2"],
          method: "cash",
          paidAmount: 250000,
        }),
      },
      expect.any(Object),
      undefined,
    );
    expect(orderMocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $in: expect.arrayContaining([expect.any(Object)]) },
        orderKind: "table_session",
      }),
      {
        $set: expect.objectContaining({
          sessionStatus: "closed",
          orderPaymentStatus: "paid",
          activeSessionKey: null,
          currentStatus: "completed",
          "payment.status": "paid",
        }),
      },
    );
    expect(tableMocks.updateMany).toHaveBeenCalledWith(
      {
        _id: {
          $in: expect.arrayContaining([
            "valid-merged",
            "valid-a1",
            "valid-a2",
          ]),
        },
        restaurantId: expect.any(Object),
      },
      { $set: { status: "available" } },
    );
    expect(invoiceMocks.updateOne).toHaveBeenCalledWith(
      { _id: "valid-invoice", restaurantId: expect.any(Object) },
      {
        $set: {
          tableCode: "A1+A2",
          "meta.tableMerge": {
            mergedTableId: "valid-merged",
            mergedTableCode: "A1+A2",
            sourceTableIds: ["valid-a1", "valid-a2"],
          },
        },
      },
    );
    expect(result.invoice.tableCode).toBe("A1+A2");
  });
});
