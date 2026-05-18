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
  openPerformanceReportPrintWindow,
  formatTrendDelta,
  resolveTrendDelta,
  resolvePreviousPeriod,
  buildPreviousSnapshotMap,
  buildPerformanceOverview,
  resolveNeedsAttentionVisibleRows,
  escapeCsvValue,
  buildPerformanceOverviewCsvRows,
  buildPerformanceOverviewCsvBlobContent,
} from "./StaffPerformancePage";
import { vi } from "vitest";

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

describe("openPerformanceReportPrintWindow", () => {
  it("opens a usable print window and severs opener", () => {
    const fakeWindow = { opener: "present" };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow);
    const result = openPerformanceReportPrintWindow();
    expect(openSpy).toHaveBeenCalledWith("", "_blank", "width=900,height=700");
    expect(result).toBe(fakeWindow);
    expect(fakeWindow.opener).toBeNull();
    openSpy.mockRestore();
  });
});


describe("formatTrendDelta", () => {
  it("returns +X when current score is higher", () => {
    expect(formatTrendDelta(85, 80)).toBe("+5 điểm so với kỳ trước");
  });

  it("returns -X when current score is lower", () => {
    expect(formatTrendDelta(75, 80)).toBe("-5 điểm so với kỳ trước");
  });

  it("returns no change when scores are equal", () => {
    expect(formatTrendDelta(80, 80)).toBe("Không đổi");
  });

  it("returns missing data label when previous score is unavailable", () => {
    expect(formatTrendDelta(80, undefined)).toBe("Chưa có dữ liệu kỳ trước");
  });
});


describe("resolvePreviousPeriod", () => {
  it("returns previous month for full-month range", () => {
    expect(resolvePreviousPeriod("2026-05-01", "2026-05-31")).toEqual({
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
    });
  });

  it("returns contiguous previous range for custom dates", () => {
    expect(resolvePreviousPeriod("2026-05-10", "2026-05-16")).toEqual({
      periodStart: "2026-05-03",
      periodEnd: "2026-05-09",
    });
  });
});

describe("buildPreviousSnapshotMap", () => {
  it("selects nearest previous snapshot by periodEnd", () => {
    const result = buildPreviousSnapshotMap(
      [
        { employeeId: "e1", periodEnd: "2026-04-30T23:59:59.999Z", finalPerformanceScore: 80 },
        { employeeId: "e1", periodEnd: "2026-04-15T23:59:59.999Z", finalPerformanceScore: 70 },
        { employeeId: "e2", periodEnd: "2026-04-29T23:59:59.999Z", finalPerformanceScore: 60 },
      ],
      "2026-05-01",
    );

    expect(result.e1.finalPerformanceScore).toBe(80);
    expect(result.e2.finalPerformanceScore).toBe(60);
  });
});

describe("performance overview helpers", () => {
  it("resolveTrendDelta returns numeric delta or null", () => {
    expect(resolveTrendDelta(90, 80)).toBe(10);
    expect(resolveTrendDelta(90, undefined)).toBeNull();
  });

  it("resolveTrendDelta treats empty current score values as missing", () => {
    expect(resolveTrendDelta(null, 80)).toBeNull();
    expect(resolveTrendDelta(undefined, 80)).toBeNull();
    expect(resolveTrendDelta("", 80)).toBeNull();
  });

  it("resolveTrendDelta still accepts numeric zero values", () => {
    expect(resolveTrendDelta(0, 80)).toBe(-80);
    expect(resolveTrendDelta(80, 0)).toBe(80);
  });

  it("topImproved selects highest 3 positive deltas", () => {
    const rows = [
      { trendDelta: 1 },
      { trendDelta: 6 },
      { trendDelta: 2 },
      { trendDelta: 4 },
      { trendDelta: -1 },
    ];
    const result = buildPerformanceOverview(rows);
    expect(result.topImproved.map((item) => item.trendDelta)).toEqual([6, 4, 2]);
  });

  it("topDeclined selects lowest 3 negative deltas", () => {
    const rows = [
      { trendDelta: -1 },
      { trendDelta: -6 },
      { trendDelta: -2 },
      { trendDelta: -4 },
      { trendDelta: 3 },
    ];
    const result = buildPerformanceOverview(rows);
    expect(result.topDeclined.map((item) => item.trendDelta)).toEqual([-6, -4, -2]);
  });

  it("does not include missing-current rows in top improved or declined", () => {
    const rows = [
      { trendDelta: resolveTrendDelta(null, 80) },
      { trendDelta: resolveTrendDelta(undefined, 75) },
      { trendDelta: resolveTrendDelta("", 70) },
      { trendDelta: resolveTrendDelta(88, 80) },
      { trendDelta: resolveTrendDelta(72, 80) },
    ];
    const result = buildPerformanceOverview(rows);
    expect(result.topImproved.map((item) => item.trendDelta)).toEqual([8]);
    expect(result.topDeclined.map((item) => item.trendDelta)).toEqual([-8]);
  });

  it("needsAttention includes needs_attention and poor levels", () => {
    const rows = [
      { snapshot: { performanceLevel: "good" }, trendDelta: 1 },
      { snapshot: { performanceLevel: "needs_attention" }, trendDelta: -1 },
      { snapshot: { performanceLevel: "poor" }, trendDelta: -2 },
    ];
    const result = buildPerformanceOverview(rows);
    expect(result.needsAttention).toHaveLength(2);
  });

  it("counts rows missing previous snapshot data", () => {
    const rows = [
      { trendDelta: null },
      { trendDelta: 2 },
      { trendDelta: null },
    ];
    const result = buildPerformanceOverview(rows);
    expect(result.noPreviousDataCount).toBe(2);
  });

  it("buildPerformanceOverview keeps full needsAttention list", () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      snapshot: { performanceLevel: index % 2 === 0 ? "needs_attention" : "poor" },
      trendDelta: -1,
    }));
    const result = buildPerformanceOverview(rows);
    expect(result.needsAttention).toHaveLength(7);
  });
});

describe("resolveNeedsAttentionVisibleRows", () => {
  it("returns first 5 items when collapsed", () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({ id: index + 1 }));
    const result = resolveNeedsAttentionVisibleRows(rows, false, 5);
    expect(result).toHaveLength(5);
    expect(result.map((item) => item.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns all items when expanded", () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({ id: index + 1 }));
    const result = resolveNeedsAttentionVisibleRows(rows, true, 5);
    expect(result).toHaveLength(7);
  });
});

describe("csv helpers", () => {
  it("escapeCsvValue wraps comma-containing values", () => {
    expect(escapeCsvValue("A,B")).toBe('"A,B"');
  });

  it("escapeCsvValue escapes internal quotes", () => {
    expect(escapeCsvValue('A "B"')).toBe('"A ""B"""');
  });

  it("escapeCsvValue guards formula-like values", () => {
    expect(escapeCsvValue("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvValue("+test")).toBe("'+test");
    expect(escapeCsvValue("-test")).toBe("'-test");
    expect(escapeCsvValue("@cmd")).toBe("'@cmd");
  });

  it("escapeCsvValue does not prefix number types", () => {
    expect(escapeCsvValue(-5)).toBe("-5");
  });

  it("buildPerformanceOverviewCsvRows handles missing snapshot and previousSnapshot", () => {
    const rows = [
      {
        employee: { code: "E001", name: "An", role: "Phục vụ" },
        snapshot: null,
        previousSnapshot: null,
        score: null,
        level: null,
        trendDelta: null,
      },
    ];
    const result = buildPerformanceOverviewCsvRows(rows);
    expect(result[0][0]).toBe("E001");
    expect(result[0][3]).toBe("--");
    expect(result[0][5]).toBe("--");
    expect(result[0][7]).toBe("Không");
    expect(result[0][8]).toBe("--");
  });

  it("buildPerformanceOverviewCsvBlobContent prepends UTF-8 BOM", () => {
    const csv = buildPerformanceOverviewCsvBlobContent([]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});
