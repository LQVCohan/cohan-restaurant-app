import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import MobileHome from "./MobileHome";

vi.mock("./components/Categories", () => ({
  default: () => <div data-testid="categories" />,
}));

vi.mock("./components/RestaurantGrid", () => ({
  default: () => <div data-testid="restaurant-grid" />,
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

describe("MobileHome search", () => {
  it("opens the shared search page instead of filtering only restaurants", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<MobileHome />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: /tìm nhà hàng hoặc món ăn/i }),
      { target: { value: "Cá nướng" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Tìm" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/search");
    expect(new URLSearchParams(screen.getByTestId("query-string").textContent).get("q")).toBe("Cá nướng");
  });
});
