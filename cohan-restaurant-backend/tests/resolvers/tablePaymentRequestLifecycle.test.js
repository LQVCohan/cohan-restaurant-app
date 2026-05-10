import { beforeEach, describe, expect, it, vi } from "vitest";

const OrderModel = vi.hoisted(() => ({}));
const clearPaymentRequestAfterNewChildOrderBatchCreatedMock = vi.hoisted(() =>
  vi.fn(),
);

vi.mock("../../models/index.js", () => ({ Order: OrderModel }));
vi.mock("../../utils/orderLifecycle.js", () => ({
  clearPaymentRequestAfterNewChildOrderBatchCreated:
    clearPaymentRequestAfterNewChildOrderBatchCreatedMock,
}));

describe("withTablePaymentRequestLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears stale payment request after createOrderForTable succeeds", async () => {
    const { withTablePaymentRequestLifecycle } = await import(
      "../../graphql/resolvers/order/tablePaymentRequestLifecycle.js"
    );
    const createdOrder = {
      _id: "child-1",
      orderType: "dine_in",
      orderKind: "order_batch",
      parentOrderId: "parent-1",
    };
    const baseMutation = {
      createOrderForTable: vi.fn().mockResolvedValue({
        isNewOrder: true,
        order: createdOrder,
      }),
    };

    const wrapped = withTablePaymentRequestLifecycle(baseMutation);
    const result = await wrapped.createOrderForTable(
      null,
      { input: { restaurantId: "rest-1" } },
      { user: { id: "staff-1" } },
    );

    expect(result.order).toBe(createdOrder);
    expect(clearPaymentRequestAfterNewChildOrderBatchCreatedMock).toHaveBeenCalledWith({
      OrderModel,
      order: createdOrder,
      reason: "Thêm món mới sau khi khách yêu cầu thanh toán.",
    });
  });

  it("does not clear payment request when createOrderForTable fails", async () => {
    const { withTablePaymentRequestLifecycle } = await import(
      "../../graphql/resolvers/order/tablePaymentRequestLifecycle.js"
    );
    const baseMutation = {
      createOrderForTable: vi.fn().mockRejectedValue(new Error("create failed")),
    };

    const wrapped = withTablePaymentRequestLifecycle(baseMutation);

    await expect(
      wrapped.createOrderForTable(null, { input: {} }, {}),
    ).rejects.toThrow("create failed");
    expect(clearPaymentRequestAfterNewChildOrderBatchCreatedMock).not.toHaveBeenCalled();
  });

  it("does not clear payment request when createOrderForTable returns no order", async () => {
    const { withTablePaymentRequestLifecycle } = await import(
      "../../graphql/resolvers/order/tablePaymentRequestLifecycle.js"
    );
    const baseMutation = {
      createOrderForTable: vi.fn().mockResolvedValue({ isNewOrder: false }),
    };

    const wrapped = withTablePaymentRequestLifecycle(baseMutation);
    const result = await wrapped.createOrderForTable(null, { input: {} }, {});

    expect(result).toEqual({ isNewOrder: false });
    expect(clearPaymentRequestAfterNewChildOrderBatchCreatedMock).not.toHaveBeenCalled();
  });
});
