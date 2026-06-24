import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildArMobileTestReport, copyTextToClipboard } from "./arMobileTestReport";

const originalClipboard = navigator.clipboard;
const originalExecCommand = document.execCommand;

beforeEach(() => {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  });
  Object.defineProperty(navigator, "xr", {
    configurable: true,
    value: { isSessionSupported: vi.fn() },
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: originalClipboard,
  });
  document.execCommand = originalExecCommand;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("arMobileTestReport", () => {
  it("builds a parseable report with device, capability and model information", () => {
    const json = buildArMobileTestReport({
      selectedModel: {
        label: "Bàn tròn 4 ghế",
        key: "round-4",
        modelUrl: "/models/table.glb",
        tableType: "round",
      },
      table: { code: "A1" },
      restaurant: { name: "COHAN Demo" },
      floor: { name: "Tầng 1" },
      capabilities: { secureContext: true, camera: true, webxr: true },
      arStatus: {
        label: "Sẵn sàng đặt bàn",
        description: "Thiết bị đã sẵn sàng để đặt bàn bằng AR.",
      },
      extra: { modelError: "" },
    });

    const report = JSON.parse(json);

    expect(report.title).toBe("COHAN AR/3D mobile test report");
    expect(report.secureContext).toBe(true);
    expect(report.browser.mediaDevices).toBe(true);
    expect(report.browser.webxr).toBe(true);
    expect(report.appState.restaurant).toBe("COHAN Demo");
    expect(report.appState.floor).toBe("Tầng 1");
    expect(report.appState.table).toBe("A1");
    expect(report.appState.selectedModel).toBe("Bàn tròn 4 ghế");
    expect(report.appState.modelUrl).toBe("/models/table.glb");
    expect(report.appState.arStatusLabel).toBe("Sẵn sàng đặt bàn");
    expect(report.extra.modelError).toBe("");
  });

  it("uses safe fallback values when optional app state is missing", () => {
    const report = JSON.parse(buildArMobileTestReport());

    expect(report.appState.restaurant).toBe("-");
    expect(report.appState.floor).toBe("-");
    expect(report.appState.table).toBe("-");
    expect(report.appState.selectedModel).toBe("-");
    expect(report.appState.modelUrl).toBe("-");
  });

  it("copies with navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await expect(copyTextToClipboard("AR report")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("AR report");
  });

  it("falls back to document.execCommand when clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = vi.fn().mockReturnValue(true);

    await expect(copyTextToClipboard("Fallback report")).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });
});
