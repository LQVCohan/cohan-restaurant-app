import process from "process";
const DEFAULT_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const normalizeLevel = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value) return 1;
  const raw = String(value).toLowerCase();
  if (["low", "basic", "small"].includes(raw)) return 1;
  if (["medium", "mid", "normal"].includes(raw)) return 2;
  if (["high", "vip", "large", "premium"].includes(raw)) return 3;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 1;
};

const getTableLevel = (table = {}) => {
  const capacity = table.capacity || 0;
  if (table.type === "vip" || capacity >= 10) return 3;
  if (capacity >= 6) return 2;
  return 1;
};

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
        ? promotions
            .map((p) => `${p.name || p.code}(level:${normalizeLevel(p.level)})`)
            .join(", ")
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
    const tableLevel = getTableLevel(payload?.table || {});
    const ranked = promos
      .map((promo) => ({
        ...promo,
        __level: normalizeLevel(promo.level),
      }))
      .sort((a, b) => b.__level - a.__level);
    const eligible = ranked.filter((promo) => promo.__level >= tableLevel);
    const list = (eligible.length ? eligible : ranked).slice(0, 2);
    return `Ưu tiên gắn promotion: ${list
      .map((p) => p.name || p.code)
      .join(", ")} (level phù hợp bàn ${tableLevel}).`;
  }
  if (type === "turnover") {
    const history = payload?.history || [];
    const durations = history
      .map((item) => {
        const start = Date.parse(item.checkIn || item.startAt);
        const end = Date.parse(item.checkOut || item.endAt);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
        const minutes = Math.max(0, Math.round((end - start) / 60000));
        return minutes || null;
      })
      .filter(Boolean);
    const avg =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;
    const base = avg ?? (status === "occupied" ? 60 : status === "reserved" ? 30 : 10);
    return `Ước lượng bàn trống sau ${base}–${base + 20} phút (phụ thuộc món và số khách).`;
  }
  return "Chưa có gợi ý phù hợp.";
};


const safeJsonParse = (raw) => {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

const normalizeLayoutFromAi = (layout, payload = {}) => {
  const tableCount = Math.max(1, Number(payload?.tableCount || 8));
  const prefix = String(payload?.codePrefix || "AI").trim() || "AI";
  const selected = new Set((payload?.selectedComponents || []).map((i) => String(i || "").trim()));
  const rawTables = Array.isArray(layout?.tables) ? layout.tables : [];
  const rawDecor = Array.isArray(layout?.decor) ? layout.decor : [];

  const tables = rawTables.slice(0, tableCount).map((table, index) => ({
    code: String(table?.code || `${prefix}-${index + 1}`).trim(),
    x: Number.isFinite(Number(table?.x)) ? Number(table.x) : index * 120,
    y: Number.isFinite(Number(table?.y)) ? Number(table.y) : Math.floor(index / 4) * 120,
    rotation: Number.isFinite(Number(table?.rotation)) ? Number(table.rotation) : 0,
    capacity: Number.isFinite(Number(table?.capacity)) ? Number(table.capacity) : 4,
    type: String(table?.type || "standard"),
  }));

  const decor = rawDecor
    .filter((item) => item && selected.has(String(item.type || "")))
    .map((item, idx) => ({
      id: `ai_decor_${Date.now()}_${idx}`,
      type: String(item.type || "plant"),
      x: Number.isFinite(Number(item.x)) ? Number(item.x) : 0,
      y: Number.isFinite(Number(item.y)) ? Number(item.y) : 0,
      w: Number.isFinite(Number(item.w)) ? Number(item.w) : 60,
      h: Number.isFinite(Number(item.h)) ? Number(item.h) : 60,
      rotation: Number.isFinite(Number(item.rotation)) ? Number(item.rotation) : 0,
      label: String(item.label || ""),
      isRealTable: false,
    }));

  return { tables, decor };
};

const fallbackSmartLayout = (payload = {}) => {
  const tableCount = Math.max(1, Number(payload?.tableCount || 8));
  const prefix = String(payload?.codePrefix || "AI").trim() || "AI";
  const selected = new Set((payload?.selectedComponents || []).map((i) => String(i || "").trim()));
  const startX = Number(payload?.startX || 0);
  const startY = Number(payload?.startY || 0);

  const tables = Array.from({ length: tableCount }).map((_, idx) => ({
    code: `${prefix}-${idx + 1}`,
    x: startX + (idx % 4) * 120,
    y: startY + Math.floor(idx / 4) * 120,
    rotation: 0,
    capacity: 4,
    type: "standard",
  }));

  const decor = [];
  if (selected.has("wall")) {
    decor.push(
      { id: `ai_wall_${Date.now()}_1`, type: "wall", x: startX - 80, y: startY - 60, w: 640, h: 10, rotation: 0, label: "Tường", isRealTable: false },
      { id: `ai_wall_${Date.now()}_2`, type: "wall", x: startX - 80, y: startY + 420, w: 640, h: 10, rotation: 0, label: "Tường", isRealTable: false }
    );
  }
  if (selected.has("plant")) {
    decor.push(
      { id: `ai_plant_${Date.now()}_1`, type: "plant", x: startX - 40, y: startY + 40, w: 40, h: 40, rotation: 0, label: "Cây", isRealTable: false },
      { id: `ai_plant_${Date.now()}_2`, type: "plant", x: startX + 520, y: startY + 280, w: 40, h: 40, rotation: 0, label: "Cây", isRealTable: false }
    );
  }
  if (selected.has("stairs")) {
    decor.push({ id: `ai_stairs_${Date.now()}`, type: "stairs", x: startX + 500, y: startY - 20, w: 100, h: 60, rotation: 0, label: "Cầu thang", isRealTable: false });
  }
  const maybe = [
    ["door", { type: "door", w: 70, h: 12, label: "Cửa" }],
    ["window", { type: "window", w: 12, h: 80, label: "Cửa sổ" }],
    ["cashier", { type: "cashier", w: 120, h: 50, label: "Thu ngân" }],
    ["kitchen", { type: "kitchen", w: 140, h: 90, label: "Bếp" }],
    ["buffet", { type: "buffet", w: 160, h: 70, label: "Buffet" }],
    ["wc", { type: "wc", w: 80, h: 80, label: "WC" }],
  ];
  let offset = 0;
  for (const [key, base] of maybe) {
    if (!selected.has(key)) continue;
    decor.push({
      id: `ai_${key}_${Date.now()}_${offset}`,
      x: startX + 480,
      y: startY + offset * 72,
      rotation: 0,
      isRealTable: false,
      ...base,
    });
    offset += 1;
  }

  return { tables, decor };
};

export const generateSmartFloorLayout = async (payload = {}) => {
  const selected = payload?.selectedComponents || [];
  const useAiModel = selected.length >= 3;
  if (useAiModel) {
    const prompt = [
      "Bạn là trợ lý thiết kế sơ đồ nhà hàng.",
      "Trả về JSON thuần với shape {tables:[], decor:[]}.",
      "tables gồm: code,x,y,rotation,capacity,type.",
      "decor gồm: type,x,y,w,h,rotation,label.",
      "Không trả markdown.",
      `Yêu cầu: ${JSON.stringify(payload)}`,
    ].join("\n");

    const ai = await callOpenAI(prompt);
    const parsed = safeJsonParse(ai);
    if (parsed) {
      return normalizeLayoutFromAi(parsed, payload);
    }
  }
  return fallbackSmartLayout(payload);
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
  if (ai) return ai;
  const tables = payload?.tables || [];
  if (tables.length) {
    const targetId = payload?.table?.id;
    const target = tables.find((t) => String(t.id) === String(targetId)) || payload?.table;
    const targetPos = target?.position || {};
    const enriched = tables
      .map((t) => ({
        ...t,
        distance:
          targetPos.x != null && targetPos.y != null && t.position
            ? Math.hypot(t.position.x - targetPos.x, t.position.y - targetPos.y)
            : Number.POSITIVE_INFINITY,
        usageCount: t.usageCount ?? 0,
      }))
      .sort((a, b) => a.distance - b.distance || a.usageCount - b.usageCount);
    const candidates = enriched.slice(0, 3).map((t) => t.code).filter(Boolean);
    if (candidates.length) {
      return `Gợi ý ghép bàn gần kề (ưu tiên bàn ít sử dụng) vào giờ cao điểm: ${candidates.join(
        ", "
      )}.`;
    }
  }
  return fallbackSuggestion("merge", payload);
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
  if (ai) return ai;
  const history = payload?.history || [];
  const hourCounts = new Array(24).fill(0);
  history.forEach((item) => {
    const start = Date.parse(item.checkIn || item.startAt);
    const end = Date.parse(item.checkOut || item.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    const startHour = new Date(start).getHours();
    const endHour = new Date(end).getHours();
    for (let h = startHour; h <= endHour; h += 1) {
      hourCounts[h % 24] += 1;
    }
  });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const base = fallbackSuggestion("turnover", payload);
  if (peakHour >= 0 && Math.max(...hourCounts) > 0) {
    return `${base} Khung giờ đông nhất: khoảng ${peakHour}:00–${(peakHour + 2) % 24}:00.`;
  }
  return base;
};
