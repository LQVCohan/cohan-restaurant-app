import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchBox, {
  expandSearchSource,
  normalizeSearchText,
} from "./SearchBox";

const testItems = [
  {
    id: "bracket",
    title: "Combo [A]+",
    description: "Bracket plus safe",
    category: "Test",
    keywords: ["combo"],
    icon: "🍽️",
  },
  {
    id: "dot",
    title: "Combo. Dot",
    description: "Dot safe",
    category: "Test",
    keywords: ["dot"],
    icon: "🍽️",
  },
  {
    id: "slash",
    title: "Path \\ Menu",
    description: "Backslash safe",
    category: "Test",
    keywords: ["slash"],
    icon: "🍽️",
  },
  {
    id: "paren",
    title: "Deal (A)",
    description: "Parenthesis safe",
    category: "Test",
    keywords: ["paren"],
    icon: "🍽️",
  },
];

const inventoryPage = {
  id: "inventory",
  title: "Quản lý kho",
  description: "Theo dõi tồn kho, nhập xuất và cảnh báo nguyên liệu",
  category: "Điều hướng",
  keywords: ["kho", "inventory"],
  icon: "📦",
  type: "navigation",
};

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/manager#dashboard");
});

describe("SearchBox", () => {
  it("renders a vector search icon instead of an emoji", () => {
    const { container } = render(<SearchBox items={testItems} />);

    expect(container.querySelector("svg.search-icon")).toBeInTheDocument();
    expect(container.querySelector(".search-box")?.textContent).not.toContain("🔍");
  });

  it("does not crash for regex-special queries and returns matching results", () => {
    render(<SearchBox items={testItems} />);

    const input = screen.getByPlaceholderText("Tìm kiếm mọi thứ trong trang...");

    [
      ["[", "Combo [A]+"],
      ["+", "Combo [A]+"],
      [".", "Combo. Dot"],
      ["\\", "Path \\ Menu"],
      ["(A)", "Deal (A)"],
    ].forEach(([query, expectedTitle]) => {
      fireEvent.change(input, { target: { value: query } });
      expect(
        screen.getByText((_, element) => element?.textContent === expectedTitle),
      ).toBeInTheDocument();
    });
  });

  it("keeps highlight behavior and selects the first result with Enter", () => {
    const onSelectItem = vi.fn();
    render(<SearchBox items={[testItems[0]]} onSelectItem={onSelectItem} />);

    const input = screen.getByPlaceholderText("Tìm kiếm mọi thứ trong trang...");
    fireEvent.change(input, { target: { value: "Combo" } });

    expect(document.querySelector(".search-highlight")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelectItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: "bracket" }),
    );
  });

  it("normalizes Vietnamese text and only expands nested items for allowed parents", () => {
    expect(normalizeSearchText("Công thức Định lượng")).toBe(
      "cong thuc dinh luong",
    );

    const allowed = expandSearchSource([inventoryPage]);
    expect(allowed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "inventory:recipes", page: "inventory" }),
      ]),
    );
    expect(allowed.some((item) => item.page === "transactions")).toBe(false);
    expect(expandSearchSource([])).toEqual([]);
  });

  it("finds a nested function without diacritics and opens its exact manager path", () => {
    const onSelectItem = vi.fn();
    const navigateListener = vi.fn();
    localStorage.setItem("manager.selectedRestaurantId", "restaurant-2");
    window.addEventListener("manager:navigate", navigateListener);

    render(<SearchBox items={[inventoryPage]} onSelectItem={onSelectItem} />);
    const input = screen.getByPlaceholderText("Tìm kiếm mọi thứ trong trang...");
    fireEvent.change(input, { target: { value: "kho cong thuc" } });

    expect(screen.getByText("Công thức")).toBeInTheDocument();
    expect(screen.getByText("Kho hàng › Công thức")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Công thức"));

    expect(onSelectItem).not.toHaveBeenCalled();
    expect(navigateListener).toHaveBeenCalledTimes(1);
    expect(navigateListener.mock.calls[0][0].detail).toEqual({
      page: "inventory",
      query: { tab: "recipes", restaurantId: "restaurant-2" },
      source: "manager-search",
    });

    window.removeEventListener("manager:navigate", navigateListener);
  });

  it("does not fall back to unscoped default items when an empty custom list is supplied", () => {
    render(<SearchBox items={[]} />);
    fireEvent.change(
      screen.getByPlaceholderText("Tìm kiếm mọi thứ trong trang..."),
      { target: { value: "Dashboard" } },
    );

    expect(screen.getByText(/Không tìm thấy kết quả/)).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
