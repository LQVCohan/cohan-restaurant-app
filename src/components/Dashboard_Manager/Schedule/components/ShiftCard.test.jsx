import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShiftCard, { getShiftDurationMeta } from "./ShiftCard";

const baseShift = {
  id: "shift-1",
  startTime: "11:00",
  endTime: "15:00",
  staffIds: [],
  essentialJobs: ["server"],
};

describe("ShiftCard", () => {
  it("labels a four-hour shift as part-time and keeps the card actionable", () => {
    const onClick = vi.fn();
    render(<ShiftCard shift={baseShift} staffList={[]} onClick={onClick} />);

    expect(screen.getByText("Bán thời gian · 4 giờ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(baseShift);
  });

  it("labels an eight-hour shift as full-time", () => {
    render(
      <ShiftCard
        shift={{ ...baseShift, startTime: "07:00", endTime: "15:00" }}
        staffList={[]}
        onClick={() => {}}
      />,
    );

    expect(screen.getByText("Toàn thời gian · 8 giờ")).toBeInTheDocument();
  });

  it("calculates overnight duration without changing schedule data", () => {
    expect(getShiftDurationMeta("22:00", "02:00")).toEqual({
      tone: "part-time",
      label: "Bán thời gian · 4 giờ",
    });
  });
});
