import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: { findOne: vi.fn() },
}));
const mongooseMocks = vi.hoisted(() => ({
  isValidObjectId: vi.fn(() => true),
  Types: {
    ObjectId: class ObjectId {
      constructor(value) {
        this.value = String(value);
      }
      toString() {
        return this.value;
      }
    },
  },
}));
const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));
const trackingMocks = vi.hoisted(() => ({
  emitCustomerTrackingUpdateIfChanged: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({
  emitOrderEvent: vi.fn(),
}));

vi.mock("mongoose", () => ({ default: mongooseMocks }));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authMocks);
vi.mock("../../src/services/orderTracking.service.js", () => trackingMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => eventMocks);

const restaurantId = "64b000000000000000000001";
const orderId = "64b000000000000000000002";
const itemId = "64b000000000000000000003";
const staffId = "64b000000000000000000004";

function createOrder(overrides = {}) {
  const item = {
    _id: itemId,
    name: "Cua cân ký",
    unit: "kg",
    weightGrams: 850,
    servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
    proofImages: [],
  };
  const order = {
    _id: orderId,
    restaurantId,
    currentStatus: "pending",
    clientMeta: { source: "customer_table_qr" },
    statusTimeline: [],
    payment: null,
    items: {
      id: vi.fn((value) => (String(value) === itemId ? item : null)),
    },
    markModified: vi.fn(),
    save: vi.fn(async function save() {
      return this;
    }),
    toJSON: vi.fn(function toJSON() {
      return {
        id: String(this._id),
        currentStatus: this.currentStatus,
        clientMeta: this.clientMeta,
      };
    }),
    ...overrides,
  };
  return { order, item };
}

describe("OrderProofMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireRestaurantPermission.mockResolvedValue(true);
    eventMocks.emitOrderEvent.mockResolvedValue(undefined);
  });

  it("stores an audited customer waiver for a pending weighted item", async () => {
    const { order, item } = createOrder();
    modelMocks.Order.findOne.mockResolvedValue(order);
    const { OrderProofMutation } = await import(
      "../../graphql/resolvers/order/orderProofMutation.js"
    );

    const result = await OrderProofMutation.setOrderItemProofWaiver(
      null,
      {
        input: {
          restaurantId,
          orderId,
          orderItemId: itemId,
          waived: true,
          reason: "Khách hàng xác nhận không cần ảnh minh chứng.",
        },
      },
      { user: { id: staffId } },
    );

    expect(order.clientMeta.proofWaivers[itemId]).toEqual(
      expect.objectContaining({
        waived: true,
        waivedBy: staffId,
        reason: "Khách hàng xác nhận không cần ảnh minh chứng.",
        source: "staff_customer_confirmation",
        waivedAt: expect.any(String),
      }),
    );
    expect(item.proofImages).toEqual([]);
    expect(order.markModified).toHaveBeenCalledWith("clientMeta");
    expect(order.statusTimeline.at(-1)?.note).toContain("ghi nhận khách không cần");
    expect(eventMocks.emitOrderEvent).toHaveBeenCalledWith(
      expect.anything(),
      restaurantId,
      "ORDER_ITEM_PROOF_WAIVER_UPDATED",
      expect.objectContaining({
        meta: expect.objectContaining({ itemId, waived: true }),
      }),
    );
    expect(result.order.clientMeta.proofWaivers[itemId].waived).toBe(true);
  });

  it("removes the waiver automatically when a real proof image is uploaded", async () => {
    const { order, item } = createOrder({
      clientMeta: {
        source: "customer_table_qr",
        proofWaivers: {
          [itemId]: {
            waived: true,
            waivedBy: staffId,
            reason: "Khách hàng xác nhận không cần ảnh minh chứng.",
          },
        },
      },
    });
    modelMocks.Order.findOne.mockResolvedValue(order);
    const { OrderProofMutation } = await import(
      "../../graphql/resolvers/order/orderProofMutation.js"
    );

    await OrderProofMutation.uploadOrderItemProof(
      null,
      {
        input: {
          restaurantId,
          orderId,
          orderItemId: itemId,
          proofImages: ["/uploads/proof.jpg"],
        },
      },
      { user: { id: staffId } },
    );

    expect(item.proofImages).toEqual(["/uploads/proof.jpg"]);
    expect(order.clientMeta.proofWaivers[itemId]).toBeUndefined();
    expect(eventMocks.emitOrderEvent).toHaveBeenCalledWith(
      expect.anything(),
      restaurantId,
      "ORDER_ITEM_PROOF_UPDATED",
      expect.objectContaining({
        meta: expect.objectContaining({ itemId, proofCount: 1 }),
      }),
    );
  });

  it("does not allow a waiver after the order leaves pending", async () => {
    const { order } = createOrder({ currentStatus: "confirmed" });
    modelMocks.Order.findOne.mockResolvedValue(order);
    const { OrderProofMutation } = await import(
      "../../graphql/resolvers/order/orderProofMutation.js"
    );

    await expect(
      OrderProofMutation.setOrderItemProofWaiver(
        null,
        {
          input: {
            restaurantId,
            orderId,
            orderItemId: itemId,
            waived: true,
          },
        },
        { user: { id: staffId } },
      ),
    ).rejects.toThrow("only be changed while the order is pending");
    expect(order.save).not.toHaveBeenCalled();
  });
});
