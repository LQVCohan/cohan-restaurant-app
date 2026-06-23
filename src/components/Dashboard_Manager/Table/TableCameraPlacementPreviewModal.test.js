import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CAMERA_PLACEMENT, normalizeCameraPlacement } from "@/config/table3dCameraPlacementStorage";
import TableCameraPlacementPreviewModal from "./TableCameraPlacementPreviewModal";
import {
  buildPreviewModelItemFromVisualConfig,
  formatVisualConfigSavedAt,
  getVisualConfigSummary,
} from "./tableVisualConfigHelpers";

const renderCameraModal = (props = {}) =>
  render(
    React.createElement(TableCameraPlacementPreviewModal, {
      open: true,
      onClose: vi.fn(),
      modelItem: {
        key: "table.thumb",
        label: "Bàn thumbnail",
        tableType: "round-table",
        capacity: 4,
        thumbnailUrl: "https://cdn.example.com/thumb.png",
        modelUrl: "https://cdn.example.com/table.glb",
        dimensionsCm: { diameterCm: 110, heightCm: 76 },
      },
      ...props,
    })
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete navigator.mediaDevices;
  window.localStorage.clear();
});

describe("buildPreviewModelItemFromVisualConfig", () => {
  it("maps complete visualConfig to modelItem", () => {
    const visualConfig = {
      modelKey: "table.round.6",
      modelLabel: "Bàn tròn 6",
      tableType: "round",
      capacity: 6,
      defaultScale: 1.15,
      modelUrl: "https://cdn.example.com/round.glb",
      thumbnailUrl: "https://cdn.example.com/round.png",
      source: "catalog-test",
      sourceLabel: "Catalog Test",
      licenseLabel: "CC0",
      dimensions: { widthCm: 140, depthCm: 140, heightCm: 75, diameterCm: 140 },
      tags: ["round", "vip"],
      fallbackKind: "model",
      customModelKind: "url",
      tableArea: "vip",
      shape: "round",
    };

    const result = buildPreviewModelItemFromVisualConfig(visualConfig);

    expect(result).toMatchObject({
      key: "table.round.6",
      label: "Bàn tròn 6",
      tableType: "round",
      capacity: 6,
      defaultScale: 1.15,
      modelUrl: "https://cdn.example.com/round.glb",
      thumbnailUrl: "https://cdn.example.com/round.png",
      source: "catalog-test",
      sourceLabel: "Catalog Test",
      licenseLabel: "CC0",
      dimensionsCm: { widthCm: 140, depthCm: 140, heightCm: 75, diameterCm: 140 },
      tags: ["round", "vip"],
      fallbackKind: "model",
      customModelKind: "url",
      customModelSpec: {
        name: "Bàn tròn 6",
        capacity: 6,
        widthCm: 140,
        depthCm: 140,
        heightCm: 75,
        diameterCm: 140,
        area: "vip",
        shape: "round",
      },
    });
  });


  it("keeps diameter dimensions and formats round table summary", () => {
    const visualConfig = {
      modelKey: "table.round.diameter",
      modelLabel: "Bàn tròn diameter",
      tableType: "round-table",
      capacity: 4,
      dimensions: { diameter: 110, heightCm: 76 },
    };

    const previewItem = buildPreviewModelItemFromVisualConfig(visualConfig);
    const summary = getVisualConfigSummary(visualConfig);

    expect(previewItem.dimensionsCm).toMatchObject({
      diameterCm: 110,
      heightCm: 76,
    });
    expect(previewItem.customModelSpec).toMatchObject({
      diameterCm: 110,
      heightCm: 76,
    });
    expect(summary?.dimensions).toBe("Ø 110 cm x cao 76 cm");
  });

  it("uses fallback when modelKey/modelLabel is missing", () => {
    const result = buildPreviewModelItemFromVisualConfig({ capacity: 4 });

    expect(result.key).toBe("saved-model");
    expect(result.label).toBe("Mẫu bàn đã lưu");
    expect(result.capacity).toBe(4);
  });

  it("handles visualConfig dimensions missing without crash", () => {
    const result = buildPreviewModelItemFromVisualConfig({
      modelLabel: "Bàn test",
      dimensions: {},
      capacity: 2,
    });

    expect(result.customModelSpec).toBeNull();
    expect(result.capacity).toBe(2);
  });

  it("normalizes missing placement with default opacity and clamps opacity", () => {
    expect(normalizeCameraPlacement(undefined)).toEqual(DEFAULT_CAMERA_PLACEMENT);
    expect(normalizeCameraPlacement({ opacity: 2 })).toMatchObject({ opacity: 1 });
    expect(normalizeCameraPlacement({ opacity: 0.1 })).toMatchObject({ opacity: 0.35 });
  });
});

describe("TableCameraPlacementPreviewModal", () => {
  it("shows unsupported camera guidance without crashing", async () => {
    renderCameraModal();

    expect(await screen.findByText("Thiết bị hoặc trình duyệt này chưa hỗ trợ xem thử bằng camera.")).toBeInTheDocument();
    expect(screen.getByText("Thử Chrome hoặc Safari phiên bản mới nhất.")).toBeInTheDocument();
    expect(screen.getByText("Mở trang bằng HTTPS hoặc localhost.")).toBeInTheDocument();
  });

  it("renders thumbnail overlay and falls back when thumbnail fails", async () => {
    renderCameraModal();

    const thumbnail = await screen.findByAltText("Mẫu Bàn thumbnail");
    expect(thumbnail).toHaveAttribute("src", "https://cdn.example.com/thumb.png");

    fireEvent.error(thumbnail);

    await waitFor(() => {
      expect(screen.queryByAltText("Mẫu Bàn thumbnail")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Mẫu bàn dùng để ước lượng trong khung camera")).toBeInTheDocument();
  });

  it("updates the manual preview opacity", async () => {
    renderCameraModal({
      initialPlacement: { x: 40, y: 60, scale: 1.1, rotation: 30, opacity: 0.5 },
    });

    fireEvent.change(await screen.findByRole("slider"), { target: { value: "0.42" } });

    expect(screen.getByText(/Độ rõ của mẫu: 42%/)).toBeInTheDocument();
  });
});

describe("formatVisualConfigSavedAt", () => {
  it("falls back when savedAt is invalid", () => {
    expect(formatVisualConfigSavedAt("invalid-date-value")).toBe("Không rõ thời gian lưu");
  });
});
