import { describe, expect, it } from "vitest";
import { formatCustomerRating } from "./performanceCustomerRating";

describe("formatCustomerRating evidence", () => {
  it("keeps ratings below the evidence threshold as reference only", () => {
    const result = formatCustomerRating({
      staffRate: 4,
      staffRateCount: 2,
      customerRatingScore: 80,
      customerRatingEvidence: { customerPenalty: 0 },
    });

    expect(result.affectsScore).toBe(false);
    expect(result.hint).toContain("chưa đủ 3 lượt");
  });

  it("shows the quality deduction when role-aware evidence changes the score", () => {
    const result = formatCustomerRating({
      staffRate: 3.5,
      staffRateCount: 5,
      customerRatingScore: 70,
      customerRatingEvidence: { customerPenalty: 0.6 },
    });

    expect(result.affectsScore).toBe(true);
    expect(result.customerPenalty).toBe(0.6);
    expect(result.hint).toContain("đã giảm 0.6 điểm");
  });

  it("explains when enough ratings do not create a deduction", () => {
    const result = formatCustomerRating({
      staffRate: 4.5,
      staffRateCount: 8,
      customerRatingScore: 90,
      customerRatingEvidence: { customerPenalty: 0 },
    });

    expect(result.affectsScore).toBe(false);
    expect(result.hint).toContain("không phát sinh điều chỉnh");
  });
});
