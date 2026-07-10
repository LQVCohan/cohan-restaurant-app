import { describe, expect, it } from "vitest";
import { buildRestoredVariants } from "../../src/services/menuPriceEvent.service.js";

describe("temporary menu price restoration", () => {
  it("restores only a variant that still has the event price", () => {
    const result = buildRestoredVariants(
      [{ key: "default", price: 88_000, name: "Mặc định" }],
      [{ key: "default", price: 80_000 }],
      [{ key: "default", price: 88_000 }],
    );

    expect(result.candidates).toEqual([
      { key: "default", beforePrice: 80_000, appliedPrice: 88_000 },
    ]);
    expect(result.skippedCount).toBe(0);
  });

  it("does not overwrite a price changed again after the event started", () => {
    const result = buildRestoredVariants(
      [{ key: "default", price: 92_000 }],
      [{ key: "default", price: 80_000 }],
      [{ key: "default", price: 88_000 }],
    );

    expect(result.candidates).toEqual([]);
    expect(result.skippedCount).toBe(1);
  });
});
