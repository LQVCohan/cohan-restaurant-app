import { describe, expect, it } from "vitest";
import { buildPartTimeBlockRange } from "../../scripts/normalizeDefensePartTimeShiftBlocks.js";

describe("defense part-time shift normalization", () => {
  it("turns a seeded shift into a four-hour rotating block", () => {
    const result = buildPartTimeBlockRange("2026-07-13T09:00:00.000Z");

    expect(result.shiftType).toBe("rotating");
    expect(result.endTime.toISOString()).toBe("2026-07-13T13:00:00.000Z");
    expect(result.endTime - result.startTime).toBe(4 * 60 * 60 * 1000);
  });

  it("supports a business-defined duration without changing the start", () => {
    const result = buildPartTimeBlockRange("2026-07-13T09:00:00.000Z", 5.5);

    expect(result.startTime.toISOString()).toBe("2026-07-13T09:00:00.000Z");
    expect(result.endTime.toISOString()).toBe("2026-07-13T14:30:00.000Z");
  });

  it("rejects invalid durations", () => {
    expect(() => buildPartTimeBlockRange(new Date(), 0)).toThrow(
      "duration must be between 1 and 12 hours",
    );
  });
});
