const DEFAULT_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const buildBasePrompt = (payload, task) => {
  const {
    table = {},
    promotions = [],
    history = [],
    restaurant = {},
    constraints = {},
  } = payload || {};

  return [
    `Bạn là trợ lý vận hành nhà hàng. Nhiệm vụ: ${task}.`,
    "Trả lời ngắn gọn, rõ ràng, ưu tiên gợi ý có thể hành động ngay.",
    "Thông tin bàn:",
    `- mã bàn: ${table.code || "?"}`,
    `- sức chứa: ${table.capacity || 0}`,
    `- trạng thái: ${table.status || "unknown"}`,
    `- tầng: ${table.floorLevel ?? table.floorId ?? "?"}`,
    `- khu/zone: ${table.zone || "không rõ"}`,
    `- vị trí: x=${table.position?.x ?? "?"}, y=${
      table.position?.y ?? "?"
    }`,
    `- đặt cọc: ${table.depositAmount ?? "không có"}`,
    `- giữ bàn (phút): ${table.holdMinutes ?? table.reservationHoldMinutes ?? "?"}`,
    `- chi tiêu tối thiểu: ${table.minSpend ?? "không có"}`,
    `- chính sách huỷ: ${table.cancelPolicy ?? "không có"}`,
    `Thông tin nhà hàng: ${restaurant.name || "không rõ"}`,
    `Promotions hiện có: ${
      promotions.length
        ? promotions.map((p) => p.name || p.code).join(", ")
        : "không có"
    }`,
    `Lịch sử bàn: ${history.length ? "có" : "không có"}`,
    `Ràng buộc: ${Object.keys(constraints).length ? JSON.stringify(constraints) : "không có"}`,
  ].join("\n");
};

const fallbackSuggestion = (type, payload) => {
  const capacity = payload?.table?.capacity || 0;
  const status = payload?.table?.status || "available";
  if (type === "merge") {
    const target = Math.max(capacity + 2, 4);
    return `Gợi ý ghép bàn: ưu tiên ghép 1-2 bàn trống cùng tầng để đạt khoảng ${target} chỗ.`;
  }
  if (type === "promo") {
    const promos = payload?.promotions || [];
    if (!promos.length) {
      return "Chưa có promotion. Gợi ý ưu đãi nhanh: tặng nước/tráng miệng để kích cầu.";
    }
    return `Ưu tiên gắn promotion: ${promos
      .slice(0, 2)
      .map((p) => p.name || p.code)
      .join(", ")}.`;
  }
  if (type === "turnover") {
    const base = status === "occupied" ? 60 : status === "reserved" ? 30 : 10;
    return `Ước lượng bàn trống sau ${base}–${base + 20} phút (phụ thuộc món và số khách).`;
  }
  return "Chưa có gợi ý phù hợp.";
};

const callOpenAI = async (prompt) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Bạn là trợ lý quản lý bàn ăn trong nhà hàng, trả lời tiếng Việt.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  return content || null;
};

export const suggestTableMerge = async (payload) => {
  const prompt = buildBasePrompt(
    payload,
    "Đề xuất ghép bàn tối ưu cho nhóm khách."
  );
  const ai = await callOpenAI(prompt);
  return ai || fallbackSuggestion("merge", payload);
};

export const suggestTablePromo = async (payload) => {
  const prompt = buildBasePrompt(
    payload,
    "Đề xuất promotion/ưu đãi phù hợp cho bàn đặt."
  );
  const ai = await callOpenAI(prompt);
  return ai || fallbackSuggestion("promo", payload);
};

export const predictTableTurnover = async (payload) => {
  const prompt = buildBasePrompt(
    payload,
    "Dự đoán thời gian bàn trống và thời gian quay vòng."
  );
  const ai = await callOpenAI(prompt);
  return ai || fallbackSuggestion("turnover", payload);
};
