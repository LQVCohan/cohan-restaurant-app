import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import AttendancePageScoped from "./AttendancePageScoped";

vi.mock("./AttendancePage", async () => {
  const ReactModule = await import("react");
  const { AuthContext: AttendanceAuthContext } = await import("@/context/AuthContext");

  return {
    default: () => {
      const auth = ReactModule.useContext(AttendanceAuthContext);
      return (
        <div data-testid="attendance-restaurant-scope">
          {auth?.user?.restaurantForStaff || "unscoped"}
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

    render(
      <AuthContext.Provider
        value={{ user: { id: "manager-1", roleName: "manager" } }}
      >
        <AttendancePageScoped restaurantId={restaurantId} />
      </AuthContext.Provider>,
    );

    expect(await screen.findByTestId("attendance-restaurant-scope")).toHaveTextContent(
      restaurantId,
    );
    expect(new URL(window.location.href).searchParams.get("restaurantId")).toBe(
      restaurantId,
    );
  });
});
