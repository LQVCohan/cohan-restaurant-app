import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReviewInsightProviderFromEnv, generateReviewInsight } from "../../src/services/reviewInsight.service.js";

const ORIGINAL_ENV = { ...process.env };

describe("reviewInsight.service", () => {
  const reviews = [
    { status: "published", rating: 5, title: "Ngon", content: "Món ngon, phục vụ nhanh", tags: ["food_quality"], customerId: "secret-user" },
    { status: "published", rating: 1, title: "Chậm", content: "Phục vụ chậm và hơi tệ", tags: ["service_speed"] },
  ];
  const analytics = { avgRating: 3, actionQueueCounts: { needsModeration: 1, needsReply: 1, highRisk: 1 } };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("uses deterministic heuristic when AI flag is disabled", async () => {
    process.env.REVIEW_AI_INSIGHTS_ENABLED = "false";
    const provider = { summarizeReviews: vi.fn() };
    const insight = await generateReviewInsight(reviews, analytics, provider);
    expect(insight.source).toBe("heuristic");
    expect(insight.summary).toContain("2 đánh giá công khai");
    expect(insight.summary).toContain("3.0/5");
    expect(provider.summarizeReviews).not.toHaveBeenCalled();
  });

  it("falls back to heuristic when Gemini is enabled but the API key is missing", async () => {
    process.env.REVIEW_AI_INSIGHTS_ENABLED = "true";
    process.env.AI_PROVIDER = "gemini";
    delete process.env.GEMINI_API_KEY;

    const provider = createReviewInsightProviderFromEnv(process.env, { fetchImpl: vi.fn() });
    expect(provider).toBeNull();
    const insight = await generateReviewInsight(reviews, analytics);
    expect(insight.source).toBe("heuristic");
  });

  it("uses Gemini provider JSON and sends only sanitized review fields", async () => {
    process.env.REVIEW_AI_INSIGHTS_ENABLED = "true";
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.AI_CHATBOT_MODEL = "gemini-1.5-flash";
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        summary: "Gemini thấy chất lượng món tốt nhưng tốc độ cần cải thiện.",
        positives: ["Món ngon"],
        negatives: ["Phục vụ chậm"],
        recommendedActions: ["Tối ưu quy trình ra món"],
        topPriorities: ["Phản hồi review 1 sao"],
        confidence: 0.91,
      }) }] } }] }),
    });
    const provider = createReviewInsightProviderFromEnv(process.env, { fetchImpl });
    const insight = await generateReviewInsight(reviews, analytics, provider);

    expect(insight.source).toBe("gemini");
    expect(insight.confidence).toBe(0.91);
    expect(insight.summary).toContain("Gemini");
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toContain("food_quality");
    expect(prompt).not.toContain("secret-user");
  });

  it("falls back when Gemini returns invalid JSON", async () => {
    process.env.REVIEW_AI_INSIGHTS_ENABLED = "true";
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    const provider = createReviewInsightProviderFromEnv(process.env, {
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }) }),
    });
    const insight = await generateReviewInsight(reviews, analytics, provider);
    expect(insight.source).toBe("heuristic_fallback");
  });

  it("falls back deterministically when provider fetch throws", async () => {
    process.env.REVIEW_AI_INSIGHTS_ENABLED = "true";
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    const provider = createReviewInsightProviderFromEnv(process.env, { fetchImpl: vi.fn().mockRejectedValue(new Error("offline")) });
    const insight = await generateReviewInsight(reviews, analytics, provider);
    expect(insight.source).toBe("heuristic_fallback");
    expect(insight.recommendedActions.length).toBeGreaterThan(0);
  });
});
