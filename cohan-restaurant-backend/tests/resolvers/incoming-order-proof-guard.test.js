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

vi.mock("mongoose", () => ({ default: mongooseMocks }));
vi.mock("../../models/index.js", () => modelMocks);

const restaurantId = "64b000000000000000000001";
const orderId = "64b000000000000000000002";
const itemId = "64b000000000000000000003";

function mockOrder(order) {
  modelMocks.Order.findOne.mockReturnValue({
    select: vi.fn(() => ({
      lean: vi.fn(async () => order),
    })),
  });
}

function weightedItem(overrides = {}) {
  return {
    _id: itemId,
    name: "Cua cân ký",
    status: "pending",
    unit: "kg",
    weightGrams: 850,
    servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
    proofImages: [],
    ...overrides,
  };
}

function regularItem(overrides = {}) {
  return {
    _id: itemId,
    name: "Phở bò đặc biệt",
    status: "pending",
    unit: "phần",
    servingVariant: { mode: "FIXED", sellUnit: "phần" },
    proofImages: [],
    ...overrides,
  };
}

describe("withIncomingOrderProofGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks staff confirmation when a by-weight item has no proof", async () => {
    mockOrder({
      currentStatus: "pending",
      clientMeta: {},
      items: [weightedItem()],
    });
    const original = vi.fn();
    const { withIncomingOrderProofGuard } = await import(
      "../../graphql/resolvers/order/incomingOrderProofGuard.js"
    );
    const guarded = withIncomingOrderProofGuard({ confirmIncomingOrder: original });

    await expect(
      guarded.confirmIncomingOrder(
        null,
        { input: { id: orderId, restaurantId } },
        {},
        {},
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("thiếu ảnh minh chứng"),
      extensions: expect.objectContaining({ code: "ORDER_PROOF_REQUIRED" }),
    });
    expect(original).not.toHaveBeenCalled();
  });

  it("delegates staff confirmation after proof and weight are complete", async () => {
    mockOrder({
      currentStatus: "pending",
      clientMeta: {},
      items: [weightedItem({ proofImages: ["/uploads/proof.jpg"] })],
    });
    const original = vi.fn(async () => ({ order: { id: orderId } }));
    const { withIncomingOrderProofGuard } = await import(
      "../../graphql/resolvers/order/incomingOrderProofGuard.js"
    );
    const guarded = withIncomingOrderProofGuard({ confirmIncomingOrder: original });

    await expect(
      guarded.confirmIncomingOrder(
        null,
        { input: { id: orderId, restaurantId } },
        { user: { id: "staff-1" } },
        {},
      ),
    ).resolves.toEqual({ order: { id: orderId } });
    expect(original).toHaveBeenCalledOnce();
  });

  it("delegates without an image after an audited customer waiver", async () => {
    mockOrder({
      currentStatus: "pending",
      clientMeta: {
        proofWaivers: {
          [itemId]: {
            waived: true,
            waivedBy: "staff-1",
            waivedAt: "2026-07-14T02:00:00.000Z",
            reason: "Khách hàng xác nhận không cần ảnh minh chứng.",
          },
        },
      },
      items: [weightedItem()],
    });
    const original = vi.fn(async () => ({ order: { id: orderId } }));
    const { withIncomingOrderProofGuard } = await import(
      "../../graphql/resolvers/order/incomingOrderProofGuard.js"
    );
    const guarded = withIncomingOrderProofGuard({ confirmIncomingOrder: original });

    await expect(
      guarded.confirmIncomingOrder(
        null,
        { input: { id: orderId, restaurantId } },
        { user: { id: "staff-1" } },
        {},
      ),
    ).resolves.toEqual({ order: { id: orderId } });
    expect(original).toHaveBeenCalledOnce();
  });

  it("still blocks a waived item when its required weight is missing", async () => {
    mockOrder({
      currentStatus: "pending",
      clientMeta: {
        proofWaivers: {
          [itemId]: { waived: true },
        },
      },
      items: [weightedItem({ weightGrams: null })],
    });
    const original = vi.fn();
    const { withIncomingOrderProofGuard } = await import(
      "../../graphql/resolvers/order/incomingOrderProofGuard.js"
    );
    const guarded = withIncomingOrderProofGuard({ confirmIncomingOrder: original });

    await expect(
      guarded.confirmIncomingOrder(
        null,
        { input: { id: orderId, restaurantId } },
        {},
        {},
      ),
    ).rejects.toThrow("thiếu cân nặng");
    expect(original).not.toHaveBeenCalled();
  });

  it("blocks an order-level kitchen pickup for a pending QR order that requires proof", async () => {
    mockOrder({
      currentStatus: "pending",
      clientMeta: { source: "customer_table_qr" },
      items: [weightedItem({ proofImages: ["/uploads/proof.jpg"] })],
    });
    const original = vi.fn();
    const { withIncomingOrderProofGuard } = await import(
      "../../graphql/resolvers/order/incomingOrderProofGuard.js"
    );
    const guarded = withIncomingOrderProofGuard({ updateOrderStatus: original });

    await expect(
      guarded.updateOrderStatus(
        null,
        { input: { id: orderId, restaurantId, status: "preparing" } },
        {},
        {},
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("chờ nhân viên/POS xác nhận"),
      extensions: expect.objectContaining({
        code: "ORDER_STAFF_CONFIRMATION_REQUIRED",
      }),
    });
    expect(original).not.toHaveBeenCalled();
  });

  it("blocks an item-level kitchen pickup for a pending QR order that requires proof", async () => {
    mockOrder({
      currentStatus: "pending",
      clientMeta: { source: "customer_table_qr" },
      items: [weightedItem()],
    });
    const original = vi.fn();
    const { withIncomingOrderProofGuard } = await import(
      "../../graphql/resolvers/order/incomingOrderProofGuard.js"
    );
    const guarded = withIncomingOrderProofGuard({ updateOrderItemStatus: original });

    await expect(
      guarded.updateOrderItemStatus(
        null,
        {
          input: {
            orderId,
            itemKey: itemId,
            restaurantId,
            status: "preparing",
          },
        },
        {},
        {},
      ),
    ).rejects.toMatchObject({
      extensions: expect.objectContaining({
        code: "ORDER_STAFF_CONFIRMATION_REQUIRED",
      }),
    });
    expect(original).not.toHaveBeenCalled();
  });

  it("allows the kitchen to receive a pending QR order without proof-required items", async () => {
    mockOrder({
      currentStatus: "pending",
      clientMeta: { source: "customer_table_qr" },
      items: [regularItem()],
    });
    const original = vi.fn(async () => ({ id: orderId, currentStatus: "preparing" }));
    const { withIncomingOrderProofGuard } = await import(
      "../../graphql/resolvers/order/incomingOrderProofGuard.js"
    );
    const guarded = withIncomingOrderProofGuard({ updateOrderStatus: original });

    await expect(
      guarded.updateOrderStatus(
        null,
        { input: { id: orderId, restaurantId, status: "preparing" } },
        {},
        {},
      ),
    ).resolves.toEqual({ id: orderId, currentStatus: "preparing" });
    expect(original).toHaveBeenCalledOnce();
  });

  it("allows kitchen pickup after staff confirmation changed the order status", async () => {
    mockOrder({
      currentStatus: "confirmed",
      clientMeta: { source: "customer_table_qr" },
      items: [weightedItem({ proofImages: ["/uploads/proof.jpg"] })],
    });
    const original = vi.fn(async () => ({ id: orderId, currentStatus: "preparing" }));
    const { withIncomingOrderProofGuard } = await import(
      "../../graphql/resolvers/order/incomingOrderProofGuard.js"
    );
    const guarded = withIncomingOrderProofGuard({ updateOrderStatus: original });

    await expect(
      guarded.updateOrderStatus(
        null,
        { input: { id: orderId, restaurantId, status: "preparing" } },
        {},
        {},
      ),
    ).resolves.toEqual({ id: orderId, currentStatus: "preparing" });
    expect(original).toHaveBeenCalledOnce();
  });
});
