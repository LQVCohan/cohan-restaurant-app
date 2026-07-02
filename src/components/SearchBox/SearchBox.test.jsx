import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SearchBox from "./SearchBox";

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

describe("SearchBox regex-safe highlighting", () => {
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
        screen.getByText((_, element) => element?.textContent === expectedTitle)
      ).toBeInTheDocument();
    });
  });

  it("keeps highlight behavior for normal query and onSelectItem", () => {
    const onSelectItem = vi.fn();
    render(<SearchBox items={[testItems[0]]} onSelectItem={onSelectItem} />);

    const input = screen.getByPlaceholderText("Tìm kiếm mọi thứ trong trang...");
    fireEvent.change(input, { target: { value: "Combo" } });

    expect(document.querySelector(".search-highlight")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelectItem).toHaveBeenCalledTimes(1);
    expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ id: "bracket" }));
  });
});
