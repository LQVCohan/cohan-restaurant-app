import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotificationContainer from "../components/common/NotificationContainer";
import NotificationProvider, { toUserFacingCopy } from "./NotificationProvider";

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
      </NotificationProvider>,
    );

    const bridgedAlert = window.alert;
    expect(bridgedAlert).not.toBe(nativeAlert);

    act(() => {
      alert("Vai trò hiện tại không có quyền thực hiện thao tác này.");
      window.alert("Đã sao chép link vào clipboard!");
    });

    expect(nativeAlert).not.toHaveBeenCalled();
    expect(
      screen.getByText("Vai trò hiện tại không có quyền thực hiện thao tác này."),
    ).toBeInTheDocument();
    expect(screen.getByText("Đã sao chép link vào clipboard!")).toBeInTheDocument();
    expect(
      screen
        .getByText("Đã sao chép link vào clipboard!")
        .closest(".app-toast"),
    ).toHaveClass("app-toast--success");

    view.unmount();
    expect(window.alert).toBe(nativeAlert);
  });

  it("replaces raw GraphQL scalar failures with concise user-facing copy", () => {
    const raw =
      'Variable "$input" got invalid value "2026-07-14" at "input.startDate"; DateTime cannot represent an invalid date-time-string.';

    expect(toUserFacingCopy(raw)).toBe(
      "Thời gian đã chọn chưa hợp lệ. Vui lòng kiểm tra và thử lại.",
    );
    expect(toUserFacingCopy(raw)).not.toMatch(/Variable|DateTime|input\.|GraphQL/i);
  });

  it("keeps a recognizable order code while hiding technical exception details", () => {
    expect(
      toUserFacingCopy(
        "ApolloError ObjectId failed while loading order ORD-2026-0012",
      ),
    ).toBe(
      "Thao tác chưa hoàn tất. Vui lòng kiểm tra thông tin và thử lại. Mã đơn: ORD-2026-0012.",
    );
  });

  it("turns raw order socket events into natural Vietnamese notifications", () => {
    expect(toUserFacingCopy("Realtime: ORDER_STATUS_CHANGED (T103)")).toBe(
      "Trạng thái đơn tại bàn T103 vừa thay đổi.",
    );
    expect(toUserFacingCopy("Realtime: ORDER_CREATED (T08)")).toBe(
      "Có đơn mới tại bàn T08.",
    );
    expect(toUserFacingCopy("Realtime: PAYMENT_VERIFIED (T12)")).toBe(
      "Thanh toán của bàn T12 đã được xác nhận.",
    );
  });

  it("does not expose unknown technical event constants to users", () => {
    const message = toUserFacingCopy("Realtime: SOME_INTERNAL_EVENT_CODE (T20)");
    expect(message).toBe("Bàn T20 vừa có cập nhật mới.");
    expect(message).not.toMatch(/SOME_INTERNAL_EVENT_CODE|[A-Z]+_[A-Z_]+/);
  });

  it("translates event constants embedded inside longer messages", () => {
    expect(toUserFacingCopy("Đã nhận ORDER_CANCELLED từ hệ thống.")).toBe(
      "Đã nhận đơn hàng đã bị hủy từ hệ thống.",
    );
  });
});
