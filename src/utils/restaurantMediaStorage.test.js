import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRestaurantMedia,
  getCompressionSavingsPercent,
  getRestaurantMediaStorageKey,
  getRestaurantMediaUsageBytes,
  normalizeRestaurantMedia,
  readRestaurantMedia,
  saveRestaurantMedia,
} from "./restaurantMediaStorage";

const imageAsset = (id = "asset-1") => ({
  id,
  dataUrl: "data:image/jpeg;base64,QUJDRA==",
  name: `${id}.jpg`,
  originalBytes: 18 * 1024 * 1024,
  processedBytes: 1500 * 1024,
  quality: 0.72,
  width: 1200,
  height: 600,
});

describe("restaurantMediaStorage", () => {
  beforeEach(() => localStorage.clear());

  it("returns an empty media model when no data exists", () => {
    expect(readRestaurantMedia("restaurant-1")).toEqual({
      version: 1,
      panorama: null,
      gallery: [],
      updatedAt: null,
    });
  });

  it("persists panorama and gallery by restaurant", () => {
    saveRestaurantMedia("restaurant-1", {
      panorama: imageAsset("panorama"),
      gallery: [imageAsset("space-1")],
    });
    const stored = readRestaurantMedia("restaurant-1");
    expect(stored.panorama.id).toBe("panorama");
    expect(stored.panorama.processedBytes).toBe(1500 * 1024);
    expect(stored.panorama.quality).toBe(0.72);
    expect(stored.gallery).toHaveLength(1);
    expect(
      localStorage.getItem(getRestaurantMediaStorageKey("restaurant-1")),
    ).toContain("space-1");
  });

  it("notifies the current tab after saving", () => {
    const listener = vi.fn();
    window.addEventListener("cohan:restaurant-media-updated", listener);
    saveRestaurantMedia("restaurant-1", { gallery: [imageAsset()] });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.restaurantId).toBe("restaurant-1");
    window.removeEventListener("cohan:restaurant-media-updated", listener);
  });

  it("clears only the requested restaurant", () => {
    saveRestaurantMedia("restaurant-1", { gallery: [imageAsset("one")] });
    saveRestaurantMedia("restaurant-2", { gallery: [imageAsset("two")] });
    clearRestaurantMedia("restaurant-1");
    expect(readRestaurantMedia("restaurant-1").gallery).toHaveLength(0);
    expect(readRestaurantMedia("restaurant-2").gallery[0].id).toBe("two");
  });

  it("normalizes malformed media and estimates stored bytes", () => {
    const normalized = normalizeRestaurantMedia({
      panorama: { dataUrl: "" },
      gallery: [null, imageAsset()],
    });
    expect(normalized.panorama).toBeNull();
    expect(normalized.gallery).toHaveLength(1);
    expect(getRestaurantMediaUsageBytes(normalized)).toBeGreaterThan(0);
  });

  it("reports the compression saving for a large panorama", () => {
    expect(getCompressionSavingsPercent(imageAsset("panorama"))).toBe(92);
  });
});