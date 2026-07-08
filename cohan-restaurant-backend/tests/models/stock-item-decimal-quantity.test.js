import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import StockItem from "../../models/stockItem.model.js";

describe("StockItem decimal quantities", () => {
  it("accepts decimal balances and batch quantities in the item base unit", async () => {
    const item = new StockItem({
      restaurantId: new mongoose.Types.ObjectId(),
      warehouseId: new mongoose.Types.ObjectId(),
      ingredientId: new mongoose.Types.ObjectId(),
      onHand: 0.5,
      reserved: 0.125,
      batches: [{ qty: 0.5, costPerBaseUnit: 120000 }],
    });

    await expect(item.validate()).resolves.toBeUndefined();
  });
});
