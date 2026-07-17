import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ShiftRulesModalCore from "./ShiftRulesModalCore";

vi.mock("../../../common/Modal", () => {
  const MockModal = ({ isOpen, children }) => (isOpen ? <div>{children}</div> : null);
  MockModal.Header = ({ children }) => <header>{children}</header>;
  MockModal.Body = ({ children }) => <main>{children}</main>;
  MockModal.Footer = ({ children }) => <footer>{children}</footer>;
  return { default: MockModal };
});

vi.mock("./ScoringGuideModal", () => ({
  default: () => null,
}));

const localRules = [
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
    endTime: "23:00",
    icon: "🌙",
  },
];

const policy = {
  shiftTemplates: [
    {
      key: "morning",
      label: "Ca mở cửa",
      startTime: "05:30",
      endTime: "13:30",
      enabled: true,
      allowCrossDay: false,
    },
    {
      key: "night",
      label: "Ca đóng cửa",
      startTime: "22:00",
      endTime: "06:00",
      enabled: true,
      allowCrossDay: true,
    },
  ],
  laborRules: {
    weeklyHoursCap: 48,
    recommendedWeeklyHoursCap: 40,
    maxShiftsPerDay: 1,
    minRestHoursBetweenShifts: 10,
    maxConsecutiveWorkingDays: 6,
    hardMaxConsecutiveWorkingDays: 7,
  },
  mandatoryShiftRoles: ["server"],
};

describe("ShiftRulesModalCore", () => {
  it("waits for backend policy and initializes times from that policy", async () => {
    const onApply = vi.fn();
    const { rerender } = render(
      <ShiftRulesModalCore
        isOpen
        onClose={vi.fn()}
        rules={localRules}
        policyLoading
        policy={null}
        onApply={onApply}
      />,
    );

    expect(screen.getByRole("button", { name: "Đang tải..." })).toBeDisabled();

    rerender(
      <ShiftRulesModalCore
        isOpen
        onClose={vi.fn()}
        rules={localRules}
        policyLoading={false}
        policy={policy}
        onApply={onApply}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Ca mở cửa bắt đầu")).toHaveValue("05:30");
      expect(screen.getByLabelText("Ca đóng cửa kết thúc")).toHaveValue("06:00");
    });

    fireEvent.click(screen.getByRole("button", { name: "Lưu cài đặt" }));

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply.mock.calls[0][1].shiftTemplates[1]).toMatchObject({
      key: "night",
      startTime: "22:00",
      endTime: "06:00",
      allowCrossDay: true,
    });
  });

  it("keeps edited times when adding a third shift", async () => {
    render(
      <ShiftRulesModalCore
        isOpen
        onClose={vi.fn()}
        rules={localRules}
        policyLoading={false}
        policy={{ ...policy, shiftTemplates: policy.shiftTemplates.slice(0, 1).concat({
          key: "evening",
          label: "Ca Tối",
          startTime: "14:00",
          endTime: "23:00",
          enabled: true,
        }) }}
        onApply={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Ca mở cửa bắt đầu")).toHaveValue("05:30"),
    );

    fireEvent.change(screen.getByLabelText("Ca mở cửa bắt đầu"), {
      target: { value: "07:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm ca" }));

    expect(screen.getByLabelText("Ca mở cửa bắt đầu")).toHaveValue("07:30");
    expect(screen.getAllByLabelText(/bắt đầu$/)).toHaveLength(3);
  });
});
