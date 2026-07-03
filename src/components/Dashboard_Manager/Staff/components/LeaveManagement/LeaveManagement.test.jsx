import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LeaveManagement from "./LeaveManagement";

vi.mock("../../../../../hooks/useLeaveManagement", () => ({
  useLeaveManagement: () => ({
    leaveRequests: [],
    staffList: [],
    submitLeaveRequest: vi.fn(),
    approveLeave: vi.fn(),
    rejectLeave: vi.fn(),
    loading: false,
    error: null,
    isMutating: false,
  }),
}));

vi.mock("./LeaveRequestsList", () => ({
  default: ({ headerAction }) => <section aria-label="Danh sách đơn nghỉ phép">{headerAction}</section>,
}));

vi.mock("./LeaveRequestForm", () => ({
  default: () => <div data-testid="leave-request-form">Leave request form</div>,
}));

afterEach(() => {
  cleanup();
  document.body.classList.remove("modal-open");
  document.documentElement.classList.remove("modal-open");
});

describe("LeaveManagement create modal", () => {
  it("portals the dialog to document.body and closes it with Escape", async () => {
    render(<LeaveManagement restaurantId="restaurant-1" />);

    const trigger = screen.getByRole("button", { name: /Tạo đơn nghỉ phép/i });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Tạo đơn nghỉ phép" });

    expect(dialog.closest(".leave-management-page")).toBeNull();
    expect(dialog.parentElement).toHaveClass("modal-overlay");
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(document.body).toHaveClass("modal-open");
    expect(screen.getByTestId("leave-request-form")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Tạo đơn nghỉ phép" })).not.toBeInTheDocument();
      expect(document.body).not.toHaveClass("modal-open");
      expect(trigger).toHaveFocus();
    });
  });
});
