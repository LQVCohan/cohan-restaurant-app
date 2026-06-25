import process from "process";
import { MenuItem, Order, Recipe, Reservation, StockItem } from "../../../models/index.js";
import { generateGeminiJson } from "./geminiClient.service.js";
import { callLocalChatProvider, getLocalAiConfig } from "./localAiProvider.service.js";

const DEFAULT_OPENAI_MODEL = process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-5";
const DEFAULT_GEMINI_MODEL = process.env.AI_CHATBOT_MODEL || process.env.GEMINI_MODEL || "gemini-1.5-flash";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const ACTIVE_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "customer_attached",
  "preparing",
  "ready",
  "served",
  "completed",
]);

const ACTIVE_RESERVATION_STATUSES = new Set([
  "pending_payment",
  "confirmed",
  "seated",
  "pending_change",
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIsoDay = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
};

const getDayOfWeek = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const dow = formatter.format(date);
  const map = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 0,
  };
  return map[dow] ?? date.getDay();
};

const getHour = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  });
  const hour = Number.parseInt(formatter.format(date), 10);
  return Number.isFinite(hour) ? hour : date.getHours();
};

const makeSlotLabel = (hour) => `${String(hour).padStart(2, "0")}:00`;

const toDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
};


const createZeroHours = () => Array.from({ length: 24 }, () => 0);

function aggregateOrderHistory(orders, timezone) {
  const dayMap = new Map();
  const hourTotals = createZeroHours();
  const dayHourMap = new Map();
  const dowCountMap = new Map();
  const dishDaily = new Map();
  const recentDishDaily = new Map();

  const now = new Date();
  const recentStart = new Date(now);
  recentStart.setDate(recentStart.getDate() - 14);

  for (const order of orders || []) {
    if (!ACTIVE_ORDER_STATUSES.has(String(order?.currentStatus || "").toLowerCase())) continue;

    const createdAt = toDate(order?.createdAt);
    if (!createdAt) continue;

    const dayKey = toIsoDay(createdAt, timezone);
    const dow = getDayOfWeek(createdAt, timezone);
    const hour = getHour(createdAt, timezone);

    const guestCount = Math.max(1, parseNumber(order?.guestCount, 1));

    const dayRow = dayMap.get(dayKey) || {
      date: dayKey,
      dayOfWeek: dow,
      orders: 0,
      guests: 0,
      hourOrders: createZeroHours(),
      hourGuests: createZeroHours(),
    };

    dayRow.orders += 1;
    dayRow.guests += guestCount;
    dayRow.hourOrders[hour] += 1;
    dayRow.hourGuests[hour] += guestCount;
    dayMap.set(dayKey, dayRow);
    if (!dowCountMap.has(dow)) dowCountMap.set(dow, new Set());
    dowCountMap.get(dow).add(dayKey);

    hourTotals[hour] += 1;
    const dayHourKey = `${dow}-${hour}`;
    dayHourMap.set(dayHourKey, (dayHourMap.get(dayHourKey) || 0) + 1);

    for (const item of order?.items || []) {
      if (["cancelled", "returned"].includes(String(item?.status || "").toLowerCase())) continue;
      const qty = Math.max(0, parseNumber(item?.quantity, 0));
      if (!qty) continue;

      const dishId = item?.dishId ? String(item.dishId) : `name:${String(item?.name || "unknown")}`;
      const dishName = String(item?.name || "Món không tên").trim() || "Món không tên";
      const dailyKey = `${dishId}|${dayKey}`;
      const prev = dishDaily.get(dailyKey) || { dishId, dishName, dayKey, qty: 0 };
      prev.qty += qty;
      dishDaily.set(dailyKey, prev);

      if (createdAt >= recentStart) {
        const recentPrev = recentDishDaily.get(dailyKey) || { dishId, dishName, dayKey, qty: 0 };
        recentPrev.qty += qty;
        recentDishDaily.set(dailyKey, recentPrev);
      }
    }
  }

  return {
    days: [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    hourTotals,
    dayHourMap,
    dowCountMap: new Map([...dowCountMap.entries()].map(([k, set]) => [k, set.size])),
    dishDaily: [...dishDaily.values()],
    recentDishDaily: [...recentDishDaily.values()],
  };
}

function buildReservationUplift(reservations, timezone) {
  const slotGuests = new Map();
  const dayGuests = new Map();

  for (const row of reservations || []) {
    if (!ACTIVE_RESERVATION_STATUSES.has(String(row?.status || "").toLowerCase())) continue;
    const timeTo = toDate(row?.timeTo);
    if (!timeTo) continue;

    const dayKey = toIsoDay(timeTo, timezone);
    const hour = getHour(timeTo, timezone);
    const guests = Math.max(1, parseNumber(row?.partySize, 2));

    slotGuests.set(`${dayKey}-${hour}`, (slotGuests.get(`${dayKey}-${hour}`) || 0) + guests);
    dayGuests.set(dayKey, (dayGuests.get(dayKey) || 0) + guests);
  }

  return { slotGuests, dayGuests };
}

function buildStockRiskIndex({ risingDishes, recipeMap, stockByIngredient }) {
  return risingDishes.map((dish) => {
    const recipe = recipeMap.get(dish.dishId);
    if (!recipe) {
      return {
        ...dish,
        stockRisk: "medium",
        inventoryNote: "Thiếu công thức recipe, chỉ gợi ý prep theo món.",
      };
    }

    const defaultVariant = (recipe.servingVariants || []).find((v) => v?.isDefault) || recipe.servingVariants?.[0];
    const ingredientLines = defaultVariant?.ingredients || [];

    if (!ingredientLines.length) {
      return {
        ...dish,
        stockRisk: "medium",
        inventoryNote: "Recipe chưa có ingredient line, cần kiểm tra thủ công.",
      };
    }

    let minCoverage = Number.POSITIVE_INFINITY;
    for (const line of ingredientLines) {
      const ingredientId = line?.ingredientId ? String(line.ingredientId) : null;
      if (!ingredientId) continue;
      const available = stockByIngredient.get(ingredientId) || 0;
      const perServing = Math.max(0.000001, parseNumber(line?.qty, 0));
      const needed = perServing * Math.max(1, dish.suggestedPrepQty || 0);
      const coverage = needed > 0 ? available / needed : Number.POSITIVE_INFINITY;
      minCoverage = Math.min(minCoverage, coverage);
    }

    if (!Number.isFinite(minCoverage)) {
      return {
        ...dish,
        stockRisk: "medium",
        inventoryNote: "Không đủ dữ liệu tồn kho nguyên liệu.",
      };
    }

    const stockRisk = minCoverage >= 1.25 ? "low" : minCoverage >= 0.9 ? "medium" : "high";
    const inventoryNote =
      stockRisk === "low"
        ? "Tồn kho an toàn cho kế hoạch prep."
        : stockRisk === "medium"
          ? "Tồn kho sát ngưỡng, nên theo dõi nhập thêm."
          : "Rủi ro thiếu hàng cao, cần bổ sung nguyên liệu sớm.";

    return {
      ...dish,
      stockRisk,
      inventoryNote,
    };
  });
}

const stripJsonFences = (value = "") =>
  String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

const safeJsonParse = (raw) => {
  const text = stripJsonFences(raw);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const normalizeAiProvider = (value) => String(value || "").trim().toLowerCase();

const getAiProviderOrder = () => {
  const primary = normalizeAiProvider(process.env.AI_PROVIDER || "local");
  const fallback = normalizeAiProvider(process.env.AI_FALLBACK_PROVIDER || "local");
  const localConfig = getLocalAiConfig();
  const order = [];

  const push = (provider) => {
    const key = provider === "ollama" ? "local" : provider;
    if (["local", "gemini", "openai"].includes(key) && !order.includes(key)) order.push(key);
  };

  push(primary);
  push(fallback);
  if (localConfig.enabled) push("local");
  push("gemini");
  push("openai");

  return order;
};

const buildAiSummaryPrompt = ({ forecast, timezone }) => [
  "Bạn là trợ lý forecast nhà hàng.",
  "Trả về JSON thuần với shape {\"summary\":{},\"notes\":[string]}.",
  "summary có thể bổ sung các trường ngắn như demandInsight, staffingNote, prepWarning.",
  "Không markdown, không giải thích ngoài JSON.",
  `Timezone: ${timezone}`,
  `Input: ${JSON.stringify({
    busiestPeriods: forecast.summary?.busiestPeriods || [],
    topRisingDishes: forecast.summary?.topRisingDishes || [],
    hourlyHead: (forecast.hourlyForecast || []).slice(0, 8),
    dailyForecast: (forecast.dailyForecast || []).slice(0, 4),
    risingDishes: (forecast.risingDishes || []).slice(0, 5),
  })}`,
].join("\n");

async function callOpenAiJson({ prompt }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 260,
      messages: [
        { role: "system", content: "Bạn trả lời tiếng Việt, JSON hợp lệ." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const parsed = safeJsonParse(data?.choices?.[0]?.message?.content?.trim());
  return parsed ? { payload: parsed, provider: "openai", model: DEFAULT_OPENAI_MODEL } : null;
}

async function callGeminiJson({ prompt }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = DEFAULT_GEMINI_MODEL;
  const payload = await generateGeminiJson({
    apiKey,
    model,
    systemInstruction: "Bạn trả lời tiếng Việt, JSON hợp lệ. Không markdown.",
    prompt,
    timeoutMs: 12000,
  });
  return payload ? { payload, provider: "gemini", model } : null;
}

async function callLocalAiJson({ prompt }) {
  const localConfig = getLocalAiConfig();
  if (!localConfig.enabled) return null;

  const result = await callLocalChatProvider({
    systemInstruction: "Bạn là trợ lý forecast nhà hàng. Chỉ trả JSON hợp lệ, không markdown.",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    maxTokens: 600,
  });
  const parsed = safeJsonParse(result?.content);
  return parsed ? { payload: parsed, provider: `local:${localConfig.provider}`, model: localConfig.chatModel } : null;
}

async function tryAiSummary({ forecast, timezone }) {
  const prompt = buildAiSummaryPrompt({ forecast, timezone });
  const attemptedProviders = [];

  for (const provider of getAiProviderOrder()) {
    try {
      attemptedProviders.push(provider);
      const result =
        provider === "local"
          ? await callLocalAiJson({ prompt })
          : provider === "gemini"
            ? await callGeminiJson({ prompt })
            : await callOpenAiJson({ prompt });

      if (result?.payload?.summary) {
        return {
          aiEnhanced: true,
          payload: result.payload,
          provider: result.provider,
          model: result.model,
          attemptedProviders,
          fallbackProviderUsed: attemptedProviders.length > 1,
        };
      }
    } catch (error) {
      console.warn("[demand-forecast] AI summary provider unavailable", {
        provider,
        message: error?.message,
      });
    }
  }

  return { aiEnhanced: false, payload: null, attemptedProviders };
}

export function computeDemandForecastFromData({
  orders = [],
  reservations = [],
  recipes = [],
  stockItems = [],
  horizonDays = 2,
  timezone = "Asia/Ho_Chi_Minh",
}) {
  const safeHorizon = clamp(parseNumber(horizonDays, 2), 1, 7);
  const now = new Date();

  const history = aggregateOrderHistory(orders, timezone);
  const reservationUplift = buildReservationUplift(reservations, timezone);
  const totalOrders = history.days.reduce((sum, d) => sum + d.orders, 0);
  const totalGuests = history.days.reduce((sum, d) => sum + d.guests, 0);
  const avgGuestsPerOrder = totalOrders > 0 ? totalGuests / totalOrders : 2.2;

  const dayCount = Math.max(1, history.days.length);
  const recentDays = history.days.slice(-7);
  const recentDayCount = Math.max(1, recentDays.length);

  const recentHourTotals = createZeroHours();
  for (const day of recentDays) {
    for (let h = 0; h < 24; h += 1) {
      recentHourTotals[h] += parseNumber(day.hourOrders[h], 0);
    }
  }

  const maxHourAvg = Math.max(
    1,
    ...history.hourTotals.map((x, idx) => {
      const overallHourAvg = x / dayCount;
      const recentHourAvg = recentHourTotals[idx] / recentDayCount;
      return overallHourAvg * 0.7 + recentHourAvg * 0.3;
    })
  );

  const hourlyForecast = [];
  const dayForecastMap = new Map();

  for (let dayOffset = 0; dayOffset < safeHorizon; dayOffset += 1) {
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() + dayOffset);
    dayDate.setMinutes(0, 0, 0);
    const dayKey = toIsoDay(dayDate, timezone);
    const dow = getDayOfWeek(dayDate, timezone);

    const dayRow = {
      date: dayKey,
      expectedOrders: 0,
      expectedGuests: 0,
      peakWindow: "",
      confidence: 0,
      slots: [],
    };

    for (let hour = 6; hour <= 23; hour += 1) {
      const overallHourAvg = history.hourTotals[hour] / dayCount;
      const dowCount = Number(history?.dowCountMap?.get(dow) || 1);
      const dayHourAvg = (history.dayHourMap.get(`${dow}-${hour}`) || 0) / Math.max(1, dowCount);
      const recentHourAvg = recentHourTotals[hour] / recentDayCount;

      const rawExpectedOrders = overallHourAvg * 0.2 + dayHourAvg * 0.5 + recentHourAvg * 0.3;
      const reservationGuests = reservationUplift.slotGuests.get(`${dayKey}-${hour}`) || 0;
      const reservationOrdersBoost = reservationGuests / Math.max(1.5, avgGuestsPerOrder);

      const expectedOrders = Math.max(0, rawExpectedOrders + reservationOrdersBoost * 0.35);
      const expectedGuests = Math.max(0, expectedOrders * avgGuestsPerOrder + reservationGuests * 0.5);

      const demandScore = clamp(expectedOrders / maxHourAvg, 0, 1);
      const sampleStrength = clamp(totalOrders / 180, 0.2, 1);
      const reservationStrength = reservationGuests > 0 ? 0.08 : 0;
      const confidence = clamp(0.45 + sampleStrength * 0.4 + reservationStrength, 0.3, 0.95);

      const suggestedStaff = Math.max(2, Math.ceil(expectedGuests / 7));

      const row = {
        slot: `${dayKey} ${makeSlotLabel(hour)}`,
        hourLabel: makeSlotLabel(hour),
        date: dayKey,
        expectedOrders: Number(expectedOrders.toFixed(2)),
        expectedGuests: Number(expectedGuests.toFixed(2)),
        demandScore: Number(demandScore.toFixed(3)),
        suggestedStaff,
        confidence: Number(confidence.toFixed(3)),
      };
      hourlyForecast.push(row);

      dayRow.expectedOrders += row.expectedOrders;
      dayRow.expectedGuests += row.expectedGuests;
      dayRow.slots.push(row);
    }

    const sortedSlots = [...dayRow.slots].sort((a, b) => b.expectedOrders - a.expectedOrders);
    const top = sortedSlots[0];
    const nextHour = top ? Number.parseInt(top.hourLabel.slice(0, 2), 10) + 1 : 0;
    dayRow.peakWindow = top
      ? `${top.hourLabel}-${String(nextHour % 24).padStart(2, "0")}:00`
      : "N/A";

    dayRow.confidence = Number(
      clamp(
        0.45 + clamp(totalOrders / 220, 0, 0.35) + clamp((reservationUplift.dayGuests.get(dayKey) || 0) / 80, 0, 0.2),
        0.3,
        0.95
      ).toFixed(3)
    );

    dayRow.expectedOrders = Number(dayRow.expectedOrders.toFixed(2));
    dayRow.expectedGuests = Number(dayRow.expectedGuests.toFixed(2));

    dayForecastMap.set(dayKey, dayRow);
  }

  const dailyForecast = [...dayForecastMap.values()].map((d) => ({
    date: d.date,
    expectedOrders: d.expectedOrders,
    expectedGuests: d.expectedGuests,
    peakWindow: d.peakWindow,
    confidence: d.confidence,
  }));

  const todayKey = toIsoDay(now, timezone);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 35);

  const dishRolling = new Map();
  const dishBaseline = new Map();

  for (const order of orders || []) {
    const createdAt = toDate(order?.createdAt);
    if (!createdAt) continue;
    if (!ACTIVE_ORDER_STATUSES.has(String(order?.currentStatus || "").toLowerCase())) continue;

    for (const item of order?.items || []) {
      if (["cancelled", "returned"].includes(String(item?.status || "").toLowerCase())) continue;
      const qty = Math.max(0, parseNumber(item?.quantity, 0));
      if (!qty) continue;

      const dishId = item?.dishId ? String(item.dishId) : `name:${String(item?.name || "unknown")}`;
      const dishName = String(item?.name || "Món không tên").trim() || "Món không tên";

      if (createdAt >= weekAgo) {
        const prev = dishRolling.get(dishId) || { dishId, dishName, qty: 0 };
        prev.qty += qty;
        dishRolling.set(dishId, prev);
      } else if (createdAt >= monthAgo) {
        const prev = dishBaseline.get(dishId) || { dishId, dishName, qty: 0 };
        prev.qty += qty;
        dishBaseline.set(dishId, prev);
      }
    }
  }

  const recipeMap = new Map((recipes || []).map((r) => [String(r?.menuItemId || ""), r]));
  const stockByIngredient = new Map();
  for (const stock of stockItems || []) {
    const ingredientId = stock?.ingredientId ? String(stock.ingredientId) : null;
    if (!ingredientId) continue;
    const available = Math.max(0, parseNumber(stock?.onHand, 0) - parseNumber(stock?.reserved, 0));
    stockByIngredient.set(ingredientId, (stockByIngredient.get(ingredientId) || 0) + available);
  }

  const risingDishesRaw = [...dishRolling.values()]
    .map((recent) => {
      const baseline = dishBaseline.get(recent.dishId)?.qty || 0;
      const baselinePerWeek = baseline > 0 ? baseline / 4 : 0;
      const upliftPct = baselinePerWeek > 0 ? ((recent.qty - baselinePerWeek) / baselinePerWeek) * 100 : recent.qty > 0 ? 100 : 0;
      const confidence = clamp(
        0.35 + Math.min(0.4, recent.qty / 50) + (baseline > 0 ? 0.2 : 0),
        0.3,
        0.95
      );
      const forecastQty = Math.max(1, Math.round(recent.qty * (safeHorizon / 7) * (1 + clamp(upliftPct / 250, -0.2, 0.4))));
      const buffer = confidence >= 0.75 ? 1.08 : confidence >= 0.6 ? 1.1 : 1.15;
      const suggestedPrepQty = Math.max(1, Math.ceil(forecastQty * buffer));

      return {
        dishId: recent.dishId,
        dishName: recent.dishName,
        baselineQty: Number(baselinePerWeek.toFixed(2)),
        forecastQty,
        upliftPct: Number(upliftPct.toFixed(2)),
        suggestedPrepQty,
        confidence: Number(confidence.toFixed(3)),
      };
    })
    .filter((d) => d.forecastQty > 0)
    .sort((a, b) => b.upliftPct - a.upliftPct || b.forecastQty - a.forecastQty)
    .slice(0, 8);

  const risingDishes = buildStockRiskIndex({
    risingDishes: risingDishesRaw,
    recipeMap,
    stockByIngredient,
  });

  const prepPlan = risingDishes.slice(0, 6).map((dish) => ({
    dishId: dish.dishId,
    dishName: dish.dishName,
    suggestedPrepQty: dish.suggestedPrepQty,
    reason:
      dish.upliftPct > 25
        ? "Nhu cầu tăng rõ + xu hướng gần đây tích cực"
        : "Nhu cầu ổn định, cần chuẩn bị sớm cho khung giờ cao điểm",
    inventoryNote: dish.inventoryNote,
  }));

  const busiestPeriods = [...hourlyForecast]
    .sort((a, b) => b.expectedOrders - a.expectedOrders)
    .slice(0, 3)
    .map((slot) => {
      const hour = Number.parseInt(slot.hourLabel.slice(0, 2), 10);
      return `${slot.date} ${slot.hourLabel}-${String((hour + 1) % 24).padStart(2, "0")}:00`;
    });

  const summary = {
    busiestPeriods,
    topRisingDishes: risingDishes.slice(0, 3).map((d) => d.dishName),
    totalRecommendedPrep: prepPlan.reduce((sum, row) => sum + Number(row.suggestedPrepQty || 0), 0),
    notes:
      totalOrders < 20
        ? [
            "Dữ liệu lịch sử còn ít, forecast ưu tiên heuristic theo khung giờ và reservation.",
            `Ngày tham chiếu: ${todayKey}`,
          ]
        : [`Forecast dựa trên ${totalOrders} đơn lịch sử và tín hiệu reservation gần nhất.`],
  };

  const forecast = {
    summary,
    hourlyForecast,
    dailyForecast,
    risingDishes,
    prepPlan,
    meta: {
      method: "time_series_v1",
      fallbackUsed: totalOrders < 20,
      forecastFallbackUsed: totalOrders < 20,
      lowDataFallbackUsed: totalOrders < 20,
      aiEnhanced: false,
      generatedAt: new Date().toISOString(),
      granularity: "hourly",
      timezone,
      sampleOrders: totalOrders,
      sampleDays: history.days.length,
    },
  };

  return forecast;
}

export async function buildDemandForecast({
  restaurantId,
  timezone = "Asia/Ho_Chi_Minh",
  horizonDays = 2,
  historyDays = 35,
}) {
  const now = new Date();
  const historyStart = new Date(now);
  historyStart.setDate(historyStart.getDate() - clamp(parseNumber(historyDays, 35), 14, 90));

  const futureEnd = new Date(now);
  futureEnd.setDate(futureEnd.getDate() + clamp(parseNumber(horizonDays, 2), 1, 7));

  const [orders, reservations, recipes, stockItems] = await Promise.all([
    Order.find({
      restaurantId,
      createdAt: { $gte: historyStart, $lte: now },
      currentStatus: { $nin: ["cancelled", "failed"] },
    })
      .select({ createdAt: 1, currentStatus: 1, guestCount: 1, items: 1 })
      .lean(),
    Reservation.find({
      restaurantId,
      timeTo: { $gte: now, $lte: futureEnd },
    })
      .select({ timeTo: 1, partySize: 1, status: 1 })
      .lean(),
    Recipe.find({ restaurantId, isActive: true })
      .select({ menuItemId: 1, servingVariants: 1 })
      .lean(),
    StockItem.find({ restaurantId, ingredientId: { $ne: null } })
      .select({ ingredientId: 1, onHand: 1, reserved: 1 })
      .lean(),
  ]);

  const forecast = computeDemandForecastFromData({
    orders,
    reservations,
    recipes,
    stockItems,
    horizonDays,
    timezone,
  });

  const ai = await tryAiSummary({ forecast, timezone });
  forecast.meta.aiAttemptedProviders = ai.attemptedProviders || [];
  if (ai.aiEnhanced && ai.payload?.summary) {
    forecast.summary = {
      ...forecast.summary,
      ...ai.payload.summary,
      notes: [...(forecast.summary?.notes || []), ...(Array.isArray(ai.payload?.notes) ? ai.payload.notes : [])],
    };
    forecast.meta.aiEnhanced = true;
    forecast.meta.aiProvider = ai.provider;
    forecast.meta.aiModel = ai.model;
    forecast.meta.aiFallbackProviderUsed = Boolean(ai.fallbackProviderUsed);
  } else {
    forecast.meta.aiEnhanced = false;
    forecast.meta.aiProvider = null;
    forecast.meta.aiModel = null;
    forecast.meta.aiFallbackProviderUsed = false;
  }

  if (!forecast.risingDishes.length) {
    const menuFallback = await MenuItem.find({ restaurantId, status: "available" })
      .sort({ orderCounter: -1, updatedAt: -1 })
      .limit(5)
      .select({ _id: 1, name: 1, orderCounter: 1 })
      .lean();

    forecast.risingDishes = menuFallback.map((item, idx) => ({
      dishId: String(item._id),
      dishName: item.name || "Món mới",
      baselineQty: Number(((item.orderCounter || 0) / 8).toFixed(2)),
      forecastQty: Math.max(1, Math.round((item.orderCounter || 1) / 10)),
      upliftPct: Number((8 - idx * 1.4).toFixed(2)),
      suggestedPrepQty: Math.max(1, Math.round((item.orderCounter || 1) / 9)),
      stockRisk: "medium",
      confidence: 0.42,
      inventoryNote: "Dữ liệu lịch sử order còn mỏng, dùng fallback theo orderCounter.",
    }));

    forecast.prepPlan = forecast.risingDishes.slice(0, 5).map((dish) => ({
      dishId: dish.dishId,
      dishName: dish.dishName,
      suggestedPrepQty: dish.suggestedPrepQty,
      reason: "Fallback từ menu phổ biến gần đây",
      inventoryNote: dish.inventoryNote,
    }));

    forecast.summary.topRisingDishes = forecast.risingDishes.slice(0, 3).map((d) => d.dishName);
    forecast.summary.totalRecommendedPrep = forecast.prepPlan.reduce(
      (sum, row) => sum + Number(row.suggestedPrepQty || 0),
      0
    );
    forecast.meta.fallbackUsed = true;
    forecast.meta.forecastFallbackUsed = true;
    forecast.meta.lowDataFallbackUsed = true;
  }

  return forecast;
}
