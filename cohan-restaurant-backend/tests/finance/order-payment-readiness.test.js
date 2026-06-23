import { beforeEach, describe, expect, it, vi } from "vitest";

const restaurantId = "64b000000000000000000001";
const tableId = "64b000000000000000000002";
const servedOrderId = "64b000000000000000000003";
const pendingOrderId = "64b000000000000000000004";

const paymentMutationMock = vi.hoisted(() => ({
  payOrdersByTableId: vi.fn(),
  payOrdersByOrderIds: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  Table: { findById: vi.fn() },
  Order: { findOne: vi.fn(), find: vi.fn() },
}));

const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(async () => true),
}));

vi.mock("../../graphql/resolvers/payment/mutation.js", () => ({ default: paymentMutationMock }));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);

function query(value) {
  return {
    sort: vi.fn().mockReturnThis(),
    lean: vi.fn(async () => value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function buildOrder(extra = {}) {
  return {
    _id: servedOrderId,
    restaurantId,
    tableId,
    orderCode: "ORD-SERVED",
    currentStatus: "served",
    items: [{ status: "served" }],
    ...extra,
  };
}

describe("order payment readiness guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Table.findById.mockReturnValue(query({ _id: tableId, restaurantId, code: "T01" }));
    modelMocks.Order.findOne.mockReturnValue(query(null));
    paymentMutationMock.payOrdersByTableId.mockResolvedValue({ warning: false });
    paymentMutationMock.payOrdersByOrderIds.mockResolvedValue({ warning: false });
  });

  it("rejects table checkout when any order is not ready", async () => {
    modelMocks.Order.find.mockReturnValueOnce(query([
      buildOrder(),
      buildOrder({
        _id: pendingOrderId,
        orderCode: "ORD-PENDING",
        currentStatus: "preparing",
        items: [{ status: "preparing" }],
      }),
    ]));

    const mutation = (await import("../../graphql/resolvers/payment/strictOrderPaymentMutation.js")).default;

    await expect(mutation.payOrdersByTableId(null, {
      input: { restaurantId, tableId, method: "cash", includeUnserved: true },
    }, {})).rejects.toThrow("Không thể thanh toán khi còn món chưa phục vụ xong");

    expect(paymentMutationMock.payOrdersByTableId).not.toHaveBeenCalled();
  });

  it("forces includeUnserved to false when checkout is valid", async () => {
    modelMocks.Order.find.mockReturnValueOnce(query([buildOrder()]));
    const mutation = (await import("../../graphql/resolvers/payment/strictOrderPaymentMutation.js")).default;

    await mutation.payOrdersByTableId(null, {
      input: { restaurantId, tableId, method: "cash", includeUnserved: true },
    }, {});

    expect(paymentMutationMock.payOrdersByTableId).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ input: expect.objectContaining({ includeUnserved: false }) }),
      {},
      undefined,
    );
  });

  it("rejects selected-order checkout when a selected order is not ready", async () => {
    modelMocks.Order.find.mockReturnValueOnce(query([
      buildOrder(),
      buildOrder({
        _id: pendingOrderId,
        orderCode: "ORD-READY",
        currentStatus: "ready",
        items: [{ status: "ready" }],
      }),
    ]));

    const mutation = (await import("../../graphql/resolvers/payment/strictOrderPaymentMutation.js")).default;

    await expect(mutation.payOrdersByOrderIds(null, {
      input: { restaurantId, orderIds: [servedOrderId, pendingOrderId], method: "cash" },
    }, {})).rejects.toThrow("Không thể thanh toán khi còn món chưa phục vụ xong");

    expect(paymentMutationMock.payOrdersByOrderIds).not.toHaveBeenCalled();
  });
});
