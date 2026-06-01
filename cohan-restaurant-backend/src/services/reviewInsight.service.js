const POSITIVE_WORDS = ["ngon", "tốt", "nhanh", "sạch", "thân thiện", "hài lòng", "tuyệt", "đẹp"];
const NEGATIVE_WORDS = ["chậm", "lạnh", "tệ", "bẩn", "đắt", "ồn", "khó chịu", "thất vọng"];

const pickTags = (reviews, words) => {
  const counts = new Map();
  reviews.forEach((review) => {
    const text = `${review.title || ""} ${review.content || ""} ${(review.topicTags || []).join(" ")} ${(review.tags || []).join(" ")}`.toLowerCase();
    words.forEach((word) => {
      if (text.includes(word)) counts.set(word, (counts.get(word) || 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([word]) => word);
};

export function buildHeuristicReviewInsight(reviews = [], analytics = {}) {
  const published = reviews.filter((r) => ["published", "reported"].includes(r.status));
  const negative = published.filter((r) => Number(r.rating || 0) <= 2);
  const unrepliedNegative = negative.filter((r) => !r.firstOfficialReplyAt);
  const positives = pickTags(published.filter((r) => Number(r.rating || 0) >= 4), POSITIVE_WORDS);
  const negatives = pickTags(negative, NEGATIVE_WORDS);
  const topPriorities = [];
  if (analytics.actionQueueCounts?.needsModeration) topPriorities.push("Xử lý review pending/reported lâu nhất trước.");
  if (unrepliedNegative.length) topPriorities.push("Phản hồi review 1–2 sao chưa có official reply.");
  if (analytics.actionQueueCounts?.highRisk) topPriorities.push("Ưu tiên review high-risk có nhiều report hoặc 1 sao.");
  if (!topPriorities.length) topPriorities.push("Duy trì SLA phản hồi và theo dõi rating trend hằng tuần.");
  const recommendedActions = [
    ...topPriorities,
    negatives.length ? `Theo dõi chủ đề khách chê: ${negatives.join(", ")}.` : "Tiếp tục gom tag phàn nàn để phát hiện vấn đề lặp lại.",
    positives.length ? `Khai thác điểm mạnh khách khen: ${positives.join(", ")}.` : "Khuyến khích khách để lại review chi tiết hơn sau trải nghiệm tốt.",
  ].slice(0, 5);
  const avg = Number(analytics.avgRating || 0).toFixed(1);
  return {
    summary: `Heuristic summary: ${published.length} review công khai, điểm trung bình ${avg}/5, ${negative.length} review tiêu cực và ${unrepliedNegative.length} review tiêu cực chưa phản hồi.`,
    positives: positives.length ? positives : ["Chưa đủ tín hiệu tích cực nổi bật"],
    negatives: negatives.length ? negatives : ["Chưa đủ tín hiệu tiêu cực nổi bật"],
    recommendedActions,
    topPriorities: topPriorities.slice(0, 3),
    confidence: published.length >= 10 ? 0.78 : 0.62,
    source: "heuristic",
  };
}

export async function generateReviewInsight(reviews = [], analytics = {}, provider = null) {
  const fallback = buildHeuristicReviewInsight(reviews, analytics);
  const enabled = String(process.env.REVIEW_AI_INSIGHTS_ENABLED || "false").toLowerCase() === "true";
  if (!enabled || !provider?.summarizeReviews) return fallback;
  try {
    const safeReviews = reviews.slice(0, 80).map((r) => ({ rating: r.rating, title: r.title, content: String(r.content || "").slice(0, 500), tags: r.tags || [], topicTags: r.topicTags || [] }));
    const ai = await provider.summarizeReviews({ reviews: safeReviews, analytics });
    return { ...fallback, ...ai, source: "ai", confidence: Number(ai?.confidence || 0.82) };
  } catch (_) {
    return { ...fallback, source: "heuristic_fallback" };
  }
}
