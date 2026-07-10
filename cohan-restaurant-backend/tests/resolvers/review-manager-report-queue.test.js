import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Review: {
    countDocuments: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    aggregate: vi.fn(),
  },
  ReviewComment: { find: vi.fn(), aggregate: vi.fn() },
  ReviewReport: { countDocuments: vi.fn(), find: vi.fn(), aggregate: vi.fn() },
  EventLog: { find: vi.fn() },
}));

const authorizationMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("../../models/review.model.js", () => ({ default: modelMocks.Review }));
vi.mock("../../models/index.js", () => ({
  EventLog: modelMocks.EventLog,
  ReviewComment: modelMocks.ReviewComment,
  ReviewReport: modelMocks.ReviewReport,
}));
vi.mock("../../src/services/auth/authorization.service.js", () =>
  authorizationMocks,
);
vi.mock("../../src/services/reviewInsight.service.js", () => ({
  generateReviewInsight: vi.fn(async () => ({
    summary: "Không có dữ liệu",
    positives: [],
    negatives: [],
    recommendedActions: [],
    topPriorities: [],
    confidence: 0,
    source: "no_data",
  })),
}));

const buildReviewFindChain = (documents = []) => ({
  sort: vi.fn(() => ({
    skip: vi.fn(() => ({
      limit: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue(documents),
      })),
    })),
  })),
});

const buildCommentFindChain = (documents = []) => ({
  sort: vi.fn(() => ({
    lean: vi.fn().mockResolvedValue(documents),
  })),
});

describe("manager review report queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizationMocks.requireRestaurantPermission.mockResolvedValue(true);
    authorizationMocks.requirePermission.mockResolvedValue(true);
    modelMocks.Review.countDocuments.mockResolvedValue(0);
    modelMocks.Review.find.mockReturnValue(buildReviewFindChain([]));
    modelMocks.ReviewComment.find.mockReturnValue(buildCommentFindChain([]));
  });

  it("includes reported reviews and public reviews with pending reports for managers", async () => {
    const resolver = (
      await import("../../graphql/resolvers/review/query.js")
    ).default;
    const ctx = { user: { id: "manager-1", roleName: "manager" } };

    await resolver.reviews(
      null,
      {
        restaurantId: "restaurant-1",
        status: "reported",
        limit: 20,
        skip: 0,
      },
      ctx,
    );

    expect(authorizationMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      ctx,
      "restaurant-1",
      "review.read",
    );
    expect(modelMocks.Review.find).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      $or: [
        { status: "reported" },
        { status: "published", reportsCount: { $gt: 0 } },
      ],
    });
  });

  it("keeps the public reported filter limited to the reported status", async () => {
    const resolver = (
      await import("../../graphql/resolvers/review/query.js")
    ).default;

    await resolver.reviews(
      null,
      {
        restaurantId: "restaurant-1",
        status: "reported",
        limit: 20,
        skip: 0,
      },
      {},
    );

    expect(authorizationMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.Review.find).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      status: "reported",
    });
  });
});
