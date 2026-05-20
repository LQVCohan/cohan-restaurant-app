import { describe, expect, it } from "vitest";
import { PERFORMANCE_WEIGHTS } from "../../src/services/staffPerformance/staffPerformance.service.js";

const EXPECTED_WEIGHTS = {
  productivity: 25,
  punctuality: 25,
  quality: 20,
  managerReview: 20,
  compliance: 10,
};

describe("PERFORMANCE_WEIGHTS", () => {
  it("includes exactly the required 5 keys", () => {
    expect(Object.keys(PERFORMANCE_WEIGHTS).sort()).toEqual(
      Object.keys(EXPECTED_WEIGHTS).sort(),
    );
  });

  it("matches expected weight values", () => {
    expect(PERFORMANCE_WEIGHTS).toMatchObject(EXPECTED_WEIGHTS);
  });

  it("sums to 100", () => {
    const total = Object.values(PERFORMANCE_WEIGHTS).reduce(
      (sum, weight) => sum + Number(weight || 0),
      0,
    );

    expect(total).toBe(100);
  });
});
