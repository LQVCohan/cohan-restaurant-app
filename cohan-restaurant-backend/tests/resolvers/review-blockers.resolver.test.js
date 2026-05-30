import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reviews: new Map(),
  reports: new Map(),
  createdComments: [],
  ReviewReportCountDocuments: vi.fn(),
  ReviewUpdateOne: vi.fn(),
  ReviewCommentUpdateOne: vi.fn(),
  EventLogLog: vi.fn(),
}));

function clone(value) {
  return value ? { ...value } : value;
}

function makeReviewDoc(payload) {
  return {
    ...payload,
    _id: payload._id || payload.id,
    id: payload.id || payload._id,
    toObject: () => clone(payload),
  };
}

function makeReportDoc(payload) {
  return {
    ...payload,
    _id: payload._id || payload.id,
    id: payload.id || payload._id,
    save: vi.fn(async function save() {
      mocks.reports.set(String(this._id), this);
      return this;
    }),
  };
}

vi.mock("../../models/index.js", () => ({
  Review: {
    findById: vi.fn(async (id) => mocks.reviews.get(String(id)) || null),
    findByIdAndUpdate: vi.fn(async (id, update) => {
      const current = mocks.reviews.get(String(id));
      if (!current) return null;
      const next = makeReviewDoc({ ...current, ...(update?.$set || {}), ...Object.fromEntries(Object.entries(update || {}).filter(([key]) => !key.startsWith("$"))) });
      mocks.reviews.set(String(id), next);
      return next;
    }),
    updateOne: mocks.ReviewUpdateOne,
  },
  ReviewReport: {
    findById: vi.fn(async (id) => mocks.reports.get(String(id)) || null),
    countDocuments: mocks.ReviewReportCountDocuments,
  },
  ReviewComment: {
    create: vi.fn(async (payload) => {
      const doc = { id: `comment-${mocks.createdComments.length + 1}`, _id: `comment-${mocks.createdComments.length + 1}`, ...payload };
      mocks.createdComments.push(doc);
      return doc;
    }),
    findById: vi.fn(async () => null),
    updateOne: mocks.ReviewCommentUpdateOne,
  },
  ReviewHelpful: {},
  ReviewReaction: {},
  ReviewCommentReaction: {},
  EventLog: { log: mocks.EventLogLog },
  MenuItem: {},
  Order: {},
  PaymentTransaction: {},
  Reservation: {},
  Restaurant: {},
  User: {},
}));

vi.mock("../../graphql/guards.js", () => ({
  requirePermission: vi.fn((ctx, permission) => {
    const role = String(ctx?.user?.roleName || "").toLowerCase();
    if (role === "admin" || role === "manager" || (ctx?.user?.permissions || []).includes(permission)) return;
    throw new Error("FORBIDDEN");
  }),
  requireRestaurantAccess: vi.fn(),
}));

vi.mock("../../utils/logReview.js", () => ({
  logReviewEvent: vi.fn(),
}));

describe("review blocker resolver fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reviews.clear();
    mocks.reports.clear();
    mocks.createdComments.length = 0;
    mocks.ReviewReportCountDocuments.mockResolvedValue(0);
    mocks.ReviewUpdateOne.mockResolvedValue({ acknowledged: true });
    mocks.ReviewCommentUpdateOne.mockResolvedValue({ acknowledged: true });
    mocks.EventLogLog.mockResolvedValue(true);
  });

  it("creates a customer comment without authorName in input and derives identity", async () => {
    const { default: reviewCommentMutation } = await import("../../graphql/resolvers/review_comment/mutation.js");
    mocks.reviews.set("review-1", makeReviewDoc({ id: "review-1", _id: "review-1", restaurantId: "rest-1", status: "published" }));

    const comment = await reviewCommentMutation.createReviewComment(
      null,
      { input: { reviewId: "review-1", content: "Cảm ơn nhà hàng" } },
      { user: { id: "user-1", fullName: "Khách A", avatarUrl: "/a.png", roleName: "customer" } },
    );

    expect(comment.authorUserId).toBe("user-1");
    expect(comment.authorName).toBe("Khách A");
    expect(comment.authorAvatar).toBe("/a.png");
    expect(comment.restaurantId).toBe("rest-1");
    expect(comment.officialReply).toBe(false);
  });

  it("rejects customer-forged official replies", async () => {
    const { default: reviewCommentMutation } = await import("../../graphql/resolvers/review_comment/mutation.js");
    mocks.reviews.set("review-1", makeReviewDoc({ id: "review-1", _id: "review-1", restaurantId: "rest-1", status: "published" }));

    await expect(
      reviewCommentMutation.createReviewComment(
        null,
        { input: { reviewId: "review-1", officialReply: true, content: "Tôi là nhà hàng" } },
        { user: { id: "user-1", fullName: "Khách A", roleName: "customer" } },
      ),
    ).rejects.toThrow("FORBIDDEN");
    expect(mocks.createdComments).toHaveLength(0);
  });

  it("creates manager official replies and derives author from ctx.user", async () => {
    const { default: reviewCommentMutation } = await import("../../graphql/resolvers/review_comment/mutation.js");
    mocks.reviews.set("review-1", makeReviewDoc({ id: "review-1", _id: "review-1", restaurantId: "rest-1", restaurantName: "Cohan", status: "published" }));

    const comment = await reviewCommentMutation.createReviewComment(
      null,
      { input: { reviewId: "review-1", officialReply: true, content: "Cảm ơn quý khách" } },
      { user: { id: "manager-1", fullName: "Quản lý A", roleName: "manager" } },
    );

    expect(comment.authorUserId).toBe("manager-1");
    expect(comment.authorName).toBe("Quản lý A");
    expect(comment.restaurantId).toBe("rest-1");
    expect(comment.officialReply).toBe(true);
    expect(comment.replyByRestaurantId).toBe("rest-1");
  });

  it.each([
    ["reported", "published"],
    ["hidden", "hidden"],
    ["rejected", "rejected"],
  ])("resolveReviewReport changes %s review to %s when pending reports reach zero", async (initialStatus, expectedStatus) => {
    const { default: reviewMutation } = await import("../../graphql/resolvers/review/mutation.js");
    mocks.reviews.set("review-1", makeReviewDoc({ id: "review-1", _id: "review-1", restaurantId: "rest-1", status: initialStatus }));
    mocks.reports.set("report-1", makeReportDoc({ id: "report-1", _id: "report-1", reviewId: "review-1", restaurantId: "rest-1", status: "pending" }));
    mocks.ReviewReportCountDocuments.mockResolvedValue(0);

    await reviewMutation.resolveReviewReport(
      null,
      { id: "report-1", input: { status: "resolved", resolutionNote: "done" } },
      { user: { id: "manager-1", roleName: "manager" } },
    );

    expect(mocks.reviews.get("review-1").status).toBe(expectedStatus);
  });
});
