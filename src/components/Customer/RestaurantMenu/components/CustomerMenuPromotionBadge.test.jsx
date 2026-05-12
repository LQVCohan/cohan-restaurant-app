import fs from "node:fs";
import path from "node:path";
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveMenuPromotions } from "../../../../hooks/useActiveMenuPromotions";
import MenuDetailView from "./MenuDetailView";
import MenuItemCard from "./MenuItemCard";

vi.mock("../../../../hooks/useActiveMenuPromotions", () => ({
  useActiveMenuPromotions: vi.fn(),
}));

const readRepoFile = (relativePath) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("Customer menu promotion badge wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps MenuDetailView wired to useActiveMenuPromotions and renders promotion badge content", () => {
    const menuDetailViewSource = readRepoFile(
      "src/components/Customer/RestaurantMenu/components/MenuDetailView.jsx",
    );

    expect(menuDetailViewSource).toContain("useActiveMenuPromotions");
    expect(menuDetailViewSource).toContain("promotionLabel");

    useActiveMenuPromotions.mockReturnValue({
      promotions: [],
      promotionByItemId: {},
      promotionByCategoryId: {},
      getPromotionForMenuItem: (item) =>
        item?.id === "lunch_02" ? { name: "Ưu đãi mùa hè" } : null,
      getPromotionLabel: (promotion) => (promotion ? "-5%" : ""),
      loading: false,
      error: null,
    });

    render(
      <MenuDetailView
        restaurant={{ id: "res_01", name: "Cơm Niêu Sài Gòn" }}
        onBack={vi.fn()}
        onOpenFoodDetail={vi.fn()}
      />,
    );

    expect(useActiveMenuPromotions).toHaveBeenCalledWith("res_01");
    expect(screen.getByText("-5%")).toBeInTheDocument();
    expect(screen.getByText("Ưu đãi mùa hè")).toBeInTheDocument();
  });

  it("renders promotion label and promotion name in MenuItemCard", () => {
    render(
      <MenuItemCard
        item={{
          id: "item-1",
          name: "Kem dừa",
          description: "Kem dừa mát lạnh",
          basePrice: 45000,
          thumbImage: "https://example.com/kem-dua.jpg",
          status: "active",
          servingVariants: [],
          promotionLabel: "-5%",
          promotion: { name: "Ưu đãi mùa hè" },
        }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("-5%")).toBeInTheDocument();
    expect(screen.getByText("Ưu đãi mùa hè")).toBeInTheDocument();
  });

  it("keeps promo badge and promo name selectors in SCSS", () => {
    const scssSource = readRepoFile(
      "src/components/Customer/RestaurantMenu/styles/MenuItemCard.scss",
    );

    expect(scssSource).toContain(".menu-item-card__promo-badge");
    expect(scssSource).toContain(".menu-item-card__promo-name");
  });
});
