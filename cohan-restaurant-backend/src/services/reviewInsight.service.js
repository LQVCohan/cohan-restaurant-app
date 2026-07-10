import {
  DEFAULT_GEMINI_MODEL,
  generateGeminiJson,
} from "./ai/geminiClient.service.js";

const POSITIVE_WORDS = [
  "ngon",
  "tốt",
  "nhanh",
  "sạch",
  "thân thiện",
  "hài lòng",
  "tuyệt",
  "đẹp",
];
const NEGATIVE_WORDS = [
  "chậm",
  "lạnh",
  "tệ",
  "bẩn",
  "đắt",
  "ồn",
  "khó chịu",
  "thất vọng",
];
const MAX_REVIEWS_FOR_AI = 80;
const MAX_REVIEW_CONTENT_CHARS = 500;

const pickTags = (reviews, words) => {
  const counts = new Map();
  reviews.forEach((review) => {
    const text = `${review.title || ""} ${review.content || ""} ${(
      review.topicTags || []
    ).join(" ")} ${(review.tags || []).join(" ")}`.toLowerCase();
    words.forEach((word) => {
      if (text.includes(word)) counts.set(word, (counts.get(word) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => word);
};

const toArray = (value) =>
  Array.isArray(value)
    ? value
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

const clampConfidence = (value, fallback = 0.82) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
};

const sanitizeReviewsForAi = (reviews = []) =>
  reviews.slice(0, MAX_REVIEWS_FOR_AI).map((review) => ({
    rating: Number(review.rating || 0),
    title: String(review.title || "").slice(0, 160),
    content: String(review.content || "").slice(
      0,
      MAX_REVIEW_CONTENT_CHARS,
    ),
    tags: Array.isArray(review.tags)
      ? review.tags.map(String).slice(0, 8)
      : [],
    topicTags: Array.isArray(review.topicTags)
      ? review.topicTags.map(String).slice(0, 8)
      : [],
    sentiment: String(review.sentiment || "").slice(0, 40),
  }));

export function validateReviewInsightShape(value) {
  if (!value || typeof value !== "object") return null;
  const summary = String(value.summary || "").trim();
  if (!summary) return null;
  return {
    summary: summary.slice(0, 900),
    positives: toArray(value.positives),
    negatives: toArray(value.negatives),
    recommendedActions: toArray(value.recommendedActions),
    topPriorities: toArray(value.topPriorities),
    confidence: clampConfidence(value.confidence),
  };
}

export function resolveGeminiReviewInsightModel(env = process.env) {
  return (
    String(
      env.REVIEW_AI_INSIGHT_MODEL ||
        env.AI_CHATBOT_MODEL ||
        env.GEMINI_MODEL ||
        DEFAULT_GEMINI_MODEL,
    ).trim() || DEFAULT_GEMINI_MODEL
  );
}

export function createReviewInsightProviderFromEnv(
  env = process.env,
  { fetchImpl = globalThis.fetch } = {},
) {
  const enabled =
    String(env.REVIEW_AI_INSIGHTS_ENABLED || "false").toLowerCase() ===
    "true";
  const provider = String(env.AI_PROVIDER || "").toLowerCase();
  const apiKey = env.GEMINI_API_KEY;
  if (!enabled || provider !== "gemini" || !apiKey) return null;

  const model = resolveGeminiReviewInsightModel(env);
  return {
    source: "gemini",
    async summarizeReviews({ reviews, analytics }) {
      const systemInstruction = [
        "Bạn là trợ lý phân tích review cho module quản lý nhà hàng Cohan.",
        "Chỉ dùng dữ liệu review đã được làm sạch; không suy đoán danh tính khách hàng.",
        'Trả về JSON hợp lệ đúng schema: {"summary": string, "positives": string[], "negatives": string[], "recommendedActions": string[], "topPriorities": string[], "confidence": number}.',
        "Không dùng markdown code fence, không thêm văn bản ngoài JSON.",
      ].join("\n");
      const prompt = JSON.stringify({
        task: "Tóm tắt insight review/rating bằng tiếng Việt cho quản lý nhà hàng, ưu tiên hành động có thể thực hiện.",
        analytics,
        reviews,
      });
      const parsed = await generateGeminiJson({
        apiKey,
        model,
        systemInstruction,
        prompt,
        timeoutMs: Number(env.REVIEW_AI_INSIGHT_TIMEOUT_MS || 8000),
        fetchImpl,
      });
      const normalized = validateReviewInsightShape(parsed);
      if (!normalized) throw new Error("Gemini insight shape is invalid");
      return normalized;
    },
  };
}

export function buildHeuristicReviewInsight(reviews = [], analytics = {}) {
  const published = reviews.filter((review) =>
    ["published", "reported"].includes(review.status),
  );

  if (!published.length) {
    return {
      summary:
        "Chưa có đánh giá công khai để phân tích. Các chỉ số và xu hướng sẽ được cập nhật khi khách hàng bắt đầu gửi phản hồi.",
      positives: ["Chưa có đủ dữ liệu để xác định điểm được khách khen"],
      negatives: ["Chưa có đủ dữ liệu để xác định vấn đề khách phàn nàn"],
      recommendedActions: [
        "Duy trì SLA phản hồi và theo dõi thông báo đánh giá mới.",
        "Khuyến khích khách đã hoàn tất đơn hàng hoặc đặt bàn chia sẻ trải nghiệm.",
        "Kiểm tra lại phạm vi nhà hàng và bộ lọc nếu kỳ vọng đã có đánh giá.",
      ],
      topPriorities: ["Theo dõi đánh giá mới phát sinh"],
      confidence: 0,
      source: "no_data",
    };
  }

  const negative = published.filter(
    (review) => Number(review.rating || 0) <= 2,
  );
  const unrepliedNegative = negative.filter(
    (review) => !review.firstOfficialReplyAt,
  );
  const positives = pickTags(
    published.filter((review) => Number(review.rating || 0) >= 4),
    POSITIVE_WORDS,
  );
  const negatives = pickTags(negative, NEGATIVE_WORDS);
  const topPriorities = [];

  if (analytics.actionQueueCounts?.needsModeration) {
    topPriorities.push("Xử lý đánh giá đang có báo cáo chờ lâu nhất trước.");
  }
  if (unrepliedNegative.length) {
    topPriorities.push("Phản hồi đánh giá 1–2 sao chưa có trả lời chính thức.");
  }
  if (analytics.actionQueueCounts?.highRisk) {
    topPriorities.push("Ưu tiên đánh giá rủi ro cao có nhiều báo cáo hoặc 1 sao.");
  }
  if (!topPriorities.length) {
    topPriorities.push(
      "Duy trì SLA phản hồi và theo dõi xu hướng điểm hằng tuần.",
    );
  }

  const recommendedActions = [
    ...topPriorities,
    negatives.length
      ? `Theo dõi chủ đề khách chê: ${negatives.join(", ")}.`
      : "Tiếp tục gom thẻ phàn nàn để phát hiện vấn đề lặp lại.",
    positives.length
      ? `Khai thác điểm mạnh khách khen: ${positives.join(", ")}.`
      : "Khuyến khích khách để lại đánh giá chi tiết hơn sau trải nghiệm tốt.",
  ].slice(0, 5);
  const average = Number(analytics.avgRating || 0).toFixed(1);

  return {
    summary: `${published.length} đánh giá công khai, điểm trung bình ${average}/5; có ${negative.length} đánh giá tiêu cực và ${unrepliedNegative.length} đánh giá tiêu cực chưa được phản hồi.`,
    positives: positives.length
      ? positives
      : ["Chưa đủ tín hiệu tích cực nổi bật"],
    negatives: negatives.length
      ? negatives
      : ["Chưa đủ tín hiệu tiêu cực nổi bật"],
    recommendedActions,
    topPriorities: topPriorities.slice(0, 3),
    confidence: published.length >= 10 ? 0.78 : 0.62,
    source: "heuristic",
  };
}

export async function generateReviewInsight(
  reviews = [],
  analytics = {},
  provider = undefined,
) {
  const fallback = buildHeuristicReviewInsight(reviews, analytics);
  if (fallback.source === "no_data") return fallback;

  const enabled =
    String(process.env.REVIEW_AI_INSIGHTS_ENABLED || "false").toLowerCase() ===
    "true";
  const resolvedProvider =
    provider === undefined ? createReviewInsightProviderFromEnv() : provider;
  if (!enabled || !resolvedProvider?.summarizeReviews) return fallback;

  try {
    const safeReviews = sanitizeReviewsForAi(reviews);
    const ai = await resolvedProvider.summarizeReviews({
      reviews: safeReviews,
      analytics,
    });
    const normalized = validateReviewInsightShape(ai);
    if (!normalized) {
      throw new Error("Review insight provider returned invalid shape");
    }
    return {
      ...fallback,
      ...normalized,
      source: resolvedProvider.source || "ai",
      confidence: clampConfidence(normalized.confidence),
    };
  } catch {
    return { ...fallback, source: "heuristic_fallback" };
  }
}
