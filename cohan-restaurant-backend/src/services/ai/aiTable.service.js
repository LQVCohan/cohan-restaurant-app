import process from "process";
const DEFAULT_MODEL = process.env.AI_MODEL || "gpt-5";
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
    `- vị trí: x=${table.position?.x ?? "?"}, y=${table.position?.y ?? "?"}`,
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
    const base =
      avg ?? (status === "occupied" ? 60 : status === "reserved" ? 30 : 10);
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

const rectsOverlap = (a, b, gap = 0) =>
  a.x < b.x + b.w + gap &&
  a.x + a.w + gap > b.x &&
  a.y < b.y + b.h + gap &&
  a.y + a.h + gap > b.y;

const normalizeRect = (item = {}) => ({
  x: Number(item.x) || 0,
  y: Number(item.y) || 0,
  w: Math.max(20, Number(item.w) || 60),
  h: Math.max(20, Number(item.h) || 60),
});

const expandRect = (rect, extra = 0) => ({
  x: rect.x - extra,
  y: rect.y - extra,
  w: rect.w + extra * 2,
  h: rect.h + extra * 2,
});

const findNearestFreeRect = ({
  baseRect,
  occupiedRects,
  padding = 24,
  step = 30,
  maxRing = 14,
}) => {
  const collides = (candidate) =>
    occupiedRects.some((rect) => rectsOverlap(candidate, rect, 0));

  const baseExpanded = expandRect(baseRect, padding);
  if (!collides(baseExpanded)) return baseRect;

  for (let ring = 1; ring <= maxRing; ring += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const candidate = {
          ...baseRect,
          x: baseRect.x + dx * step,
          y: baseRect.y + dy * step,
        };
        if (!collides(expandRect(candidate, padding))) return candidate;
      }
    }
  }
  return baseRect;
};

const getBounds = (rects = []) => {
  if (!rects.length) return null;
  return rects.reduce(
    (acc, rect) => ({
      minX: Math.min(acc.minX, rect.x),
      minY: Math.min(acc.minY, rect.y),
      maxX: Math.max(acc.maxX, rect.x + rect.w),
      maxY: Math.max(acc.maxY, rect.y + rect.h),
    }),
    {
      minX: rects[0].x,
      minY: rects[0].y,
      maxX: rects[0].x + rects[0].w,
      maxY: rects[0].y + rects[0].h,
    },
  );
};

const EMPTY_COMPONENTS = {
  tables: { standard: 0, vip: 0, twoSeat: 0, fourSeat: 0, group: 0 },
  objects: { plant: 0, door: 0, window: 0, stairs: 0, cashier: 0, kitchen: 0, wc: 0, buffet: 0, wall: 0 },
};
const DEFAULT_LEGACY_COMPONENTS = {
  tables: { standard: 8, vip: 0, twoSeat: 0, fourSeat: 0, group: 0 },
  objects: { plant: 0, door: 1, window: 0, stairs: 0, cashier: 0, kitchen: 0, wc: 0, buffet: 0, wall: 0 },
};
const GOAL_SPACING = {
  capacity: { tableGap: 18, gridX: 82, gridY: 82, vipGap: 54 },
  balanced: { tableGap: 28, gridX: 104, gridY: 98, vipGap: 72 },
  spacious: { tableGap: 44, gridX: 132, gridY: 124, vipGap: 96 },
  vip: { tableGap: 40, gridX: 122, gridY: 116, vipGap: 120 },
};
const CANDIDATE_COUNT = 12;

const clampNonNegative = (value) => Math.max(0, Number(value) || 0);
const toComponents = (payload = {}) => {
  if (payload?.components) {
    const tables = { ...EMPTY_COMPONENTS.tables, ...(payload.components.tables || {}) };
    const objects = { ...EMPTY_COMPONENTS.objects, ...(payload.components.objects || {}) };
    Object.keys(tables).forEach((k) => (tables[k] = clampNonNegative(tables[k])));
    Object.keys(objects).forEach((k) => (objects[k] = clampNonNegative(objects[k])));
    return { tables, objects };
  }
  const tableCount = clampNonNegative(payload.tableCount || 8);
  const selected = new Set((payload?.selectedComponents || []).map((i) => String(i || "").trim()));
  return {
    tables: { ...DEFAULT_LEGACY_COMPONENTS.tables, standard: tableCount },
    objects: {
      ...DEFAULT_LEGACY_COMPONENTS.objects,
      wall: selected.has("wall") ? 2 : 0,
      plant: selected.has("plant") ? 2 : 0,
      stairs: selected.has("stairs") ? 1 : 0,
      door: selected.has("door") ? 1 : 0,
      window: selected.has("window") ? 2 : 0,
      cashier: selected.has("cashier") ? 1 : 0,
      kitchen: selected.has("kitchen") ? 1 : 0,
      buffet: selected.has("buffet") ? 1 : 0,
      wc: selected.has("wc") ? 1 : 0,
    },
  };
};

const VALID_TABLE_TYPES = new Set(["standard", "booth", "vip", "outdoor", "bar", "private"]);
const typeMap = {
  standard: { capacity: 4, apiType: "standard", w: 60, h: 60 },
  vip: { capacity: 6, apiType: "vip", w: 72, h: 72 },
  twoSeat: { capacity: 2, apiType: "standard", w: 52, h: 52 },
  fourSeat: { capacity: 4, apiType: "standard", w: 60, h: 60 },
  group: { capacity: 8, apiType: "booth", w: 92, h: 72 },
};
const decorSize = { plant:[40,40], door:[70,12], window:[12,80], stairs:[100,60], cashier:[120,50], kitchen:[140,90], wc:[80,80], buffet:[160,70], wall:[200,10] };
const decorLabels = { plant: "Cây", door: "Cửa", window: "Cửa sổ", stairs: "Cầu thang", cashier: "Thu ngân", kitchen: "Bếp", wc: "WC", buffet: "Buffet", wall: "Tường" };

const getOccupiedRectsFromCurrentItems = (currentItems = []) => {
  if (!Array.isArray(currentItems)) return [];
  return currentItems
    .filter((item) => item && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y)))
    .map((item) =>
      normalizeRect({
        x: Number(item.x),
        y: Number(item.y),
        w: Number(item.w) || (item.isRealTable ? 60 : 80),
        h: Number(item.h) || (item.isRealTable ? 60 : 80),
      }),
    );
};

const scoreLayout = ({ tables = [], decor = [], goal = "balanced", bounds = null }) => {
  const spacingCfg = GOAL_SPACING[goal] || GOAL_SPACING.balanced;
  const tableRects = tables.map((table) => {
    const cfg = Object.values(typeMap).find((t) => t.apiType === table.type && t.capacity === table.capacity) || typeMap.standard;
    return { x: table.x, y: table.y, w: cfg.w, h: cfg.h, type: table.type };
  });
  let overlapPenalty = 0;
  let spacingPenalty = 0;
  let vipPenalty = 0;
  let cashierDoorReward = 0;
  let balanceReward = 0;
  let decorPenalty = 0;
  for (let i = 0; i < tableRects.length; i += 1) {
    for (let j = i + 1; j < tableRects.length; j += 1) {
      const a = tableRects[i];
      const b = tableRects[j];
      if (rectsOverlap(a, b, 0)) overlapPenalty += 180;
      if (rectsOverlap(a, b, spacingCfg.tableGap)) spacingPenalty += 16;
    }
  }
  const vipTables = tableRects.filter((table) => table.type === "vip");
  const normalTables = tableRects.filter((table) => table.type !== "vip");
  vipTables.forEach((vip) => {
    let nearest = Number.POSITIVE_INFINITY;
    normalTables.forEach((other) => {
      nearest = Math.min(nearest, Math.hypot(vip.x - other.x, vip.y - other.y));
    });
    if (Number.isFinite(nearest) && nearest < spacingCfg.vipGap) vipPenalty += spacingCfg.vipGap - nearest;
    if (goal === "vip" && Number.isFinite(nearest) && nearest < spacingCfg.vipGap + 30) vipPenalty += 40;
  });
  decor.forEach((decorItem) => {
    const dRect = normalizeRect(decorItem);
    tableRects.forEach((table) => {
      if (rectsOverlap(dRect, table, 0)) overlapPenalty += 140;
      if (rectsOverlap(dRect, table, 12)) decorPenalty += 8;
    });
  });
  const door = decor.find((item) => item.type === "door");
  const cashier = decor.find((item) => item.type === "cashier");
  if (door && cashier) {
    const dist = Math.hypot(cashier.x - door.x, cashier.y - door.y);
    cashierDoorReward += Math.max(0, 180 - dist) * 0.5;
  }
  if (bounds && tableRects.length > 2) {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const avgDist = tableRects.reduce((sum, table) => sum + Math.hypot(table.x - centerX, table.y - centerY), 0) / tableRects.length;
    balanceReward += Math.max(0, 140 - avgDist * 0.5);
  }
  const score = 1000 - overlapPenalty - spacingPenalty - vipPenalty - decorPenalty + cashierDoorReward + balanceReward;
  return { score, breakdown: { overlapPenalty, spacingPenalty, vipPenalty, cashierDoorReward, balanceReward, decorPenalty } };
};

const generateRuleBasedLayout = (payload = {}, seed = 0) => {
  const startX = Number(payload.startX || 0); const startY = Number(payload.startY || 0);
  const goal = String(payload.goal || "balanced");
  const components = toComponents(payload);
  const warnings = [];
  const occupiedFromCanvas = getOccupiedRectsFromCurrentItems(payload.currentItems);
  const placed = [...occupiedFromCanvas];
  const spacingCfg = GOAL_SPACING[goal] || GOAL_SPACING.balanced;
  const seedOffset = (seed % 4) * 12;
  const tableEntries = [];
  Object.entries(components.tables).forEach(([k, n]) => { for (let i = 0; i < n; i += 1) tableEntries.push(k); });
  const requestedTableCount = tableEntries.length;
  if (tableEntries.length > 200) {
    warnings.push("Tổng số bàn vượt 200, hệ thống đã giới hạn còn 200.");
    tableEntries.length = 200;
  }
  if (tableEntries.length <= 0) {
    return { tables: [], decor: [], meta: { goal, score: 0, scoreBreakdown: {}, warnings: ["Vui lòng chọn ít nhất 1 bàn."] } };
  }
  const rows = Math.max(1, Math.round(Math.sqrt(tableEntries.length / 1.6)));
  const cols = Math.max(1, Math.ceil(tableEntries.length / rows));
  const tables = [];
  let failedPlacementCount = 0;
  const placeTable = (tableKind, baseX, baseY, extraGap = 0) => {
    const cfg = typeMap[tableKind] || typeMap.standard;
    const baseRect = { x: Math.round(baseX), y: Math.round(baseY), w: cfg.w, h: cfg.h };
    const canPlaceWithoutOverlap = (rect, pad) =>
      !placed.some((occupiedRect) =>
        rectsOverlap(expandRect(rect, Math.max(0, pad)), expandRect(occupiedRect, 0)),
      );
    const fitted = findNearestFreeRect({
      baseRect,
      occupiedRects: placed,
      padding: spacingCfg.tableGap + extraGap,
      step: 24 + (seed % 3) * 2,
      maxRing: 16,
    });
    let finalRect = normalizeRect({ ...fitted, w: cfg.w, h: cfg.h });
    if (!canPlaceWithoutOverlap(finalRect, spacingCfg.tableGap - 4)) {
      const fallbackPadding = Math.max(2, Math.floor((spacingCfg.tableGap + extraGap) * 0.5));
      const fallbackFitted = findNearestFreeRect({
        baseRect,
        occupiedRects: placed,
        padding: fallbackPadding,
        step: 18 + (seed % 3) * 2,
        maxRing: 22,
      });
      finalRect = normalizeRect({ ...fallbackFitted, w: cfg.w, h: cfg.h });
      if (!canPlaceWithoutOverlap(finalRect, 0)) {
        failedPlacementCount += 1;
        return false;
      }
    }
    placed.push(finalRect);
    tables.push({ code: `AI-${tables.length + 1}`, x: finalRect.x, y: finalRect.y, rotation: 0, capacity: cfg.capacity, type: VALID_TABLE_TYPES.has(cfg.apiType) ? cfg.apiType : "standard" });
    return true;
  };
  const putCluster = (kind, count, baseFn, extraGap = 0) => {
    for (let i = 0; i < count; i += 1) {
      const p = baseFn(i);
      placeTable(kind, p.x, p.y, extraGap);
    }
  };
  const count = { standard: 0, vip: 0, twoSeat: 0, fourSeat: 0, group: 0 };
  tableEntries.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(count, key)) count[key] += 1;
  });
  putCluster("standard", count.standard, (i) => ({ x: startX + seedOffset + (i % cols) * spacingCfg.gridX, y: startY + Math.floor(i / cols) * spacingCfg.gridY + ((Math.floor(i / cols) + seed) % 2 ? 12 : 0) }));
  putCluster("fourSeat", count.fourSeat, (i) => ({ x: startX + 32 + seedOffset + (i % cols) * spacingCfg.gridX, y: startY + 18 + Math.floor(i / cols) * spacingCfg.gridY }));
  putCluster("twoSeat", count.twoSeat, (i) => ({ x: startX - 100 - (seed % 2) * 30 + (i % 2) * 70, y: startY + (i % Math.max(2, rows)) * Math.max(78, spacingCfg.gridY - 14) }));
  putCluster("group", count.group, (i) => ({ x: startX + Math.floor(cols / 2) * spacingCfg.gridX + 64 + (i % 2) * 110, y: startY + Math.floor(rows / 2) * spacingCfg.gridY + (i % 3) * 84 }), 12);
  putCluster("vip", count.vip, (i) => ({ x: startX + cols * spacingCfg.gridX + spacingCfg.vipGap + (seed % 3) * 16, y: startY + i * (spacingCfg.gridY + 8) + (goal === "vip" ? 24 : 0) }), goal === "vip" ? 24 : 14);
  const tableBounds = getBounds(placed.slice(occupiedFromCanvas.length)) || { minX: startX, minY: startY, maxX: startX + 500, maxY: startY + 400 };
  const decor = [];
  const addDecor = (type, countDecor, posFn, padding = 10) => {
    for (let i = 0; i < countDecor; i += 1) {
      const [defaultW, defaultH] = decorSize[type] || [60, 60];
      const rawBase = posFn(i, defaultW, defaultH);
      const w = Number(rawBase?.w) || defaultW;
      const h = Number(rawBase?.h) || defaultH;
      const base = { ...rawBase, w, h };
      const fit = findNearestFreeRect({ baseRect: { ...base, w, h }, occupiedRects: placed, padding, step: 22 + (seed % 2) * 2, maxRing: 10 });
      const rect = normalizeRect({ ...fit, w, h });
      placed.push(rect);
      decor.push({ id: `auto_${type}_${seed}_${i}`, type, x: rect.x, y: rect.y, w, h, rotation: 0, label: decorLabels[type] || type, isRealTable: false });
    }
  };
  addDecor("door", components.objects.door, (i) => ({ x: tableBounds.minX + 20 + i * 90 + seedOffset, y: tableBounds.maxY + 32 }));
  addDecor("cashier", components.objects.cashier, (i) => ({ x: tableBounds.minX + 12 + i * 40, y: tableBounds.maxY + 58 + i * 20 }));
  addDecor("kitchen", components.objects.kitchen, (i, w, h) => ({ x: tableBounds.maxX + 32 + (i % 2) * 14, y: tableBounds.minY + i * (h + 20) }));
  addDecor("wc", components.objects.wc, (i, w, h) => ({ x: tableBounds.minX - w - 24 - (i % 2) * 18, y: tableBounds.minY + i * (h + 20) }));
  addDecor("buffet", components.objects.buffet, (i) => ({ x: tableBounds.maxX + 36 + (i % 2) * 20, y: tableBounds.maxY - 90 - i * 88 }));
  addDecor("stairs", components.objects.stairs, (i) => ({ x: tableBounds.minX - 120 - i * 14, y: tableBounds.maxY - 40 - i * 68 }));
  addDecor("window", components.objects.window, (i) => ({ x: tableBounds.minX + i * 100 + seedOffset, y: tableBounds.minY - 70 }));
  if (components.objects.wall > 0) {
    const wallCount = components.objects.wall;
    addDecor("wall", Math.min(2, wallCount), (i) => ({ x: tableBounds.minX - 50, y: i === 0 ? tableBounds.minY - 44 : tableBounds.maxY + 52, w: Math.max(360, tableBounds.maxX - tableBounds.minX + 100), h: 10 }), 6);
    if (wallCount >= 4) {
      addDecor("wall", 2, (i) => ({ x: i === 0 ? tableBounds.minX - 52 : tableBounds.maxX + 42, y: tableBounds.minY - 44, w: 10, h: Math.max(260, tableBounds.maxY - tableBounds.minY + 108) }), 6);
    }
  }
  addDecor("plant", components.objects.plant, (i) => ({ x: i % 2 ? tableBounds.minX - 44 : tableBounds.maxX + 20, y: i % 2 ? tableBounds.minY + 24 + i * 24 : tableBounds.maxY - 40 - i * 20 }), 8);
  if (tables.length < requestedTableCount) {
    warnings.push(`Chỉ đặt được ${tables.length}/${requestedTableCount} bàn do không đủ không gian hoặc bị trùng vị trí.`);
  } else if (failedPlacementCount > 0) {
    warnings.push(`Chỉ đặt được ${tables.length}/${requestedTableCount} bàn do không đủ không gian hoặc bị trùng vị trí.`);
  }
  const scored = scoreLayout({ tables, decor, goal, bounds: tableBounds });
  return { tables, decor, meta: { goal, score: scored.score, scoreBreakdown: scored.breakdown, warnings } };
};

export const generateSmartFloorLayout = async (payload = {}) => {
  const goal = String(payload.goal || "balanced");
  const candidates = Array.from({ length: CANDIDATE_COUNT }).map((_, idx) => generateRuleBasedLayout(payload, idx));
  const best = candidates.sort((a,b)=>(b.meta?.score||0)-(a.meta?.score||0))[0];
  if (best?.tables?.length) return best;
  return generateRuleBasedLayout({ ...payload, goal });
};
export const __testables = { toComponents, generateRuleBasedLayout, scoreLayout, getOccupiedRectsFromCurrentItems };
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
    "Đề xuất ghép bàn tối ưu cho nhóm khách.",
  );
  const ai = await callOpenAI(prompt);
  if (ai) return ai;
  const tables = payload?.tables || [];
  if (tables.length) {
    const targetId = payload?.table?.id;
    const target =
      tables.find((t) => String(t.id) === String(targetId)) || payload?.table;
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
    const candidates = enriched
      .slice(0, 3)
      .map((t) => t.code)
      .filter(Boolean);
    if (candidates.length) {
      return `Gợi ý ghép bàn gần kề (ưu tiên bàn ít sử dụng) vào giờ cao điểm: ${candidates.join(
        ", ",
      )}.`;
    }
  }
  return fallbackSuggestion("merge", payload);
};

export const suggestTablePromo = async (payload) => {
  const prompt = buildBasePrompt(
    payload,
    "Đề xuất promotion/ưu đãi phù hợp cho bàn đặt.",
  );
  const ai = await callOpenAI(prompt);
  return ai || fallbackSuggestion("promo", payload);
};

export const predictTableTurnover = async (payload) => {
  const prompt = buildBasePrompt(
    payload,
    "Dự đoán thời gian bàn trống và thời gian quay vòng.",
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
