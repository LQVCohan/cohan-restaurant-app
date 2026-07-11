import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import Promotion from "../../models/promotion.model.js";

const runQueryMiddleware = (name, query) =>
  new Promise((resolve, reject) => {
    Promotion.schema.s.hooks.execPre(name, query, [], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

describe("Promotion active capacity query guard", () => {
  it("adds the shared usage-limit filter to active promotion reads", async () => {
    const restaurantId = new mongoose.Types.ObjectId();
    const query = Promotion.find({ restaurantId, isActive: true });

    await runQueryMiddleware("find", query);

    const filter = query.getFilter();
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

  it("does not hide exhausted records from management reads", async () => {
    const query = Promotion.find({ isActive: false });

    await runQueryMiddleware("find", query);

    expect(query.getFilter()).toEqual({ isActive: false });
  });
});
