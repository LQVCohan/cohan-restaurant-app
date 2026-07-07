import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppErrorBoundary, { getFriendlyAppError } from "./AppErrorBoundary";

const BrokenLazyPage = () => {
  throw new Error(
    "Failed to fetch dynamically imported module: /src/pages/BrokenPage.jsx",
  );
};

describe("AppErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replaces a failed lazy module with a friendly recovery screen", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <AppErrorBoundary>
        <BrokenLazyPage />
      </AppErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "Không thể tải trang vừa chọn" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cohan Restaurant · UI-LOAD/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tải lại trang" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Về trang chính" }),
    ).toBeInTheDocument();
  });

  it("uses a data-connection message for network and database failures", () => {
    expect(getFriendlyAppError(new Error("Network request failed"))).toMatchObject(
      {
        code: "DATA-CONNECTION",
        title: "Hệ thống đang tạm gián đoạn",
      },
    );
  });
});
