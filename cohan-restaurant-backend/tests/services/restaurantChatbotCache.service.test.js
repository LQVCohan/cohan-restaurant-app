import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAiChatbotCache,
  deleteAiChatbotCache,
  deleteAiChatbotCacheByPrefix,
  getAiChatbotCache,
  getAiChatbotCacheStats,
  getOrSetAiChatbotCache,
  setAiChatbotCache,
} from "../../src/services/ai/restaurantChatbotCache.service.js";

describe("restaurantChatbotCache service", () => {
  beforeEach(() => {
    vi.useRealTimers();
    clearAiChatbotCache();
  });

  it("sets and gets cache values", () => {
    setAiChatbotCache("ai:test:key", { ok: true }, 1000);
    expect(getAiChatbotCache("ai:test:key")).toEqual({ ok: true });
  });

  it("returns undefined for expired entries and lazily removes them", () => {
    vi.useFakeTimers();
    setAiChatbotCache("ai:test:expired", "value", 10);
    vi.advanceTimersByTime(11);
    expect(getAiChatbotCache("ai:test:expired")).toBeUndefined();
    expect(getAiChatbotCacheStats()).toMatchObject({ entries: 0, activeEntries: 0, expiredEntries: 0 });
    vi.useRealTimers();
  });

  it("getOrSet calls loader once on cache hit", async () => {
    const loader = vi.fn(async () => "loaded");
    await expect(getOrSetAiChatbotCache("ai:test:loader", loader, 1000)).resolves.toBe("loaded");
    await expect(getOrSetAiChatbotCache("ai:test:loader", loader, 1000)).resolves.toBe("loaded");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("deletes a single key", () => {
    setAiChatbotCache("ai:test:delete", 1, 1000);
    expect(deleteAiChatbotCache("ai:test:delete")).toBe(true);
    expect(getAiChatbotCache("ai:test:delete")).toBeUndefined();
  });

  it("deletes entries by prefix", () => {
    setAiChatbotCache("ai:test:prefix:a", 1, 1000);
    setAiChatbotCache("ai:test:prefix:b", 2, 1000);
    setAiChatbotCache("ai:test:other", 3, 1000);
    expect(deleteAiChatbotCacheByPrefix("ai:test:prefix:")).toBe(2);
    expect(getAiChatbotCache("ai:test:prefix:a")).toBeUndefined();
    expect(getAiChatbotCache("ai:test:prefix:b")).toBeUndefined();
    expect(getAiChatbotCache("ai:test:other")).toBe(3);
  });

  it("clears all entries", () => {
    setAiChatbotCache("ai:test:a", 1, 1000);
    setAiChatbotCache("ai:test:b", 2, 1000);
    clearAiChatbotCache();
    expect(getAiChatbotCacheStats()).toMatchObject({ entries: 0, activeEntries: 0, expiredEntries: 0 });
  });

  it("reports stats count entries", () => {
    setAiChatbotCache("ai:test:stats:a", 1, 1000);
    setAiChatbotCache("ai:test:stats:b", 2, 1000);
    expect(getAiChatbotCacheStats()).toMatchObject({ entries: 2, activeEntries: 2, expiredEntries: 0 });
  });

  it("propagates loader errors without caching failures", async () => {
    const error = new Error("loader failed");
    const loader = vi.fn(async () => { throw error; });
    await expect(getOrSetAiChatbotCache("ai:test:error", loader, 1000)).rejects.toThrow("loader failed");
    expect(getAiChatbotCache("ai:test:error")).toBeUndefined();
  });
});
