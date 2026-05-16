import { describe, expect, it } from "vitest";
import {
  calculateFormulaScore,
  buildAdjustmentHistoryItems,
  formatDelta,
  formatCustomerRating,
  getWeightedContribution,
  resolveComponentWeight,
  shouldDisplayAdjustment,
  buildPerformanceReportData,
  escapeHtml,
  buildPerformanceReportHtml,
} from "./StaffPerformancePage";

describe("formatCustomerRating", () => {
  it("shows X/5 and review count when rating exists", () => {
    const result = formatCustomerRating({
      staffRate: 4.2,
      staffRateCount: 5,
      customerRatingScore: 84,
    });

    expect(result.hasRating).toBe(true);
    expect(result.label).toBe("Đánh giá khách hàng: 4.2/5 (5 lượt)");
    expect(result.hint).toBe("Quy đổi tham khảo: 84/100");
  });

  it("shows fallback text when rating is missing", () => {
    const result = formatCustomerRating({});

    expect(result.hasRating).toBe(false);
    expect(result.label).toBe("Chưa có đánh giá khách hàng");
  });

  it("falls back to staffRate * 20 when customerRatingScore is null", () => {
    const result = formatCustomerRating({
      staffRate: 4.2,
      staffRateCount: 5,
      customerRatingScore: null,
    });

    expect(result.hint).toBe("Quy đổi tham khảo: 84/100");
  });

  it("falls back to staffRate * 20 when customerRatingScore is undefined", () => {
    const result = formatCustomerRating({
      staffRate: 4.2,
      staffRateCount: 5,
    });

    expect(result.hint).toBe("Quy đổi tham khảo: 84/100");
  });

  it("keeps explicit customerRatingScore = 0", () => {
    const result = formatCustomerRating({
      staffRate: 4.2,
      staffRateCount: 5,
      customerRatingScore: 0,
    });

    expect(result.hint).toBe("Quy đổi tham khảo: 0/100");
  });
});


describe("getWeightedContribution", () => {
  it("returns weighted contribution for a valid score", () => {
    expect(getWeightedContribution(80, 25)).toBe(20);
    expect(getWeightedContribution(80, 30)).toBe(24);
  });

  it("returns 0 when score is missing", () => {
    expect(getWeightedContribution(undefined, 25)).toBe(0);
  });
});


describe("resolveComponentWeight", () => {
  it("uses snapshot component weight when present", () => {
    expect(resolveComponentWeight({ weight: 30 }, 25)).toBe(30);
  });

  it("falls back to default item weight when component weight is missing", () => {
    expect(resolveComponentWeight({}, 25)).toBe(25);
  });

  it("does not crash with missing component and falls back safely", () => {
    expect(resolveComponentWeight(undefined, 20)).toBe(20);
  });
});

describe("calculateFormulaScore", () => {
  it("calculates formula score using component scores and weights", () => {
    const snapshot = {
      productivity: { score: 80, weight: 25 },
      punctuality: { score: 90, weight: 25 },
      quality: { score: 70, weight: 20 },
      managerReview: { score: 85, weight: 20 },
      compliance: { score: 100, weight: 10 },
    };

    expect(calculateFormulaScore(snapshot)).toBe(83.5);
  });

  it("does not crash when components are missing", () => {
    expect(calculateFormulaScore({ productivity: { score: 80 } })).toBe(20);
    expect(calculateFormulaScore({})).toBe(0);
  });

  it("supports deriving delta from final score and formula score", () => {
    const snapshot = {
      productivity: { score: 85, weight: 25 },
      punctuality: { score: 85, weight: 25 },
      quality: { score: 85, weight: 20 },
      managerReview: { score: 85, weight: 20 },
      compliance: { score: 85, weight: 10 },
    };
    const formulaScore = calculateFormulaScore(snapshot);
    const adjustmentDelta = 80 - formulaScore;
    expect(formulaScore).toBe(85);
    expect(adjustmentDelta).toBe(-5);
  });
});

describe("adjustment display helpers", () => {
  it("hides adjustment when delta is smaller than tolerance", () => {
    expect(shouldDisplayAdjustment(0.009)).toBe(false);
    expect(shouldDisplayAdjustment(-0.009)).toBe(false);
  });

  it("shows signed delta text", () => {
    expect(formatDelta(5)).toBe("+5");
    expect(formatDelta(-5)).toBe("-5");
  });

  it("builds adjustment history from incidents and appeals", () => {
    const items = buildAdjustmentHistoryItems(
      [{ id: "a1", scoreDelta: -5, previousScore: 90, newScore: 85, reason: "Đi trễ", createdAt: "2026-05-10T10:00:00.000Z" }],
      [{ id: "p1", status: "accepted", scoreReversalDelta: 3, scoreReversalNote: "Chấp nhận khiếu nại", scoreReversedAt: "2026-05-11T10:00:00.000Z" }],
    );
    expect(items).toHaveLength(2);
    expect(items[0].scoreDelta).toBe(3);
    expect(items[1].scoreDelta).toBe(-5);
  });

  it("returns empty when no adjustment data", () => {
    expect(buildAdjustmentHistoryItems([], [])).toEqual([]);
  });
});

describe("buildPerformanceReportData", () => {
  it("uses employee.fullName as fallback when snapshot employeeName is missing", () => {
    const report = buildPerformanceReportData({
      snapshot: {},
      employee: { fullName: "Nguyen Van A", name: "A" },
    });
    expect(report.employeeName).toBe("Nguyen Van A");
  });

  it("includes customer rating when available", () => {
    const report = buildPerformanceReportData({
      snapshot: {
        employeeName: "An",
        periodStart: "2026-05-01",
        periodEnd: "2026-05-31",
        finalPerformanceScore: 87,
        productivity: { score: 90, weight: 25 },
        punctuality: { score: 90, weight: 25 },
        quality: { score: 80, weight: 20 },
        managerReview: { score: 85, weight: 20 },
        compliance: { score: 85, weight: 10 },
        factors: { staffRate: 4.5, staffRateCount: 20, customerRatingScore: 90 },
      },
      adjustmentHistory: [],
    });
    expect(report.customerRating.hasRating).toBe(true);
    expect(report.customerRating.label).toContain("4.5/5");
  });

  it("returns empty state when adjustment history missing", () => {
    const report = buildPerformanceReportData({ snapshot: {}, adjustmentHistory: [] });
    expect(report.adjustmentHistory).toEqual([]);
  });
});

describe("escapeHtml", () => {
  it("escapes html special characters", () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      "&lt;img src=x onerror=alert(1)&gt;",
    );
  });
});

describe("buildPerformanceReportHtml", () => {
  it("does not include raw html from adjustment reason", () => {
    const html = buildPerformanceReportHtml({
      employeeName: "An",
      periodLabel: "01/05/2026 - 31/05/2026",
      restaurantName: "R1",
      finalPerformanceScore: 90,
      performanceLevel: "Tốt",
      formulaScore: 90,
      adjustmentDelta: 0,
      hasAdjustment: false,
      formulaBreakdown: [],
      hasCustomWeight: false,
      customerRating: { hasRating: false, label: "Chưa có đánh giá khách hàng", hint: "" },
      adjustmentHistory: [{ scoreDelta: -2, reason: "<script>alert(1)</script>", createdAt: "2026-05-12T10:00:00.000Z" }],
    });
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
