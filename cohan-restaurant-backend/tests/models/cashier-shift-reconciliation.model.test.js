import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import CashierShiftReconciliation from "../../models/cashier-shift-reconciliation.model.js";

describe("CashierShiftReconciliation model", () => {
  it("normalizes active keys to one open drawer per cashier", async () => {
    const restaurantId = new mongoose.Types.ObjectId();
    const cashierId = new mongoose.Types.ObjectId();
    const doc = new CashierShiftReconciliation({
      restaurantId,
      cashierId,
      registerCode: "BAR-01",
      activeKey: `${restaurantId}:${cashierId}:BAR-01`,
      status: "OPEN",
      openingCash: 500000,
      openedBy: new mongoose.Types.ObjectId(),
    });

    await doc.validate();

    expect(doc.activeKey).toBe(`${restaurantId}:${cashierId}`);
  });

  it("removes the unique active key after a terminal review decision", async () => {
    const restaurantId = new mongoose.Types.ObjectId();
    const cashierId = new mongoose.Types.ObjectId();
    const doc = new CashierShiftReconciliation({
      restaurantId,
      cashierId,
      activeKey: `${restaurantId}:${cashierId}:MAIN`,
      status: "APPROVED",
      openingCash: 0,
      openedBy: new mongoose.Types.ObjectId(),
    });

    await doc.validate();

    expect(doc.activeKey).toBeUndefined();
  });
});
