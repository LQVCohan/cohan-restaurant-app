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

describe("withIncomingOrderProofGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks kitchen handoff when a by-weight item has no proof", async () => {
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

  it("delegates after proof and weight are complete", async () => {
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
});
