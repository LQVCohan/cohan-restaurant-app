import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  Notification: { create: vi.fn() },
  Restaurant: { findById: vi.fn() },
  BrandMembership: { find: vi.fn() },
  Review: {
    findOne: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
    find: vi.fn(),
  },
  ReviewHelpful: { findOne: vi.fn(), create: vi.fn() },
  ReviewReaction: { findOne: vi.fn(), create: vi.fn() },
  ReviewReport: {
    countDocuments: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findById: vi.fn(),
  },
  ReviewComment: { find: vi.fn() },
  EventLog: {},
  logReviewEvent: vi.fn(),
  requirePermission: vi.fn(),
  requireRestaurantAccess: vi.fn(),
  normalizeReviewInput: vi.fn(),
  validateReviewTarget: vi.fn(),
  normalizeReviewTargetForPersistence: vi.fn(),
  deriveCustomerIdentity: vi.fn(),
  normalizeReviewStaff: vi.fn(),
  resolveVerifiedReview: vi.fn(),
  analyzeReviewText: vi.fn(),
  calculateReviewReliability: vi.fn(),
}));

vi.mock("../../models/index.js", () => ({
  Notification: mocks.Notification,
  Restaurant: mocks.Restaurant,
  BrandMembership: mocks.BrandMembership,
  Review: mocks.Review,
  ReviewHelpful: mocks.ReviewHelpful,
  ReviewReaction: mocks.ReviewReaction,
  ReviewReport: mocks.ReviewReport,
  ReviewComment: mocks.ReviewComment,
  EventLog: mocks.EventLog,
}));
vi.mock("../../models/review.model.js", () => ({ default: mocks.Review }));

vi.mock("../../utils/logReview.js", () => ({ logReviewEvent: mocks.logReviewEvent }));
vi.mock("../../graphql/guards.js", () => ({
  requirePermission: mocks.requirePermission,
  requireRestaurantAccess: mocks.requireRestaurantAccess,
}));
vi.mock("../../src/services/reviewHardening.service.js", () => ({
  REVIEW_REACTION_TYPES: ["like"],
  REVIEW_REPORT_REASONS: ["spam", "abuse", "offensive", "fake", "privacy", "other"],
  REVIEW_STATUSES: ["pending", "published", "hidden", "reported", "rejected"],
  analyzeReviewText: mocks.analyzeReviewText,
  calculateReviewReliability: mocks.calculateReviewReliability,
  badUserInput: (message) => Object.assign(new Error(message), { extensions: { code: "BAD_USER_INPUT" } }),
  buildReactionIncPayload: vi.fn((x) => x),
  clampReactionSummary: vi.fn(() => ({})),
  deriveCustomerIdentity: mocks.deriveCustomerIdentity,
  forbidden: (message = "Forbidden") => Object.assign(new Error(message), { extensions: { code: "FORBIDDEN" } }),
  normalizeReviewInput: mocks.normalizeReviewInput,
  normalizeReviewStaff: mocks.normalizeReviewStaff,
  normalizeReviewTargetForPersistence: mocks.normalizeReviewTargetForPersistence,
  resolveVerifiedReview: mocks.resolveVerifiedReview,
  unauthenticated: (message = "Login required") => Object.assign(new Error(message), { extensions: { code: "UNAUTHENTICATED" } }),
  validateReviewTarget: mocks.validateReviewTarget,
}));

const leanResult = (value) => ({ lean: vi.fn(async () => value) });
const membershipFindResult = (rows = []) => ({
  select: vi.fn(() => ({ lean: vi.fn(async () => rows) })),
});
const managerCtx = { user: { id: "manager1", roleName: "Manager" } };
const adminCtx = { user: { id: "admin1", roleName: "Admin" } };
const customerCtx = { user: { id: "customer1", fullName: "Minh" } };

let mutation;
let query;

beforeEach(async () => {
  vi.clearAllMocks();
  mutation = (await import("../../graphql/resolvers/review/mutation.js")).default;
  query = (await import("../../graphql/resolvers/review/query.js")).default;

  mocks.normalizeReviewInput.mockReturnValue({ rating: 2, title: "Chậm", content: "Nội dung đánh giá đủ dài", images: [], tags: [], location: "HN" });
  mocks.validateReviewTarget.mockResolvedValue(null);
  mocks.normalizeReviewTargetForPersistence.mockReturnValue({ targetId: "restaurant1", targetName: "Cohan" });
  mocks.deriveCustomerIdentity.mockReturnValue({ customerId: "customer1", customerName: "Minh", customerAvatar: "" });
  mocks.normalizeReviewStaff.mockResolvedValue({ staffId: null, staffName: "" });
  mocks.resolveVerifiedReview.mockResolvedValue({ verifiedPurchase: true, verifiedSource: "order", verifiedSourceId: "order1" });
  mocks.analyzeReviewText.mockReturnValue({ sentiment: "negative", topicTags: ["slow_service"] });
  mocks.calculateReviewReliability.mockReturnValue({ reliabilityScore: 95, reliabilityLevel: "high", reliabilitySignals: ["verified_experience", "source:order"] });
  mocks.Review.findOne.mockReturnValue(leanResult(null));
  mocks.Restaurant.findById.mockReturnValue({ select: vi.fn(() => ({ lean: vi.fn(async () => ({ managerId: "manager1", name: "Cohan" })) })) });
  mocks.BrandMembership.find.mockReturnValue(membershipFindResult([{ userId: "manager1", brandId: "brand1", role: "manager", status: "active", restaurantIds: ["restaurant1"] }]));
  mocks.Notification.create.mockResolvedValue({ _id: "notification1" });
} );

describe("transparent review flow", () => {
  it("creates customer review as published immediately and keeps hardening metadata", async () => {
    mocks.Review.create.mockImplementation(async (payload) => ({ id: "review1", ...payload }));

    const created = await mutation.createReview(null, {
      input: { targetType: "restaurant", targetId: "restaurant1", restaurantId: "restaurant1", rating: 2, content: "Nội dung đánh giá đủ dài" },
    }, customerCtx);

    expect(created.status).toBe("published");
    expect(mocks.Review.create).toHaveBeenCalledWith(expect.objectContaining({
      status: "published",
      verifiedPurchase: true,
      verifiedSource: "order",
      sentiment: "negative",
      topicTags: ["slow_service"],
    }));
    expect(mocks.logReviewEvent).toHaveBeenCalledWith(expect.objectContaining({ verb: "review.create" }));
    expect(mocks.logReviewEvent).toHaveBeenCalledWith(expect.objectContaining({ verb: "review.notification.negative" }));
    expect(mocks.BrandMembership.find).toHaveBeenCalledWith({ role: "manager", status: "active", restaurantIds: "restaurant1" });
    expect(mocks.Notification.create).toHaveBeenCalled();
  });

  it("blocks duplicate customer review in the 24h guard scope", async () => {
    mocks.Review.findOne.mockReturnValue(leanResult({ _id: "existing" }));

    await expect(mutation.createReview(null, {
      input: { targetType: "restaurant", targetId: "restaurant1", restaurantId: "restaurant1", rating: 5, content: "Nội dung đánh giá đủ dài" },
    }, customerCtx)).rejects.toThrow("Bạn đã gửi đánh giá");

    expect(mocks.Review.findOne).toHaveBeenCalledWith(expect.objectContaining({
      customerId: "customer1",
      restaurantId: "restaurant1",
      targetType: "restaurant",
      targetId: "restaurant1",
      status: { $in: ["pending", "published", "reported"] },
    }));
  });

  it("public published reviews query includes reported reviews", async () => {
    mocks.Review.countDocuments.mockResolvedValue(2);
    mocks.Review.find.mockReturnValue({
      sort: vi.fn(() => ({
        skip: vi.fn(() => ({
          limit: vi.fn(() => ({ lean: vi.fn(async () => [{ _id: "review1", id: "review1", status: "reported" }]) })),
        })),
      })),
    });
    mocks.ReviewComment.find.mockReturnValue({ sort: vi.fn(() => ({ lean: vi.fn(async () => []) })) });

    const result = await query.reviews(null, { restaurantId: "restaurant1", status: "published", limit: 20, skip: 0 }, {});

    expect(mocks.Review.countDocuments).toHaveBeenCalledWith(expect.objectContaining({ status: { $in: ["published", "reported"] } }));
    expect(result.items[0].status).toBe("reported");
  });

  it("keeps same user/reason report idempotent by upsert key and recalculated pending count", async () => {
    mocks.Review.findById.mockResolvedValue({ id: "review1", restaurantId: "restaurant1", status: "published" });
    mocks.ReviewReport.findOneAndUpdate.mockResolvedValue({ id: "report1" });
    mocks.ReviewReport.countDocuments.mockResolvedValue(1);
    mocks.Review.findByIdAndUpdate.mockResolvedValue({ id: "review1", restaurantId: "restaurant1", status: "published", reportsCount: 1 });

    await mutation.reportReview(null, { id: "review1", input: { reason: "other", detail: "duplicate" } }, customerCtx);

    expect(mocks.ReviewReport.findOneAndUpdate).toHaveBeenCalledWith(
      { reviewId: "review1", reporterUserId: "customer1", reason: "other" },
      expect.any(Object),
      expect.objectContaining({ upsert: true }),
    );
    expect(mocks.Review.findByIdAndUpdate).toHaveBeenCalledWith("review1", expect.objectContaining({ reportsCount: 1, status: "published" }), { new: true });
  });

  it("moves severe reports to reported without hiding the review", async () => {
    mocks.Review.findById.mockResolvedValue({ id: "review1", restaurantId: "restaurant1", status: "published" });
    mocks.ReviewReport.findOneAndUpdate.mockResolvedValue({ id: "report1" });
    mocks.ReviewReport.countDocuments.mockResolvedValue(1);
    mocks.Review.findByIdAndUpdate.mockResolvedValue({ id: "review1", restaurantId: "restaurant1", status: "reported", reportsCount: 1 });

    await mutation.reportReview(null, { id: "review1", input: { reason: "privacy", detail: "private data" } }, customerCtx);

    expect(mocks.Review.findByIdAndUpdate).toHaveBeenCalledWith("review1", expect.objectContaining({ reportsCount: 1, status: "reported" }), { new: true });
    expect(mocks.logReviewEvent).toHaveBeenCalledWith(expect.objectContaining({ verb: "review.report.create" }));
  });


  it("blocks updateReview bypasses for manager/admin and keeps owner public reviews immutable", async () => {
    mocks.Review.findById.mockResolvedValue({
      id: "review1",
      restaurantId: "restaurant1",
      status: "published",
      rating: 2,
      title: "Original",
      content: "Original content",
      customerId: "customer1",
      createdBy: "customer1",
    });

    await expect(mutation.updateReview(null, { id: "review1", input: { status: "hidden", moderationNote: "hide it" } }, managerCtx))
      .rejects.toThrow("không được sửa nội dung");
    await expect(mutation.updateReview(null, { id: "review1", input: { rating: 5, title: "Better", content: "Edited by manager" } }, managerCtx))
      .rejects.toThrow("không được sửa nội dung");
    await expect(mutation.updateReview(null, { id: "review1", input: { status: "hidden" } }, adminCtx))
      .rejects.toThrow("không được sửa nội dung");
    await expect(mutation.updateReview(null, { id: "review1", input: { content: "Owner edit after public" } }, customerCtx))
      .rejects.toThrow("Đánh giá đã công khai");

    expect(mocks.Review.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("lets manager store only an internal moderation note through updateReview", async () => {
    mocks.Review.findById.mockResolvedValue({ id: "review1", restaurantId: "restaurant1", status: "published", customerId: "customer1", createdBy: "customer1" });
    mocks.Review.findByIdAndUpdate.mockResolvedValue({ id: "review1", restaurantId: "restaurant1", status: "published", moderationNote: "watch report" });

    const updated = await mutation.updateReview(null, { id: "review1", input: { moderationNote: " watch report " } }, managerCtx);

    expect(updated.moderationNote).toBe("watch report");
    expect(mocks.Review.findByIdAndUpdate).toHaveBeenCalledWith("review1", expect.objectContaining({ moderationNote: "watch report" }), { new: true });
    expect(mocks.Review.findByIdAndUpdate.mock.calls[0][1].status).toBeUndefined();
  });

  it("blocks deleteReview for manager/admin bypass and only lets owners delete non-public drafts", async () => {
    mocks.Review.findById.mockResolvedValueOnce({ id: "review1", restaurantId: "restaurant1", status: "published", customerId: "customer1", createdBy: "customer1" });
    await expect(mutation.deleteReview(null, { id: "review1" }, managerCtx)).rejects.toThrow("Không được dùng deleteReview");

    mocks.Review.findById.mockResolvedValueOnce({ id: "review1", restaurantId: "restaurant1", status: "published", customerId: "customer1", createdBy: "customer1" });
    await expect(mutation.deleteReview(null, { id: "review1" }, adminCtx)).rejects.toThrow("Không được dùng deleteReview");

    mocks.Review.findById.mockResolvedValueOnce({ id: "review1", restaurantId: "restaurant1", status: "published", customerId: "customer1", createdBy: "customer1" });
    await expect(mutation.deleteReview(null, { id: "review1" }, customerCtx)).rejects.toThrow("Đánh giá đã công khai");

    mocks.Review.findById.mockResolvedValueOnce({ id: "review2", restaurantId: "restaurant1", status: "pending", customerId: "customer1", createdBy: "customer1" });
    mocks.Review.findByIdAndUpdate.mockResolvedValue({ id: "review2", status: "hidden" });
    await expect(mutation.deleteReview(null, { id: "review2" }, customerCtx)).resolves.toBe(true);
    expect(mocks.Review.findByIdAndUpdate).toHaveBeenCalledWith("review2", expect.objectContaining({ status: "hidden", moderationReason: "owner_deleted" }));
  });

  it("allows helpful and reactions on reported reviews because they remain public-visible", async () => {
    mocks.Review.findById.mockResolvedValueOnce({ id: "review1", restaurantId: "restaurant1", status: "reported", helpfulCount: 0 });
    mocks.ReviewHelpful.findOne.mockResolvedValue(null);
    mocks.ReviewHelpful.create.mockResolvedValue({ id: "helpful1" });
    mocks.Review.findByIdAndUpdate.mockResolvedValueOnce({ id: "review1", restaurantId: "restaurant1", status: "reported", helpfulCount: 1 });

    const helpful = await mutation.incrementReviewHelpful(null, { id: "review1" }, customerCtx);
    expect(helpful.helpfulCount).toBe(1);

    mocks.Review.findById.mockResolvedValueOnce({ id: "review1", restaurantId: "restaurant1", status: "reported" });
    mocks.ReviewReaction.findOne.mockResolvedValue(null);
    mocks.ReviewReaction.create.mockResolvedValue({ id: "reaction1" });
    mocks.Review.findByIdAndUpdate.mockResolvedValueOnce({ id: "review1", restaurantId: "restaurant1", status: "reported", reactions: { like: 1 } });

    const reacted = await mutation.reactReview(null, { id: "review1", reaction: "like" }, customerCtx);
    expect(reacted.reactions.like).toBe(1);
  });

  it("prevents manager from hiding or rejecting arbitrary negative reviews", async () => {
    mocks.Review.findById.mockResolvedValue({ id: "review1", restaurantId: "restaurant1", status: "published" });

    await expect(mutation.setReviewStatus(null, { id: "review1", status: "hidden", reason: "bad rating", moderationNote: "bad rating" }, managerCtx))
      .rejects.toThrow("Manager không được");
  });

  it("allows manager to mark reported only when an open report exists", async () => {
    mocks.Review.findById.mockResolvedValue({ id: "review1", restaurantId: "restaurant1", status: "published" });
    mocks.ReviewReport.countDocuments.mockResolvedValue(1);
    mocks.Review.findByIdAndUpdate.mockResolvedValue({ id: "review1", restaurantId: "restaurant1", status: "reported" });

    const updated = await mutation.setReviewStatus(null, { id: "review1", status: "reported", reason: "report queue", moderationNote: "report queue" }, managerCtx);

    expect(updated.status).toBe("reported");
    expect(mocks.Review.findByIdAndUpdate).toHaveBeenCalledWith("review1", expect.objectContaining({ status: "reported" }), { new: true });
  });

  it("requires Admin policy reason before hidden/rejected status", async () => {
    mocks.Review.findById.mockResolvedValue({ id: "review1", restaurantId: "restaurant1", status: "published" });

    await expect(mutation.setReviewStatus(null, { id: "review1", status: "hidden", reason: "short", moderationNote: "short" }, adminCtx))
      .rejects.toThrow("Admin phải nhập lý do");

    mocks.Review.findByIdAndUpdate.mockResolvedValue({ id: "review1", restaurantId: "restaurant1", status: "hidden" });
    const updated = await mutation.setReviewStatus(null, { id: "review1", status: "hidden", reason: "Tiết lộ thông tin riêng tư của khách", moderationNote: "policy" }, adminCtx);
    expect(updated.status).toBe("hidden");
  });
});
