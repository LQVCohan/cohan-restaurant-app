import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MenuEngineeringAssistantWidget from "./MenuEngineeringAssistantWidget";
import SmartPromotionEngineWidget from "./SmartPromotionEngineWidget";

const promotionEngine = {
  summary: {
    recommendedCampaignCount: 3,
    topOpportunityWindow: "06:00-08:00",
    highestPrioritySegment: "NEW",
  },
  campaigns: [
    {
      campaignKey: "primary",
      title: "Thưởng ngưỡng đơn khách mới",
      priority: "MEDIUM",
      targetSegment: "NEW",
      targetOrderType: "dine_in",
      targetWindow: { startHour: 6, endHour: 8 },
      recommendation: {
        discountType: "AMOUNT",
        discountValue: 25000,
        minOrderValue: 100000,
        maxDiscount: 25000,
        conditions: ["off_peak_window"],
      },
      expectedKpi: {
        expectedOrdersLiftPct: 12.5,
        expectedRevenueLiftPct: 8.5,
        confidence: 0.6,
      },
      reason: "off-peak + khách mới + cần tăng conversion",
      guardrails: ["không áp dụng cùng voucher khác"],
    },
    {
      campaignKey: "secondary-1",
      title: "Giữ chân khách quay lại",
      priority: "LOW",
      targetSegment: "OFTEN",
      targetOrderType: "takeaway",
      targetWindow: { startHour: 10, endHour: 14 },
      recommendation: {
        discountType: "PERCENT",
        discountValue: 8,
        minOrderValue: 120000,
        maxDiscount: 30000,
        conditions: ["threshold_aov"],
      },
      expectedKpi: {
        expectedOrdersLiftPct: 9,
        expectedRevenueLiftPct: 7,
        confidence: 0.55,
      },
      reason: "basket hiện thấp hơn ngưỡng mục tiêu, cần đẩy AOV",
      guardrails: ["ưu tiên đơn chưa dùng voucher"],
    },
    {
      campaignKey: "secondary-2",
      title: "Combo cuối tuần",
      priority: "MEDIUM",
      targetSegment: "VIP",
      targetOrderType: "delivery",
      targetWindow: { startHour: 18, endHour: 21 },
      recommendation: {
        discountType: "PERCENT",
        discountValue: 7,
        minOrderValue: 169000,
        maxDiscount: 45000,
        conditions: ["bundle_focus"],
      },
      expectedKpi: {
        expectedOrdersLiftPct: 8,
        expectedRevenueLiftPct: 6,
        confidence: 0.5,
      },
      reason: "khách VIP phù hợp upsell có kiểm soát",
      guardrails: ["ưu tiên combo thay vì giảm thẳng"],
    },
  ],
  autoSelectedPromotions: [
    {
      promotionId: "promo-1",
      promotionName: "WELCOME25",
      source: "existing_coupon",
      fitScore: 0.8,
      fitReason: "active_now + usage_capacity_ok",
    },
  ],
  couponContext: { activeCouponCount: 1, nearUsageLimitCount: 0 },
  meta: {
    method: "smart_promo_v1",
    sampleOrders: 2,
    sampleDays: 30,
    fallbackUsed: true,
    lowDataFallbackUsed: true,
    aiEnhanced: true,
  },
};

const menuAssistant = {
  summary: {
    totalDishes: 4,
    starCount: 1,
    plowhorseCount: 1,
    puzzleCount: 1,
    dogCount: 1,
    avgMarginPct: 58.5,
    notes: [
      "Phân tích 4 món trong 30 ngày gần nhất.",
      "Ước tính cost: snapshot 2 dòng, recipe 1 dòng, fallback 1 dòng.",
    ],
  },
  dishes: [
    {
      dishId: "d1",
      dishName: "Cơm gà",
      quantity: 12,
      revenue: 1180000,
      profit: 720000,
      marginPct: 61,
      quadrant: "star",
    },
    {
      dishId: "d2",
      dishName: "Bún bò",
      quantity: 10,
      revenue: 950000,
      profit: 410000,
      marginPct: 43,
      quadrant: "plowhorse",
    },
    {
      dishId: "d3",
      dishName: "Gỏi cuốn",
      quantity: 4,
      revenue: 420000,
      profit: 300000,
      marginPct: 71,
      quadrant: "puzzle",
    },
    {
      dishId: "d4",
      dishName: "Mì xào",
      quantity: 2,
      revenue: 180000,
      profit: 45000,
      marginPct: 25,
      quadrant: "dog",
    },
  ],
  recommendations: [
    "Giữ chuẩn chất lượng và ưu tiên upsell món STAR \"Cơm gà\".",
    "Tối ưu cost/portion cho \"Bún bò\" để tăng lợi nhuận.",
    "Đẩy truyền thông cho \"Gỏi cuốn\" để tăng độ phổ biến.",
  ],
  meta: {
    method: "menu_engineering_v1",
    sampleOrders: 8,
    sampleDays: 30,
    fallbackUsed: true,
    fallbackMarginRate: 0.65,
  },
};

describe("growth recommendation widgets", () => {
  it("shows promotion provenance, AI limits and manager-friendly values", () => {
    const onNavigate = vi.fn();
    render(
      <SmartPromotionEngineWidget
        engine={promotionEngine}
        loading={false}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getByText("Nguồn dữ liệu")).toBeInTheDocument();
    expect(screen.getByText("AI chỉ diễn giải")).toBeInTheDocument();
    expect(screen.getByText(/Đơn hàng 30 ngày, dự báo nhu cầu/)).toBeInTheDocument();
    expect(
      screen.getByText(/KPI, mức ưu tiên và mức giảm vẫn do công thức tính/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Giảm 25\.000đ/)).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.queryByText(/\bAMOUNT\b/)).not.toBeInTheDocument();

    const secondarySummary = screen.getByText("Xem 2 đề xuất còn lại").closest("summary");
    const secondaryDetails = secondarySummary.closest("details");
    fireEvent.click(secondarySummary);
    expect(secondaryDetails.open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Mở khuyến mãi" }));
    expect(onNavigate).toHaveBeenCalledWith("promotions");
  });

  it("explains menu cost priority and separates actions from data notes", () => {
    const onNavigate = vi.fn();
    render(
      <MenuEngineeringAssistantWidget
        assistant={menuAssistant}
        loading={false}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getByText("Nguồn và cách tính")).toBeInTheDocument();
    expect(screen.getByText("Có phần ước tính")).toBeInTheDocument();
    expect(
      screen.getByText(/giá vốn lưu tại thời điểm bán.*công thức món và giá nguyên liệu/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/biên mặc định 65%/)).toBeInTheDocument();
    expect(screen.getByText(/không dùng AI để thay đổi số liệu/i)).toBeInTheDocument();
    expect(screen.getByText("Cơm gà")).toBeInTheDocument();
    expect(screen.getByText("Xem thêm 1 món")).toBeInTheDocument();
    expect(screen.getByText(/Giữ chuẩn chất lượng và ưu tiên upsell món chủ lực/)).toBeInTheDocument();
    expect(screen.getByText("Ghi chú chất lượng dữ liệu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mở menu" }));
    expect(onNavigate).toHaveBeenCalledWith("menu");
  });
});
