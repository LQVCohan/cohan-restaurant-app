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

const DEFAULT_COMPONENTS = {
  tables: { standard: 8, vip: 0, twoSeat: 0, fourSeat: 0, group: 0 },
  objects: { plant: 0, door: 1, window: 0, stairs: 0, cashier: 0, kitchen: 0, wc: 0, buffet: 0, wall: 0 },
};

const clampNonNegative = (value) => Math.max(0, Number(value) || 0);
const toComponents = (payload = {}) => {
  if (payload?.components) {
    const tables = { ...DEFAULT_COMPONENTS.tables, ...(payload.components.tables || {}) };
    const objects = { ...DEFAULT_COMPONENTS.objects, ...(payload.components.objects || {}) };
    Object.keys(tables).forEach((k) => (tables[k] = clampNonNegative(tables[k])));
    Object.keys(objects).forEach((k) => (objects[k] = clampNonNegative(objects[k])));
    return { tables, objects };
  }
  const tableCount = clampNonNegative(payload.tableCount || 8);
  const selected = new Set((payload?.selectedComponents || []).map((i) => String(i || "").trim()));
  return {
    tables: { ...DEFAULT_COMPONENTS.tables, standard: tableCount },
    objects: {
      ...DEFAULT_COMPONENTS.objects,
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

const typeMap = { standard: [4, "standard"], vip: [6, "vip"], twoSeat: [2, "two-seat"], fourSeat: [4, "four-seat"], group: [8, "group"] };
const decorSize = { plant:[40,40], door:[70,12], window:[12,80], stairs:[100,60], cashier:[120,50], kitchen:[140,90], wc:[80,80], buffet:[160,70], wall:[200,10] };

const generateRuleBasedLayout = (payload = {}, seed = 0) => {
  const startX = Number(payload.startX || 0); const startY = Number(payload.startY || 0);
  const goal = String(payload.goal || "balanced");
  const components = toComponents(payload); const warnings=[];
  const tableEntries=[]; Object.entries(components.tables).forEach(([k,n])=>{ for(let i=0;i<n;i++) tableEntries.push(k); });
  if (tableEntries.length>200){ warnings.push("Tổng số bàn vượt 200, hệ thống giới hạn 200."); tableEntries.length=200; }
  const spacing = goal==="capacity"?78:goal==="spacious"?128:goal==="vip"?118:98;
  const rows = Math.max(1, Math.round(Math.sqrt(tableEntries.length/1.4))); const cols = Math.max(1, Math.ceil(tableEntries.length/rows));
  const placed=[]; const tables=[];
  const placeTable=(tableType,index,x,y)=>{ const [cap, apiType]= typeMap[tableType] || [4,"standard"]; const w = tableType==="group"?90:60; const h = tableType==="group"?70:60; const rect={x,y,w,h}; if(placed.some(r=>rectsOverlap(expandRect(rect,12), expandRect(r,12)))) return false; placed.push(rect); tables.push({code:`AI-${tables.length+1}`,x,y,rotation:0,capacity:cap,type:apiType}); return true; };
  tableEntries.sort((a,b)=> (a==="vip"?-1:0) - (b==="vip"?-1:0));
  tableEntries.forEach((tt, idx)=>{ let x=startX+(idx%cols)*spacing+((Math.floor(idx/cols))%2?20:0); let y=startY+Math.floor(idx/cols)*spacing; if(tt==="vip"){x=startX+cols*spacing+80+seed*8; y=startY+idx*90;} if(tt==="twoSeat"){x=startX-120-(idx%3)*70; y=startY+(idx%rows)*90;} if(tt==="group"){x=startX+Math.floor(cols/2)*spacing+(idx%2)*110; y=startY+Math.floor(rows/2)*spacing+(idx%3)*80;} let tries=0; while(!placeTable(tt, idx, Math.round(x), Math.round(y)) && tries<30){x+=35; y+=(tries%2?24:-24); tries++;} });

  const bounds = getBounds(placed) || {minX:startX,minY:startY,maxX:startX+500,maxY:startY+400};
  const decor=[]; const addDecor=(type,count,posFn)=>{for(let i=0;i<count;i++){const [w,h]=decorSize[type]||[60,60]; const base=posFn(i,w,h); const fit=findNearestFreeRect({baseRect:{...base,w,h},occupiedRects:placed,padding:10,step:24,maxRing:8}); placed.push(normalizeRect(fit)); decor.push({id:`ai_${type}_${Date.now()}_${i}_${seed}`,type,x:fit.x,y:fit.y,w,h,rotation:0,label:type.toUpperCase(),isRealTable:false});}};
  addDecor("door", components.objects.door, (i,w,h)=>({x:bounds.minX+20+i*90,y:bounds.maxY+30}));
  addDecor("cashier", components.objects.cashier, (i,w,h)=>({x:bounds.minX+10,y:bounds.maxY+60+i*60}));
  ["kitchen","wc","buffet","stairs","window","wall"].forEach((t,idx)=>addDecor(t, components.objects[t], (i,w,h)=>({x:bounds.maxX+40+(idx%2)*30,y:bounds.minY+i*(h+16)})));
  addDecor("plant", components.objects.plant, (i,w,h)=>({x:i%2?bounds.minX-50:bounds.maxX+20,y:i%2?bounds.minY+20+i*30:bounds.maxY-40-i*20}));

  const scoreLayout = () => {
    let score=1000;
    for(let i=0;i<tables.length;i++){for(let j=i+1;j<tables.length;j++){const a={x:tables[i].x,y:tables[i].y,w:60,h:60}; const b={x:tables[j].x,y:tables[j].y,w:60,h:60}; if(rectsOverlap(a,b,0)) score-=120; if(rectsOverlap(a,b,18)) score-=15;}}
    tables.forEach((t)=>{if(t.type==="vip" && t.x<bounds.maxX-120) score-=25;});
    const door=decor.find((d)=>d.type==="door"); const cashier=decor.find((d)=>d.type==="cashier"); if(door&&cashier){const dist=Math.hypot(cashier.x-door.x,cashier.y-door.y); score += Math.max(0,120-dist)/2;}
    const centerX=(bounds.minX+bounds.maxX)/2; const spread=tables.reduce((s,t)=>s+Math.abs(t.x-centerX),0)/Math.max(1,tables.length); score += goal==="capacity"? -spread*0.05 : spread*0.02;
    return score;
  };
  const score = scoreLayout();
  if (!tables.length) warnings.push("Không thể đặt đủ bàn theo yêu cầu, đã tối ưu trong giới hạn hiện tại.");
  return { tables, decor, meta:{goal,score,warnings} };
};

export const generateSmartFloorLayout = async (payload = {}) => {
  const goal = String(payload.goal || "balanced");
  const candidates = Array.from({ length: 4 }).map((_, idx) => generateRuleBasedLayout(payload, idx));
  const best = candidates.sort((a,b)=>(b.meta?.score||0)-(a.meta?.score||0))[0];
  if (best?.tables?.length) return best;
  return generateRuleBasedLayout({ ...payload, goal });
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
