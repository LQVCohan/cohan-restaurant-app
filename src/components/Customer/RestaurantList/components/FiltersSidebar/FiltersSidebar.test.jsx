import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FiltersSidebar from "./FiltersSidebar";

describe("FiltersSidebar mobile sheet", () => {
  it("opens, reports active filters, and closes with Escape", () => {
    render(
      <FiltersSidebar
        filters={{
          districts: ["Quận 1"],
          cuisines: ["Việt Nam"],
          ratings: [],
          priceRanges: [],
        }}
        onFilterChange={vi.fn()}
        onClearFilters={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /^bộ lọc/i });
    expect(trigger).toHaveTextContent("2");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });
});
