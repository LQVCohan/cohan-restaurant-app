const GEMINI_MODEL = process.env.GEMINI_REWRITE_MODEL || "gemini-1.5-flash";
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const cleanText = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const clampText = (value = "", max = 1200) => cleanText(value).slice(0, max);

const buildFallbackRewrite = ({ restaurantName, cuisineType, currentText, chefName }) => {
  const name = cleanText(restaurantName) || "Nhà hàng";
  const cuisine = cleanText(cuisineType) || "ẩm thực đa dạng";
  const story = cleanText(currentText) || "mang đến trải nghiệm ẩm thực chỉn chu, gần gũi và đáng nhớ";
  const chefLine = cleanText(chefName)
    ? ` Dưới sự phụ trách của ${cleanText(chefName)}, từng món ăn được chăm chút để giữ trọn hương vị và cảm xúc.`
    : "";

  return clampText(
    `${name} là điểm hẹn ${cuisine}, nơi thực khách có thể thưởng thức món ngon trong không gian ấm cúng và chuyên nghiệp. ${story}.${chefLine}`,
  );
};

const buildPrompt = ({ restaurantName, cuisineType, currentText, chefName, tone }) => `
Bạn là copywriter F&B cao cấp. Hãy viết lại mô tả ngắn cho hồ sơ nhà hàng bằng tiếng Việt.

Yêu cầu:
- 2 đến 3 câu, tối đa 120 từ.
- Tự nhiên, tin cậy, phù hợp ứng dụng đặt bàn/đặt món.
- Không dùng emoji, không dùng dấu ngoặc kép, không phóng đại quá mức.
- Giữ đúng thông tin đã có, không tự bịa địa chỉ/giải thưởng.
- Tone: ${cleanText(tone) || "ấm áp, chuyên nghiệp, cao cấp vừa phải"}.

Thông tin:
Tên nhà hàng: ${cleanText(restaurantName) || "Chưa có"}
Loại ẩm thực: ${cleanText(cuisineType) || "Chưa chọn"}
Bếp trưởng/phụ trách bếp: ${cleanText(chefName) || "Chưa cập nhật"}
Mô tả hiện tại: ${cleanText(currentText) || "Chưa có mô tả"}

Chỉ trả về nội dung mô tả đã viết lại.
`.trim();

const extractGeminiText = (payload) => {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return cleanText(parts.map((part) => part?.text || "").join(" "));
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

  try {
    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
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
      return {
        text: fallbackText,
        provider: "fallback",
        usedGemini: false,
        reason: `Gemini HTTP ${response.status}: ${errorText.slice(0, 240)}`,
      };
    }

    const payload = await response.json();
    const text = clampText(extractGeminiText(payload));

    if (!text) {
      return {
        text: fallbackText,
        provider: "fallback",
        usedGemini: false,
        reason: "Gemini returned empty text",
      };
    }

    return {
      text,
      provider: "gemini",
      usedGemini: true,
      reason: "ok",
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
