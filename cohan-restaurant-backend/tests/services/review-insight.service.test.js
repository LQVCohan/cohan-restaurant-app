import { describe, expect, it, vi } from "vitest";
import { generateReviewInsight } from "../../src/services/reviewInsight.service.js";

describe("reviewInsight.service", () => {
  const reviews = [
    { status: "published", rating: 5, title: "Ngon", content: "Món ngon, phục vụ nhanh", tags: ["food_quality"] },
    { status: "published", rating: 1, title: "Chậm", content: "Phục vụ chậm và hơi tệ", tags: ["service_speed"] },
  ];
  const analytics = { avgRating: 3, actionQueueCounts: { needsModeration: 1, needsReply: 1, highRisk: 1 } };

  it("uses deterministic heuristic when AI flag is disabled", async () => {
    const old = process.env.REVIEW_AI_INSIGHTS_ENABLED;
    process.env.REVIEW_AI_INSIGHTS_ENABLED = "false";
    const provider = { summarizeReviews: vi.fn() };
    const insight = await generateReviewInsight(reviews, analytics, provider);
    expect(insight.source).toBe("heuristic");
    expect(insight.summary).toContain("Heuristic summary");
    expect(provider.summarizeReviews).not.toHaveBeenCalled();
    process.env.REVIEW_AI_INSIGHTS_ENABLED = old;
  });

  it("falls back deterministically when provider fails", async () => {
    const old = process.env.REVIEW_AI_INSIGHTS_ENABLED;
    process.env.REVIEW_AI_INSIGHTS_ENABLED = "true";
    const insight = await generateReviewInsight(reviews, analytics, { summarizeReviews: vi.fn().mockRejectedValue(new Error("offline")) });
    expect(insight.source).toBe("heuristic_fallback");
    expect(insight.recommendedActions.length).toBeGreaterThan(0);
    process.env.REVIEW_AI_INSIGHTS_ENABLED = old;
  });
});
