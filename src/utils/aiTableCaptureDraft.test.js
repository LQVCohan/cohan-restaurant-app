import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_CAPTURE_MAX_SOURCE_BYTES,
  calculateCaptureDimensions,
  clearTable3DBuilderSessionState,
  getTable3DBuilderSessionState,
  setTable3DBuilderSessionState,
  validateAiTableCaptureFile,
} from "./aiTableCaptureDraft";

describe("aiTableCaptureDraft", () => {
  afterEach(() => {
    clearTable3DBuilderSessionState();
    vi.unstubAllGlobals();
  });

  it("accepts common camera images and rejects oversized or HEIC files", () => {
    expect(
      validateAiTableCaptureFile(
        new File(["photo"], "table.jpg", { type: "image/jpeg" }),
      ),
    ).toBe("");

    const oversized = new File(["x"], "large.jpg", { type: "image/jpeg" });
    Object.defineProperty(oversized, "size", {
      value: AI_CAPTURE_MAX_SOURCE_BYTES + 1,
    });
    expect(validateAiTableCaptureFile(oversized)).toMatch(/30 MB/);

    expect(
      validateAiTableCaptureFile(
        new File(["heic"], "IMG_0001.HEIC", { type: "image/heic" }),
      ),
    ).toMatch(/HEIC\/HEIF/);
  });

  it("limits the longest image edge while preserving aspect ratio", () => {
    expect(calculateCaptureDimensions(4032, 3024)).toEqual({
      width: 2048,
      height: 1536,
    });
    expect(calculateCaptureDimensions(1200, 900)).toEqual({
      width: 1200,
      height: 900,
    });
  });

  it("restores whether the builder and AI mode were open before a reload", () => {
    setTable3DBuilderSessionState({ open: true, mode: "ai" });
    expect(getTable3DBuilderSessionState()).toEqual({
      open: true,
      simulatorOpen: false,
      mode: "ai",
    });

    clearTable3DBuilderSessionState();
    expect(getTable3DBuilderSessionState()).toEqual({
      open: false,
      simulatorOpen: false,
      mode: "parametric",
    });
  });
});
