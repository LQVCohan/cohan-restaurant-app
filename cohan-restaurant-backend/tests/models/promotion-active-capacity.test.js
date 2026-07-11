import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { withActivePromotionCapacity } from "../../models/promotion.model.js";

describe("Promotion active capacity query guard", () => {
  it("adds the shared usage-limit filter to active promotion reads", () => {
    const restaurantId = new mongoose.Types.ObjectId();
    const filter = withActivePromotionCapacity({ restaurantId, isActive: true });

    expect(filter.$and).toHaveLength(2);
    expect(filter.$and[0]).toMatchObject({ restaurantId, isActive: true });
    expect(filter.$and[1]).toEqual({
      $expr: {
        $or: [
          { $lte: [{ $ifNull: ["$usageLimit", 0] }, 0] },
          {
            $lt: [
              { $ifNull: ["$usageCount", 0] },
              { $ifNull: ["$usageLimit", 0] },
            ],
          },
        ],
      },
    });
  });

  it("does not hide exhausted records from management reads", () => {
    expect(withActivePromotionCapacity({ isActive: false })).toEqual({
      isActive: false,
    });
  });
});
