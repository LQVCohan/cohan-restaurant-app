import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { describe, expect, it, vi } from "vitest";
import ComboManagement from "./ComboManagement";

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal();
  const TestIcon = (props) => <svg aria-hidden="true" {...props} />;
  return {
    ...actual,
    BadgeDollarSign: actual.BadgeDollarSign || actual.DollarSign || TestIcon,
  };
});

vi.mock("@/hooks/useManagerRestaurantSelection", () => ({
  default: () => ({
    selectedRestaurantId: "r1",
    restaurantOptions: [{ id: "r1", name: "Cohan" }],
    setSelectedRestaurantId: vi.fn(),
    hasRestaurants: true,
  }),
}));

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

const renderPage = () =>
  render(
    <MockedProvider mocks={[]} addTypename={false}>
      <ComboManagement />
    </MockedProvider>,
  );

describe("ComboManagement", () => {
  it("renders manager combo heading and create action", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Quản lý combo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tạo combo" }),
    ).toBeInTheDocument();
  });

  it("opens create modal when clicking create combo", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Tạo combo" }));

    expect(
      screen.getByRole("dialog", { name: "Tạo combo" }),
    ).toBeInTheDocument();
  });

  it("closes the create modal with Escape", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Tạo combo" }));
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Tạo combo" }),
      ).not.toBeInTheDocument();
    });
  });
});
