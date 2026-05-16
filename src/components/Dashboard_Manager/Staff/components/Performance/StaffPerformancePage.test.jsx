import { describe, expect, it } from "vitest";
import { formatCustomerRating } from "./StaffPerformancePage";

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
});
