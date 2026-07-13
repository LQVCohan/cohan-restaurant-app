import { describe, expect, it } from "vitest";

import {
  computeAutoScheduleCandidateScore,
  estimateHourlyCost,
  readScoringWeight,
} from "../../src/services/scheduling/autoScheduleScoring.service.js";

const ZERO_WEIGHTS = {
  roleFit: 0,
  availabilityFit: 0,
  workloadBalance: 0,
  fairness: 0,
  performance: 0,
  employmentTypeFit: 0,
  costEfficiency: 0,
  reliability: 0,
  fatiguePenalty: 0,
  overtimePenalty: 0,
  ruleRiskPenalty: 0,
};

const basePolicy = (scoringWeights) => ({
  scoringWeights,
  laborRules: {
    recommendedWeeklyHoursCap: 40,
    maxConsecutiveWorkingDays: 6,
  },
  employmentTypePolicy: {
    full_time: {
      weeklyHoursTarget: 40,
      maxConsecutiveWorkingDays: 6,
      priorityWeight: 1,
    },
  },
});

const buildScore = ({
  weights,
  performanceScore = 75,
  reliabilityScore = 75,
  warnings = [],
  afterPlanned = 8,
  rotationHours = 0,
  maxRotationHours = 0,
  estimatedHourlyCost = null,
  minHourlyCost = null,
  maxHourlyCost = null,
  consecutiveWorkingDays = 1,
} = {}) =>
  computeAutoScheduleCandidateScore({
    policy: basePolicy(weights),
    staff: { employmentType: "full_time" },
    validation: {
      warnings,
      metrics: {
        performanceScore,
        reliabilityScore,
        consecutiveWorkingDays,
      },
    },
    afterPlanned,
    rotationHours,
    maxRotationHours,
    requiredRole: "server",
    roleFitRatio: 1,
    estimatedHourlyCost,
    minHourlyCost,
    maxHourlyCost,
    shiftHours: 8,
  });

describe("auto schedule scoring weights", () => {
  it("keeps an explicit zero instead of falling back to the default weight", () => {
    expect(readScoringWeight({ performance: 0 }, "performance")).toBe(0);
    expect(readScoringWeight({}, "performance")).toBe(10);
  });

  it("fully disables a criterion when its weight is zero", () => {
    const low = buildScore({
      weights: ZERO_WEIGHTS,
      performanceScore: 20,
    });
    const high = buildScore({
      weights: ZERO_WEIGHTS,
      performanceScore: 100,
    });

    expect(low.score).toBe(0);
    expect(high.score).toBe(0);
    expect(low.positiveComponents.performance).toBe(0);
    expect(high.positiveComponents.performance).toBe(0);
  });

  it("uses performance when the manager gives it a positive weight", () => {
    const weights = { ...ZERO_WEIGHTS, performance: 20 };
    const low = buildScore({ weights, performanceScore: 40 });
    const high = buildScore({ weights, performanceScore: 95 });

    expect(high.score).toBeGreaterThan(low.score);
    expect(high.positiveComponents.performance).toBe(19);
  });

  it("reduces availability contribution and applies rule-risk penalty for warnings", () => {
    const weights = {
      ...ZERO_WEIGHTS,
      availabilityFit: 20,
      ruleRiskPenalty: 20,
    };
    const clean = buildScore({ weights });
    const warned = buildScore({
      weights,
      warnings: [
        {
          code: "FULL_TIME_UNAVAILABLE_EXCEPTION",
          severity: "warning",
        },
      ],
    });

    expect(clean.positiveComponents.availabilityFit).toBe(20);
    expect(warned.positiveComponents.availabilityFit).toBe(5);
    expect(warned.penaltyComponents.ruleRiskPenalty).toBe(12);
    expect(clean.score).toBeGreaterThan(warned.score);
  });

  it("makes the cost weight compare actual estimated hourly cost", () => {
    const weights = { ...ZERO_WEIGHTS, costEfficiency: 20 };
    const cheaper = buildScore({
      weights,
      estimatedHourlyCost: 30_000,
      minHourlyCost: 30_000,
      maxHourlyCost: 60_000,
    });
    const expensive = buildScore({
      weights,
      estimatedHourlyCost: 60_000,
      minHourlyCost: 30_000,
      maxHourlyCost: 60_000,
    });

    expect(cheaper.score).toBe(100);
    expect(expensive.score).toBe(0);
  });

  it("does not treat missing salary data as the cheapest candidate", () => {
    const weights = { ...ZERO_WEIGHTS, costEfficiency: 20 };
    const missing = buildScore({
      weights,
      estimatedHourlyCost: Number.NaN,
      minHourlyCost: 30_000,
      maxHourlyCost: 60_000,
    });
    const unavailableForEveryone = buildScore({
      weights,
      estimatedHourlyCost: Number.NaN,
      minHourlyCost: null,
      maxHourlyCost: null,
    });

    expect(missing.score).toBe(0);
    expect(missing.estimatedHourlyCost).toBeNull();
    expect(unavailableForEveryone.positiveCapacity).toBe(0);
  });

  it("prioritizes the employee with fewer accumulated hours when fairness is enabled", () => {
    const weights = { ...ZERO_WEIGHTS, fairness: 10 };
    const rested = buildScore({
      weights,
      rotationHours: 0,
      maxRotationHours: 24,
    });
    const loaded = buildScore({
      weights,
      rotationHours: 24,
      maxRotationHours: 24,
    });

    expect(rested.score).toBe(100);
    expect(loaded.score).toBe(0);
  });

  it("estimates hourly cost from hourly, shift, and monthly salary data", () => {
    expect(
      estimateHourlyCost({
        staff: { hourlyRate: 50_000 },
        shiftHours: 8,
        weeklyTarget: 40,
      }),
    ).toBe(50_000);
    expect(
      estimateHourlyCost({
        staff: { salaryType: "shift", baseSalary: 400_000 },
        shiftHours: 8,
        weeklyTarget: 40,
      }),
    ).toBe(50_000);
    expect(
      estimateHourlyCost({
        staff: { salaryType: "monthly", baseSalary: 8_690_000 },
        shiftHours: 8,
        weeklyTarget: 40,
      }),
    ).toBe(50_000);
    expect(
      Number.isNaN(
        estimateHourlyCost({
          staff: {},
          shiftHours: 8,
          weeklyTarget: 40,
        }),
      ),
    ).toBe(true);
  });
});
