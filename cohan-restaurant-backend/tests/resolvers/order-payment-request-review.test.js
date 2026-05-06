import { beforeEach, describe, expect, it, vi } from "vitest";

const emitOrderEventMock = vi.hoisted(() => vi.fn());

const orderDocFactory = (overrides = {}) => ({
  _id: "65f000000000000000000001",
  restaurantId: "65f000000000000000000099",
  currentStatus: "served",
  items: [{ status: "served", voidRequests: [], returnRequests: [] }],
  payment: { status: "pending" },
  statusTimeline: [],
  save: vi.fn().mockResolvedValue(true),
  ...overrides,
});

const modelMocks = vi.hoisted(() => ({
  Order: {
    find: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ acknowledged: true }),
  },
  Invoice: { create: vi.fn().mockResolvedValue([{ _id: "inv-1" }]) },
  PaymentTransaction: { create: vi.fn().mockResolvedValue([{ _id: "trx-1" }]) },
  Cashflow: { create: vi.fn().mockResolvedValue([{ _id: "cf-1" }]) },
  EventLog: { log: vi.fn().mockResolvedValue(true) },
  Table: { updateOne: vi.fn().mockResolvedValue(true) },
  Restaurant: {},
  PaymentSession: {},
}));

vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({ emitOrderEvent: emitOrderEventMock }));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../utils/generateInvoiceNumber.ts", () => ({ generateInvoiceNumber: vi.fn().mockResolvedValue("INV-001") }));
vi.mock("../../src/services/payment/paymentSession.service.js", () => ({ createReservationPayment: vi.fn() }));
vi.mock("mongoose", () => {
  const startSession = vi.fn(async () => ({
    startTransaction: vi.fn(),
    commitTransaction: vi.fn().mockResolvedValue(true),
    abortTransaction: vi.fn().mockResolvedValue(true),
    endSession: vi.fn(),
  }));
  return {
    default: {
      isValidObjectId: vi.fn(() => true),
      Types: { ObjectId: function ObjectId(v) { this.value = v; this.toString = () => String(v); } },
    },
    startSession,
  };
});

describe("payment request + confirm guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requestPaymentForOrder succeeds for fully served order", async () => {
    const { OrderMutation } = await import("../../graphql/resolvers/order/mutation.js");
    const order = orderDocFactory();
    modelMocks.Order.find.mockResolvedValue([order]);

    await OrderMutation.requestPaymentForOrder(
      null,
      { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000001"] } },
      { user: { _id: "65f000000000000000000777" } },
    );

    expect(order.payment.status).toBe("payment_requested");
    expect(order.payment.requestedAt).toBeTruthy();
    expect(order.payment.requestedBy).toBeTruthy();
    expect(order.statusTimeline.at(-1)?.note).toBe("Nhân viên yêu cầu thanh toán.");
    expect(order.save).toHaveBeenCalled();
    expect(emitOrderEventMock).toHaveBeenCalled();
  });

  it("requestPaymentForOrder blocks when unfinished item exists", async () => {
    const { OrderMutation } = await import("../../graphql/resolvers/order/mutation.js");
    const order = orderDocFactory({ items: [{ status: "preparing", voidRequests: [], returnRequests: [] }] });
    modelMocks.Order.find.mockResolvedValue([order]);

    await expect(
      OrderMutation.requestPaymentForOrder(null, { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000001"] } }, { user: { _id: "u1" } }),
    ).rejects.toThrow("Không thể yêu cầu thanh toán khi còn món chưa phục vụ xong.");
    expect(order.save).not.toHaveBeenCalled();
  });

  it("requestPaymentForOrder blocks when pending void/return exists", async () => {
    const { OrderMutation } = await import("../../graphql/resolvers/order/mutation.js");
    const order = orderDocFactory({ items: [{ status: "served", voidRequests: [{ status: "pending" }], returnRequests: [] }] });
    modelMocks.Order.find.mockResolvedValue([order]);

    await expect(
      OrderMutation.requestPaymentForOrder(null, { input: { restaurantId: "65f000000000000000000099", orderIds: ["65f000000000000000000001"] } }, { user: { _id: "u1" } }),
    ).rejects.toThrow("Không thể yêu cầu thanh toán khi còn yêu cầu hủy/trả món đang chờ duyệt.");
    expect(order.save).not.toHaveBeenCalled();
  });

});
