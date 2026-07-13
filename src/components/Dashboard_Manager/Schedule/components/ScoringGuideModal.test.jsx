import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ScoringGuideModal from "./ScoringGuideModal";

describe("ScoringGuideModal", () => {
  it("explains the score in basic language and shows current weights", () => {
    render(
      <ScoringGuideModal
        isOpen
        onClose={vi.fn()}
        weights={{ performance: 0, fatiguePenalty: 35 }}
      />,
    );

    expect(screen.getByText("Cách hệ thống tính điểm")).toBeInTheDocument();
    expect(document.querySelector(".scoring-guide-zero-note")).toHaveTextContent(
      "Đặt một mục bằng 0 nghĩa là bỏ qua mục đó.",
    );
    expect(screen.getByText(/điểm cộng − điểm trừ/i)).toBeInTheDocument();

    const performanceRow = screen.getByText("Hiệu suất").closest("article");
    const fatigueRow = screen
      .getByText("Làm liên tục quá nhiều ngày")
      .closest("article");

    expect(within(performanceRow).getByText("Mức 0")).toBeInTheDocument();
    expect(within(fatigueRow).getByText("Mức 35")).toBeInTheDocument();
  });

  it("closes from the confirmation button", () => {
    const onClose = vi.fn();

    render(<ScoringGuideModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Đã hiểu" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
