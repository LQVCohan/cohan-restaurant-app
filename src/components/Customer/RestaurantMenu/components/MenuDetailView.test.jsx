import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@apollo/client";
import { AuthContext } from "../../../../context/AuthContext";
import MenuDetailView from "./MenuDetailView";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

vi.mock("../../../../hooks/useFoodPreferences", () => ({
  default: () => ({ preferences: null }),
}));

vi.mock("../../../../hooks/useActiveMenuPromotions", () => ({
  useActiveMenuPromotions: () => ({
    getPromotionForMenuItem: () => null,
    getPromotionLabel: () => "",
  }),
}));

const renderMenu = (props = {}) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ isAuthenticated: false }}>
        <MenuDetailView
          restaurant={{
            id: "restaurant-1",
            name: "Cohan Test",
            canOrder: true,
            openingStatus: "open",
          }}
          canOrder
          initialTimeSlot="breakfast"
          onBack={vi.fn()}
          onOpenFoodDetail={vi.fn()}
          {...props}
        />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("customer MenuDetailView time-slot boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQuery.mockImplementation((_query, options = {}) => {
      if (options.variables?.filter) {
        return {
          data: {
            menuItemsConnection: {
              edges: [],
              pageInfo: { endCursor: null, hasNextPage: false },
            },
          },
          loading: false,
          error: null,
          fetchMore: vi.fn(),
          refetch: vi.fn(),
        };
      }

      return {
        data: { customerMenuCategories: [] },
        loading: false,
        error: null,
      };
    });
  });

  it("allows normal remote ordering to switch meal periods", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "Bữa trưa" }));

    expect(
      screen.queryByText("Món không thuộc khung giờ đặt bàn."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bữa trưa" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps a booking add-on locked to the reservation meal period", () => {
    renderMenu({ lockedTimeSlot: "breakfast" });

    fireEvent.click(screen.getByRole("button", { name: "Bữa tối" }));

    expect(
      screen.getByText("Món không thuộc khung giờ đặt bàn."),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Lịch của bạn dùng thực đơn Bữa sáng",
    );
  });
});
