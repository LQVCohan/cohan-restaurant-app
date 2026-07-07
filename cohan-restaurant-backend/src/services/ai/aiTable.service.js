import process from "process";
import { __testables, generateSmartFloorLayout } from "./aiTableLayoutCore.service.js";
import { DEFAULT_GEMINI_MODEL, generateGeminiText } from "./geminiClient.service.js";

export { __testables, generateSmartFloorLayout };

const promptFor = (payload = {}, task = "") => [
  "Bạn là trợ lý vận hành bàn của nhà hàng Cohan.",
  "Chỉ dùng dữ liệu được cung cấp, trả lời tiếng Việt ngắn gọn và có thể hành động.",
  `Nhiệm vụ: ${task}`,
  `Dữ liệu: ${JSON.stringify({
    table: payload.table || null,
    tables: (payload.tables || []).slice(0, 30),
    history: (payload.history || []).slice(0, 50),
    promotions: (payload.promotions || []).slice(0, 20),
    restaurant: payload.restaurant || null,
    constraints: payload.constraints || {},
  })}`,
].join("\n");

const askGemini = async (payload, task) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.AI_TABLE_MODEL || process.env.AI_CHATBOT_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  try {
    return await generateGeminiText({
      apiKey,
      model,
      systemInstruction: "Bạn là trợ lý quản lý bàn ăn. Không bịa dữ liệu ngoài input.",
      prompt: promptFor(payload, task),
      temperature: 0.35,
      maxOutputTokens: 300,
      timeoutMs: Number(process.env.AI_TABLE_TIMEOUT_MS || 12000),
    });
  } catch {
    return null;
  }
};

const fallbackMerge = (payload = {}) => {
  const target = payload.table || {};
  const position = target.position || {};
  const codes = (payload.tables || [])
    .filter((table) => String(table.id || "") !== String(target.id || ""))
    .map((table) => ({
      code: table.code,
      distance: table.position && position.x != null && position.y != null
        ? Math.hypot(table.position.x - position.x, table.position.y - position.y)
        : Infinity,
      usageCount: Number(table.usageCount || 0),
    }))
    .sort((a, b) => a.distance - b.distance || a.usageCount - b.usageCount)
    .slice(0, 3)
    .map((table) => table.code)
    .filter(Boolean);
  return codes.length
    ? `Gợi ý ghép bàn gần kề: ${codes.join(", ")}.`
    : `Gợi ý ghép 1-2 bàn trống cùng tầng để đạt khoảng ${Math.max(Number(target.capacity || 0) + 2, 4)} chỗ.`;
};

const fallbackPromo = (payload = {}) => {
  const rows = (payload.promotions || []).slice(0, 2).map((item) => item.name || item.code).filter(Boolean);
  return rows.length ? `Ưu tiên áp dụng: ${rows.join(", ")}.` : "Chưa có ưu đãi phù hợp; quản lý nên kiểm tra chính sách hiện hành.";
};

const fallbackTurnover = (payload = {}) => {
  const durations = (payload.history || []).map((item) => {
    const start = Date.parse(item.checkIn || item.startAt);
    const end = Date.parse(item.checkOut || item.endAt);
    return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 60000)) : null;
  }).filter(Number.isFinite);
  const base = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : payload.table?.status === "occupied" ? 60 : payload.table?.status === "reserved" ? 30 : 10;
  return `Ước lượng bàn trống sau ${base}-${base + 20} phút.`;
};

export const suggestTableMerge = async (payload) =>
  (await askGemini(payload, "Đề xuất ghép bàn tối ưu cho nhóm khách.")) || fallbackMerge(payload);

export const suggestTablePromo = async (payload) =>
  (await askGemini(payload, "Đề xuất ưu đãi phù hợp cho bàn đặt.")) || fallbackPromo(payload);

export const predictTableTurnover = async (payload) =>
  (await askGemini(payload, "Dự đoán thời gian bàn trống và thời gian quay vòng.")) || fallbackTurnover(payload);
