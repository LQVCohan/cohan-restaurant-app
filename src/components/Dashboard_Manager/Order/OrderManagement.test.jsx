import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { RejectOrderDialog } from "./OrderManagement";

const RejectDialogHarness = ({ onConfirm = vi.fn() }) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  return (
    <RejectOrderDialog
      open
      orderLabel="ORD-2026-0007"
      reason={reason}
      error={error}
      onReasonChange={(value) => {
        setReason(value);
        setError("");
      }}
      onCancel={vi.fn()}
      onConfirm={() => {
        if (!reason.trim()) {
          setError("Vui lòng nhập lý do từ chối đơn.");
          return;
        }
        onConfirm(reason.trim());
      }}
    />
  );
};

describe("RejectOrderDialog", () => {
  it("shows validation when the reject reason is empty", () => {
    render(<RejectDialogHarness />);

    fireEvent.click(screen.getByRole("button", { name: /xác nhận từ chối/i }));

    expect(screen.getByText("Vui lòng nhập lý do từ chối đơn.")).toBeInTheDocument();
  });

  it("accepts a reject reason and calls confirm", () => {
    const onConfirm = vi.fn();
    render(<RejectDialogHarness onConfirm={onConfirm} />);

    fireEvent.change(screen.getByRole("textbox", { name: /lý do từ chối/i }), {
      target: { value: "Món đã hết" },
    });
    fireEvent.click(screen.getByRole("button", { name: /xác nhận từ chối/i }));

    expect(onConfirm).toHaveBeenCalledWith("Món đã hết");
  });
});
