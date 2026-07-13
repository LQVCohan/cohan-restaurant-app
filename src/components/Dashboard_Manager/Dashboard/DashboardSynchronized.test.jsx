import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import DashboardSynchronized from "./DashboardSynchronized";

vi.mock("./Dashboard", () => ({
  default: ({ staffRoster }) => (
    <main data-testid="dashboard-composition">
      <aside className="dashboard-side-stack">{staffRoster}</aside>
    </main>
  ),
}));

vi.mock("./components/DashboardStaffRoster", () => ({
  default: ({ restaurantId }) => (
    <section data-testid="dashboard-staff-roster">{restaurantId}</section>
  ),
}));

describe("DashboardSynchronized layout composition", () => {
  it("renders the roster as a stable dashboard child without a portal mount", async () => {
    render(
      <AuthContext.Provider
        value={{ restaurants: [{ id: "restaurant-1", name: "Cohan" }] }}
      >
        <DashboardSynchronized />
      </AuthContext.Provider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("dashboard-staff-roster")).toHaveTextContent(
        "restaurant-1",
      ),
    );
    expect(
      screen.getByTestId("dashboard-composition").querySelector(
        ".dashboard-side-stack > [data-testid='dashboard-staff-roster']",
      ),
    ).not.toBeNull();
    expect(document.querySelector(".dashboard-staff-roster-portal-slot")).toBeNull();
  });
});
