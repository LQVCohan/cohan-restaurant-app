import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import Order from "../../models/order.model.js";
import {
  installOrderSettlementStateCompatibility,
  normalizeOrderSettlementState,
} from "../../models/order-settlement-state-compatibility.js";

installOrderSettlementStateCompatibility(Order);

describe("order settlement state compatibility", () => {
  it("normalizes legacy uppercase parent-session values before validation", async () => {
    const order = new Order({
      restaurantId: new mongoose.Types.ObjectId(),
      orderType: "dine_in",
      items: [],
      totals: {
        subtotal: 0,
        tax: 0,
        service: 0,
        grandTotal: 0,
      },
    });

    // These are the exact values assigned by the external-payment settlement
    // path when it closes the table-session parent after all child orders paid.
    order.sessionStatus = "CLOSED";
    order.orderPaymentStatus = "PAID";

    expect(order.sessionStatus).toBe("closed");
    expect(order.orderPaymentStatus).toBe("paid");
    await expect(order.validate()).resolves.toBeUndefined();
  });

  it("keeps nullish values intact and trims valid enum values", () => {
    expect(normalizeOrderSettlementState(undefined)).toBeUndefined();
    expect(normalizeOrderSettlementState(null)).toBeNull();
    expect(normalizeOrderSettlementState(" READY_TO_PAY ")).toBe("ready_to_pay");
  });

  it("is safe to install more than once during development reloads", () => {
    expect(installOrderSettlementStateCompatibility(Order)).toBe(Order);
    expect(installOrderSettlementStateCompatibility(Order)).toBe(Order);
  });
});
