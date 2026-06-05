import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import Header from "./Header";

vi.mock("../SearchBox/SearchBox", () => ({
  default: () => <div data-testid="search-box" />,
}));

const renderHeader = (avatar) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          user: {
            fullName: "Admin User",
            roleName: "admin",
            email: "admin@example.com",
            avatar,
          },
          logout: vi.fn(),
        }}
      >
        <Header />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("manager Header avatar", () => {
  it("renders slash-prefixed upload avatars as images", () => {
    renderHeader("/uploads/admin.png");

    expect(screen.getByRole("img", { name: "Admin User" })).toHaveAttribute(
      "src",
      "http://localhost:4000/uploads/admin.png",
    );
    expect(screen.queryByText("/uploads/admin.png")).not.toBeInTheDocument();
  });

  it("renders relative upload avatars with an image extension as images", () => {
    renderHeader("uploads/admin.webp");

    expect(screen.getByRole("img", { name: "Admin User" })).toHaveAttribute(
      "src",
      "http://localhost:4000/uploads/admin.webp",
    );
    expect(screen.queryByText("uploads/admin.webp")).not.toBeInTheDocument();
  });
});
