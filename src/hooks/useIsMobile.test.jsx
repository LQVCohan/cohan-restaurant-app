import { afterEach, describe, expect, it, vi } from "vitest";
import { readMobileViewport } from "./useIsMobile";

describe("readMobileViewport", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("returns the current mobile media-query result", () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    expect(readMobileViewport()).toBe(true);
  });

  it("falls back to desktop when matchMedia is unavailable", () => {
    window.matchMedia = undefined;
    expect(readMobileViewport()).toBe(false);
  });
});
