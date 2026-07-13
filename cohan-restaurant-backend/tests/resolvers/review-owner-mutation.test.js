import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  Review: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  logReviewEvent: vi.fn(),
  normalizeReviewInput: vi.fn(),
  normalizeReviewStaff: vi.fn(),
  analyzeReviewText: vi.fn(),
}));

vi.mock("../../models/review.model.js", () => ({ default: mocks.Review }));
vi.mock("../../utils/logReview.js", () => ({ logReviewEvent: mocks.logReviewEvent }));
vi.mock("../../src/services/reviewHardening.service.js", () => ({
  analyzeReviewText: mocks.analyzeReviewText,
  forbidden: (message = "Forbidden") =>
    Object.assign(new Error(message), { extensions: { code: "FORBIDDEN" } }),
  normalizeReviewInput: mocks.normalizeReviewInput,
  normalizeReviewStaff: mocks.normalizeReviewStaff,
  unauthenticated: (message = "Login required") =>
    Object.assign(new Error(message), { extensions: { code: "UNAUTHENTICATED" } }),
}));

const customerCtx = { user: { id: "customer-1" } };
const otherCustomerCtx = { user: { id: "customer-2" } };

const reviewDocument = (overrides = {}) => ({
  _id: "review-1",
  id: "review-1",
  customerId: "customer-1",
  createdBy: "customer-1",
  restaurantId: "restaurant-1",
  status: "published",
  rating: 5,
  title: "Tốt",
  content: "Nội dung đánh giá ban đầu đủ dài",
  images: [],
  tags: [],
  location: "",
  staffId: null,
  toObject() {
    return { ...this };
  },
  ...overrides,
});

let ownerMutation;

beforeEach(async () => {
  vi.clearAllMocks();
  ownerMutation = await import("../../graphql/resolvers/review/ownerMutation.js");
  mocks.normalizeReviewInput.mockReturnValue({
    rating: 4,
    title: "Đã sửa",
    content: "Nội dung sau khi chỉnh sửa đủ dài",
    images: [],
    tags: [],
    location: "",
  });
  mocks.normalizeReviewStaff.mockResolvedValue({ staffId: null, staffName: "" });
  mocks.analyzeReviewText.mockReturnValue({ sentiment: "positive", topicTags: [] });
});

describe("review owner mutations", () => {
  it("allows the owner to edit a published review and preserves public status", async () => {
    const before = reviewDocument();
    const updated = reviewDocument({
      rating: 4,
      title: "Đã sửa",
      content: "Nội dung sau khi chỉnh sửa đủ dài",
    });
    mocks.Review.findById.mockResolvedValue(before);
    mocks.Review.findByIdAndUpdate.mockResolvedValue(updated);

    const result = await ownerMutation.resolveOwnerUpdateReview(
      vi.fn(),
      null,
      {
        id: "review-1",
        input: {
          rating: 4,
          title: "Đã sửa",
          content: "Nội dung sau khi chỉnh sửa đủ dài",
          staffId: null,
        },
      },
      customerCtx,
    );

    expect(result.status).toBe("published");
    expect(mocks.Review.findByIdAndUpdate).toHaveBeenCalledWith(
      "review-1",
      expect.objectContaining({
        rating: 4,
        title: "Đã sửa",
        content: "Nội dung sau khi chỉnh sửa đủ dài",
        staffId: null,
        updatedBy: "customer-1",
      }),
      { new: true, runValidators: true },
    );
    expect(mocks.logReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ verb: "review.owner.update" }),
    );
  });

  it("delegates non-owner updates to the existing manager/admin policy", async () => {
    const baseResolver = vi
      .fn()
      .mockResolvedValue({ id: "review-1", moderationNote: "Đã ghi chú" });
    mocks.Review.findById.mockResolvedValue(reviewDocument());

    const result = await ownerMutation.resolveOwnerUpdateReview(
      baseResolver,
      null,
      { id: "review-1", input: { moderationNote: "Đã ghi chú" } },
      otherCustomerCtx,
    );

    expect(result.moderationNote).toBe("Đã ghi chú");
    expect(baseResolver).toHaveBeenCalledWith(
      null,
      { id: "review-1", input: { moderationNote: "Đã ghi chú" } },
      otherCustomerCtx,
      undefined,
    );
    expect(mocks.Review.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("temporarily blocks editing while a review is under report review", async () => {
    mocks.Review.findById.mockResolvedValue(
      reviewDocument({ status: "reported" }),
    );

    await expect(
      ownerMutation.resolveOwnerUpdateReview(
        vi.fn(),
        null,
        {
          id: "review-1",
          input: { rating: 4, content: "Nội dung đủ dài để cập nhật" },
        },
        customerCtx,
      ),
    ).rejects.toThrow("đang được xem xét");
  });

  it("soft deletes a published review owned by the current customer", async () => {
    const before = reviewDocument();
    mocks.Review.findById.mockResolvedValue(before);
    mocks.Review.findByIdAndUpdate.mockResolvedValue(before);

    const result = await ownerMutation.resolveOwnerDeleteReview(
      vi.fn(),
      null,
      { id: "review-1" },
      customerCtx,
    );

    expect(result).toBe(true);
    expect(mocks.Review.findByIdAndUpdate).toHaveBeenCalledWith(
      "review-1",
      expect.objectContaining({
        status: "hidden",
        moderationReason: "owner_deleted",
        moderatedBy: "customer-1",
        updatedBy: "customer-1",
      }),
      { new: false },
    );
    expect(mocks.logReviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ verb: "review.owner.softDelete" }),
    );
  });
});
