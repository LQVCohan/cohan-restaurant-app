import { describe, expect, it } from "vitest";
import {
  analyzeReviewText,
  buildReactionIncPayload,
  deriveCustomerIdentity,
  normalizeReviewInput,
} from "../../src/services/reviewHardening.service.js";

describe("review hardening helpers", () => {
  it("derives customer identity from authenticated context and ignores client identity", () => {
    const identity = deriveCustomerIdentity({ user: { id: "u1", fullName: "Nguyễn Văn A", avatarUrl: "/a.png" } });
    expect(identity).toEqual({ customerId: "u1", customerName: "Nguyễn Văn A", customerAvatar: "/a.png" });
  });

  it("normalizes safe review input and drops excessive duplicate tags", () => {
    const input = normalizeReviewInput({
      rating: 5,
      title: "  Tuyệt vời  ",
      content: "Món ăn ngon, phục vụ nhanh.",
      images: ["/uploads/review/a.jpg"],
      tags: [" Ngon ", "ngon", "Sạch"],
    });
    expect(input.title).toBe("Tuyệt vời");
    expect(input.tags).toEqual(["ngon", "sạch"]);
  });

  it("rejects invalid rating/content/images", () => {
    expect(() => normalizeReviewInput({ rating: 6, content: "Nội dung hợp lệ dài" })).toThrow();
    expect(() => normalizeReviewInput({ rating: 5, content: "ngắn" })).toThrow();
    expect(() => normalizeReviewInput({ rating: 5, content: "Nội dung hợp lệ dài", images: ["javascript:alert(1)"] })).toThrow();
  });

  it("builds idempotent reaction counter deltas for set/unset/change", () => {
    expect(buildReactionIncPayload({ inc: { like: 1 }, dec: {} })).toEqual({ "reactions.like": 1, likesCount: 1 });
    expect(buildReactionIncPayload({ inc: {}, dec: { like: 1 } })).toEqual({ "reactions.like": -1, likesCount: -1 });
    expect(buildReactionIncPayload({ inc: { love: 1 }, dec: { like: 1 } })).toEqual({ "reactions.love": 1, "reactions.like": -1, likesCount: -1 });
  });

  it("computes deterministic Vietnamese sentiment/topics", () => {
    const result = analyzeReviewText("", "Món ngon, phục vụ nhanh và sạch sẽ");
    expect(result.sentiment).toBe("positive");
    expect(result.topicTags).toContain("food_quality");
    expect(result.topicTags).toContain("service_speed");
  });
});
