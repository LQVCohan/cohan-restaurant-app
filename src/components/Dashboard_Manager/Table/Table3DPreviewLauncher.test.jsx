import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import Table3DPreviewLauncher from "./Table3DPreviewLauncher";

vi.mock("./Table3DSimulatorModalV2", () => ({
  default: ({ open, restaurantId, restaurantName }) =>
    open ? (
      <div role="dialog">
        Preview {restaurantName} ({restaurantId})
      </div>
    ) : null,
}));

describe("Table3DPreviewLauncher", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  it("adds the manager header action and opens the global preview modal", async () => {
    render(
      <MemoryRouter initialEntries={["/manager#tables"]}>
        <AuthContext.Provider
          value={{
            restaurants: [{ id: "restaurant-1", name: "Cơ sở trung tâm" }],
          }}
        >
          <div className="manager-layout--tables">
            <div className="tm-container">
              <div className="mph-controls-row" />
            </div>
          </div>
          <Table3DPreviewLauncher />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const previewButton = await screen.findByRole("button", {
      name: "Xem thử bàn 3D và AR",
    });
    expect(previewButton).toHaveTextContent("Xem thử bàn");

    fireEvent.click(previewButton);

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Preview Cơ sở trung tâm (restaurant-1)",
    );
  });

  it("tracks the shared manager restaurant selection", async () => {
    render(
      <MemoryRouter initialEntries={["/manager#tables"]}>
        <AuthContext.Provider
          value={{
            restaurants: [
              { id: "restaurant-1", name: "Cơ sở trung tâm" },
              { id: "restaurant-2", name: "Cơ sở quận 2" },
            ],
          }}
        >
          <div className="manager-layout--tables">
            <div className="tm-container">
              <div className="mph-controls-row" />
            </div>
          </div>
          <Table3DPreviewLauncher />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: "Xem thử bàn 3D và AR" });
    window.dispatchEvent(
      new CustomEvent("manager:scope-selection", {
        detail: {
          key: "manager.selectedRestaurantId",
          value: "restaurant-2",
        },
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Xem thử bàn 3D và AR" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toHaveTextContent(
        "Preview Cơ sở quận 2 (restaurant-2)",
      );
    });
  });
});
