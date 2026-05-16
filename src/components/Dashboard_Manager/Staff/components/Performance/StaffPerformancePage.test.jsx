import { describe, expect, it } from "vitest";
import {
  formatCustomerRating,
  getWeightedContribution,
  resolveComponentWeight,
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
