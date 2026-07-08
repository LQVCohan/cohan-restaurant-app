import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { message } from "antd";
import { useMutation, useQuery } from "@apollo/client/react";
import RestaurantCuisineOnboarding from "./RestaurantCuisineOnboarding";

vi.mock("antd", () => ({
  message: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@apollo/client/react", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@/hooks/useBrandManagement", () => ({
  MY_BRANDS_QUERY: {},
}));

const templates = [
  {
    key: "vietnamese",
    version: 1,
    name: "Ẩm thực Việt Nam",
    cuisineType: "Việt Nam",
    description: "Món Việt quen thuộc.",
    ingredientCount: 10,
    menuCount: 3,
    menuItemCount: 6,
    featuredItems: ["Phở bò", "Cơm gà"],
  },
  {
    key: "korean",
    version: 1,
    name: "Ẩm thực Hàn Quốc",
    cuisineType: "Hàn Quốc",
    description: "Món Hàn đậm vị.",
    ingredientCount: 10,
    menuCount: 3,
    menuItemCount: 6,
    featuredItems: ["Bibimbap", "Bulgogi"],
  },
];

const applyMock = vi.fn();
const skipMock = vi.fn();

const operationSource = (operation) =>
  String(operation?.loc?.source?.body || operation || "");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    callback();
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());

  useQuery.mockReturnValue({
    data: { restaurantCuisineTemplates: templates },
    loading: false,
    error: null,
  });
  applyMock.mockResolvedValue({
    data: {
      applyRestaurantCuisineTemplate: {
        success: true,
        ingredientCount: 10,
        menuCount: 3,
        menuItemCount: 6,
        warnings: [],
        restaurant: {
          id: "r1",
          name: "Cohan Quận 1",
          cuisineType: "Hàn Quốc",
          publicationStatus: "draft",
          initialSetup: { status: "completed", templateKey: "korean", templateVersion: 1 },
        },
      },
    },
  });
  skipMock.mockResolvedValue({
    data: { skipRestaurantCuisineSetup: { id: "r1", initialSetup: { status: "skipped" } } },
  });

  useMutation.mockImplementation((operation) => {
    const source = operationSource(operation);
    if (source.includes("ApplyRestaurantCuisineTemplate")) {
      return [applyMock, { loading: false }];
    }
    if (source.includes("SkipRestaurantCuisineSetup")) {
      return [skipMock, { loading: false }];
    }
    throw new Error(`Unexpected mutation: ${source}`);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RestaurantCuisineOnboarding", () => {
  it("does not open for an already configured restaurant", () => {
    const { container } = render(
      <RestaurantCuisineOnboarding
        restaurant={{ id: "r1", name: "Cohan Quận 1", initialSetup: { status: "completed" } }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("selects and applies a cuisine package", async () => {
    const { container } = render(
      <RestaurantCuisineOnboarding
        restaurant={{ id: "r1", name: "Cohan Quận 1", initialSetup: { status: "pending" } }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(document.body.querySelector(".cuisine-onboarding")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /chọn mô hình ẩm thực/i })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]);
    fireEvent.click(screen.getByRole("button", { name: /thiết lập nhà hàng/i }));

    await waitFor(() => {
      expect(applyMock).toHaveBeenCalledWith({
        variables: { restaurantId: "r1", templateKey: "korean" },
      });
    });
    expect(message.success).toHaveBeenCalledWith("Đã tạo 6 món mẫu cho Cohan Quận 1");
  });
});
