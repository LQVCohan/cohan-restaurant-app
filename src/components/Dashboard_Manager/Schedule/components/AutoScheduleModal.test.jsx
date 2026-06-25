import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AutoScheduleModal from "./AutoScheduleModal";

const baseConfig = {
  horizonDays: 7,
  weeklyHoursCap: 40,
  respectAvailability: true,
  avoidOvertime: true,
  requiredRoles: ["server"],
};

const basePreview = {
  items: [
    {
      shiftKey: "2026-05-20|evening",
      shiftType: "evening",
      status: "understaffed",
      confidence: 0.9,
      date: "2026-05-20",
      canApply: true,
      missingHeadcount: 1,
      currentAssignedStaff: 0,
      recommendedTotalStaff: 1,
      plannedAssignments: [{ staffId: "s1", fullName: "A", role: "server" }],
      unresolvedCount: 0,
    },
  ],
};

const renderModal = (extra = {}) => {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    config: baseConfig,
    onConfigChange: vi.fn(),
    requiredRoleOptions: [{ role: "server", label: "Phục vụ" }],
    onGenerate: vi.fn(),
    preview: basePreview,
    selectedShiftKeys: { "2026-05-20|evening": true },
    onToggleShift: vi.fn(),
    onApply: vi.fn(),
    overrideReason: "",
    onOverrideReasonChange: vi.fn(),
    overrideConfirmed: false,
    onOverrideConfirmedChange: vi.fn(),
    overrideError: "",
    overrideSummary: {
      requiresOverride: false,
      warningAssignments: [],
      cleanAssignments: 1,
      unresolvedPositions: 0,
    },
    ...extra,
  };
  render(<AutoScheduleModal {...props} />);
  return props;
};

const findApplyButton = () =>
  screen.findByRole("button", {
    name: /(?:Xác nhận áp dụng|Áp dụng)\s+1\s+ca/i,
  });

describe("AutoScheduleModal override flow", () => {
  it("enables apply for clean assignment without override reason", async () => {
    renderModal();
    const applyBtn = await findApplyButton();
    expect(applyBtn).toBeEnabled();
  });

  it("shows warning panel and disables apply when override required but reason empty", async () => {
    renderModal({
      overrideSummary: {
        requiresOverride: true,
        warningAssignments: [{ staffId: "s1" }],
        cleanAssignments: 0,
        unresolvedPositions: 0,
      },
    });

    expect(
      await screen.findByText(
        /(?:Có phân công cần ghi đè cảnh báo|Cần xác nhận ghi đè cảnh báo)/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Lý do ghi đè")).toBeInTheDocument();

    const applyBtn = await findApplyButton();
    expect(applyBtn).toBeDisabled();
  });

  it("enables apply when override reason is long enough and confirmed", async () => {
    const onApply = vi.fn();
    renderModal({
      onApply,
      overrideReason: "Đã xác nhận đủ người hỗ trợ ca này",
      overrideConfirmed: true,
      overrideSummary: {
        requiresOverride: true,
        warningAssignments: [{ staffId: "s1" }],
        cleanAssignments: 0,
        unresolvedPositions: 0,
      },
    });

    const applyBtn = await findApplyButton();
    expect(applyBtn).toBeEnabled();
    fireEvent.click(applyBtn);
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        overrideConfirmed: true,
      }),
    );
  });
});
