import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Table3DActionBarV2 from "./Table3DActionBarV2";

vi.mock("@/components/common/Button", () => ({
  default: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Table3DActionBarV2", () => {
  const baseProps = {
    canLaunchNativeAr: true,
    isOpeningAr: false,
    arUnavailableReason: "Cần HTTPS",
    onOpenNativeAr: vi.fn(),
  };

  it("shows only the native camera AR action", () => {
    render(<Table3DActionBarV2 {...baseProps} />);

    expect(
      screen.getByRole("button", { name: /Mở camera AR/i }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /Xem camera 2D/i }),
    ).not.toBeInTheDocument();
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

  it("calls the native AR handler", async () => {
    const onOpenNativeAr = vi.fn();

    render(
      <Table3DActionBarV2
        {...baseProps}
        onOpenNativeAr={onOpenNativeAr}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Mở camera AR/i }));

    await waitFor(() => expect(onOpenNativeAr).toHaveBeenCalledTimes(1));
  });

  it("prioritizes native floor scanning and keeps pinch scaling enabled", async () => {
    const shell = document.createElement("div");
    shell.className = "table-3d-modal";
    const viewer = document.createElement("model-viewer");
    viewer.activateAR = vi.fn().mockResolvedValue(undefined);
    shell.appendChild(viewer);
    document.body.appendChild(shell);

    const onOpenNativeAr = vi.fn(async () => {
      viewer.setAttribute("ar-scale", "auto");
      await viewer.activateAR();
    });

    render(
      <Table3DActionBarV2
        {...baseProps}
        onOpenNativeAr={onOpenNativeAr}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Mở camera AR/i }));

    await waitFor(() => expect(viewer.activateAR).toHaveBeenCalledTimes(1));
    expect(viewer).toHaveAttribute(
      "ar-modes",
      "scene-viewer webxr quick-look",
    );
    expect(viewer).toHaveAttribute("ar-placement", "floor");
    expect(viewer).toHaveAttribute("ar-scale", "auto");
  });

  it("still calls the launcher when the model viewer is not mounted", async () => {
    const onOpenNativeAr = vi.fn();

    render(
      <Table3DActionBarV2
        {...baseProps}
        onOpenNativeAr={onOpenNativeAr}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Mở camera AR/i }));

    await waitFor(() => expect(onOpenNativeAr).toHaveBeenCalledTimes(1));
  });
});
