import { describe, expect, it } from "vitest";
import {
  buildHeuristicReviewInsight,
  generateReviewInsight,
} from "../../src/services/reviewInsight.service.js";

describe("review insight empty state", () => {
  it("returns a Vietnamese no-data summary instead of an English heuristic sentence", () => {
    const insight = buildHeuristicReviewInsight([], {
      avgRating: 0,
      actionQueueCounts: {
        needsModeration: 0,
        needsReply: 0,
        highRisk: 0,
      },
    });

    expect(insight.source).toBe("no_data");
    expect(insight.confidence).toBe(0);
    expect(insight.summary).toContain("Chưa có đánh giá công khai");
    expect(insight.summary).not.toContain("Heuristic summary");
    expect(insight.recommendedActions.length).toBeGreaterThan(0);
  });

  it("does not call an AI provider when there are no public reviews", async () => {
    const provider = {
      source: "gemini",
      summarizeReviews: async () => {
        throw new Error("provider should not be called");
      },
    };

    const insight = await generateReviewInsight([], {}, provider);

    expect(insight.source).toBe("no_data");
  });
});
