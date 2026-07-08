import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Table3DSimulatorModal from "./Table3DSimulatorModal";

const mocks = vi.hoisted(() => ({
  deleteCustomTableModel: vi.fn(),
  upsertCustomTableModel: vi.fn(),
  buildPreviewModelItemFromVisualConfig: vi.fn(),
  buildVisualConfigFromModel: vi.fn(),
}));

vi.mock("@/config/table3dCustomModelStorage", () => ({
  deleteCustomTableModel: mocks.deleteCustomTableModel,
  upsertCustomTableModel: mocks.upsertCustomTableModel,
}));

vi.mock("./tableVisualConfigHelpers", () => ({
  buildPreviewModelItemFromVisualConfig:
    mocks.buildPreviewModelItemFromVisualConfig,
  buildVisualConfigFromModel: mocks.buildVisualConfigFromModel,
}));

vi.mock("./Table3DSimulatorModalV2", () => ({
  default: ({ open, onApply }) =>
    open ? (
      <button
        type="button"
        onClick={() =>
          onApply(
            {
              key: "uploaded-table",
              label: "Bàn upload",
              modelUrl: "https://cdn.example.com/uploaded.glb",
            },
            {
              visualConfig: {
                modelKey: "uploaded-table",
                modelUrl: "https://cdn.example.com/uploaded.glb",
              },
            },
          )
        }
      >
        Áp dụng mẫu test
      </button>
    ) : null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.buildPreviewModelItemFromVisualConfig.mockImplementation(
    (visualConfig) => ({
      key: visualConfig?.modelKey || "saved-model",
      label: visualConfig?.modelLabel || "Mẫu đã lưu",
      modelUrl: visualConfig?.modelUrl || "",
      source: visualConfig?.source || "user-upload",
      customModelKind: visualConfig?.customModelKind || "upload",
    }),
  );
  mocks.buildVisualConfigFromModel.mockReturnValue({
    modelKey: "uploaded-table",
    modelUrl: "https://cdn.example.com/uploaded.glb",
  });
});

describe("Table3DSimulatorModal", () => {
  it("prioritizes and saves the persisted uploaded model for an existing table", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const onSaveArPosition = vi.fn().mockResolvedValue(undefined);
    const visualConfig = {
      modelKey: "uploaded-table",
      modelLabel: "Bàn upload",
      modelUrl: "https://cdn.example.com/uploaded.glb",
      source: "user-upload",
      customModelKind: "upload",
    };

    render(
      <Table3DSimulatorModal
        open
        table={{ id: "table-1", visualConfig }}
        restaurantName="COHAN Demo"
        restaurantId="restaurant-1"
        onApply={onApply}
        onClose={onClose}
        onSaveArPosition={onSaveArPosition}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Áp dụng mẫu test" })).toBeInTheDocument();
    });

    expect(mocks.deleteCustomTableModel).toHaveBeenCalledWith(
      "uploaded-table",
      "COHAN Demo",
    );
    expect(mocks.upsertCustomTableModel).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "uploaded-table",
        modelUrl: "https://cdn.example.com/uploaded.glb",
        customModelKind: "upload",
      }),
      "COHAN Demo",
    );

    fireEvent.click(screen.getByRole("button", { name: "Áp dụng mẫu test" }));

    await waitFor(() => {
      expect(onSaveArPosition).toHaveBeenCalledWith({
        visualConfigPatch: {
          modelKey: "uploaded-table",
          modelUrl: "https://cdn.example.com/uploaded.glb",
        },
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(onApply).not.toHaveBeenCalled();
  });

  it("keeps the generic add-table callback when no concrete table is selected", () => {
    const onApply = vi.fn();
    const onSaveArPosition = vi.fn();

    render(
      <Table3DSimulatorModal
        open
        table={null}
        restaurantId="restaurant-1"
        onApply={onApply}
        onSaveArPosition={onSaveArPosition}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Áp dụng mẫu test" }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ key: "uploaded-table" }),
      expect.objectContaining({
        visualConfig: expect.objectContaining({ modelKey: "uploaded-table" }),
      }),
    );
    expect(onSaveArPosition).not.toHaveBeenCalled();
  });
});
