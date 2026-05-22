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
    const targetCapacity = Math.max(capacity + 2, 4);
    return `Gợi ý ghép bàn: ưu tiên ghép 1-2 bàn trống cùng tầng để đạt khoảng ${targetCapacity} chỗ.`;
  }
  if (type === "promo") {
    const promos = payload?.promotions || [];
    if (!promos.length) return "Chưa có promotion. Gợi ý ưu đãi nhanh: tặng nước/tráng miệng để kích cầu.";
    const tableLevel = getTableLevel(payload?.table || {});
    const ranked = promos
      .map((promo) => ({ ...promo, __level: normalizeLevel(promo.level) }))
      .sort((a, b) => b.__level - a.__level);
    const eligible = ranked.filter((promo) => promo.__level >= tableLevel);
    const list = (eligible.length ? eligible : ranked).slice(0, 2);
    return `Ưu tiên gắn promotion: ${list.map((p) => p.name || p.code).join(", ")} (level phù hợp bàn ${tableLevel}).`;
  }
  if (type === "turnover") {
    const durations = (payload?.history || [])
      .map((item) => {
        const start = Date.parse(item.checkIn || item.startAt);
        const end = Date.parse(item.checkOut || item.endAt);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
        return Math.max(0, Math.round((end - start) / 60000)) || null;
      })
      .filter(Boolean);
    const avg = durations.length
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

const rectsOverlap = (a, b, gap = 0) =>
  a.x < b.x + b.w + gap &&
  a.x + a.w + gap > b.x &&
  a.y < b.y + b.h + gap &&
  a.y + a.h + gap > b.y;
const normalizeRect = (item = {}) => ({
  x: Number(item.x) || 0,
  y: Number(item.y) || 0,
  w: Math.max(12, Number(item.w) || 60),
  h: Math.max(12, Number(item.h) || 60),
});
const expandRect = (rect, extra = 0) => ({
  x: rect.x - extra,
  y: rect.y - extra,
  w: rect.w + extra * 2,
  h: rect.h + extra * 2,
});
const inZone = (r, z) => r.x >= z.x && r.y >= z.y && r.x + r.w <= z.x + z.w && r.y + r.h <= z.y + z.h;
const centerOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const EMPTY_COMPONENTS = { tables: { standard: 0, vip: 0, twoSeat: 0, fourSeat: 0, group: 0 }, objects: { plant: 0, door: 0, window: 0, stairs: 0, cashier: 0, kitchen: 0, wc: 0, buffet: 0, wall: 0 } };
const DEFAULT_LEGACY_COMPONENTS = { tables: { standard: 8, vip: 0, twoSeat: 0, fourSeat: 0, group: 0 }, objects: { plant: 0, door: 1, window: 0, stairs: 0, cashier: 0, kitchen: 0, wc: 0, buffet: 0, wall: 0 } };
const GOAL_SPACING = { capacity: { tableGap: 18, gridX: 82, gridY: 82, vipGap: 54 }, balanced: { tableGap: 28, gridX: 104, gridY: 98, vipGap: 72 }, spacious: { tableGap: 44, gridX: 132, gridY: 124, vipGap: 96 }, vip: { tableGap: 40, gridX: 122, gridY: 116, vipGap: 120 } };
const CANDIDATE_COUNT = 16;
const clampNonNegative = (value) => Math.max(0, Number(value) || 0);

const normalizeComponentMap = (baseMap, inputMap = {}) => {
  const merged = { ...baseMap, ...inputMap };
  Object.keys(merged).forEach((key) => {
    merged[key] = clampNonNegative(merged[key]);
  });
  return merged;
};

const toComponents = (payload = {}) => {
  if (payload?.components) {
    return {
      tables: normalizeComponentMap(EMPTY_COMPONENTS.tables, payload.components.tables || {}),
      objects: normalizeComponentMap(EMPTY_COMPONENTS.objects, payload.components.objects || {}),
    };
  }

  const selected = new Set(payload.selectedComponents || []);
  return {
    tables: {
      ...DEFAULT_LEGACY_COMPONENTS.tables,
      standard: clampNonNegative(payload.tableCount || 8),
    },
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
const typeMap = { standard: { capacity: 4, apiType: "standard", w: 60, h: 60 }, vip: { capacity: 6, apiType: "vip", w: 72, h: 72 }, twoSeat: { capacity: 2, apiType: "standard", w: 52, h: 52 }, fourSeat: { capacity: 4, apiType: "standard", w: 60, h: 60 }, group: { capacity: 8, apiType: "booth", w: 92, h: 72 } };
const decorSize = { plant:[40,40], door:[70,12], window:[12,80], stairs:[100,60], cashier:[120,50], kitchen:[140,90], wc:[80,80], buffet:[160,70], wall:[200,10] };
const decorLabels = { plant:"Cây",door:"Cửa",window:"Cửa sổ",stairs:"Cầu thang",cashier:"Thu ngân",kitchen:"Bếp",wc:"WC",buffet:"Buffet",wall:"Tường" };

const getOccupiedRectsFromCurrentItems = (currentItems = []) => Array.isArray(currentItems) ? currentItems.filter((item) => item && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y))).map((item) => normalizeRect({ x: item.x, y: item.y, w: item.w || (item.isRealTable ? 60 : 80), h: item.h || (item.isRealTable ? 60 : 80) })) : [];

const buildLayoutZones = ({ startX = 0, startY = 0, tableCount = 10, goal = "balanced", components = EMPTY_COMPONENTS, seed = 0 }) => {
  const baseW = Math.max(760, Math.round(Math.sqrt(tableCount + 4) * 260));
  const baseH = Math.max(560, Math.round(Math.sqrt(tableCount + 4) * 220));
  const orient = seed % 2 === 0 ? "vertical" : "horizontal";
  const aisle = orient === "vertical" ? { x: startX + Math.floor(baseW / 2) - 48 + (seed % 3) * 6, y: startY + 30, w: 96, h: baseH - 60, orientation: "vertical" } : { x: startX + 30, y: startY + Math.floor(baseH / 2) - 48 + (seed % 3) * 6, w: baseW - 60, h: 96, orientation: "horizontal" };
  const vipSide = seed % 4;
  const serviceSide = seed % 3;
  const diningPad = 40;
  const mainDining = { x: startX + diningPad, y: startY + diningPad, w: baseW - diningPad * 2, h: baseH - diningPad * 2 };
  let vipZone = { x: startX + baseW - 240, y: startY + 40, w: 200, h: 180 };
  if (vipSide === 1) vipZone = { x: startX + 40, y: startY + 40, w: 210, h: 180 };
  if (vipSide === 2) vipZone = { x: startX + baseW - 250, y: startY + baseH - 220, w: 210, h: 180 };
  if (goal === "vip") vipZone = { ...vipZone, w: vipZone.w + 20, h: vipZone.h + 20 };
  let serviceZone = { x: startX + baseW - 260, y: startY + baseH - 220, w: 220, h: 180 };
  if (serviceSide === 1) serviceZone = { x: startX + baseW - 260, y: startY + 40, w: 220, h: 180 };
  if (serviceSide === 2) serviceZone = { x: startX + 40, y: startY + baseH - 220, w: 220, h: 180 };
  const decorZone = { x: startX + 20, y: startY + 20, w: baseW - 40, h: baseH - 40 };
  if (
    components.tables.standard + components.tables.fourSeat + components.tables.twoSeat ===
      0 &&
    components.tables.vip > 0
  ) {
    vipZone = { x: startX + 120, y: startY + 120, w: baseW - 240, h: baseH - 240 };
  }
  return { mainDining, vipZone, serviceZone, decorZone, mainAisle: aisle };
};

const isInAisle = (rect, aisle, gap = 0) => !!aisle && rectsOverlap(expandRect(rect, gap), aisle, 0);

const scoreLayout = ({ tables = [], decor = [], goal = "balanced", zones = null }) => {
  const spacingCfg = GOAL_SPACING[goal] || GOAL_SPACING.balanced;
  const tableRects = tables.map((table) => {
    const width = table.w || (table.capacity >= 6 ? 72 : 60);
    const height = table.h || (table.capacity >= 6 ? 72 : 60);
    return { ...normalizeRect({ x: table.x, y: table.y, w: width, h: height }), type: table.type };
  });

  let overlapPenalty = 0;
  let spacingPenalty = 0;
  let vipPenalty = 0;
  let cashierDoorReward = 0;
  let balanceReward = 0;
  let decorPenalty = 0;
  let aislePenalty = 0;
  let zoneReward = 0;
  let serviceFlowReward = 0;

  for (let i = 0; i < tableRects.length; i += 1) {
    for (let j = i + 1; j < tableRects.length; j += 1) {
      if (rectsOverlap(tableRects[i], tableRects[j], 0)) overlapPenalty += 220;
      if (rectsOverlap(tableRects[i], tableRects[j], spacingCfg.tableGap)) spacingPenalty += 16;
    }
  }

  const vip = tableRects.filter((table) => table.type === "vip");
  const standard = tableRects.filter((table) => table.type !== "vip");
  vip.forEach((vipTable) => {
    const nearest = standard.reduce(
      (minDistance, normalTable) =>
        Math.min(minDistance, dist(centerOf(vipTable), centerOf(normalTable))),
      Infinity,
    );
    if (Number.isFinite(nearest) && nearest < spacingCfg.vipGap) {
      vipPenalty += spacingCfg.vipGap - nearest;
    }
  });

  decor.forEach((decorItem) => {
    const decorRect = normalizeRect(decorItem);
    tableRects.forEach((tableRect) => {
      if (rectsOverlap(decorRect, tableRect, 0)) overlapPenalty += 140;
      if (rectsOverlap(decorRect, tableRect, 12)) decorPenalty += 8;
    });
  });

  const door = decor.find((item) => item.type === "door");
  const cashier = decor.find((item) => item.type === "cashier");
  if (door && cashier) {
    const doorCenter = centerOf(normalizeRect(door));
    const cashierCenter = centerOf(normalizeRect(cashier));
    cashierDoorReward += Math.max(0, 180 - dist(doorCenter, cashierCenter)) * 0.6;
  }
  if (zones?.mainAisle) {
    [...tableRects, ...decor.map(normalizeRect)].forEach((r) => { if (isInAisle(r, zones.mainAisle, 0)) aislePenalty += 180; });
    const left = tableRects.filter((t) => centerOf(t).x < zones.mainAisle.x).length; const right = tableRects.length - left;
    balanceReward += Math.max(0, 80 - Math.abs(left - right) * 14);
  }
  if (zones) {
    tableRects.forEach((t) => { if (t.type === "vip" && inZone(t, zones.vipZone)) zoneReward += 16; if (t.type !== "vip" && inZone(t, zones.mainDining)) zoneReward += 8; });
    decor.forEach((d) => { if (["kitchen", "wc", "buffet"].includes(d.type) && inZone(normalizeRect(d), zones.serviceZone)) zoneReward += 10; });
    const kitchen = decor.find((d) => d.type === "kitchen"); const wc = decor.find((d) => d.type === "wc");
    vip.forEach((v) => {
      if (kitchen && dist(centerOf(v), centerOf(normalizeRect(kitchen))) < 200) vipPenalty += 70;
      if (wc && dist(centerOf(v), centerOf(normalizeRect(wc))) < 180) vipPenalty += 70;
    });
  }
  if (door && cashier && zones?.mainDining) {
    const diningCenter = centerOf(zones.mainDining); const d1 = dist(centerOf(normalizeRect(door)), centerOf(normalizeRect(cashier))); const d2 = dist(centerOf(normalizeRect(cashier)), diningCenter);
    serviceFlowReward += Math.max(0, 220 - d1) * 0.2 + Math.max(0, 360 - d2) * 0.15;
  }
  const score = 1200 - overlapPenalty - spacingPenalty - vipPenalty - decorPenalty - aislePenalty + cashierDoorReward + balanceReward + zoneReward + serviceFlowReward;
  return { score, breakdown: { overlapPenalty, spacingPenalty, vipPenalty, cashierDoorReward, balanceReward, decorPenalty, aislePenalty, zoneReward, serviceFlowReward } };
};

const generateRuleBasedLayout = (payload = {}, seed = 0) => {
  const startX = Number(payload.startX || 0);
  const startY = Number(payload.startY || 0);
  const goal = String(payload.goal || "balanced");
  const components = toComponents(payload);
  const warnings = [];
  const tableOrder = ["standard", "fourSeat", "twoSeat", "group", "vip"];
  const tableEntries = [];
  tableOrder.forEach((kind) => {
    for (let i = 0; i < (components.tables[kind] || 0); i += 1) {
      tableEntries.push(kind);
    }
  });

  const originalRequested = tableEntries.length;
  if (tableEntries.length > 200) {
    warnings.push("Tổng số bàn vượt 200, hệ thống đã giới hạn còn 200.");
    tableEntries.length = 200;
  }

  const normalizedCounts = {
    standard: 0,
    fourSeat: 0,
    twoSeat: 0,
    group: 0,
    vip: 0,
  };
  tableEntries.forEach((kind) => {
    normalizedCounts[kind] += 1;
  });

  const requested = tableEntries.length;
  const zones = buildLayoutZones({ startX, startY, tableCount: requested, goal, components, seed });
  const occupiedFromCanvas = getOccupiedRectsFromCurrentItems(payload.currentItems);
  const occupied = [...occupiedFromCanvas, zones.mainAisle];
  const spacingCfg = GOAL_SPACING[goal] || GOAL_SPACING.balanced;
  const tables = [];
  const placeRect = (baseRect, pad = 10) => {
    for (let ring = 0; ring < 18; ring++) for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
      if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
      const c = { ...baseRect, x: Math.round(baseRect.x + dx * (20 + (seed % 3) * 2)), y: Math.round(baseRect.y + dy * (20 + (seed % 3) * 2)) };
      if (isInAisle(c, zones.mainAisle, 0)) continue;
      if (occupied.some((r) => rectsOverlap(expandRect(c, pad), r, 0))) continue;
      occupied.push(c); return c;
    }
    return null;
  };
  const addTable = (kind, x, y, extra = 0) => {
    const cfg = typeMap[kind] || typeMap.standard;
    const rect = placeRect({ x, y, w: cfg.w, h: cfg.h }, spacingCfg.tableGap + extra);
    if (!rect) return false;

    tables.push({
      code: `AI-${tables.length + 1}`,
      x: rect.x,
      y: rect.y,
      rotation: 0,
      capacity: cfg.capacity,
      type: VALID_TABLE_TYPES.has(cfg.apiType) ? cfg.apiType : "standard",
      w: cfg.w,
      h: cfg.h,
    });
    return true;
  };

  const addCluster = (kind, count, zone, opts = {}) => {
    const cols = Math.max(1, Math.ceil(Math.sqrt(count || 1))); const gapX = opts.gapX || spacingCfg.gridX; const gapY = opts.gapY || spacingCfg.gridY;
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols), col = i % cols;
      const stagger = ((seed + i) % 2) * (opts.stagger || 10);
      const x = zone.x + (opts.offsetX || 0) + col * gapX + (opts.side === "right" ? zone.w * 0.5 : 0) + stagger;
      const y = zone.y + (opts.offsetY || 0) + row * gapY + ((seed + row) % 3) * 6;
      addTable(kind, x, y, opts.extraGap || 0);
    }
  };

  const stdCount = normalizedCounts.standard + normalizedCounts.fourSeat;
  if (zones.mainAisle.orientation === "vertical") {
    const leftZone = { x: zones.mainDining.x, y: zones.mainDining.y, w: Math.max(120, zones.mainAisle.x - zones.mainDining.x - 24), h: zones.mainDining.h };
    const rightZone = { x: zones.mainAisle.x + zones.mainAisle.w + 24, y: zones.mainDining.y, w: Math.max(120, zones.mainDining.x + zones.mainDining.w - (zones.mainAisle.x + zones.mainAisle.w + 24)), h: zones.mainDining.h };
    addCluster("standard", Math.ceil(normalizedCounts.standard / 2), leftZone, { gapX: spacingCfg.gridX, gapY: spacingCfg.gridY, stagger: 10 });
    addCluster("standard", Math.floor(normalizedCounts.standard / 2), rightZone, { gapX: spacingCfg.gridX, gapY: spacingCfg.gridY, stagger: 12 });
    addCluster("fourSeat", Math.ceil(normalizedCounts.fourSeat / 2), leftZone, { offsetX: 20, offsetY: 20 });
    addCluster("fourSeat", Math.floor(normalizedCounts.fourSeat / 2), rightZone, { offsetX: 24, offsetY: 26 });
  } else {
    addCluster("standard", normalizedCounts.standard, zones.mainDining, { gapX: spacingCfg.gridX, gapY: spacingCfg.gridY, stagger: 8 });
    addCluster("fourSeat", normalizedCounts.fourSeat, zones.mainDining, { offsetX: 22, offsetY: 16 });
  }
  addCluster("twoSeat", normalizedCounts.twoSeat, { x: zones.mainDining.x, y: zones.decorZone.y + 20, w: zones.mainDining.w, h: 160 }, { gapX: 72, gapY: 74, extraGap: -6 });
  addCluster("group", normalizedCounts.group, { x: zones.mainDining.x + zones.mainDining.w - 260, y: zones.mainDining.y + 50, w: 220, h: zones.mainDining.h - 100 }, { gapX: 110, gapY: 88, extraGap: 10 });
  addCluster("vip", normalizedCounts.vip, zones.vipZone, { gapX: spacingCfg.gridX, gapY: spacingCfg.gridY, extraGap: goal === "vip" ? 18 : 8 });

  const decor = [];
  const addDecor = (type, count, builder, pad = 8, allowAisleEnd = false) => {
    for (let i = 0; i < count; i++) {
      const [defaultW, defaultH] = decorSize[type] || [60, 60];
      const basePos = builder(i, defaultW, defaultH);
      const baseRect = {
        ...basePos,
        w: basePos.w || defaultW,
        h: basePos.h || defaultH,
      };

      let rect = placeRect(baseRect, pad);
      if (!rect && allowAisleEnd) {
        rect = placeRect(
          { ...baseRect, x: zones.mainAisle.x, y: zones.mainAisle.y + zones.mainAisle.h + 10 },
          pad,
        );
      }
      if (!rect) continue;

      decor.push({
        id: `auto_${type}_${seed}_${i}`,
        type,
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        rotation: 0,
        label: decorLabels[type] || type,
        isRealTable: false,
      });
    }
  };
  const aisle = zones.mainAisle;
  addDecor("door", components.objects.door, (_i, w, h) => aisle.orientation === "vertical" ? { x: aisle.x + (aisle.w - w) / 2, y: startY + 4, w, h } : { x: startX + 4, y: aisle.y + (aisle.h - h) / 2, w, h }, 2, true);
  const placedDoor = decor.find((item) => item.type === "door");
  addDecor(
    "cashier",
    components.objects.cashier,
    (_i, w, h) => {
      if (placedDoor) {
        return {
          x: placedDoor.x + placedDoor.w + 18,
          y: placedDoor.y + 18,
          w,
          h,
        };
      }
      return {
        x: aisle.x + aisle.w + 20,
        y: aisle.y + 24,
        w,
        h,
      };
    },
    10,
  );
  addDecor("kitchen", components.objects.kitchen, (i, w, h) => ({ x: zones.serviceZone.x + 10 + (i % 2) * 20, y: zones.serviceZone.y + 10 + i * (h + 10), w, h }), 10);
  addDecor("wc", components.objects.wc, (i, w, h) => ({ x: zones.serviceZone.x + zones.serviceZone.w - w - 10, y: zones.serviceZone.y + 20 + i * (h + 8), w, h }), 10);
  addDecor("buffet", components.objects.buffet, (i, w, h) => ({ x: zones.serviceZone.x - w - 16 - i * 10, y: zones.mainDining.y + zones.mainDining.h - h - 20, w, h }), 8);
  addDecor("window", components.objects.window, (i, w, h) => ({ x: zones.decorZone.x + 30 + i * 110, y: zones.decorZone.y - h - 10, w, h }), 2);
  if (components.objects.wall > 0) {
    addDecor("wall", Math.min(2, components.objects.wall), (i) => ({ x: zones.decorZone.x, y: i === 0 ? zones.decorZone.y - 18 : zones.decorZone.y + zones.decorZone.h + 10, w: zones.decorZone.w, h: 10 }), 0);
    if (components.objects.wall >= 4) addDecor("wall", 2, (i) => ({ x: i === 0 ? zones.decorZone.x - 12 : zones.decorZone.x + zones.decorZone.w + 2, y: zones.decorZone.y, w: 10, h: zones.decorZone.h }), 0);
  }
  addDecor("plant", components.objects.plant, (i, w, h) => ({ x: i % 2 ? zones.vipZone.x - 24 : zones.mainDining.x + zones.mainDining.w + 10, y: zones.mainDining.y + 30 + i * 36, w, h }), 4);
  addDecor("stairs", components.objects.stairs, (i, w, h) => ({ x: zones.decorZone.x + zones.decorZone.w - w - 16 - i * 20, y: zones.decorZone.y + 16 + i * 20, w, h }), 8);

  if (tables.length < requested) {
    warnings.push(`Chỉ đặt được ${tables.length}/${requested} bàn do không đủ không gian hoặc bị trùng vị trí.`);
  }
  const scored = scoreLayout({ tables, decor, goal, zones });
  return { tables: tables.map(({ w, h, ...t }) => t), decor, meta: { goal, score: scored.score, scoreBreakdown: scored.breakdown, warnings, zones } };
};

export const generateSmartFloorLayout = async (payload = {}) => {
  const goal = String(payload.goal || "balanced");
  const candidates = Array.from({ length: CANDIDATE_COUNT }).map((_, idx) => generateRuleBasedLayout(payload, idx));
  const best = candidates.sort((a, b) => (b.meta?.score || 0) - (a.meta?.score || 0))[0];
  if (best?.tables?.length) return best;
  return generateRuleBasedLayout({ ...payload, goal });
};
export const __testables = { toComponents, generateRuleBasedLayout, scoreLayout, getOccupiedRectsFromCurrentItems, buildLayoutZones, isInAisle };

const callOpenAI = async (prompt) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(OPENAI_ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: DEFAULT_MODEL, messages: [{ role: "system", content: "Bạn là trợ lý quản lý bàn ăn trong nhà hàng, trả lời tiếng Việt." }, { role: "user", content: prompt }], temperature: 0.4, max_tokens: 200 }) });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
};

export const suggestTableMerge = async (payload) => {
  const ai = await callOpenAI(buildBasePrompt(payload, "Đề xuất ghép bàn tối ưu cho nhóm khách."));
  if (ai) return ai;
  const tables = payload?.tables || [];
  if (tables.length) {
    const target = tables.find((t) => String(t.id) === String(payload?.table?.id)) || payload?.table;
    const targetPos = target?.position || {};
    const candidates = tables.map((t) => ({ ...t, distance: targetPos.x != null && targetPos.y != null && t.position ? Math.hypot(t.position.x - targetPos.x, t.position.y - targetPos.y) : Infinity, usageCount: t.usageCount ?? 0 })).sort((a, b) => a.distance - b.distance || a.usageCount - b.usageCount).slice(0, 3).map((t) => t.code).filter(Boolean);
    if (candidates.length) return `Gợi ý ghép bàn gần kề (ưu tiên bàn ít sử dụng) vào giờ cao điểm: ${candidates.join(", ")}.`;
  }
  return fallbackSuggestion("merge", payload);
};
export const suggestTablePromo = async (payload) => (await callOpenAI(buildBasePrompt(payload, "Đề xuất promotion/ưu đãi phù hợp cho bàn đặt."))) || fallbackSuggestion("promo", payload);
export const predictTableTurnover = async (payload) => {
  const ai = await callOpenAI(buildBasePrompt(payload, "Dự đoán thời gian bàn trống và thời gian quay vòng."));
  if (ai) return ai;
  const hourCounts = new Array(24).fill(0);
  (payload?.history || []).forEach((item) => {
    const start = Date.parse(item.checkIn || item.startAt); const end = Date.parse(item.checkOut || item.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    for (let h = new Date(start).getHours(); h <= new Date(end).getHours(); h += 1) hourCounts[h % 24] += 1;
  });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const base = fallbackSuggestion("turnover", payload);
  return peakHour >= 0 && Math.max(...hourCounts) > 0 ? `${base} Khung giờ đông nhất: khoảng ${peakHour}:00–${(peakHour + 2) % 24}:00.` : base;
};
