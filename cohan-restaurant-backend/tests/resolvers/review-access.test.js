import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  Review: { find: vi.fn(), findOne: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), aggregate: vi.fn(), findByIdAndUpdate: vi.fn(), findByIdAndDelete: vi.fn(), updateOne: vi.fn(), create: vi.fn() },
  ReviewReaction: { findOne: vi.fn(), create: vi.fn(), deleteOne: vi.fn(), findByIdAndUpdate: vi.fn() },
  ReviewReport: { countDocuments: vi.fn() },
  User: { findOne: vi.fn() },
  ReviewComment: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), create: vi.fn(), updateOne: vi.fn() },
  EventLog: { log: vi.fn() },
  Restaurant: { exists: vi.fn(), findById: vi.fn() },
  MenuItem: { exists: vi.fn() },
  Order: { findOne: vi.fn() },
  PaymentTransaction: { findOne: vi.fn() },
  Reservation: { findOne: vi.fn() },
  Notification: { create: vi.fn() },
}));
const authorizationMocks = vi.hoisted(() => ({ requireRestaurantPermission: vi.fn(), requirePermission: vi.fn() }));
const logMocks = vi.hoisted(() => ({ logReviewEvent: vi.fn() }));

vi.mock("../../models/index.js", () => mocks);
vi.mock("../../models/review.model.js", () => ({ default: mocks.Review }));
vi.mock("../../src/services/auth/authorization.service.js", () => authorizationMocks);
vi.mock("../../utils/logReview.js", () => logMocks);
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true) } }));

const chain = (rows) => ({
  sort: vi.fn(() => ({
    lean: vi.fn().mockResolvedValue(rows),
    skip: vi.fn(() => ({ limit: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(rows) })) })),
  })),
});

describe("review/reviewComment access hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizationMocks.requireRestaurantPermission.mockImplementation(async (ctx) => {
      if (!ctx?.user) throw new Error("UNAUTHENTICATED");
      if (String(ctx?.user?.roleName || "").toLowerCase() === "customer") throw new Error("FORBIDDEN");
      return true;
    });
    authorizationMocks.requirePermission.mockImplementation(async (ctx) => {
      if (!ctx?.user) throw new Error("UNAUTHENTICATED");
      if (String(ctx?.user?.roleName || "").toLowerCase() === "customer") throw new Error("FORBIDDEN");
      return true;
    });
    mocks.Review.countDocuments.mockResolvedValue(1);
    mocks.Review.find.mockReturnValue(chain([]));
    mocks.Review.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    mocks.Review.aggregate.mockResolvedValue([]);
    mocks.Restaurant.exists.mockResolvedValue(true);
    mocks.Restaurant.findById.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ managerId: null }) }) });
    mocks.Order.findOne.mockReturnValue({ sort: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) }) });
    mocks.PaymentTransaction.findOne.mockReturnValue({ sort: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) }) });
    mocks.Reservation.findOne.mockReturnValue({ sort: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) }) });
    mocks.Review.findByIdAndUpdate.mockResolvedValue({ _id: "valid-rv1", rating: 4, title: "t", content: "c", status: "reported", restaurantId: "valid-r1", helpfulCount: 1 });
    mocks.ReviewReport.countDocuments.mockResolvedValue(1);
    mocks.Review.create.mockResolvedValue({ _id: "valid-rv1", rating: 5, restaurantId: "valid-r1" });
    mocks.User.findOne.mockReturnValue({ select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue({ _id: "staff-1", fullName: "Real Staff" }) })) });
    mocks.ReviewComment.countDocuments.mockResolvedValue(0);
    mocks.ReviewComment.find.mockReturnValue(chain([]));
    mocks.ReviewComment.create.mockResolvedValue({ id: "valid-c1", restaurantId: "valid-r1" });
  });

  it("public reviews force published and no guard", async () => {
    const q = (await import("../../graphql/resolvers/review/query.js")).default;
    await q.reviews(null, { restaurantId: "valid-r1" }, {});
    expect(authorizationMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(mocks.Review.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
  });

  it("staff pending reviews with restaurantId requires guard first", async () => {
    const q = (await import("../../graphql/resolvers/review/query.js")).default;
    await q.reviews(null, { restaurantId: "valid-r1", status: "pending" }, { user: { roleName: "manager" } });
    expect(authorizationMocks.requireRestaurantPermission).toHaveBeenCalled();
    expect(authorizationMocks.requireRestaurantPermission.mock.invocationCallOrder[0]).toBeLessThan(mocks.Review.find.mock.invocationCallOrder[0]);
  });

  it("non-admin staff pending without restaurantId throws", async () => {
    const q = (await import("../../graphql/resolvers/review/query.js")).default;
    await expect(q.reviews(null, { status: "pending" }, { user: { roleName: "manager" } })).rejects.toThrow("Forbidden");
  });

  it("review pending denies public allows owner/staff scoped", async () => {
    const q = (await import("../../graphql/resolvers/review/query.js")).default;
    mocks.Review.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: "valid-rv1", status: "pending", createdBy: "u1", restaurantId: "valid-r1" }) });
    await expect(q.review(null, { id: "valid-rv1" }, {})).rejects.toThrow();
    await expect(q.review(null, { id: "valid-rv1" }, { user: { id: "u1" } })).resolves.toMatchObject({ _id: "valid-rv1" });
  });

  it("createReview requires login and publishes with backend-derived createdBy", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    await expect(m.createReview(null, { input: { status: "published" } }, {})).rejects.toThrow();
    await m.createReview(null, { input: { status: "published", createdBy: "x", rating: 5, content: "Nội dung đánh giá hợp lệ", targetType: "restaurant", targetId: "valid-r1", restaurantId: "valid-r1" } }, { user: { id: "u1" } });
    expect(mocks.Review.create).toHaveBeenCalledWith(expect.objectContaining({ status: "published", createdBy: "u1" }));
  });

  it("createReview with valid staff sets canonical staffId/staffName", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    await m.createReview(null, { input: { rating: 5, content: "Nội dung đánh giá hợp lệ", targetType: "restaurant", targetId: "valid-r1", restaurantId: "valid-r1", staffId: "staff-input", staffName: "Fake Name" } }, { user: { id: "u1" } });
    expect(mocks.User.findOne).toHaveBeenCalledWith(expect.objectContaining({ _id: "staff-input", userType: { $in: ["STAFF", "staff"] }, deletedAt: null, restaurantForStaff: "valid-r1" }));
    expect(mocks.Review.create).toHaveBeenCalledWith(expect.objectContaining({ staffId: "staff-1", staffName: "Real Staff" }));
  });

  it("createReview with invalid staff restaurant throws clear error", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    mocks.User.findOne.mockReturnValueOnce({ select: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) })) });
    await expect(m.createReview(null, { input: { rating: 5, content: "Nội dung đánh giá hợp lệ", targetType: "restaurant", targetId: "valid-r1", restaurantId: "valid-r1", staffId: "staff-bad" } }, { user: { id: "u1" } })).rejects.toThrow("Nhân viên không hợp lệ cho nhà hàng này.");
  });

  it("createReview without staffId stores null/empty staff fields", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    await m.createReview(null, { input: { rating: 5, content: "Nội dung đánh giá hợp lệ", targetType: "restaurant", targetId: "valid-r1", restaurantId: "valid-r1" } }, { user: { id: "u1" } });
    expect(mocks.User.findOne).not.toHaveBeenCalled();
    expect(mocks.Review.create).toHaveBeenCalledWith(expect.objectContaining({ staffId: null, staffName: "" }));
  });

  it("updateReview owner sanitizes forbidden fields", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    mocks.Review.findById.mockResolvedValue({ _id: "valid-rv1", createdBy: "u1", restaurantId: "valid-r1", rating: 1, title: "a", content: "Nội dung cũ hợp lệ", status: "pending", toObject() { return { _id: "valid-rv1", createdBy: "u1", restaurantId: "valid-r1", rating: 1, title: "a", content: "Nội dung cũ hợp lệ", status: "pending" }; } });
    await m.updateReview(null, { id: "valid-rv1", input: { status: "published", restaurantId: "hack", helpfulCount: 999, title: "ok" } }, { user: { id: "u1" } });
    const patch = mocks.Review.findByIdAndUpdate.mock.calls[0][1];
    expect(patch.status).toBeUndefined(); expect(patch.restaurantId).toBeUndefined(); expect(patch.helpfulCount).toBeUndefined();
  });

  it("setReviewStatus only allows staff scoped report-backed moderation", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    mocks.Review.findById.mockResolvedValue({ _id: "valid-rv1", createdBy: "u1", restaurantId: "valid-r1", status: "published" });
    await expect(m.setReviewStatus(null, { id: "valid-rv1", status: "reported" }, { user: { id: "u1", roleName: "customer" } })).rejects.toThrow();
    await m.setReviewStatus(null, { id: "valid-rv1", status: "reported" }, { user: { id: "m1", roleName: "manager" } });
    expect(authorizationMocks.requireRestaurantPermission).toHaveBeenCalled();
  });

  it("updateReview with valid staffId refreshes staffName snapshot", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    mocks.Review.findById.mockResolvedValue({ _id: "valid-rv1", createdBy: "u1", restaurantId: "valid-r1", rating: 1, title: "a", content: "Nội dung cũ hợp lệ", status: "pending", toObject() { return { _id: "valid-rv1", createdBy: "u1", restaurantId: "valid-r1", rating: 1, title: "a", content: "Nội dung cũ hợp lệ", status: "pending" }; } });
    await m.updateReview(null, { id: "valid-rv1", input: { staffId: "staff-new" } }, { user: { id: "u1" } });
    expect(mocks.Review.findByIdAndUpdate).toHaveBeenCalledWith(
      "valid-rv1",
      expect.objectContaining({ staffId: "staff-1", staffName: "Real Staff" }),
      { new: true }
    );
  });

  it("updateReview with only staffName does not persist raw staffName", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    mocks.Review.findById.mockResolvedValue({ _id: "valid-rv1", createdBy: "u1", restaurantId: "valid-r1", rating: 1, title: "a", content: "Nội dung cũ hợp lệ", status: "pending", toObject() { return { _id: "valid-rv1", createdBy: "u1", restaurantId: "valid-r1", rating: 1, title: "a", content: "Nội dung cũ hợp lệ", status: "pending" }; } });
    await m.updateReview(null, { id: "valid-rv1", input: { staffName: "Client Spoofed Name", title: "ok" } }, { user: { id: "u1" } });
    const patch = mocks.Review.findByIdAndUpdate.mock.calls[0][1];
    expect(patch.staffName).toBeUndefined();
    expect(patch.title).toBe("ok");
  });

  it("updateReview with staffId null clears staff fields", async () => {
    const m = (await import("../../graphql/resolvers/review/mutation.js")).default;
    mocks.Review.findById.mockResolvedValue({ _id: "valid-rv1", createdBy: "u1", restaurantId: "valid-r1", rating: 1, title: "a", content: "Nội dung cũ hợp lệ", status: "pending", toObject() { return { _id: "valid-rv1", createdBy: "u1", restaurantId: "valid-r1", rating: 1, title: "a", content: "Nội dung cũ hợp lệ", status: "pending" }; } });
    await m.updateReview(null, { id: "valid-rv1", input: { staffId: null, staffName: "Spoof" } }, { user: { id: "u1" } });
    expect(mocks.Review.findByIdAndUpdate).toHaveBeenCalledWith(
      "valid-rv1",
      expect.objectContaining({ staffId: null, staffName: "" }),
      { new: true }
    );
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
