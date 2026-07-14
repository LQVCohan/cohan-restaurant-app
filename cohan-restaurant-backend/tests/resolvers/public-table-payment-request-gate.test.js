import { beforeEach, describe, expect, it, vi } from "vitest";

const eventMocks = vi.hoisted(() => ({
  emitRestaurantEvent: vi.fn(),
}));

const transactionMocks = vi.hoisted(() => ({
  startTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  abortTransaction: vi.fn(),
  endSession: vi.fn(),
  startSession: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  EventLog: { log: vi.fn() },
  Order: {
    findOne: vi.fn(),
    find: vi.fn(),
    updateMany: vi.fn(),
    updateOne: vi.fn(),
  },
  Table: { findOne: vi.fn() },
}));

vi.mock("mongoose", () => {
  function ObjectId(value) {
    this.value = String(value);
    this.toString = () => this.value;
  }

  return {
    default: {
      isValidObjectId: vi.fn((value) => Boolean(value)),
      Types: { ObjectId },
    },
    startSession: transactionMocks.startSession,
  };
});

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => eventMocks);
vi.mock("../../utils/orderLifecycle.js", () => ({
  ACTIVE_TABLE_SESSION_SORT: { openedAt: -1 },
  INACTIVE_ORDER_STATUSES: ["completed", "cancelled", "failed"],
  ORDER_KIND: { TABLE_SESSION: "table_session" },
  ORDER_PAYMENT_STATUS: { PAYMENT_REQUESTED: "payment_requested" },
  SESSION_STATUS: { READY_TO_PAY: "ready_to_pay" },
  activeTableSessionLookupFilter: vi.fn(() => ({ active: true })),
  childOrdersForSessionFilter: vi.fn(() => ({ child: true })),
}));
vi.mock("../../utils/publicTableSession.js", () => ({
  TABLE_ACCESS_TOKEN_ERROR: "Invalid table access token",
  buildPublicRequestTablePaymentResult: vi.fn((value) => value),
  normalizePublicTableCode: vi.fn((value) =>
    value == null ? null : String(value).trim().toUpperCase(),
  ),
  verifyTableAccessToken: vi.fn(() => ({
    restaurantId: "restaurant-1",
    tableId: "table-1",
    tableCode: "T1",
  })),
}));

const tableChain = (value) => ({
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

const findOneChain = (value) => ({
  sort: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

const findManyChain = (value) => ({
  sort: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

const input = {
  restaurantId: "restaurant-1",
  tableId: "table-1",
  tableCode: "T1",
  token: "token-1",
};

const activeSession = {
  _id: "session-1",
  currentStatus: "served",
  customerRequests: [],
  payment: { status: "pending" },
};

function servedOrder(overrides = {}) {
  return {
    _id: "order-1",
    orderCode: "ORD-001",
    currentStatus: "served",
    payment: { status: "pending" },
    items: [
      {
        status: "served",
        voidRequests: [],
        returnRequests: [],
      },
    ],
    ...overrides,
  };
}

describe("public table payment request readiness gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    transactionMocks.startSession.mockResolvedValue({
      startTransaction: transactionMocks.startTransaction,
      commitTransaction: transactionMocks.commitTransaction.mockResolvedValue(undefined),
      abortTransaction: transactionMocks.abortTransaction.mockResolvedValue(undefined),
      endSession: transactionMocks.endSession,
    });

    modelMocks.Table.findOne.mockReturnValue(
      tableChain({
        _id: "table-1",
        code: "T1",
        tableAccessToken: "token-1",
      }),
    );
    modelMocks.Order.findOne.mockReturnValue(findOneChain(activeSession));
    modelMocks.Order.updateMany.mockResolvedValue({ acknowledged: true });
    modelMocks.Order.updateOne.mockResolvedValue({ matchedCount: 1 });
    modelMocks.EventLog.log.mockResolvedValue(true);
    eventMocks.emitRestaurantEvent.mockResolvedValue(undefined);
  });

  it("does not update state or emit an event while any order is unfinished", async () => {
    modelMocks.Order.find.mockReturnValue(
      findManyChain([
        servedOrder({
          orderCode: "ORD-PREPARING",
          currentStatus: "preparing",
          items: [
            {
              status: "preparing",
              voidRequests: [],
              returnRequests: [],
            },
          ],
        }),
      ]),
    );

    const { publicRequestTablePayment } = await import(
      "../../graphql/resolvers/payment/publicTablePaymentMutation.js"
    );
    const result = await publicRequestTablePayment(null, { input }, {});

    expect(result).toMatchObject({
      ok: false,
      warning: true,
      readyForPayment: false,
      pendingOrderCodes: ["ORD-PREPARING"],
      requestedAt: null,
    });
    expect(result.message).toContain("chưa phục vụ xong");
    expect(transactionMocks.startSession).not.toHaveBeenCalled();
    expect(modelMocks.Order.updateMany).not.toHaveBeenCalled();
    expect(modelMocks.Order.updateOne).not.toHaveBeenCalled();
    expect(modelMocks.EventLog.log).not.toHaveBeenCalled();
    expect(eventMocks.emitRestaurantEvent).not.toHaveBeenCalled();
  });

  it("does not emit a payment event while a void or return request is pending", async () => {
    modelMocks.Order.find.mockReturnValue(
      findManyChain([
        servedOrder({
          orderCode: "ORD-VOID",
          items: [
            {
              status: "served",
              voidRequests: [{ status: "pending" }],
              returnRequests: [],
            },
          ],
        }),
      ]),
    );

    const { publicRequestTablePayment } = await import(
      "../../graphql/resolvers/payment/publicTablePaymentMutation.js"
    );
    const result = await publicRequestTablePayment(null, { input }, {});

    expect(result.pendingOrderCodes).toEqual(["ORD-VOID"]);
    expect(result.ok).toBe(false);
    expect(transactionMocks.startSession).not.toHaveBeenCalled();
    expect(eventMocks.emitRestaurantEvent).not.toHaveBeenCalled();
  });

  it("marks the session ready and emits only after every order is served", async () => {
    modelMocks.Order.find.mockReturnValue(findManyChain([servedOrder()]));

    const { publicRequestTablePayment } = await import(
      "../../graphql/resolvers/payment/publicTablePaymentMutation.js"
    );
    const result = await publicRequestTablePayment(null, { input }, {});

    expect(result).toMatchObject({
      ok: true,
      warning: false,
      readyForPayment: true,
      pendingOrderCodes: [],
    });
    expect(transactionMocks.startSession).toHaveBeenCalledTimes(1);
    expect(modelMocks.Order.updateMany).toHaveBeenCalledTimes(1);
    expect(modelMocks.Order.updateOne).toHaveBeenCalledTimes(1);
    expect(transactionMocks.commitTransaction).toHaveBeenCalledTimes(1);
    expect(transactionMocks.abortTransaction).not.toHaveBeenCalled();
    expect(transactionMocks.endSession).toHaveBeenCalledTimes(1);
    expect(eventMocks.emitRestaurantEvent).toHaveBeenCalledWith(
      {},
      expect.anything(),
      "TABLE_PAYMENT_REQUESTED",
      expect.objectContaining({ tableCode: "T1", requestType: "PAYMENT_REQUEST" }),
    );
  });
});
