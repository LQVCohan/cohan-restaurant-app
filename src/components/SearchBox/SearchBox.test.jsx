import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import SearchBox from "./SearchBox";

const testItems = [
  {
    id: "searchbox-regex-item",
    title: "Combo [A]+",
    description: "Regex safe",
    category: "Test",
    keywords: ["combo"],
    icon: "🍽️",
  },
];

describe("SearchBox regex-safe highlighting", () => {
  it("does not crash for regex-special queries and still returns results", () => {
    render(<SearchBox items={testItems} />);

    const input = screen.getByPlaceholderText("Tìm kiếm mọi thứ trong trang...");

    ["[", "+", ".", "\\", "(A)"] .forEach((query) => {
      fireEvent.change(input, { target: { value: query } });
      expect(screen.getByText("Combo [A]+", { exact: false })).toBeInTheDocument();
    });
  });

  it("keeps highlight behavior for normal query and onSelectItem", () => {
    const onSelectItem = vi.fn();
    render(<SearchBox items={testItems} onSelectItem={onSelectItem} />);

    const input = screen.getByPlaceholderText("Tìm kiếm mọi thứ trong trang...");
    fireEvent.change(input, { target: { value: "Combo" } });

    expect(document.querySelector(".search-highlight")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelectItem).toHaveBeenCalledTimes(1);
    expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ id: "searchbox-regex-item" }));
  });
});
