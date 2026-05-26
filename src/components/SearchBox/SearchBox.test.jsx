import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SearchBox from "./SearchBox";

const items = [
  { id: "1", title: "A.B", description: "Contains literal dot.", category: "Test", keywords: ["a.b"], icon: "•" },
  { id: "2", title: "Array [value]", description: "Brackets [ ] text", category: "Test", keywords: ["[value]"], icon: "•" },
  { id: "3", title: "Question?", description: "Has a ? mark?", category: "Test", keywords: ["question?"], icon: "•" },
  { id: "4", title: "Hello world", description: "Normal text search still works", category: "Test", keywords: ["hello"], icon: "•" },
];

describe("SearchBox highlighting escapes regex chars", () => {
  it("searchQuery '.' highlights literal dots only", () => {
    const { container } = render(<SearchBox items={items} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "." } });

    const highlights = container.querySelectorAll(".search-highlight");
    expect(highlights.length).toBeGreaterThan(0);
    highlights.forEach((node) => expect(node.textContent).toBe("."));
  });

  it("searchQuery '[' does not throw", () => {
    render(<SearchBox items={items} />);
    expect(() => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "[" } });
    }).not.toThrow();
  });

  it("searchQuery '?' highlights literal question marks only", () => {
    const { container } = render(<SearchBox items={items} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "?" } });

    const highlights = container.querySelectorAll(".search-highlight");
    expect(highlights.length).toBeGreaterThan(0);
    highlights.forEach((node) => expect(node.textContent).toBe("?"));
  });

  it("normal text search still works", () => {
    render(<SearchBox items={items} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });
    expect(screen.getByText(/Hello/i)).toBeInTheDocument();
  });
});
