import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import StaffSettingsPage from "./StaffSettingsPage";

const renderSettings = (user) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, restaurants: [], logout: () => {} }}>
        <StaffSettingsPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("StaffSettingsPage recovery navigation", () => {
  it("always offers Home and gives manager accounts an explicit manager exit", () => {
    renderSettings({ id: "manager-1", fullName: "Quản lý", roleName: "manager" });

    expect(screen.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByRole("link", { name: "Về trang quản lý" }),
    ).toHaveAttribute("href", "/manager#dashboard");
  });

  it("does not expose the manager workspace to operational staff", () => {
    renderSettings({ id: "staff-1", fullName: "Nhân viên", roleName: "server" });

    expect(screen.getByRole("link", { name: "Về trang chủ" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Về trang quản lý" }),
    ).not.toBeInTheDocument();
  });
});
