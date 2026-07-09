import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotificationContainer from "../components/common/NotificationContainer";
import NotificationProvider from "./NotificationProvider";

describe("NotificationProvider alert bridge", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("routes browser alert calls to non-blocking toasts and restores alert on unmount", () => {
    vi.useFakeTimers();
    const nativeAlert = vi.fn();
    window.alert = nativeAlert;

    const view = render(
      <NotificationProvider>
        <NotificationContainer />
      </NotificationProvider>
    );

    const bridgedAlert = window.alert;
    expect(bridgedAlert).not.toBe(nativeAlert);

    act(() => {
      alert("Vai trò hiện tại không có quyền thực hiện thao tác này.");
      window.alert("Đã sao chép link vào clipboard!");
    });

    expect(nativeAlert).not.toHaveBeenCalled();
    expect(
      screen.getByText("Vai trò hiện tại không có quyền thực hiện thao tác này.")
    ).toBeInTheDocument();
    expect(screen.getByText("Đã sao chép link vào clipboard!")).toBeInTheDocument();
    expect(
      screen
        .getByText("Đã sao chép link vào clipboard!")
        .closest(".app-toast")
    ).toHaveClass("app-toast--success");

    view.unmount();
    expect(window.alert).toBe(nativeAlert);
  });
});
