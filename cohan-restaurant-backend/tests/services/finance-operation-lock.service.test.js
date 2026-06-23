import { describe, expect, it } from "vitest";
import {
  getActiveFinanceOperationLockCount,
  withFinanceOperationLock,
} from "../../src/services/finance/financeOperationLock.service.js";

function makeGate() {
  let open;
  const promise = new Promise((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

describe("finance operation lock service", () => {
  it("runs same-key operations one after another", async () => {
    const gate = makeGate();
    const order = [];

    const first = withFinanceOperationLock("refund-1", async () => {
      order.push("first-start");
      await gate.promise;
      order.push("first-end");
      return "first";
    });

    const second = withFinanceOperationLock("refund-1", async () => {
      order.push("second-start");
      return "second";
    });

    await Promise.resolve();
    expect(order).toEqual(["first-start"]);
    gate.open();

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
    expect(order).toEqual(["first-start", "first-end", "second-start"]);
    expect(getActiveFinanceOperationLockCount()).toBe(0);
  });

  it("runs different keys independently", async () => {
    const gate = makeGate();
    const order = [];

    const first = withFinanceOperationLock("payable-a", async () => {
      order.push("a-start");
      await gate.promise;
      order.push("a-end");
    });

    const second = withFinanceOperationLock("payable-b", async () => {
      order.push("b-start");
    });

    await second;
    expect(order).toEqual(["a-start", "b-start"]);
    gate.open();
    await first;
    expect(getActiveFinanceOperationLockCount()).toBe(0);
  });
});
