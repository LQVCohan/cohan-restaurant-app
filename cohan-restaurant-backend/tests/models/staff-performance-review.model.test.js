import { describe, expect, it } from "vitest";
import StaffPerformanceReview from "../../models/StaffPerformanceReview.model.js";

describe("StaffPerformanceReview model", () => {
  it("keeps one review per employee, restaurant and period", () => {
    const indexes = StaffPerformanceReview.schema.indexes();
    const reviewPeriodIndex = indexes.find(
      ([fields]) =>
        fields.employeeId === 1 &&
        fields.restaurantId === 1 &&
        fields.periodStart === 1 &&
        fields.periodEnd === 1,
    );

    expect(reviewPeriodIndex).toBeTruthy();
    expect(reviewPeriodIndex[1]).toEqual(
      expect.objectContaining({
        unique: true,
        name: "uniq_staff_performance_review_period",
      }),
    );
  });
});
