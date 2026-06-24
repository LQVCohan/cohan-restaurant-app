import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Table3DActionBarV2 from "./Table3DActionBarV2";

vi.mock("@/components/common/Button", () => ({
  default: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

describe("Table3DActionBarV2", () => {
  const baseProps = {
    selectedModel: { key: "round-4", label: "Bàn tròn 4 ghế" },
    canPreviewCamera: true,
    onOpenCamera: vi.fn(),
    canOpenArPlacement: true,
    arPlacementTitle: "Đặt và lưu vị trí bàn bằng AR",
    onOpenArPlacement: vi.fn(),
    canLaunchNativeAr: true,
    isOpeningAr: false,
    arUnavailableReason: "Cần HTTPS",
    onOpenNativeAr: vi.fn(),
    onApply: vi.fn(),
  };

  it("separates camera preview, native AR viewing, AR placement and apply actions", () => {
    render(<Table3DActionBarV2 {...baseProps} />);

    expect(screen.getByRole("button", { name: /Xem thử 2D bằng camera/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Xem AR trên thiết bị/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Thiết lập vị trí bàn/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Áp dụng mẫu này/i })).toBeEnabled();
  });

  it("supports custom labels for the AR placement and apply actions", () => {
    render(
      <Table3DActionBarV2
        {...baseProps}
        placementActionLabel="Đặt bàn vào sơ đồ bằng AR"
        applyActionLabel="Áp dụng mẫu 3D"
      />
    );

    expect(screen.getByRole("button", { name: /Đặt bàn vào sơ đồ bằng AR/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Áp dụng mẫu 3D/i })).toBeEnabled();
  });

  it("disables native AR when the device is not ready and keeps the reason on the title", () => {
    render(
      <Table3DActionBarV2
        {...baseProps}
        canLaunchNativeAr={false}
        arUnavailableReason="AR chỉ hoạt động khi trang được mở bằng HTTPS hoặc localhost."
      />
    );

    const nativeArButton = screen.getByRole("button", { name: /Xem AR trên thiết bị/i });
    expect(nativeArButton).toBeDisabled();
    expect(nativeArButton).toHaveAttribute(
      "title",
      "AR chỉ hoạt động khi trang được mở bằng HTTPS hoặc localhost."
    );
  });

  it("disables AR placement when no table is selected", () => {
    render(<Table3DActionBarV2 {...baseProps} canOpenArPlacement={false} />);

    expect(screen.getByRole("button", { name: /Chưa chọn bàn/i })).toBeDisabled();
    expect(screen.getByText(/Mở chi tiết một bàn trước để lưu vị trí/i)).toBeInTheDocument();
  });

  it("calls the right handlers", () => {
    const onOpenCamera = vi.fn();
    const onOpenNativeAr = vi.fn();
    const onOpenArPlacement = vi.fn();
    const onApply = vi.fn();

    render(
      <Table3DActionBarV2
        {...baseProps}
        onOpenCamera={onOpenCamera}
        onOpenNativeAr={onOpenNativeAr}
        onOpenArPlacement={onOpenArPlacement}
        onApply={onApply}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Xem thử 2D bằng camera/i }));
    fireEvent.click(screen.getByRole("button", { name: /Xem AR trên thiết bị/i }));
    fireEvent.click(screen.getByRole("button", { name: /Thiết lập vị trí bàn/i }));
    fireEvent.click(screen.getByRole("button", { name: /Áp dụng mẫu này/i }));

    expect(onOpenCamera).toHaveBeenCalledTimes(1);
    expect(onOpenNativeAr).toHaveBeenCalledTimes(1);
    expect(onOpenArPlacement).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
