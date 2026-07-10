import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AvailabilitySnapshotModal from "./AvailabilitySnapshotModal";

describe("AvailabilitySnapshotModal portal", () => {
  it("renders the dialog directly under document.body so manager layout containers cannot clip it", () => {
    const { container } = render(
      <AvailabilitySnapshotModal
        isOpen
        onClose={() => {}}
        weekStart={new Date("2026-07-06T00:00:00.000Z")}
        weekEnd={new Date("2026-07-12T23:59:59.999Z")}
        availabilityWindows={[]}
        availabilitySubmissions={[]}
        staffList={[]}
        shiftTemplates={[]}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.parentElement).toBe(document.body);
    expect(container).not.toContainElement(dialog);
  });
});
