import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchPage from "./SearchPage";

const useSearchMock = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useSearch", () => ({
  useSearch: useSearchMock,
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="pathname">{location.pathname}</div>
      <div data-testid="query-string">{location.search}</div>
    </>
  );
}

describe("SearchPage", () => {
  beforeEach(() => {
    useSearchMock.mockReturnValue({
      loading: false,
      results: {
        totalCount: 1,
        items: [
          {
            type: "MENU_ITEM",
            score: 4.5,
            timeSlot: "dinner",
            categoryName: "Hải sản",
            servingLabel: "Phần 2 người",
            cookingMethods: ["Nướng"],
            restaurant: {
              id: "restaurant-1",
              name: "Cohan Restaurant",
              avgRating: 4.8,
              address: { district: "Quận 1", city: "TP.HCM" },
            },
            menuItem: {
              id: "menu-item-1",
              name: "Cá nướng",
              basePrice: 180000,
              thumbImage: null,
            },
          },
        ],
      },
    });
  });

  it("shows catalog metadata and opens the dish in its restaurant", () => {
    render(
      <MemoryRouter initialEntries={["/search?q=n%C6%B0%E1%BB%9Bng"]}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Hải sản")).toBeInTheDocument();
    expect(screen.getByText("Phần 2 người · Nướng")).toBeInTheDocument();
    expect(screen.getByText("Cohan Restaurant")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("heading", { name: "Cá nướng" }).closest("article"));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/cus-menu");
    const params = new URLSearchParams(
      screen.getByTestId("query-string").textContent,
    );
    expect(params.get("restaurantId")).toBe("restaurant-1");
    expect(params.get("menuItemId")).toBe("menu-item-1");
  });
});
