import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  processRefundRequest: vi.fn(),
  retryRefundRequest: vi.fn(),
  recordSupplierPayment: vi.fn(),
}));

vi.mock("../../graphql/resolvers/payment/mutation.js", () => ({ default: calls }));

function makeGate() {
  let open;
  const promise = new Promise((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

describe("finance guarded mutations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("serializes refund processing for the same refund id", async () => {
    const gate = makeGate();
    const order = [];
    calls.processRefundRequest
      .mockImplementationOnce(async () => {
        order.push("first-start");
        await gate.promise;
        order.push("first-end");
        return { id: "refund-1", status: "success" };
      })
      .mockImplementationOnce(async () => {
        order.push("second-start");
        return { id: "refund-1", status: "success" };
      });

    const mutation = (await import("../../graphql/resolvers/payment/financeOperationGuardMutation.js")).default;
    const first = mutation.processRefundRequest(null, { id: "refund-1" }, {}, undefined);
    const second = mutation.processRefundRequest(null, { id: "refund-1" }, {}, undefined);

    await Promise.resolve();
    expect(order).toEqual(["first-start"]);
    gate.open();
    await first;
    await second;
    expect(order).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("serializes supplier payment recording for the same payable id", async () => {
    const gate = makeGate();
    const order = [];
    calls.recordSupplierPayment
      .mockImplementationOnce(async () => {
        order.push("first-start");
        await gate.promise;
        order.push("first-end");
        return { id: "payable-1", remainingAmount: 0 };
      })
      .mockImplementationOnce(async () => {
        order.push("second-start");
        return { id: "payable-1", remainingAmount: 0 };
      });

    const mutation = (await import("../../graphql/resolvers/payment/financeOperationGuardMutation.js")).default;
    const first = mutation.recordSupplierPayment(null, { id: "payable-1", input: { amount: 100 } }, {}, undefined);
    const second = mutation.recordSupplierPayment(null, { id: "payable-1", input: { amount: 100 } }, {}, undefined);

    await Promise.resolve();
    expect(order).toEqual(["first-start"]);
    gate.open();
    await first;
    await second;
    expect(order).toEqual(["first-start", "first-end", "second-start"]);
  });
});
