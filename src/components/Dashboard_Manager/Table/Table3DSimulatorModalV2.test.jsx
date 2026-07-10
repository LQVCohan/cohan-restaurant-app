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
  Object.defineProperty(navigator, "xr", {
    configurable: true,
    value: undefined,
  });
});

describe("Table3DSimulatorModalV2", () => {
  it("renders the global catalog preview without 2D or persistence actions", () => {
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
    expect(
      screen.queryByRole("button", { name: /Xem camera 2D/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Chưa chọn bàn/i)).not.toBeInTheDocument();
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

  it("configures floor placement and launches native AR after capability detection", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "xr", {
      configurable: true,
      value: { isSessionSupported: vi.fn().mockResolvedValue(true) },
    });

    const { container } = render(<Table3DSimulatorModalV2 {...baseProps} />);
    const viewer = container.querySelector("model-viewer");
    Object.defineProperty(viewer, "canActivateAR", {
      configurable: true,
      value: true,
    });
    viewer.activateAR = vi.fn().mockResolvedValue(undefined);

    expect(viewer).toHaveAttribute("ar-placement", "floor");
    expect(viewer).toHaveAttribute("ar-scale", "auto");
    expect(viewer).toHaveAttribute(
      "ar-modes",
      "webxr scene-viewer quick-look",
    );
    expect(viewer).toHaveAttribute("scale", "1 1 1");
    expect(viewer).toHaveAttribute("xr-environment");
    expect(viewer.querySelector('[slot="ar-button"]')).toHaveAttribute(
      "hidden",
    );

    fireEvent.load(viewer);

    await waitFor(() => {
      expect(screen.getByText("Sẵn sàng quét sàn")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Mở camera AR/i }),
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /Mở camera AR/i }));

    await waitFor(() => expect(viewer.activateAR).toHaveBeenCalledTimes(1));
  });

  it("reconciles a model that loaded before effect listeners were attached", async () => {
    const loadedDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "loaded",
    );
    const canActivateDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "canActivateAR",
    );
    const activateDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "activateAR",
    );
    const activateAR = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(HTMLElement.prototype, "loaded", {
      configurable: true,
      get() {
        return this.tagName === "MODEL-VIEWER";
      },
    });
    Object.defineProperty(HTMLElement.prototype, "canActivateAR", {
      configurable: true,
      get() {
        return this.tagName === "MODEL-VIEWER";
      },
    });
    Object.defineProperty(HTMLElement.prototype, "activateAR", {
      configurable: true,
      value: activateAR,
    });

    try {
      render(<Table3DSimulatorModalV2 {...baseProps} />);

      await waitFor(() => {
        expect(
          screen.queryByText("Đang tải mô hình 3D"),
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /Mở camera AR/i }),
        ).toBeEnabled();
      });
    } finally {
      if (loadedDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "loaded", loadedDescriptor);
      } else {
        delete HTMLElement.prototype.loaded;
      }
      if (canActivateDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "canActivateAR",
          canActivateDescriptor,
        );
      } else {
        delete HTMLElement.prototype.canActivateAR;
      }
      if (activateDescriptor) {
        Object.defineProperty(
          HTMLElement.prototype,
          "activateAR",
          activateDescriptor,
        );
      } else {
        delete HTMLElement.prototype.activateAR;
      }
    }
  });
});
