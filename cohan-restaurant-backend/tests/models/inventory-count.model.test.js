import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import InventoryCount from "../../models/inventory-count.model.js";

describe("InventoryCount model", () => {
  it("accepts decimal counted quantities and document reconciliation state", async () => {
    const count = new InventoryCount({
      restaurantId: new mongoose.Types.ObjectId(),
      warehouseId: new mongoose.Types.ObjectId(),
      code: "IC-TEST-001",
      title: "Kiểm kê cuối kỳ",
      periodStart: new Date("2026-07-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-31T23:59:59.000Z"),
      lines: [
        {
          ingredientId: new mongoose.Types.ObjectId(),
          nameSnapshot: "Gạo",
          unit: "kg",
          systemQty: 12.5,
          countedQty: 12.25,
          variance: -0.25,
        },
      ],
      documents: [
        {
          movementId: new mongoose.Types.ObjectId(),
          documentNo: "PN-0001",
          status: "matched",
          note: "Khớp phiếu nhập",
          checkedAt: new Date(),
        },
      ],
    });

    await expect(count.validate()).resolves.toBeUndefined();
  });
});
