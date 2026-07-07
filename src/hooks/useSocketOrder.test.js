import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import useSocketOrder from "./useSocketOrder";

const socketMock = vi.hoisted(() => {
  const listeners = {};
  const socket = {
    on: vi.fn((event, handler) => {
      listeners[event] = handler;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };

  return { listeners, socket };
});

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => socketMock.socket),
}));

vi.mock("@/lib/authStorage", () => ({
  getToken: vi.fn(() => "manager-token"),
}));

afterEach(() => {
  Object.keys(socketMock.listeners).forEach((event) => {
    delete socketMock.listeners[event];
  });
  vi.clearAllMocks();
});

describe("useSocketOrder table QR events", () => {
  it("falls back to the existing manager callbacks with the verified table context", () => {
    const onCustomerStaffCallRequested = vi.fn();
    const onCustomerPaymentRequested = vi.fn();
    const { unmount } = renderHook(() =>
      useSocketOrder("restaurant-1", {
        onCustomerStaffCallRequested,
        onCustomerPaymentRequested,
      }),
    );

    const staffEvent = {
      type: "TABLE_CUSTOMER_REQUEST_CREATED",
      tableId: "table-101",
      tableCode: "V101",
    };
    const paymentEvent = {
      type: "TABLE_PAYMENT_REQUESTED",
      tableId: "table-102",
      tableCode: "V102",
    };

    act(() => {
      socketMock.listeners.orderEvents(staffEvent);
      socketMock.listeners.orderEvents(paymentEvent);
    });

    expect(onCustomerStaffCallRequested).toHaveBeenCalledWith(staffEvent);
    expect(onCustomerPaymentRequested).toHaveBeenCalledWith(paymentEvent);
    unmount();
  });

  it("prefers explicit table callbacks so the same event is not handled twice", () => {
    const onTableCustomerRequestCreated = vi.fn();
    const onCustomerStaffCallRequested = vi.fn();
    const { unmount } = renderHook(() =>
      useSocketOrder("restaurant-1", {
        onTableCustomerRequestCreated,
        onCustomerStaffCallRequested,
      }),
    );

    const event = {
      type: "TABLE_CUSTOMER_REQUEST_CREATED",
      tableId: "table-103",
      tableCode: "V103",
    };

    act(() => {
      socketMock.listeners.orderEvents(event);
    });

    expect(onTableCustomerRequestCreated).toHaveBeenCalledWith(event);
    expect(onCustomerStaffCallRequested).not.toHaveBeenCalled();
    unmount();
  });
});
