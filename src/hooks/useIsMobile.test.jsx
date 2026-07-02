import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useIsMobile from "./useIsMobile";

describe("useIsMobile", () => {
  let matches;
  let listeners;

  beforeEach(() => {
    matches = false;
    listeners = new Set();

    window.matchMedia = vi.fn(() => ({
      get matches() {
        return matches;
      },
      media: "(max-width: 760px)",
      onchange: null,
      addEventListener: (_event, listener) => listeners.add(listener),
      removeEventListener: (_event, listener) => listeners.delete(listener),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("tracks viewport changes", () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      listeners.forEach((listener) => listener({ matches: true }));
    });

    expect(result.current).toBe(true);
  });

  it("falls back to desktop when matchMedia is unavailable", () => {
    window.matchMedia = undefined;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
