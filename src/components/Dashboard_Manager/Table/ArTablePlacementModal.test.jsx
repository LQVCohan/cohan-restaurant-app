import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ArTablePlacementModal from "./ArTablePlacementModal";

vi.mock("@/components/common/Button", () => ({
  default: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/common/Modal", () => {
  const Modal = ({ isOpen, children, className = "" }) =>
    isOpen ? <div role="dialog" className={className}>{children}</div> : null;
  Modal.Header = ({ children }) => <header>{children}</header>;
  Modal.Body = ({ children }) => <main>{children}</main>;
  Modal.Footer = ({ children }) => <footer>{children}</footer>;
  return { default: Modal };
});

const baseProps = {
  open: true,
  onClose: vi.fn(),
  table: { id: "table-1", code: "A1" },
  restaurant: {
    name: "COHAN Demo",
    address: { lat: 10.772, lng: 106.698 },
    arGeofenceRadiusMeters: 100,
  },
  floor: { id: "floor-1", name: "Tầng 1" },
  selectedModel: {
    key: "round-4",
    label: "Bàn tròn 4 ghế",
    modelUrl: "https://example.com/table.glb",
  },
  currentFloorLayout: { id: "floor-1", name: "Tầng 1" },
  onSavePosition: vi.fn(),
};

const mockGeolocation = (success = true) => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((resolve, reject) => {
        if (success) {
          resolve({ coords: { latitude: 10.772, longitude: 106.698 } });
        } else {
          reject(new Error("denied"));
        }
      }),
    },
  });
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
  globalThis.XRWebGLLayer = undefined;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  mockGeolocation(true);
});

describe("ArTablePlacementModal", () => {
  it("renders the AR placement workflow with user-facing mode labels", async () => {
    render(<ArTablePlacementModal {...baseProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Đặt vị trí bàn bằng AR")).toBeInTheDocument();
    expect(screen.getByText(/Bàn:/i)).toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("AR thật để lưu vị trí")).toBeInTheDocument();
    expect(screen.getByText("AR native để xem mẫu")).toBeInTheDocument();
    expect(screen.getByText("Manual calibration")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("HTTPS / secure context")).toBeInTheDocument();
    });
  });

  it("shows clear fallback warnings when WebXR is unavailable", async () => {
    render(<ArTablePlacementModal {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("navigator.xr khả dụng")).toBeInTheDocument();
      expect(screen.getByText("immersive-ar được hỗ trợ")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Thiết bị\/trình duyệt chưa hỗ trợ WebXR AR/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bắt đầu AR thật" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Chọn vị trí này" })).toBeDisabled();
  });

  it("warns when no table is selected for AR placement", async () => {
    render(<ArTablePlacementModal {...baseProps} table={null} />);

    expect(screen.getByText("Chưa chọn bàn để đặt vị trí.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Chọn vị trí này" })).toBeDisabled();
    });
  });

  it("detects a secure WebXR-capable browser in preflight", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "xr", {
      configurable: true,
      value: {
        isSessionSupported: vi.fn().mockResolvedValue(true),
      },
    });
    globalThis.XRWebGLLayer = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      getExtension: vi.fn(() => ({ loseContext: vi.fn() })),
    }));

    render(<ArTablePlacementModal {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText("HTTPS / secure context")).toBeInTheDocument();
      expect(screen.getByText("navigator.xr khả dụng")).toBeInTheDocument();
      expect(screen.getByText("immersive-ar được hỗ trợ")).toBeInTheDocument();
    });

    expect(screen.getAllByText("OK").length).toBeGreaterThanOrEqual(4);
  });
});
