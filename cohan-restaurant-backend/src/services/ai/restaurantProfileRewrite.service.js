const DEFAULT_GEMINI_REWRITE_MODELS = [
  process.env.GEMINI_REWRITE_MODEL,
  "gemini-flash-latest",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
].filter(Boolean);

const cleanText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const clampText = (value = "", max = 1200) => cleanText(value).slice(0, max);

const normalizeCuisine = (value = "") => {
  const cuisine = cleanText(value);
  if (!cuisine || /chưa\s*(chọn|cập nhật)/i.test(cuisine)) return "ẩm thực được chăm chút";
  return cuisine;
};

const normalizeCurrentStory = (value = "") => {
  const text = cleanText(value);
  if (!text) return "";

  // Avoid feeding an old fallback sentence back into a new fallback and duplicating it.
  if (/là điểm hẹn.+nơi thực khách có thể thưởng thức/i.test(text)) return "";
  return text.replace(/\.{2,}/g, ".");
};

const buildFallbackRewrite = ({ restaurantName, cuisineType, currentText, chefName }) => {
  const name = cleanText(restaurantName) || "Nhà hàng";
  const cuisine = normalizeCuisine(cuisineType);
  const story = normalizeCurrentStory(currentText);
  const chef = cleanText(chefName);

  const sentences = [
    `${name} là điểm hẹn ${cuisine}, mang đến trải nghiệm ấm cúng, chỉn chu và dễ nhớ cho thực khách.`,
    story || "Không gian và món ăn được chuẩn bị cẩn thận để mỗi lần ghé thăm đều tạo cảm giác gần gũi, tin cậy.",
    chef ? `Bếp trưởng ${chef} phụ trách hương vị và chất lượng phục vụ trong từng món ăn.` : "",
  ].filter(Boolean);

  return clampText(sentences.join(" "));
};

const buildPrompt = ({ restaurantName, cuisineType, currentText, chefName, tone }) => `
Bạn là copywriter F&B cao cấp. Hãy viết lại mô tả ngắn cho hồ sơ nhà hàng bằng tiếng Việt.

Yêu cầu:
- 2 đến 3 câu, tối đa 120 từ.
- Tự nhiên, tin cậy, phù hợp ứng dụng đặt bàn/đặt món.
- Không dùng emoji, không dùng dấu ngoặc kép, không phóng đại quá mức.
- Giữ đúng thông tin đã có, không tự bịa địa chỉ/giải thưởng.
- Nếu loại ẩm thực chưa chọn thì không viết cụm "Chưa chọn ẩm thực".
- Tone: ${cleanText(tone) || "ấm áp, chuyên nghiệp, cao cấp vừa phải"}.

Thông tin:
Tên nhà hàng: ${cleanText(restaurantName) || "Chưa có"}
Loại ẩm thực: ${normalizeCuisine(cuisineType)}
Bếp trưởng/phụ trách bếp: ${cleanText(chefName) || "Chưa cập nhật"}
Mô tả hiện tại: ${normalizeCurrentStory(currentText) || "Chưa có mô tả"}

Chỉ trả về nội dung mô tả đã viết lại.
`.trim();

const extractGeminiText = (payload) => {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return cleanText(parts.map((part) => part?.text || "").join(" "));
};

const buildGeminiEndpoint = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const callGeminiModel = async ({ apiKey, model, input, signal }) => {
  const response = await fetch(`${buildGeminiEndpoint(model)}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(input) }],
        },
      ],
      generationConfig: {
        temperature: 0.65,
        topP: 0.9,
        maxOutputTokens: 220,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const error = new Error(`Gemini ${model} HTTP ${response.status}: ${errorText.slice(0, 220)}`);
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  return clampText(extractGeminiText(payload));
};

export async function rewriteRestaurantProfileDescription(input = {}) {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    "";

  const fallbackText = buildFallbackRewrite(input);

  if (!apiKey) {
    return {
      text: fallbackText,
      provider: "fallback",
      usedGemini: false,
      reason: "Missing GEMINI_API_KEY/GOOGLE_GEMINI_API_KEY/GOOGLE_AI_API_KEY",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.GEMINI_REWRITE_TIMEOUT_MS || 12000),
  );

  const attemptedErrors = [];

  try {
    for (const model of DEFAULT_GEMINI_REWRITE_MODELS) {
      try {
        const text = await callGeminiModel({
          apiKey,
          model,
          input,
          signal: controller.signal,
        });

        if (!text) {
          attemptedErrors.push(`${model}: empty text`);
          continue;
        }

        return {
          text,
          provider: "gemini",
          usedGemini: true,
          reason: `model:${model}`,
        };
      } catch (error) {
        attemptedErrors.push(error?.message || `${model}: request failed`);
        if (error?.name === "AbortError") break;
      }
    }

    return {
      text: fallbackText,
      provider: "fallback",
      usedGemini: false,
      reason: attemptedErrors.join(" | ").slice(0, 500) || "Gemini returned no usable response",
    };
  } catch (error) {
    return {
      text: fallbackText,
      provider: "fallback",
      usedGemini: false,
      reason: error?.name === "AbortError" ? "Gemini request timeout" : error?.message || "Gemini request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
