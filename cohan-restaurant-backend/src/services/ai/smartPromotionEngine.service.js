import process from "process";
import mongoose from "mongoose";
import { Coupon, Customer, Order, Promotion, StockItem } from "../../../models/index.js";
import { buildDemandForecast } from "./demandForecast.service.js";
import { DEFAULT_GEMINI_MODEL, generateGeminiJson } from "./geminiClient.service.js";

const ACTIVE_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "customer_attached",
  "preparing",
  "ready",
  "served",
  "completed",
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toNum = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function scoreExistingPromotion(promo, campaign, nowDate) {
  let score = 0.4;
  const reasons = [];

  const startAt = promo?.startAt ? new Date(promo.startAt) : null;
  const endAt = promo?.endAt ? new Date(promo.endAt) : null;
  const activeNow = (!startAt || startAt <= nowDate) && (!endAt || endAt >= nowDate) && promo?.isActive;
  if (activeNow) {
    score += 0.2;
    reasons.push("active_now");
  }

  const target = String(promo?.targetAudience || "all").toUpperCase();
  const segment = String(campaign?.targetSegment || "ALL").toUpperCase();
  if (target === "ALL" || target === segment) {
    score += 0.2;
    reasons.push("segment_fit");
  }

  const usageLimit = toNum(promo?.usageLimit, 0);
  const usageCount = toNum(promo?.usageCount, 0);
  if (usageLimit <= 0 || usageCount / Math.max(1, usageLimit) < 0.85) {
    score += 0.1;
    reasons.push("usage_capacity_ok");
  }

  if (String(promo?.discountType || "").toUpperCase() === String(campaign?.recommendation?.discountType || "").toUpperCase()) {
    score += 0.1;
    reasons.push("discount_type_match");
  }
  if (toNum(promo?.minOrderValue, 0) <= toNum(campaign?.recommendation?.minOrderValue, 0)) {
    score += 0.08;
    reasons.push("min_order_fit");
  }
  if (String(promo?.scope || "ORDER").toUpperCase() === String(campaign?.recommendation?.scope || "ORDER").toUpperCase()) {
    score += 0.08;
    reasons.push("scope_fit");
  }
  if (!promo?.stacking && campaign?.recommendation?.stacking === false) {
    score += 0.05;
    reasons.push("stacking_guardrail_fit");
  }

  return {
    fitScore: Number(clamp(score, 0, 0.99).toFixed(2)),
    fitReason: reasons.join(" + ") || "general_fit",
  };
}

function scoreExistingCoupon(coupon, campaign, nowDate, avgOrderValue) {
  let score = 0.3;
  const reasons = [];
  if (isActiveNow(coupon, nowDate)) {
    score += 0.2;
    reasons.push("active_now");
  }
  if (String(coupon?.discountType || "").toUpperCase() === String(campaign?.recommendation?.discountType || "").toUpperCase()) {
    score += 0.2;
    reasons.push("discount_type_match");
  }
  if (avgOrderValue > 0 && toNum(coupon?.minOrderValue, 0) <= avgOrderValue) {
    score += 0.15;
    reasons.push("min_order_fit");
  } else if (avgOrderValue <= 0) {
    score -= 0.08;
    reasons.push("aov_missing");
  }
  const maxUsage = toNum(coupon?.maxUsage, 0);
  const used = toNum(coupon?.used, 0);
  if (maxUsage <= 0 || used / Math.max(1, maxUsage) < 0.85) {
    score += 0.1;
    reasons.push("usage_capacity_ok");
  }
  const segment = String(campaign?.targetSegment || "ALL").toUpperCase();
  const constraintsText = JSON.stringify(coupon?.constraints || {}).toUpperCase();
  if (!constraintsText || constraintsText.includes(segment) || constraintsText.includes("ALL")) {
    score += 0.08;
    reasons.push("constraints_segment_fit");
  }
  return {
    fitScore: Number(clamp(score, 0, 0.95).toFixed(2)),
    fitReason: reasons.join(" + ") || "general_fit",
  };
}
function isActiveNow(row, nowDate) {
  const startAt = row?.startAt ? new Date(row.startAt) : null;
  const endAt = row?.endAt ? new Date(row.endAt) : null;
  return Boolean(row?.isActive && (!startAt || startAt <= nowDate) && (!endAt || endAt >= nowDate));
}

async function tryAiEnhanceCampaigns({ summary, campaigns, timezone }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { aiEnhanced: false, campaigns: null };

  const model =
    process.env.SMART_PROMOTION_AI_MODEL ||
    process.env.AI_CHATBOT_MODEL ||
    process.env.GEMINI_MODEL ||
    DEFAULT_GEMINI_MODEL;
  const prompt = [
    "Bạn là chuyên gia growth/promotion cho nhà hàng.",
    "Hãy cải thiện title/reason/guardrails của campaigns, KHÔNG đổi KPI số học.",
    "Trả về JSON thuần: {campaigns:[{campaignKey,title,reason,guardrails}]}.",
    `Timezone: ${timezone}`,
    `Input: ${JSON.stringify({ summary, campaigns })}`,
  ].join("\n");

  try {
    const parsed = await generateGeminiJson({
      apiKey,
      model,
      systemInstruction: "Bạn trả lời tiếng Việt và chỉ trả JSON hợp lệ.",
      prompt,
      temperature: 0.2,
      maxOutputTokens: 700,
      timeoutMs: Number(process.env.SMART_PROMOTION_AI_TIMEOUT_MS || 12000),
    });
    if (!Array.isArray(parsed?.campaigns)) return { aiEnhanced: false, campaigns: null };
    return { aiEnhanced: true, campaigns: parsed.campaigns };
  } catch {
    return { aiEnhanced: false, campaigns: null };
  }
}

function kpiFromScore({ score, demandWeakness, basketGap, stockReliefPotential }) {
  const base = clamp(score, 0.2, 0.95);
  return {
    expectedOrdersLiftPct: Math.round((6 + base * 14 + demandWeakness * 8) * 10) / 10,
    expectedRevenueLiftPct: Math.round((4 + base * 9 + basketGap * 6) * 10) / 10,
    expectedConversionLiftPct: Math.round((5 + base * 11 + demandWeakness * 7) * 10) / 10,
    expectedAovLiftPct: Math.round((2 + base * 6 + basketGap * 10) * 10) / 10,
    expectedRedemptionRate: Number((0.08 + base * 0.18).toFixed(3)),
    expectedStockReliefScore: Math.round((stockReliefPotential * 100 + base * 25) * 10) / 10,
    confidence: Number((0.45 + base * 0.45).toFixed(2)),
  };
}

export async function buildSmartPromotionEngine({
  restaurantId,
  lookbackDays = 30,
  timezone = "Asia/Ho_Chi_Minh",
  horizonDays = 2,
}) {
  const rid = mongoose.isValidObjectId(restaurantId)
    ? new mongoose.Types.ObjectId(restaurantId)
    : null;
  if (!rid) throw new Error("Invalid restaurantId");

  const safeLookbackDays = clamp(toNum(lookbackDays, 30), 7, 90);
  const safeHorizonDays = clamp(toNum(horizonDays, 2), 1, 7);
  const now = new Date();
  const start = new Date(now.getTime() - safeLookbackDays * 86400000);

  const [orders, promotions, coupons, customers, stockItems] = await Promise.all([
    Order.find({
      restaurantId: rid,
      createdAt: { $gte: start, $lte: now },
      currentStatus: { $in: [...ACTIVE_ORDER_STATUSES] },
    })
      .select({ createdAt: 1, orderType: 1, items: 1, totals: 1, currentStatus: 1 })
      .lean(),
    Promotion.find({ restaurantId: rid }).select({ name: 1, code: 1, promotionType: 1, scope: 1, discountType: 1, discountValue: 1, minOrderValue: 1, maxDiscount: 1, usageLimit: 1, usageCount: 1, targetAudience: 1, conditions: 1, startAt: 1, endAt: 1, isActive: 1, stacking: 1, level: 1 }).lean(),
    Coupon.find({ restaurantId: rid }).select({ name: 1, code: 1, category: 1, discountType: 1, discountValue: 1, minOrderValue: 1, maxDiscount: 1, maxUsage: 1, used: 1, constraints: 1, publishAt: 1, startAt: 1, endAt: 1, isActive: 1 }).lean(),
    Customer.find({ customerRestaurants: { $in: [rid] } }).select({ customerType: 1, totalOrders: 1, totalSpending: 1 }).lean(),
    StockItem.find({ restaurantId: rid }).select({ onHand: 1, reserved: 1 }).limit(200).lean(),
  ]);

  let forecast;
  let forecastFallback = true;
  try {
    forecast = await buildDemandForecast({ restaurantId: rid, timezone, horizonDays: safeHorizonDays });
    forecastFallback = Boolean(forecast?.meta?.fallbackUsed);
  } catch {
    forecast = null;
    forecastFallback = true;
  }

  const activePromotions = (promotions || []).filter((p) => isActiveNow(p, now));
  const activeCoupons = (coupons || []).filter((c) => isActiveNow(c, now));

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, row) => sum + toNum(row?.totals?.grandTotal, 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const lowStockCount = (stockItems || []).filter((row) => toNum(row.onHand, 0) - toNum(row.reserved, 0) <= 10).length;
  const stockPressureRatio = stockItems.length ? lowStockCount / stockItems.length : 0;

  const segmentCount = { NEW: 0, OFTEN: 0, VIP: 0 };
  for (const row of customers || []) {
    const type = String(row?.customerType || "NEW").toUpperCase();
    if (segmentCount[type] != null) segmentCount[type] += 1;
  }
  const highestPrioritySegment =
    segmentCount.NEW >= segmentCount.OFTEN && segmentCount.NEW >= segmentCount.VIP
      ? "NEW"
      : segmentCount.OFTEN >= segmentCount.VIP
        ? "OFTEN"
        : "VIP";

  const hourly = forecast?.hourlyForecast || [];
  const sortedByDemand = [...hourly].sort((a, b) => toNum(a.expectedOrders, 0) - toNum(b.expectedOrders, 0));
  const weakest = sortedByDemand[0] || null;
  const topOpportunityWindow = weakest?.hourLabel
    ? `${weakest.hourLabel}-${String((toNum(weakest.hourLabel.slice(0, 2), 0) + 2) % 24).padStart(2, "0")}:00`
    : "15:00-17:00";
  const demandWeakness = weakest ? clamp(1 - toNum(weakest.demandScore, 0.5), 0, 1) : 0.45;
  const basketGap = avgOrderValue > 0 ? clamp((140000 - avgOrderValue) / 140000, 0, 1) : 0.5;

  const baseCampaigns = [
    {
      campaignKey: "off_peak_happy_hour_new",
      title: "Happy Hour khách mới",
      objective: "increase_conversion",
      campaignType: "time_window_discount",
      priority: demandWeakness > 0.5 ? "high" : "medium",
      score: Number((0.55 + demandWeakness * 0.32 + (highestPrioritySegment === "NEW" ? 0.08 : 0)).toFixed(2)),
      targetSegment: "NEW",
      targetOrderType: "dine_in",
      targetWindow: { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startHour: 15, endHour: 17 },
      recommendation: {
        promotionType: "PERCENTAGE",
        scope: "ORDER",
        discountType: "PERCENT",
        discountValue: 10,
        minOrderValue: Math.max(79000, Math.round(avgOrderValue * 0.8)),
        maxDiscount: 30000,
        stacking: false,
        targetAudience: "NEW",
        conditions: ["off_peak_window"],
      },
      guardrails: ["không áp dụng cùng voucher khác", "tắt campaign khi demand tăng mạnh"],
      reason: "off-peak + khách mới + cần tăng conversion",
    },
    {
      campaignKey: "basket_threshold_often",
      title: "Thưởng ngưỡng đơn cho khách quay lại",
      objective: "increase_aov",
      campaignType: "min_order_threshold",
      priority: basketGap > 0.35 ? "high" : "medium",
      score: Number((0.52 + basketGap * 0.33 + (highestPrioritySegment === "OFTEN" ? 0.08 : 0)).toFixed(2)),
      targetSegment: "OFTEN",
      targetOrderType: "takeaway",
      targetWindow: { days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], startHour: 10, endHour: 22 },
      recommendation: {
        promotionType: "FIXED",
        scope: "ORDER",
        discountType: "AMOUNT",
        discountValue: 25000,
        minOrderValue: Math.max(119000, Math.round(avgOrderValue * 1.25)),
        maxDiscount: 25000,
        stacking: false,
        targetAudience: "OFTEN",
        conditions: ["threshold_aov"],
      },
      guardrails: ["ưu tiên đơn chưa dùng voucher", "giới hạn theo usageLimit/khung giờ"],
      reason: "basket hiện thấp hơn ngưỡng mục tiêu, cần đẩy AOV",
    },
    {
      campaignKey: "vip_bundle_upsell",
      title: "Ưu đãi bundle VIP",
      objective: "upsell_margin",
      campaignType: "bundle_offer",
      priority: "medium",
      score: Number((0.5 + (highestPrioritySegment === "VIP" ? 0.16 : 0.06)).toFixed(2)),
      targetSegment: "VIP",
      targetOrderType: "delivery",
      targetWindow: { days: ["Fri", "Sat", "Sun"], startHour: 18, endHour: 21 },
      recommendation: {
        promotionType: "COMBO",
        scope: "ORDER",
        discountType: "PERCENT",
        discountValue: 7,
        minOrderValue: Math.max(169000, Math.round(avgOrderValue * 1.4)),
        maxDiscount: 45000,
        stacking: false,
        targetAudience: "VIP",
        conditions: ["bundle_focus"],
      },
      guardrails: ["không giảm sâu món premium nhu cầu cao", "ưu tiên combo thay vì giảm thẳng"],
      reason: "khách VIP có chi tiêu cao, phù hợp upsell có kiểm soát",
    },
  ];

  const stockReliefPotential = clamp(stockPressureRatio, 0, 1);
  const campaigns = baseCampaigns
    .map((campaign) => {
      const kpi = kpiFromScore({
        score: campaign.score,
        demandWeakness,
        basketGap,
        stockReliefPotential,
      });
      const extraGuard = stockPressureRatio > 0.25 ? ["không áp dụng cho món/line có stock risk cao"] : [];
      return {
        ...campaign,
        expectedKpi: kpi,
        guardrails: [...campaign.guardrails, ...extraGuard],
      };
    })
    .sort((a, b) => b.score - a.score);

  const autoSelectedPromotions = activePromotions
    .map((promo) => {
      const targetCampaign = campaigns[0];
      const fit = scoreExistingPromotion(promo, targetCampaign, now);
      return {
        source: "existing_promotion",
        promotionId: String(promo._id),
        promotionName: promo.name || "Promotion",
        fitScore: fit.fitScore,
        fitReason: fit.fitReason,
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 4)
    .concat(
      activeCoupons.map((coupon) => {
        const fit = scoreExistingCoupon(coupon, campaigns[0], now, avgOrderValue);
        return {
          source: "existing_coupon",
          promotionId: String(coupon._id),
          promotionName: coupon.code || coupon.name || "Coupon",
          fitScore: fit.fitScore,
          fitReason: fit.fitReason,
        };
      }),
    )
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 6);

  const segmentInsights = [
    {
      segment: "NEW",
      recommendedStrategy: "welcome_discount",
      reason: "ưu tiên tăng conversion và first order",
    },
    {
      segment: "OFTEN",
      recommendedStrategy: "threshold_reward",
      reason: "tăng AOV bằng ngưỡng đơn hợp lý",
    },
    {
      segment: "VIP",
      recommendedStrategy: "upsell_bundle",
      reason: "giữ biên lợi nhuận bằng ưu đãi chọn lọc",
    },
  ];

  const timeWindowInsights = [
    {
      window: topOpportunityWindow,
      demandLevel: demandWeakness > 0.5 ? "low" : "medium",
      recommendedStrategy: "flash_discount",
    },
  ];

  const nearLimitPromotions = (promotions || []).filter((p) => toNum(p.usageLimit, 0) > 0 && toNum(p.usageCount, 0) / Math.max(1, toNum(p.usageLimit, 0)) >= 0.85).length;
  const nearLimitCoupons = (coupons || []).filter((c) => toNum(c.maxUsage, 0) > 0 && toNum(c.used, 0) / Math.max(1, toNum(c.maxUsage, 0)) >= 0.85).length;
  const summary = {
    recommendedCampaignCount: campaigns.length,
    topOpportunityWindow,
    highestPrioritySegment,
    notes: [
      demandWeakness > 0.5
        ? "Khung giờ thấp điểm có dư địa tăng conversion."
        : "Nhu cầu ổn định, ưu tiên tối ưu AOV và segment-fit.",
      stockPressureRatio > 0.25
        ? "Stock pressure cao: cần guardrail để tránh đẩy campaign sai món."
        : "Stock pressure trong ngưỡng an toàn.",
      activePromotions.length
        ? `Đang có ${activePromotions.length} promotion active và ${activeCoupons.length} coupon active, đã chấm điểm tránh overlap cơ bản.`
        : "Chưa có promotion active phù hợp, ưu tiên khởi tạo campaign mới.",
      totalOrders < 20 ? "Dữ liệu còn ít, nên review thủ công trước khi chạy campaign." : "Mẫu dữ liệu đủ để ưu tiên campaign có confidence cao hơn.",
    ],
  };
  if (totalOrders < 20) {
    for (const c of campaigns) {
      c.priority = c.priority === "high" ? "medium" : c.priority;
      c.expectedKpi.confidence = Number(Math.min(c.expectedKpi.confidence, 0.55).toFixed(2));
      c.guardrails = [...c.guardrails, "dữ liệu còn ít: chạy draft/review trước khi publish"];
    }
  }

  let aiEnhanced = false;
  const aiResult = await tryAiEnhanceCampaigns({ summary, campaigns, timezone });
  let finalCampaigns = campaigns;
  if (aiResult.aiEnhanced && Array.isArray(aiResult.campaigns)) {
    aiEnhanced = true;
    const map = new Map(aiResult.campaigns.map((c) => [String(c.campaignKey), c]));
    finalCampaigns = campaigns.map((campaign) => {
      const ai = map.get(String(campaign.campaignKey));
      if (!ai) return campaign;
      return {
        ...campaign,
        title: ai.title || campaign.title,
        reason: ai.reason || campaign.reason,
        guardrails: Array.isArray(ai.guardrails) && ai.guardrails.length ? ai.guardrails : campaign.guardrails,
      };
    });
  }

  return {
    summary,
    campaigns: finalCampaigns,
    autoSelectedPromotions,
    segmentInsights,
    timeWindowInsights,
    couponContext: {
      activeCouponCount: activeCoupons.length,
      nearUsageLimitCount: nearLimitCoupons + nearLimitPromotions,
    },
    meta: {
      method: "smart_promo_v1",
      fallbackUsed: forecastFallback || totalOrders < 20,
      forecastFallbackUsed: forecastFallback,
      lowDataFallbackUsed: totalOrders < 20,
      aiEnhanced,
      generatedAt: now,
      timezone,
      sampleOrders: totalOrders,
      sampleDays: safeLookbackDays,
    },
  };
}
