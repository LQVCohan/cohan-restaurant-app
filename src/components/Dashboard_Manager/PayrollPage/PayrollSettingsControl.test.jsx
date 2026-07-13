import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "@apollo/client";
import PayrollSettingsControl, {
  formatSavedPayrollValue,
} from "./PayrollSettingsControl";

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings.join(""),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

describe("PayrollSettingsControl saved values", () => {
  it("formats saved currency values in Vietnamese", () => {
    expect(formatSavedPayrollValue(8000, "đ/phút")).toBe("8.000 đ/phút");
  });

  it("keeps the saved value visible while the manager edits a draft", () => {
    useQuery.mockReturnValue({
      data: {
        payrollSettings: {
          standardWorkDaysPerMonth: 26,
          standardHoursPerDay: 8,
          latenessPenaltyPerMinute: 8000,
          earlyLeavePenaltyPerMinute: 5000,
          nightShiftStart: "22:00",
          nightShiftEnd: "06:00",
        },
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useMutation.mockReturnValue([vi.fn()]);

    render(
      <PayrollSettingsControl
        restaurantId="restaurant-1"
        restaurantName="Cohan"
        actor={{ roleName: "manager" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mở cấu hình" }));

    expect(screen.getByText("Hiện tại: 8.000 đ/phút")).toBeInTheDocument();
    const lateInput = screen.getByText("Trừ đi muộn").closest("label").querySelector("input");
    fireEvent.change(lateInput, { target: { value: "9000" } });
    expect(lateInput).toHaveValue(9000);
    expect(screen.getByText("Hiện tại: 8.000 đ/phút")).toBeInTheDocument();
  });
});
