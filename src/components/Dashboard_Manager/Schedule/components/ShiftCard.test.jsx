import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShiftCard, {
  getEmploymentMixMeta,
  getShiftDurationMeta,
} from "./ShiftCard";

const baseShift = {
  id: "shift-1",
  startTime: "11:00",
  endTime: "15:00",
  staffIds: [],
  essentialJobs: ["server"],
};

describe("ShiftCard", () => {
  it("labels duration without guessing the employee contract type", () => {
    const onClick = vi.fn();
    render(<ShiftCard shift={baseShift} staffList={[]} onClick={onClick} />);

    expect(screen.getByText("Ca 4 giờ")).toBeInTheDocument();
    expect(screen.queryByText(/bán thời gian/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(baseShift);
  });

  it("shows actual full-time and part-time assignments independently of duration", () => {
    render(
      <ShiftCard
        shift={{
          ...baseShift,
          startTime: "07:00",
          endTime: "15:00",
          staffIds: ["staff-full", "staff-part"],
        }}
        staffList={[
          { id: "staff-full", name: "An", job: "server", employmentType: "FULL_TIME" },
          { id: "staff-part", name: "Bình", job: "server", employmentType: "part-time" },
        ]}
        onClick={() => {}}
      />,
    );

    expect(screen.getByText("Ca 8 giờ")).toBeInTheDocument();
    expect(screen.getByText("1 toàn thời gian")).toBeInTheDocument();
    expect(screen.getByText("1 bán thời gian")).toBeInTheDocument();
  });

  it("calculates overnight duration without changing schedule data", () => {
    expect(getShiftDurationMeta("22:00", "02:00")).toEqual({
      tone: "short",
      label: "Ca 4 giờ",
    });
  });

  it("normalizes backend employment-type spellings before counting", () => {
    expect(
      getEmploymentMixMeta([
        { employmentType: "FULL_TIME" },
        { employmentType: "full-time" },
        { employmentType: "part time" },
      ]),
    ).toEqual([
      { type: "full_time", tone: "full-time", count: 2, label: "2 toàn thời gian" },
      { type: "part_time", tone: "part-time", count: 1, label: "1 bán thời gian" },
    ]);
  });
});
