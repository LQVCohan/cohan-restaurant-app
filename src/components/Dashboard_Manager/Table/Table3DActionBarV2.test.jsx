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
    canLaunchNativeAr: true,
    isOpeningAr: false,
    arUnavailableReason: "Cần HTTPS",
    onOpenNativeAr: vi.fn(),
  };

  it("shows only camera preview and native camera AR actions", () => {
    render(<Table3DActionBarV2 {...baseProps} />);

    expect(
      screen.getByRole("button", { name: /Xem camera 2D/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Mở camera AR/i }),
    ).toBeEnabled();
    expect(screen.queryByText(/vị trí bàn/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Áp dụng mẫu/i)).not.toBeInTheDocument();
  });

  it("disables native AR when the device is not ready and keeps the reason", () => {
    render(
      <Table3DActionBarV2
        {...baseProps}
        canLaunchNativeAr={false}
        arUnavailableReason="AR chỉ hoạt động khi trang được mở bằng HTTPS hoặc localhost."
      />,
    );

    const nativeArButton = screen.getByRole("button", {
      name: /Mở camera AR/i,
    });
    expect(nativeArButton).toBeDisabled();
    expect(nativeArButton).toHaveAttribute(
      "title",
      "AR chỉ hoạt động khi trang được mở bằng HTTPS hoặc localhost.",
    );
  });

  it("disables camera preview when the browser has no camera support", () => {
    render(<Table3DActionBarV2 {...baseProps} canPreviewCamera={false} />);

    expect(
      screen.getByRole("button", { name: /Xem camera 2D/i }),
    ).toBeDisabled();
  });

  it("calls the camera and AR handlers", () => {
    const onOpenCamera = vi.fn();
    const onOpenNativeAr = vi.fn();

    render(
      <Table3DActionBarV2
        {...baseProps}
        onOpenCamera={onOpenCamera}
        onOpenNativeAr={onOpenNativeAr}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Xem camera 2D/i }));
    fireEvent.click(screen.getByRole("button", { name: /Mở camera AR/i }));

    expect(onOpenCamera).toHaveBeenCalledTimes(1);
    expect(onOpenNativeAr).toHaveBeenCalledTimes(1);
  });
});
