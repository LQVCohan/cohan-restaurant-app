import { DEFAULT_GEMINI_MODEL, generateGeminiText } from "./geminiClient.service.js";

const getGeminiRewriteModel = () =>
  String(
    process.env.GEMINI_REWRITE_MODEL ||
      process.env.AI_CHATBOT_MODEL ||
      process.env.GEMINI_MODEL ||
      DEFAULT_GEMINI_MODEL,
  ).trim() || DEFAULT_GEMINI_MODEL;

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

const countVietnameseWords = (value = "") =>
  cleanText(value)
    .split(/\s+/)
    .filter(Boolean).length;

const countSentences = (value = "") =>
  cleanText(value)
    .split(/[.!?。]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;

const validateRewriteText = (value = "") => {
  const text = cleanText(value);
  const wordCount = countVietnameseWords(text);
  const sentenceCount = countSentences(text);

  if (!text) return { ok: false, reason: "empty text" };
  if (wordCount < 28) return { ok: false, reason: `too short (${wordCount} words)` };
  if (sentenceCount < 2) return { ok: false, reason: `not enough sentences (${sentenceCount})` };
  if (/mang đến trải nghiệm\.?$/i.test(text)) {
    return { ok: false, reason: "unfinished generic sentence" };
  }
  if (/chưa\s*(chọn|cập nhật)/i.test(text)) {
    return { ok: false, reason: "contains placeholder wording" };
  }

  return { ok: true, reason: "ok" };
};

const buildFallbackRewrite = ({ restaurantName, cuisineType, currentText, chefName }) => {
  const name = cleanText(restaurantName) || "Nhà hàng";
  const cuisine = normalizeCuisine(cuisineType);
  const story = normalizeCurrentStory(currentText);
  const chef = cleanText(chefName);

  const sentences = [
    `${name} là điểm hẹn ${cuisine}, mang đến trải nghiệm ấm cúng, chỉn chu và dễ nhớ cho thực khách.`,
    story || "Không gian và món ăn được chuẩn bị cẩn thận để mỗi lần ghé thăm đều tạo cảm giác gần gũi, tin cậy.",
    chef ? `Bếp trưởng ${chef} phụ trách hương vị và chất lượng phục vụ trong từng món ăn.` : "Đội ngũ nhà hàng luôn chú trọng chất lượng phục vụ để khách cảm thấy thoải mái từ lúc đặt bàn đến khi dùng bữa.",
  ].filter(Boolean);

  return clampText(sentences.join(" "));
};

const buildPrompt = ({ restaurantName, cuisineType, currentText, chefName, tone }) => `
Bạn là copywriter F&B cao cấp. Hãy viết lại mô tả ngắn cho hồ sơ nhà hàng bằng tiếng Việt.

Yêu cầu bắt buộc:
- Viết đủ 2 câu hoàn chỉnh, khoảng 45 đến 90 từ.
- Mỗi câu phải có chủ ngữ, vị ngữ và kết thúc bằng dấu chấm.
- Không trả về câu cụt như "mang đến trải nghiệm".
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

Chỉ trả về đúng đoạn mô tả hoàn chỉnh, không giải thích thêm.
`.trim();

const buildRepairPrompt = ({ restaurantName, cuisineType, chefName, tone }, badText) => `
Đoạn sau quá ngắn hoặc chưa hoàn chỉnh: ${cleanText(badText) || "(trống)"}

Hãy viết lại thành mô tả hồ sơ nhà hàng bằng tiếng Việt.
Yêu cầu: đúng 2 câu hoàn chỉnh, 45 đến 90 từ, không emoji, không dấu ngoặc kép, không nhắc "Chưa chọn ẩm thực".
Tên nhà hàng: ${cleanText(restaurantName) || "Nhà hàng"}
Loại ẩm thực: ${normalizeCuisine(cuisineType)}
Bếp trưởng/phụ trách bếp: ${cleanText(chefName) || "Chưa cập nhật"}
Tone: ${cleanText(tone) || "ấm áp, chuyên nghiệp, đáng tin cậy"}

Chỉ trả về mô tả hoàn chỉnh.
`.trim();

const getModelTimeoutMs = () => {
  const timeout = Number(process.env.GEMINI_REWRITE_TIMEOUT_MS || 30000);
  return Number.isFinite(timeout) && timeout >= 5000 ? timeout : 30000;
};

const requestGemini = async ({ credential, model, prompt }) => {
  const text = await generateGeminiText({
    apiKey: credential,
    model,
    systemInstruction: "Bạn viết nội dung tiếng Việt tự nhiên và chỉ trả phần mô tả được yêu cầu.",
    prompt,
    timeoutMs: getModelTimeoutMs(),
    temperature: 0.72,
    maxOutputTokens: 260,
  });
  return clampText(text);
};

const callGeminiModel = async ({ credential, model, input }) => {
  const firstText = await requestGemini({
    credential,
    model,
    prompt: buildPrompt(input),
  });

  const firstValidation = validateRewriteText(firstText);
  if (firstValidation.ok) return firstText;

  const repairedText = await requestGemini({
    credential,
    model,
    prompt: buildRepairPrompt(input, firstText),
  });
  const repairedValidation = validateRewriteText(repairedText);

  if (!repairedValidation.ok) {
    const error = new Error(
      `${model}: invalid rewrite after retry (${firstValidation.reason}; ${repairedValidation.reason})`,
    );
    error.status = "invalid_output";
    throw error;
  }

  return repairedText;
};

const readGeminiCredential = () =>
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GOOGLE_AI_API_KEY ||
  "";

export async function rewriteRestaurantProfileDescription(input = {}) {
  const credential = readGeminiCredential();
  const fallbackText = buildFallbackRewrite(input);

  if (!credential) {
    return {
      text: fallbackText,
      provider: "fallback",
      usedGemini: false,
      reason: "Missing Gemini credential",
    };
  }

  const model = getGeminiRewriteModel();
  try {
    const text = await callGeminiModel({ credential, model, input });
    const validation = validateRewriteText(text);

    if (!validation.ok) {
      throw new Error(`${model}: ${validation.reason}`);
    }

    return {
      text,
      provider: "gemini",
      usedGemini: true,
      reason: `model:${model}`,
    };
  } catch (error) {
    return {
      text: fallbackText,
      provider: "fallback",
      usedGemini: false,
      reason: error?.message || `${model}: request failed`,
    };
  }
}
