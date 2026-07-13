import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";

import Review from "../../models/review.model.js";
import {
  hasGroundedVerification,
  isPublicReviewOperation,
  resolvePresentedReviewStats,
  toGraphqlDate,
} from "../../graphql/resolvers/review/presentation.js";

const operationInfo = (name) => ({
  operation: { name: { value: name } },
});

describe("public review presentation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("casts restaurant and target ids before Mongo aggregation", async () => {
    const aggregate = vi.spyOn(Review, "aggregate").mockResolvedValue([
      {
        totals: [{ count: 1 }],
        ratingSummary: [{ average: 5 }],
        ratingBreakdown: [{ _id: 5, count: 1 }],
      },
    ]);
    vi.spyOn(Review, "countDocuments").mockResolvedValue(0);

    const restaurantId = new mongoose.Types.ObjectId().toString();
    const targetId = new mongoose.Types.ObjectId().toString();
    const result = await resolvePresentedReviewStats(
      null,
      { restaurantId, targetType: "restaurant", targetId },
      { user: { id: "manager-1", roleName: "manager" } },
      operationInfo("GetRestaurantReviewStats"),
    );

    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[0].$match.restaurantId).toBeInstanceOf(
      mongoose.Types.ObjectId,
    );
    expect(pipeline[0].$match.targetId).toBeInstanceOf(
      mongoose.Types.ObjectId,
    );
    expect(pipeline[0].$match.status).toEqual({
      $in: ["published", "reported"],
    });
    expect(result).toEqual({
      total: 1,
      pending: 0,
      avgRating: 5,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
    });
  });

  it("supports legacy ratings stored as numeric strings through conversion", async () => {
    const aggregate = vi.spyOn(Review, "aggregate").mockResolvedValue([
      {
        totals: [{ count: 2 }],
        ratingSummary: [{ average: 4.5 }],
        ratingBreakdown: [
          { _id: 4, count: 1 },
          { _id: 5, count: 1 },
        ],
      },
    ]);
    vi.spyOn(Review, "countDocuments").mockResolvedValue(0);

    const result = await resolvePresentedReviewStats(
      null,
      { restaurantId: new mongoose.Types.ObjectId().toString() },
      {},
      operationInfo("GetRestaurantReviewStatsForHeader"),
    );

    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[1].$set.__normalizedRating.$convert.to).toBe("double");
    expect(result.avgRating).toBe(4.5);
    expect(result.ratingBreakdown[4]).toBe(1);
    expect(result.ratingBreakdown[5]).toBe(1);
  });

  it("recovers a missing createdAt from the Mongo ObjectId timestamp", () => {
    const id = new mongoose.Types.ObjectId();
    expect(toGraphqlDate(null, id)).toBe(id.getTimestamp().toISOString());
  });

  it("only accepts completed transactional evidence for the verified badge", () => {
    const sourceId = new mongoose.Types.ObjectId();
    const completedAt = new Date(Date.now() - 60_000);

    expect(
      hasGroundedVerification({
        verifiedPurchase: true,
        verifiedSource: "order",
        verifiedSourceId: sourceId,
        orderCompletedAt: completedAt,
      }),
    ).toBe(true);

    expect(
      hasGroundedVerification({
        verifiedPurchase: true,
        verifiedSource: "reservation",
        verifiedSourceId: sourceId,
        visitedAt: completedAt,
      }),
    ).toBe(false);

    expect(
      hasGroundedVerification({
        verifiedPurchase: true,
        verifiedSource: "payment",
        verifiedSourceId: sourceId,
        visitedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    ).toBe(false);
  });

  it("keeps customer-facing operations in public review scope", () => {
    expect(isPublicReviewOperation(operationInfo("GetRestaurantReviews"))).toBe(
      true,
    );
    expect(isPublicReviewOperation(operationInfo("FoodReviewSummaryV2"))).toBe(
      true,
    );
    expect(isPublicReviewOperation(operationInfo("GetReviewStats"))).toBe(
      false,
    );
  });
});
