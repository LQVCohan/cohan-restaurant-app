import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import AttendancePageScoped from "./AttendancePageScoped";

vi.mock("./AttendancePage", async () => {
  const ReactModule = await import("react");
  const { AuthContext: MockAuthContext } = await import("@/context/AuthContext");

  return {
    default: ({ restaurantId }) => {
      const { user } = ReactModule.useContext(MockAuthContext);
      return (
        <div>
          <span data-testid="attendance-user-id">{user?.id}</span>
          <span data-testid="attendance-user-role">{user?.roleName}</span>
          <span data-testid="attendance-restaurant-scope">
            {restaurantId || "unscoped"}
          </span>
        </div>
      );
    },
  };
});

const renderScopedPage = (restaurantId) =>
  render(
    <AuthContext.Provider
      value={{ user: { id: "manager-1", roleName: "manager" } }}
    >
      <AttendancePageScoped restaurantId={restaurantId} />
    </AuthContext.Provider>,
  );

describe("AttendancePageScoped", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/manager?staffPage=attendance#staff");
  });

  it("provides the selected restaurant before AttendancePage mounts", async () => {
    const restaurantId = "69ce9e2e8d8d711f12e251b1";

    renderScopedPage(restaurantId);

    expect(await screen.findByTestId("attendance-restaurant-scope")).toHaveTextContent(
      restaurantId,
    );
    expect(screen.getByTestId("attendance-user-id")).toHaveTextContent("manager-1");
    expect(screen.getByTestId("attendance-user-role")).toHaveTextContent("manager");
    expect(new URL(window.location.href).searchParams.get("restaurantId")).toBe(
      restaurantId,
    );
  });

  it("does not mount AttendancePage before a restaurant is selected", () => {
    renderScopedPage("");

    expect(screen.queryByTestId("attendance-restaurant-scope")).not.toBeInTheDocument();
  });
});
