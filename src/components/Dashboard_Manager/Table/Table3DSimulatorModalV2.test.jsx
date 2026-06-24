import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Table3DSimulatorModalV2 from "./Table3DSimulatorModalV2";

const modelsState = vi.hoisted(() => ({
  models: [
    {
      key: "round-4",
      label: "Bàn tròn 4 ghế",
      tableType: "round-table",
      capacity: 4,
      defaultScale: 1,
      modelUrl: "https://example.com/table.glb",
      thumbnailUrl: "https://example.com/table.jpg",
      sourceLabel: "Demo source",
      licenseLabel: "CC0",
      tags: ["round", "demo"],
    },
  ],
}));

vi.mock("@/components/common/Button", () => ({
  default: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/common/Modal", () => {
  const Modal = ({ isOpen, children, className = "" }) =>
    isOpen ? <div role="dialog" className={className}>{children}</div> : null;
  return { default: Modal };
});

vi.mock("@/hooks/useTable3DModels", () => ({
  default: () => ({
    models: modelsState.models,
    modelsByType: {
      "round-table": modelsState.models,
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("@/config/table3dCustomModelStorage", () => ({
  deleteCustomTableModel: vi.fn(() => []),
  loadCustomTableModels: vi.fn(() => []),
  mergeCatalogWithCustomModels: (catalog, custom) => [...catalog, ...custom],
  upsertCustomTableModel: vi.fn((item) => [item]),
  doesCustomModelMatchTableType: vi.fn(() => true),
  getCustomModelCatalogTableType: vi.fn(() => "round-table"),
}));

vi.mock("./Table3DCatalogPanel", () => ({
  default: ({ filteredModels, selectedModel, onSelectModel }) => (
    <aside data-testid="catalog-panel">
      {filteredModels.map((model) => (
        <button key={model.key} type="button" onClick={() => onSelectModel(model.key)}>
          {model.label}
        </button>
      ))}
      <span data-testid="selected-model">{selectedModel?.label}</span>
    </aside>
  ),
}));

vi.mock("./CustomTableModelBuilderModal", () => ({ default: () => null }));
vi.mock("./TableCameraPlacementPreviewModal", () => ({ default: () => null }));
vi.mock("./ArTablePlacementModal", () => ({
  default: ({ open }) => (open ? <div data-testid="ar-placement-modal">Đặt vị trí bàn bằng AR</div> : null),
}));

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onApply: vi.fn(),
  currentFloorName: "Tầng 1",
  restaurantName: "COHAN Demo",
  restaurantId: "restaurant-1",
  table: { id: "table-1", code: "A1" },
  restaurant: { name: "COHAN Demo" },
  floor: { id: "floor-1", name: "Tầng 1" },
  currentFloorLayout: { id: "floor-1", name: "Tầng 1" },
  onSaveArPosition: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: false,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  });
  Object.defineProperty(navigator, "xr", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  globalThis.customElements = globalThis.customElements || {
    get: vi.fn(() => true),
  };
});

describe("Table3DSimulatorModalV2", () => {
  it("renders the 3D modal with mobile AR readiness messaging", async () => {
    render(<Table3DSimulatorModalV2 {...baseProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Xem thử và bố trí bàn 3D/i })).toBeInTheDocument();
    expect(screen.getByText("Bàn tròn 4 ghế")).toBeInTheDocument();
    expect(screen.getByText("Cần HTTPS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Báo cáo test/i })).toBeInTheDocument();
  });

  it("copies a diagnostic report for mobile debugging", async () => {
    render(<Table3DSimulatorModalV2 {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Báo cáo test/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    });

    const report = JSON.parse(navigator.clipboard.writeText.mock.calls[0][0]);
    expect(report.appState.table).toBe("A1");
    expect(report.appState.selectedModel).toBe("Bàn tròn 4 ghế");
    expect(report.secureContext).toBe(false);
    expect(screen.getByText("Đã copy báo cáo")).toBeInTheDocument();
  });

  it("opens the AR placement modal when a table is selected", () => {
    render(<Table3DSimulatorModalV2 {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Đặt bàn vào sơ đồ bằng AR/i }));

    expect(screen.getByTestId("ar-placement-modal")).toBeInTheDocument();
  });

  it("disables AR placement when no table is selected", () => {
    render(<Table3DSimulatorModalV2 {...baseProps} table={null} />);

    expect(screen.getByRole("button", { name: /Chưa chọn bàn/i })).toBeDisabled();
    expect(screen.getByText(/Mở chi tiết một bàn trước để lưu vị trí/i)).toBeInTheDocument();
  });

  it("shows ready status when secure WebXR is available", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "xr", {
      configurable: true,
      value: { isSessionSupported: vi.fn().mockResolvedValue(true) },
    });

    render(<Table3DSimulatorModalV2 {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Sẵn sàng đặt bàn")).toBeInTheDocument();
    });
  });
});
