import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ShiftRulesModal from "./ShiftRulesModal";

const baseRules = [
  {
    type: "morning",
    label: "Ca Sáng",
    startTime: "06:00",
    endTime: "14:00",
    icon: "🌅",
  },
  {
    type: "evening",
    label: "Ca Tối",
    startTime: "14:00",
    endTime: "22:00",
    icon: "🌙",
  },
];

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  rules: baseRules,
  policy: {},
  onApply: vi.fn(),
};

describe("ShiftRulesModal mandatoryShiftRoles", () => {
  it("submits an explicit empty mandatoryShiftRoles array when all roles are unchecked", async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);

    render(
      <ShiftRulesModal
        {...baseProps}
        mandatoryShiftRoles={["server"]}
        onApply={onApply}
      />,
    );

    const serverCheckbox = await screen.findByLabelText("Phục vụ");
    expect(serverCheckbox).toBeChecked();

    fireEvent.click(serverCheckbox);
    expect(serverCheckbox).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Lưu cài đặt" }));

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply.mock.calls[0][1].mandatoryShiftRoles).toEqual([]);
  });

  it("normalizes and deduplicates mandatory roles before saving", async () => {
    const onApply = vi.fn().mockResolvedValue(undefined);

    render(
      <ShiftRulesModal
        {...baseProps}
        mandatoryShiftRoles={["SERVER", " server ", "cashier"]}
        onApply={onApply}
      />,
    );

    expect(await screen.findByLabelText("Phục vụ")).toBeChecked();
    expect(screen.getByLabelText("Thu ngân")).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Lưu cài đặt" }));

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply.mock.calls[0][1].mandatoryShiftRoles).toEqual([
      "server",
      "cashier",
    ]);
  });
});
