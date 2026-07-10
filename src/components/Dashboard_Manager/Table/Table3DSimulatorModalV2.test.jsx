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
    isOpen ? (
      <div role="dialog" className={className}>
        {children}
      </div>
    ) : null;
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
  default: ({
    filteredModels,
    selectedModel,
    onSelectModel,
    onCreateCustomModel,
  }) => (
    <aside data-testid="catalog-panel">
      {filteredModels.map((model) => (
        <button
          key={model.key}
          type="button"
          onClick={() => onSelectModel(model.key)}
        >
          {model.label}
        </button>
      ))}
      <button type="button" onClick={onCreateCustomModel}>
        Tạo mẫu mới
      </button>
      <span data-testid="selected-model">{selectedModel?.label}</span>
    </aside>
  ),
}));

vi.mock("./CustomTableModelBuilderModal", () => ({
  default: ({ open, onApply }) =>
    open ? (
      <div data-testid="custom-model-builder">
        <button
          type="button"
          onClick={() =>
            onApply({
              key: "online-custom",
              label: "Bàn URL tùy chỉnh",
              tableType: "round-table",
              capacity: 4,
              defaultScale: 1,
              modelUrl: "https://example.com/custom.glb",
            })
          }
        >
          Dùng model URL test
        </button>
      </div>
    ) : null,
}));

vi.mock("./TableCameraPlacementPreviewModal", () => ({
  default: ({ open, modelItem }) =>
    open ? (
      <div data-testid="camera-preview">Camera {modelItem?.label}</div>
    ) : null,
}));

const baseProps = {
  open: true,
  onClose: vi.fn(),
  restaurantName: "COHAN Demo",
  restaurantId: "restaurant-1",
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
});

describe("Table3DSimulatorModalV2", () => {
  it("renders the global catalog preview without table persistence actions", () => {
    render(<Table3DSimulatorModalV2 {...baseProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Xem thử bàn 3D trong không gian/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Bàn tròn 4 ghế").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cần HTTPS").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /Mở camera AR/i }),
    ).toBeDisabled();
    expect(screen.queryByText(/lưu vị trí/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Áp dụng mẫu/i)).not.toBeInTheDocument();
  });

  it("opens the existing custom model flow and keeps the imported model selected", () => {
    render(<Table3DSimulatorModalV2 {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Tạo mẫu mới" }));
    expect(screen.getByTestId("custom-model-builder")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Dùng model URL test" }),
    );

    expect(screen.getByTestId("selected-model")).toHaveTextContent(
      "Bàn URL tùy chỉnh",
    );
  });

  it("opens the camera fallback for the selected model", () => {
    render(<Table3DSimulatorModalV2 {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Xem camera 2D/i }));

    expect(screen.getByTestId("camera-preview")).toHaveTextContent(
      "Bàn tròn 4 ghế",
    );
  });

  it("launches native camera AR when the page is secure", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "xr", {
      configurable: true,
      value: { isSessionSupported: vi.fn().mockResolvedValue(true) },
    });

    const { container } = render(<Table3DSimulatorModalV2 {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("Sẵn sàng AR")).toBeInTheDocument();
    });

    const viewer = container.querySelector("model-viewer");
    viewer.activateAR = vi.fn().mockResolvedValue(undefined);

    fireEvent.click(screen.getByRole("button", { name: /Mở camera AR/i }));

    await waitFor(() => expect(viewer.activateAR).toHaveBeenCalledTimes(1));
  });
});
