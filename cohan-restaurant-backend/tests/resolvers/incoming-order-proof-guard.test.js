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

function mockOrder(order) {
  modelMocks.Order.findOne.mockReturnValue({
    select: vi.fn(() => ({
      lean: vi.fn(async () => order),
    })),
  });
}

describe("withIncomingOrderProofGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks kitchen handoff when a by-weight item has no proof", async () => {
    mockOrder({
      currentStatus: "pending",
      items: [
        {
          _id: "64b000000000000000000003",
          name: "Cua cân ký",
          status: "pending",
          unit: "kg",
          weightGrams: 850,
          servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
          proofImages: [],
        },
      ],
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
      items: [
        {
          _id: "64b000000000000000000003",
          name: "Cua cân ký",
          status: "pending",
          unit: "kg",
          weightGrams: 850,
          servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
          proofImages: ["/uploads/proof.jpg"],
        },
      ],
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
});
