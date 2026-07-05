import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.fn();
const findByIdMock = vi.fn();

const modelMocks = vi.hoisted(() => ({
  Order: {
    findById: (...args) => findByIdMock(...args),
  },
  KitchenOrderWorkItem: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  Reservation: {}, TableCustomer: {}, Warehouse: {}, Recipe: {}, Ingredient: {}, ModifierGroup: {}, CheckoutSession: {}, Coupon: {}, Customer: {}, User: {}, WalletTransaction: {}, PrintSetting: {},
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/resolvers/order/helper/orderUtils.js", () => ({ normalizeItem: vi.fn(), toId: vi.fn((v) => v) }));
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({ emitOrderEvent: vi.fn() }));
vi.mock("../../graphql/resolvers/order/helper/userUtils.js", () => ({ ensureUserForOrder: vi.fn(), resolveTable: vi.fn() }));
vi.mock("../../graphql/resolvers/order/helper/tableUtils.js", () => ({ markTableStatus: vi.fn() }));
vi.mock("../../graphql/resolvers/order/helper/tracking.js", () => ({ createOrderTrackingEvent: vi.fn() }));
vi.mock("../../utils/generateOrderCode.js", () => ({ default: vi.fn() }));
vi.mock("../../src/services/inventory.service.js", () => ({ reserveForOrderTx: vi.fn(), commitReservationForOrderTx: vi.fn(), cancelReservationForOrderTx: vi.fn() }));

function buildOrder({ quantity = 2, returnedQuantity = 0, originalQuantity = 2, status = "served", refundMode = "none", reqQty = 1 }) {
  const item = {
    _id: "item1",
    name: "Món A",
    prepStation: "kitchen",
    quantity,
    returnedQuantity,
    originalQuantity,
    status,
    price: 10000,
    modifiersPrice: 0,
    returnRequests: [{ requestId: "req1", quantity: reqQty, refundMode, status: "pending" }],
    toObject() { return { ...this }; },
  };
  return {
    _id: "order1",
    currentStatus: "served",
    totals: { subtotal: 20000, grandTotal: 20000, serviceRate: 0, taxRate: 0, promotionDiscount: 0, voucherDiscount: 0, shippingFee: 0 },
    items: {
      id: (id) => (id === "item1" ? item : null),
      map: (fn) => [fn(item)],
      [Symbol.iterator]: function* () { yield item; },
    },
    statusTimeline: [],
    save: saveMock,
  };
}

function mockFindByIdWithOrder(order) {
  findByIdMock.mockImplementation(() => {
    const query = {
      session: vi.fn(() => query),
      lean: vi.fn().mockResolvedValue(order),
      then: (resolve) => Promise.resolve(resolve(order)),
      catch: () => query,
    };
    return query;
  });
}
function mockKitchenWorkItemFindOne(value = null) {
  const query = {
    lean: vi.fn(() => ({
      session: vi.fn().mockResolvedValue(value),
    })),
  };
  modelMocks.KitchenOrderWorkItem.findOne.mockReturnValue(query);
}

describe("reviewOrderItemReturn refund mode handling", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockKitchenWorkItemFindOne(null);
    modelMocks.KitchenOrderWorkItem.findOneAndUpdate.mockReturnValue({
      session: vi.fn().mockResolvedValue({ _id: "work-item-1" }),
    });
  });

  it("keeps quantity/status/totals for refundMode none", async () => {
    const order = buildOrder({ refundMode: "none", reqQty: 2, quantity: 2, originalQuantity: 2 });
    const mongooseMod = await import("mongoose");
    vi.spyOn(mongooseMod.default, "isValidObjectId").mockReturnValue(true);
    vi.spyOn(mongooseMod.default, "startSession").mockResolvedValue({ withTransaction: async (fn) => fn(), endSession: vi.fn() });
    mockFindByIdWithOrder(order);

    const { OrderMutation } = (await import("../../graphql/resolvers/order/mutation.js")).default;
    await OrderMutation.reviewOrderItemReturn(null, { input: { orderId: "order1", orderItemId: "item1", requestId: "req1", approve: true } }, { user: { id: "u1" } });

    const item = order.items.id("item1");
    expect(item.returnedQuantity).toBe(2);
    expect(item.quantity).toBe(2);
    expect(item.status).toBe("served");
    expect(order.totals.grandTotal).toBe(20000);
  });

  it("keeps quantity/status/totals for refund_after_payment", async () => {
    const order = buildOrder({ refundMode: "refund_after_payment", reqQty: 2, quantity: 2, originalQuantity: 2 });
    const mongooseMod = await import("mongoose");
    vi.spyOn(mongooseMod.default, "isValidObjectId").mockReturnValue(true);
    vi.spyOn(mongooseMod.default, "startSession").mockResolvedValue({ withTransaction: async (fn) => fn(), endSession: vi.fn() });
    mockFindByIdWithOrder(order);

    const { OrderMutation } = (await import("../../graphql/resolvers/order/mutation.js")).default;
    await OrderMutation.reviewOrderItemReturn(null, { input: { orderId: "order1", orderItemId: "item1", requestId: "req1", approve: true } }, { user: { id: "u1" } });

    const item = order.items.id("item1");
    expect(item.returnedQuantity).toBe(2);
    expect(item.quantity).toBe(2);
    expect(item.status).toBe("served");
    expect(order.totals.grandTotal).toBe(20000);
  });

  it("partial remove_from_bill keeps served and reduces totals", async () => {
    const order = buildOrder({ refundMode: "remove_from_bill", reqQty: 1, quantity: 2, originalQuantity: 2 });
    const mongooseMod = await import("mongoose");
    vi.spyOn(mongooseMod.default, "isValidObjectId").mockReturnValue(true);
    vi.spyOn(mongooseMod.default, "startSession").mockResolvedValue({ withTransaction: async (fn) => fn(), endSession: vi.fn() });
    mockFindByIdWithOrder(order);

    const { OrderMutation } = (await import("../../graphql/resolvers/order/mutation.js")).default;
    await OrderMutation.reviewOrderItemReturn(null, { input: { orderId: "order1", orderItemId: "item1", requestId: "req1", approve: true } }, { user: { id: "u1" } });

    const item = order.items.id("item1");
    expect(item.returnedQuantity).toBe(1);
    expect(item.quantity).toBe(1);
    expect(item.status).toBe("served");
    expect(order.totals.grandTotal).toBeLessThan(20000);
  });

  it("full remove_from_bill sets returned and reduces totals", async () => {
    const order = buildOrder({ refundMode: "remove_from_bill", reqQty: 1, quantity: 1, originalQuantity: 1 });
    order.totals = { subtotal: 10000, grandTotal: 10000, serviceRate: 0, taxRate: 0, promotionDiscount: 0, voucherDiscount: 0, shippingFee: 0 };
    const mongooseMod = await import("mongoose");
    vi.spyOn(mongooseMod.default, "isValidObjectId").mockReturnValue(true);
    vi.spyOn(mongooseMod.default, "startSession").mockResolvedValue({ withTransaction: async (fn) => fn(), endSession: vi.fn() });
    mockFindByIdWithOrder(order);

    const { OrderMutation } = (await import("../../graphql/resolvers/order/mutation.js")).default;
    await OrderMutation.reviewOrderItemReturn(null, { input: { orderId: "order1", orderItemId: "item1", requestId: "req1", approve: true } }, { user: { id: "u1" } });

    const item = order.items.id("item1");
    expect(item.returnedQuantity).toBe(1);
    expect(item.quantity).toBe(0);
    expect(item.status).toBe("returned");
    expect(order.totals.grandTotal).toBe(0);
  });
});
