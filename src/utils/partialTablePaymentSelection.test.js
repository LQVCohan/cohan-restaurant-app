import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPartialTablePaymentSelection,
  getPartialTablePaymentSelection,
  setPartialTablePaymentSelection,
} from "./partialTablePaymentSelection";

describe("partial table payment selection store", () => {
  beforeEach(() => {
    clearPartialTablePaymentSelection();
  });

  it("normalizes duplicate order ids and marks a subset as partial", () => {
    const selection = setPartialTablePaymentSelection({
      active: true,
      restaurantId: "restaurant-1",
      tableId: "table-1",
      selectedOrderIds: ["order-1", "order-1"],
      allOrderIds: ["order-1", "order-2"],
    });

    expect(selection.selectedOrderIds).toEqual(["order-1"]);
    expect(selection.allOrderIds).toEqual(["order-1", "order-2"]);
    expect(selection.isPartial).toBe(true);
  });

  it("keeps the default all-order selection out of the partial route", () => {
    setPartialTablePaymentSelection({
      active: true,
      selectedOrderIds: ["order-1", "order-2"],
      allOrderIds: ["order-1", "order-2"],
    });

    expect(getPartialTablePaymentSelection()).toMatchObject({
      active: true,
      isPartial: false,
    });
  });
});
