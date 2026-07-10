import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    recipeCount: 6,
    dishNames: [
      "Phở bò",
      "Cơm gà",
      "Bún thịt nướng",
      "Cơm thịt kho trứng",
      "Đậu hũ sốt hành",
      "Trứng chiên cơm trắng",
    ],
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
    recipeCount: 6,
    dishNames: [
      "Cơm trộn Bibimbap",
      "Canh kimchi đậu hũ",
      "Bò Bulgogi",
      "Gà sốt cay Hàn Quốc",
      "Cơm cuộn rong biển",
      "Đậu hũ sốt cay",
    ],
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

  it("shows backend counts and the complete dish list in a native disclosure", () => {
    render(
      <RestaurantCuisineOnboarding
        restaurant={{ id: "r1", name: "Cohan Quận 1", initialSetup: { status: "pending" } }}
      />,
    );

    const querySource = operationSource(useQuery.mock.calls[0][0]);
    expect(querySource).toContain("recipeCount");
    expect(querySource).toContain("dishNames");

    const firstCard = document.body.querySelectorAll(".cuisine-template-card")[0];
    expect(firstCard).toHaveTextContent("6Món");
    expect(firstCard).toHaveTextContent("10Nguyên liệu");
    expect(firstCard).toHaveTextContent("6Công thức");

    const summaryText = within(firstCard).getByText("Xem 6 món sẽ được tạo");
    const summary = summaryText.closest("summary");
    const details = summary.closest("details");
    expect(summary).toBeInTheDocument();
    expect(details).not.toHaveAttribute("open");

    fireEvent.click(summary);
    expect(details).toHaveAttribute("open");
    templates[0].dishNames.forEach((dishName) => {
      expect(within(details).getByText(dishName)).toBeInTheDocument();
    });
    expect(screen.getAllByRole("radio")[0]).toBeChecked();
  });

  it("reopens after being dismissed when the parent sends a new request", () => {
    const restaurant = {
      id: "r1",
      name: "Cohan Quận 1",
      initialSetup: { status: "pending" },
    };
    const { rerender } = render(
      <RestaurantCuisineOnboarding restaurant={restaurant} openRequest={0} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Để sau" })[0]);
    expect(screen.queryByRole("dialog", { name: /chọn mô hình ẩm thực/i })).not.toBeInTheDocument();

    rerender(<RestaurantCuisineOnboarding restaurant={restaurant} openRequest={1} />);
    expect(screen.getByRole("dialog", { name: /chọn mô hình ẩm thực/i })).toBeInTheDocument();
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
