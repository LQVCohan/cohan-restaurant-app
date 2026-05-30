import { describe, expect, it } from "vitest";

import { parseDurationMs } from "../../src/utils/duration.js";

describe("parseDurationMs", () => {
  it("parses minute durations", () => {
    expect(parseDurationMs("15m", "1h")).toBe(15 * 60 * 1000);
  });

  it("parses day durations", () => {
    expect(parseDurationMs("7d", "15m")).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("parses hour durations", () => {
    expect(parseDurationMs("8h", "15m")).toBe(8 * 60 * 60 * 1000);
  });

  it("parses second and millisecond durations", () => {
    expect(parseDurationMs("30s", "15m")).toBe(30 * 1000);
    expect(parseDurationMs("250ms", "15m")).toBe(250);
  });

  it("uses the fallback only when the primary value is nullish", () => {
    expect(parseDurationMs(undefined, "1h")).toBe(60 * 60 * 1000);
    expect(parseDurationMs(null, "15m")).toBe(15 * 60 * 1000);
  });

  it("throws for invalid explicit input even when a fallback is provided", () => {
    expect(() => parseDurationMs("invalid", "15m")).toThrow("Invalid duration: invalid");
  });

  it("throws when the fallback is invalid", () => {
    expect(() => parseDurationMs(undefined, "invalid")).toThrow("Invalid duration: invalid");
  });

  it("preserves existing numeric input behavior", () => {
    expect(() => parseDurationMs(900000, "15m")).toThrow("Invalid duration: 900000");
    expect(() => parseDurationMs("900000", "15m")).toThrow("Invalid duration: 900000");
  });
});
