import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AttendancePageScoped from "./AttendancePageScoped";

vi.mock("./AttendancePage", async () => {
  const ReactModule = await import("react");
  const { AttendanceScopeContext } = await import("@/context/AttendanceScopeContext");

  return {
    default: () => {
      const restaurantId = ReactModule.useContext(AttendanceScopeContext);
      return (
        <div data-testid="attendance-restaurant-scope">
          {restaurantId || "unscoped"}
        </div>
      );
    },
  };
});

describe("AttendancePageScoped", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/manager?staffPage=attendance#staff");
  });

  it("provides the selected restaurant before AttendancePage mounts", async () => {
    const restaurantId = "69ce9e2e8d8d711f12e251b1";

    render(<AttendancePageScoped restaurantId={restaurantId} />);

    expect(await screen.findByTestId("attendance-restaurant-scope")).toHaveTextContent(
      restaurantId,
    );
    expect(new URL(window.location.href).searchParams.get("restaurantId")).toBe(
      restaurantId,
    );
  });

  it("does not mount AttendancePage before a restaurant is selected", () => {
    render(<AttendancePageScoped restaurantId="" />);

    expect(screen.queryByTestId("attendance-restaurant-scope")).not.toBeInTheDocument();
  });
});
