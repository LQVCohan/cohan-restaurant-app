import { describe, expect, it } from "vitest";
import {
  buildQualityEvidenceForEmployee,
  hasPerformanceEvidence,
} from "../../src/services/staffPerformance/staffPerformance.service.js";

describe("staff performance evidence", () => {
  it("marks kitchen evidence as score-affecting only when it creates a penalty", () => {
    const penalized = buildQualityEvidenceForEmployee({
      staff: { positionTitle: "Bếp trưởng" },
      baseSkillScore: 80,
      hasManagerReview: true,
      kitchenMetrics: {
        totalItems: 10,
        kitchenItems: 10,
        headChefItems: 10,
        veryLateItems: 2,
      },
      cashierMetrics: {},
      customerRatingScore: 0,
      staffRateCount: 0,
    });
    const clean = buildQualityEvidenceForEmployee({
      staff: { positionTitle: "Bếp trưởng" },
      baseSkillScore: 80,
      hasManagerReview: true,
      kitchenMetrics: {
        totalItems: 10,
        kitchenItems: 10,
        headChefItems: 10,
      },
      cashierMetrics: {},
      customerRatingScore: 0,
      staffRateCount: 0,
    });

    expect(penalized.kitchenPenalty).toBeGreaterThan(0);
    expect(penalized.affectsScore).toBe(true);
    expect(clean.kitchenPenalty).toBe(0);
    expect(clean.affectsScore).toBe(false);
  });

  it("does not claim a high customer rating changed the score", () => {
    const evidence = buildQualityEvidenceForEmployee({
      staff: { positionTitle: "Phục vụ" },
      baseSkillScore: 75,
      hasManagerReview: false,
      kitchenMetrics: {},
      cashierMetrics: {},
      customerRatingScore: 90,
      staffRateCount: 5,
    });

    expect(evidence.customerPenalty).toBe(0);
    expect(evidence.affectsScore).toBe(false);
  });

  it("treats operational evidence as activity without shifts or timesheets", () => {
    expect(hasPerformanceEvidence({ kitchenMetrics: { totalItems: 1 } })).toBe(true);
    expect(
      hasPerformanceEvidence({
        cashierMetrics: { totalHandledPayments: 1 },
      }),
    ).toBe(true);
    expect(hasPerformanceEvidence({ staffRateCount: 1 })).toBe(true);
    expect(hasPerformanceEvidence()).toBe(false);
  });
});
