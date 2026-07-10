import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SchedulePage from "./SchedulePage";

vi.mock("../../../Schedule/ScheduleManagement", () => ({
  default: ({ readOnly, restaurantId }) => (
    <div
      data-testid="schedule-management"
      data-read-only={String(readOnly)}
      data-restaurant-id={restaurantId}
    />
  ),
}));

describe("SchedulePage", () => {
  it("keeps the embedded schedule scoped to the active staff restaurant", () => {
    render(<SchedulePage restaurantId="restaurant-active" />);

    const schedule = screen.getByTestId("schedule-management");
    expect(schedule).toHaveAttribute("data-read-only", "true");
    expect(schedule).toHaveAttribute(
      "data-restaurant-id",
      "restaurant-active",
    );
  });
});
