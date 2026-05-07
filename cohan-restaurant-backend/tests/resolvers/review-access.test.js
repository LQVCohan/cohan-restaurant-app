import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  Review: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn(), findByIdAndUpdate: vi.fn(), findByIdAndDelete: vi.fn(), updateOne: vi.fn(), create: vi.fn() },
  ReviewReaction: { findOne: vi.fn(), create: vi.fn(), deleteOne: vi.fn(), findByIdAndUpdate: vi.fn() },
  ReviewComment: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), create: vi.fn(), updateOne: vi.fn() },
  EventLog: { log: vi.fn() },
}));
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));
const logMocks = vi.hoisted(() => ({ logReviewEvent: vi.fn() }));

vi.mock("../../models/index.js", () => mocks);
vi.mock("../../models/review.model.js", () => ({ default: mocks.Review }));
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../utils/logReview.js", () => logMocks);

const chain = (rows) => ({ sort: vi.fn(() => ({ skip: vi.fn(() => ({ limit: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(rows) })) })) })) });

describe("review/reviewComment access hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue();
    mocks.Review.countDocuments.mockResolvedValue(1);
    mocks.Review.find.mockReturnValue(chain([]));
    mocks.Review.aggregate.mockResolvedValue([]);
    mocks.Review.findByIdAndUpdate.mockResolvedValue({ _id: "valid-rv1", rating: 4, title: "t", content: "c", status: "pending", restaurantId: "valid-r1", helpfulCount: 1 });
    mocks.Review.create.mockResolvedValue({ _id: "valid-rv1", rating: 5, restaurantId: "valid-r1" });
    mocks.ReviewComment.countDocuments.mockResolvedValue(0);
    mocks.ReviewComment.find.mockReturnValue(chain([]));
    mocks.ReviewComment.create.mockResolvedValue({ id: "valid-c1", restaurantId: "valid-r1" });
  });

  it("public reviews force published and no guard", async () => {
    const q = (await import("../../graphql/resolvers/review/query.js")).default;
    await q.reviews(null, { restaurantId: "valid-r1" }, {});
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(mocks.Review.find).toHaveBeenCalledWith(expect.objectContaining({ status: "published" }));
  });

  it("staff pending reviews with restaurantId requires guard first", async () => {
    const q = (await import("../../graphql/resolvers/review/query.js")).default;
    await q.reviews(null, { restaurantId: "valid-r1", status: "pending" }, { user: { roleName: "manager" } });
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(guardMocks.requireRestaurantAccess.mock.invocationCallOrder[0]).toBeLessThan(mocks.Review.find.mock.invocationCallOrder[0]);
  });

  it("non-admin staff pending without restaurantId throws", async () => {
    const q = (await import("../../graphql/resolvers/review/query.js")).default;
    await expect(q.reviews(null, { status: "pending" }, { user: { roleName: "manager" } })).rejects.toThrow("restaurantId is required");
  });

  it("review pending denies public allows owner/staff scoped", async () => {
    const q = (await import("../../graphql/resolvers/review/query.js")).default;
    mocks.Review.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-rv1", status: "pending", createdBy: "u1", restaurantId: "valid-r1" }) });
    await expect(q.review(null, { id: "valid-rv1" }, {})).rejects.toThrow();
    await expect(q.review(null, { id: "valid-rv1" }, { user: { id: "u1" } })).resolves.toMatchObject({ _id: "valid-rv1" });
  });

  it("createReview requires login and forces pending/createdBy", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    await expect(m.createReview(null, { input: { status: "published" } }, {})).rejects.toThrow();
    await m.createReview(null, { input: { status: "published", createdBy: "x" } }, { user: { id: "u1" } });
    expect(mocks.Review.create).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", createdBy: "u1" }));
  });

  it("updateReview owner sanitizes forbidden fields", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    mocks.Review.findById.mockResolvedValue({ _id: "valid-rv1", createdBy: "u1", restaurantId: "valid-r1", rating: 1, title: "a", content: "b", status: "pending" });
    await m.updateReview(null, { id: "valid-rv1", input: { status: "published", restaurantId: "hack", helpfulCount: 999, title: "ok" } }, { user: { id: "u1" } });
    const patch = mocks.Review.findByIdAndUpdate.mock.calls[0][1];
    expect(patch.status).toBeUndefined(); expect(patch.restaurantId).toBeUndefined(); expect(patch.helpfulCount).toBeUndefined();
  });

  it("setReviewStatus only staff scoped", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    mocks.Review.findById.mockResolvedValue({ _id: "valid-rv1", createdBy: "u1", restaurantId: "valid-r1", status: "pending" });
    await expect(m.setReviewStatus(null, { id: "valid-rv1", status: "published" }, { user: { id: "u1", roleName: "customer" } })).rejects.toThrow();
    await m.setReviewStatus(null, { id: "valid-rv1", status: "published" }, { user: { id: "m1", roleName: "manager" } });
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
  });

  it("increment/react review block unpublished", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    mocks.Review.findById.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue({ _id: "valid-rv1", status: "pending" }) });
    await expect(m.incrementReviewHelpful(null, { id: "valid-rv1" }, {})).rejects.toThrow();
    mocks.Review.findById.mockResolvedValue({ _id: "valid-rv1", status: "pending", restaurantId: "valid-r1" });
    await expect(m.reactReview(null, { id: "valid-rv1", reaction: "like" }, { user: { id: "u1" } })).rejects.toThrow();
  });

  it("reviewComments unpublished denies public before comment db", async () => {
    const q = (await import("../../graphql/resolvers/review_comment/query.js")).default;
    mocks.Review.findById.mockReturnValue({ select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue({ _id: "valid-rv1", status: "pending", restaurantId: "valid-r1", createdBy: "u1" }) })) });
    await expect(q.reviewComments(null, { reviewId: "valid-rv1" }, {})).rejects.toThrow();
    expect(mocks.ReviewComment.find).not.toHaveBeenCalled();
  });

  it("createReviewComment derives restaurantId and validates parent", async () => {
    const m = (await import("../../graphql/resolvers/review_comment/mutation.js")).default;
    mocks.Review.findById.mockResolvedValue({ _id: "valid-rv1", status: "published", restaurantId: "valid-r1" });
    await m.createReviewComment(null, { input: { reviewId: "valid-rv1", restaurantId: "hack", content: "c" } }, { user: { id: "u1" } });
    expect(mocks.ReviewComment.create).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: "valid-r1", createdBy: "u1" }));
    mocks.ReviewComment.findById.mockResolvedValue({ reviewId: "other", restaurantId: "valid-r1" });
    await expect(m.createReviewComment(null, { input: { reviewId: "valid-rv1", parentId: "c1", content: "c" } }, { user: { id: "u1" } })).rejects.toThrow("Parent comment mismatch");
  });
});
