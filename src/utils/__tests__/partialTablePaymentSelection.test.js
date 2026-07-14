import { afterEach, describe, expect, it } from "vitest";

import {
  clearPartialTablePaymentSelection,
  getPartialTablePaymentSelection,
  setPartialTablePaymentSelection,
} from "../partialTablePaymentSelection";

describe("partialTablePaymentSelection", () => {
  afterEach(() => {
    clearPartialTablePaymentSelection();
  });

  it("uses exact order IDs when every visible batch is selected", () => {
    const selection = setPartialTablePaymentSelection({
      active: true,
      restaurantId: "restaurant-1",
      tableId: "table-1",
      selectedOrderIds: ["order-1", "order-2"],
      allOrderIds: ["order-1", "order-2"],
    });

    expect(selection.isPartial).toBe(false);
    expect(selection.useOrderIds).toBe(true);
    expect(getPartialTablePaymentSelection().selectedOrderIds).toEqual([
      "order-1",
      "order-2",
    ]);
  });

  it("keeps partial selections on the order-id payment path", () => {
    const selection = setPartialTablePaymentSelection({
      active: true,
      restaurantId: "restaurant-1",
      tableId: "table-1",
      selectedOrderIds: ["order-2"],
      allOrderIds: ["order-1", "order-2"],
    });

    expect(selection.isPartial).toBe(true);
    expect(selection.useOrderIds).toBe(true);
  });
});
