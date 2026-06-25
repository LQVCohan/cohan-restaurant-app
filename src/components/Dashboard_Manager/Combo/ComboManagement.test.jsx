import React from "react";
import { render, screen } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { describe, expect, it, vi } from "vitest";
import ComboManagement from "./ComboManagement";

vi.mock("@/hooks/useManagerRestaurantSelection", () => ({ default: () => ({ selectedRestaurantId: "r1", restaurantOptions: [{ id: "r1", name: "Cohan" }], setSelectedRestaurantId: vi.fn(), hasRestaurants: true }) }));
vi.mock("@/hooks/useNotification", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));

describe("ComboManagement", () => {
  it("renders manager combo heading and create action", async () => {
    render(<MockedProvider mocks={[]} addTypename={false}><ComboManagement /></MockedProvider>);
    expect(screen.getByRole("heading", { name: "Quản lý combo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo combo" })).toBeInTheDocument();
  });
});
