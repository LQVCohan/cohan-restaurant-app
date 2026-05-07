import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AvailabilitySnapshotModal from "./AvailabilitySnapshotModal";

const weekStart = new Date("2026-05-25T00:00:00.000Z");
const weekEnd = new Date("2026-05-31T00:00:00.000Z");
const shiftTemplates = { morning: { label: "Ca sáng", startTime: "06:00", endTime: "14:00" } };

describe("AvailabilitySnapshotModal", () => {
  it("shows missing window empty state", () => {
    render(<AvailabilitySnapshotModal isOpen onClose={() => {}} weekStart={weekStart} weekEnd={weekEnd} staffList={[]} availabilityWindows={[]} availabilitySubmissions={[]} shiftTemplates={shiftTemplates} />);
    expect(screen.getByText("Chưa có kỳ availability đã chốt cho tuần này.")).toBeInTheDocument();
  });
});
