import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_TABLE_VR_SOURCE_BYTES,
  TABLE_VR_TARGET_BYTES,
  estimateTableVrDataUrlBytes,
  formatTableVrBytes,
  getTableVrCompressionSavings,
  getTableVrUnsupportedFileMessage,
  isPotentialTableVrImageFile,
  prepareTableVrImageFile,
} from "./tableVrImageProcessing";
import {
  getTableVrImageKey,
  getTableVrImageMetadataKey,
  loadTableVrImage,
  loadTableVrImageMetadata,
  removeTableVrImage,
  storeTableVrImage,
} from "./vrStorage";

const OriginalImage = globalThis.Image;
const originalCreateElement = document.createElement.bind(document);

const mockImageDimensions = (width, height) => {
  globalThis.Image = class MockImage {
    naturalWidth = width;
    naturalHeight = height;
    onload = null;
    onerror = null;

    set src(_value) {
      queueMicrotask(() => this.onload?.());
    }
  };
};

describe("tableVrImageProcessing", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:table-vr-test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.Image = OriginalImage;
    vi.restoreAllMocks();
  });

  it("formats size, estimates data URLs and calculates savings", () => {
    expect(formatTableVrBytes(1024 * 1024)).toBe("1.00 MB");
    expect(estimateTableVrDataUrlBytes("data:image/jpeg;base64,QUJDRA==")).toBeGreaterThan(0);
    expect(
      getTableVrCompressionSavings({
        originalBytes: 10 * 1024,
        processedBytes: 2 * 1024,
      }),
    ).toBe(80);
    expect(MAX_TABLE_VR_SOURCE_BYTES).toBe(30 * 1024 * 1024);
    expect(TABLE_VR_TARGET_BYTES).toBe(1200 * 1024);
  });

  it("accepts web images and explains phone/rendering formats", () => {
    expect(
      isPotentialTableVrImageFile(
        new File(["jpg"], "room.jpg", { type: "image/jpeg" }),
      ),
    ).toBe(true);
    expect(
      isPotentialTableVrImageFile(
        new File(["heic"], "room.heic", { type: "image/heic" }),
      ),
    ).toBe(false);
    expect(
      getTableVrUnsupportedFileMessage({ name: "phone.heic", type: "image/heic" }),
    ).toContain("JPG");
    expect(
      getTableVrUnsupportedFileMessage({ name: "lighting.exr", type: "" }),
    ).toContain("dựng hình/HDR");
  });

  it("rejects a normal wide panorama that is not close to 2:1", async () => {
    mockImageDimensions(2000, 1200);
    const file = new File(["image"], "wide.jpg", { type: "image/jpeg" });

    await expect(prepareTableVrImageFile(file)).rejects.toThrow("tỷ lệ gần 2:1");
  });

  it("compresses a browser-decodable 2:1 panorama and returns metadata", async () => {
    mockImageDimensions(4096, 2048);
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
        fillStyle: "",
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      }),
      toBlob: (callback) =>
        callback(new Blob([new Uint8Array(600 * 1024)], { type: "image/jpeg" })),
    };
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) =>
      tagName === "canvas" ? fakeCanvas : originalCreateElement(tagName, options),
    );
    const file = new File(
      [new Uint8Array(2 * 1024 * 1024)],
      "phone-sphere.png",
      { type: "image/png" },
    );

    const result = await prepareTableVrImageFile(file);

    expect(result.name).toBe("phone-sphere.jpg");
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.width).toBe(4096);
    expect(result.height).toBe(2048);
    expect(result.processedBytes).toBe(600 * 1024);
    expect(result.savingsPercent).toBeGreaterThan(0);
    expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe("table VR Local Storage", () => {
  beforeEach(() => localStorage.clear());

  it("stores and restores the panorama with metadata", () => {
    const dataUrl = "data:image/jpeg;base64,QUJDRA==";
    expect(
      storeTableVrImage("table-1", dataUrl, {
        name: "room.jpg",
        originalBytes: 2_000_000,
        processedBytes: 600_000,
        width: 4096,
        height: 2048,
        savingsPercent: 70,
      }),
    ).toBe(true);

    expect(loadTableVrImage("table-1")).toBe(dataUrl);
    expect(loadTableVrImageMetadata("table-1")).toMatchObject({
      name: "room.jpg",
      processedBytes: 600_000,
      width: 4096,
      height: 2048,
      savingsPercent: 70,
    });
  });

  it("keeps compatibility with legacy image-only entries", () => {
    const dataUrl = "data:image/jpeg;base64,QUJDRA==";
    localStorage.setItem(getTableVrImageKey("legacy"), dataUrl);

    expect(loadTableVrImage("legacy")).toBe(dataUrl);
    expect(loadTableVrImageMetadata("legacy")?.processedBytes).toBeGreaterThan(0);
  });

  it("removes both image and metadata", () => {
    storeTableVrImage("table-2", "data:image/jpeg;base64,QUJDRA==", {
      name: "room.jpg",
    });
    removeTableVrImage("table-2");

    expect(localStorage.getItem(getTableVrImageKey("table-2"))).toBeNull();
    expect(localStorage.getItem(getTableVrImageMetadataKey("table-2"))).toBeNull();
  });
});
