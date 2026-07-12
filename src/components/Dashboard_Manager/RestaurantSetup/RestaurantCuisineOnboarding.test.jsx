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
    menuCount: 4,
    timeSlotCount: 3,
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
    menus: [
      {
        key: "vietnamese:menu:breakfast",
        name: "Thực đơn buổi sáng",
        timeSlot: "breakfast",
        dishCount: 1,
        dishNames: ["Phở bò"],
      },
      {
        key: "vietnamese:menu:lunch",
        name: "Cơm và bún buổi trưa",
        timeSlot: "lunch",
        dishCount: 2,
        dishNames: ["Cơm gà", "Bún thịt nướng"],
      },
      {
        key: "vietnamese:menu:dinner-family",
        name: "Mâm cơm gia đình",
        timeSlot: "dinner",
        dishCount: 2,
        dishNames: ["Cơm thịt kho trứng", "Trứng chiên cơm trắng"],
      },
      {
        key: "vietnamese:menu:dinner-light",
        name: "Món chay và nhẹ",
        timeSlot: "dinner",
        dishCount: 1,
        dishNames: ["Đậu hũ sốt hành"],
      },
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
    timeSlotCount: 3,
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
    menus: [
      {
        key: "korean:menu:lunch",
        name: "Thực đơn buổi trưa",
        timeSlot: "lunch",
        dishCount: 3,
        dishNames: ["Cơm trộn Bibimbap", "Canh kimchi đậu hũ", "Cơm cuộn rong biển"],
      },
      {
        key: "korean:menu:dinner",
        name: "Thực đơn buổi tối",
        timeSlot: "dinner",
        dishCount: 2,
        dishNames: ["Bò Bulgogi", "Gà sốt cay Hàn Quốc"],
      },
      {
        key: "korean:menu:late_night",
        name: "Thực đơn ăn khuya",
        timeSlot: "late_night",
        dishCount: 1,
        dishNames: ["Đậu hũ sốt cay"],
      },
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
          initialSetup: {
            status: "completed",
            templateKey: "korean",
            templateVersion: 1,
          },
        },
      },
    },
  });
  skipMock.mockResolvedValue({
    data: {
      skipRestaurantCuisineSetup: {
        id: "r1",
        initialSetup: { status: "skipped" },
      },
    },
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
        restaurant={{
          id: "r1",
          name: "Cohan Quận 1",
          initialSetup: { status: "completed" },
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows menu counts and groups multiple menus inside one service time", () => {
    render(
      <RestaurantCuisineOnboarding
        restaurant={{
          id: "r1",
          name: "Cohan Quận 1",
          initialSetup: { status: "pending" },
        }}
      />,
    );

    const querySource = operationSource(useQuery.mock.calls[0][0]);
    expect(querySource).toContain("timeSlotCount");
    expect(querySource).toContain("menus");
    expect(querySource).toContain("dishNames");

    const firstCard = document.body.querySelectorAll(".cuisine-template-card")[0];
    expect(firstCard).toHaveTextContent("4Thực đơn");
    expect(firstCard).toHaveTextContent("6Món");
    expect(firstCard).toHaveTextContent("10Nguyên liệu");
    expect(firstCard).toHaveTextContent("6Công thức");
    expect(firstCard).toHaveTextContent("3 mốc giờ phục vụ");

    const summaryText = within(firstCard).getByText("Xem cấu trúc 4 thực đơn");
    const summary = summaryText.closest("summary");
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");

    fireEvent.click(summary);
    expect(details).toHaveAttribute("open");
    expect(within(details).getByText("Bữa tối")).toBeInTheDocument();
    expect(within(details).getByText("2 menu")).toBeInTheDocument();
    expect(within(details).getByText("Mâm cơm gia đình")).toBeInTheDocument();
    expect(within(details).getByText("Món chay và nhẹ")).toBeInTheDocument();
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
    expect(
      screen.queryByRole("dialog", { name: /chọn mô hình ẩm thực/i }),
    ).not.toBeInTheDocument();

    rerender(
      <RestaurantCuisineOnboarding restaurant={restaurant} openRequest={1} />,
    );
    expect(
      screen.getByRole("dialog", { name: /chọn mô hình ẩm thực/i }),
    ).toBeInTheDocument();
  });

  it("selects and applies a cuisine package", async () => {
    const { container } = render(
      <RestaurantCuisineOnboarding
        restaurant={{
          id: "r1",
          name: "Cohan Quận 1",
          initialSetup: { status: "pending" },
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(document.body.querySelector(".cuisine-onboarding")).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: /chọn mô hình ẩm thực/i }),
    ).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]);
    fireEvent.click(screen.getByRole("button", { name: /thiết lập nhà hàng/i }));

    await waitFor(() => {
      expect(applyMock).toHaveBeenCalledWith({
        variables: { restaurantId: "r1", templateKey: "korean" },
      });
    });
    expect(message.success).toHaveBeenCalledWith(
      "Đã tạo 6 món trong 3 thực đơn mẫu cho Cohan Quận 1",
    );
  });
});
