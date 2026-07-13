import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PromotionModal from "./PromotionModal";

const restaurants = [
  { id: "restaurant-1", name: "Chi nhanh Quan 1" },
  { id: "restaurant-2", name: "Chi nhanh Phu Nhuan" },
];

const categories = [
  { id: "cat-1", name: "Mon chinh" },
  { id: "cat-2", name: "Do uong" },
];

const menuItems = [
  { id: "item-1", name: "Pho bo", categoryId: "cat-1" },
  { id: "item-2", name: "Com tam", categoryId: "cat-1" },
  { id: "item-3", name: "Tra da", categoryId: "cat-2" },
];

describe("PromotionModal", () => {
  it("keeps the portalled dialog labelled and exposes form controls by name", async () => {
    render(
      <PromotionModal
        defaultRestaurantId="restaurant-1"
        onClose={vi.fn()}
        onSave={vi.fn()}
        restaurants={restaurants}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Tạo ưu đãi mới" });
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(screen.getByLabelText(/Tên chương trình/)).toHaveAttribute(
      "name",
      "name",
    );
    expect(screen.getByLabelText(/Nhà hàng áp dụng/)).toHaveValue(
      "restaurant-1",
    );
  });

  it("derives enforceable conditions from configured fields", () => {
    render(
      <PromotionModal
        defaultRestaurantId="restaurant-1"
        onClose={vi.fn()}
        onSave={vi.fn()}
        restaurants={restaurants}
      />,
    );

    fireEvent.change(document.querySelector('input[name="minOrderValue"]'), {
      target: { name: "minOrderValue", value: "200000" },
    });
    fireEvent.change(document.querySelector('select[name="targetAudience"]'), {
      target: { name: "targetAudience", value: "vip" },
    });

    expect(screen.getByText("Đơn hàng tối thiểu 200.000đ")).toBeInTheDocument();
    expect(screen.getByText("Chỉ áp dụng cho nhóm: Khách VIP")).toBeInTheDocument();
    expect(document.querySelector('textarea[name="conditions"]')).not.toBeInTheDocument();
  });

  it("renders restaurant options from props and submits the selected restaurant id", async () => {
    const onSave = vi.fn();

    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={onSave}
        restaurants={restaurants}
      />,
    );

    const restaurantSelect = document.querySelector(
      'select[name="restaurantId"]',
    );

    fireEvent.change(document.querySelector('input[name="name"]'), {
      target: { name: "name", value: "Mung le" },
    });
    fireEvent.change(document.querySelector('input[name="code"]'), {
      target: { name: "code", value: "LE2026" },
    });
    fireEvent.change(document.querySelector('input[name="discountValue"]'), {
      target: { name: "discountValue", value: "15" },
    });
    fireEvent.change(restaurantSelect, {
      target: { name: "restaurantId", value: "restaurant-2" },
    });
    fireEvent.change(document.querySelector('input[name="startDate"]'), {
      target: { name: "startDate", value: "2026-05-01T10:00" },
    });
    fireEvent.change(document.querySelector('input[name="endDate"]'), {
      target: { name: "endDate", value: "2026-05-05T22:00" },
    });

    fireEvent.click(document.querySelector('button[form="promoForm"]'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Mung le",
          code: "LE2026",
          restaurantId: "restaurant-2",
          type: "percentage",
        }),
      );
    });
  });

  it("renders a category filter helper when promotion scope is item", () => {
    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={vi.fn()}
        restaurants={restaurants}
      />,
    );

    fireEvent.change(document.querySelector('select[name="scope"]'), {
      target: { name: "scope", value: "item" },
    });

    expect(screen.getByText("Lọc món theo danh mục")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Chỉ dùng để lọc danh sách món, không lưu thành phạm vi áp dụng.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "-- Tất cả danh mục --" }),
    ).toBeInTheDocument();
  });

  it("renders only one target category select when promotion scope is category", () => {
    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={vi.fn()}
        restaurants={restaurants}
      />,
    );

    fireEvent.change(document.querySelector('select[name="scope"]'), {
      target: { name: "scope", value: "category" },
    });

    expect(screen.getByText(/Danh mục áp dụng/)).toBeInTheDocument();
    expect(screen.queryByText("Lọc món theo danh mục")).not.toBeInTheDocument();
    expect(document.querySelectorAll('select[name="categoryId"]')).toHaveLength(
      1,
    );
  });

  it("forces BOGO promotions to capture both the purchased item and the gifted item", async () => {
    const onSave = vi.fn();

    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={onSave}
        restaurants={restaurants}
      />,
    );

    fireEvent.change(document.querySelector('input[name="name"]'), {
      target: { name: "name", value: "Mua 1 tang 1 pho" },
    });
    fireEvent.change(document.querySelector('input[name="code"]'), {
      target: { name: "code", value: "BOGO-PHO" },
    });
    fireEvent.change(document.querySelector('select[name="type"]'), {
      target: { name: "type", value: "bogo" },
    });
    fireEvent.change(document.querySelector('input[name="startDate"]'), {
      target: { name: "startDate", value: "2026-05-01T10:00" },
    });
    fireEvent.change(document.querySelector('input[name="endDate"]'), {
      target: { name: "endDate", value: "2026-05-05T22:00" },
    });
    fireEvent.change(document.querySelector('select[name="categoryId"]'), {
      target: { name: "categoryId", value: "cat-1" },
    });
    fireEvent.change(document.querySelector('select[name="itemId"]'), {
      target: { name: "itemId", value: "item-1" },
    });
    fireEvent.change(document.querySelector('select[name="giftItemId"]'), {
      target: { name: "giftItemId", value: "item-2" },
    });
    fireEvent.change(document.querySelector('input[name="buyQuantity"]'), {
      target: { name: "buyQuantity", value: "1" },
    });
    fireEvent.change(document.querySelector('input[name="getQuantity"]'), {
      target: { name: "getQuantity", value: "1" },
    });

    fireEvent.click(document.querySelector('button[form="promoForm"]'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "bogo",
          scope: "item",
          itemId: "item-1",
          giftItemId: "item-2",
          productId: "item-2",
          buyQuantity: 1,
          getQuantity: 1,
          discountValue: 0,
        }),
      );
    });
  });

  it("shows helper text when selecting freeship type", () => {
    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={vi.fn()}
        restaurants={restaurants}
      />,
    );

    fireEvent.change(document.querySelector('select[name="type"]'), {
      target: { name: "type", value: "freeship" },
    });

    expect(
      screen.getByText(/hệ thống sẽ giảm trực tiếp phí vận chuyển/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/freeship sẽ không vượt quá giới hạn đó/i),
    ).toBeInTheDocument();
  });

  it("explains how BOGO promotion is applied during payment", () => {
    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={vi.fn()}
        restaurants={restaurants}
      />,
    );

    fireEvent.change(document.querySelector('select[name="type"]'), {
      target: { name: "type", value: "bogo" },
    });

    expect(
      screen.getByText(/hệ thống sẽ giảm tiền trên dòng món tặng/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/bill có 2 món A và 2 món B thì giảm tiền 2 món B/i),
    ).toBeInTheDocument();
  });

  it("shows combo helper text when selecting combo type", () => {
    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={vi.fn()}
        restaurants={restaurants}
      />,
    );

    fireEvent.change(document.querySelector('select[name="type"]'), {
      target: { name: "type", value: "combo" },
    });

    expect(
      screen.getByText(/hệ thống chỉ giảm combo nếu bill có đủ tất cả món/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Số lượt combo được tính theo món có số lượng ít nhất/i),
    ).toBeInTheDocument();
  });

  it("requires at least 2 combo items", async () => {
    const onSave = vi.fn();

    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={onSave}
        restaurants={restaurants}
      />,
    );

    fireEvent.change(document.querySelector('input[name="name"]'), {
      target: { name: "name", value: "Combo pho" },
    });
    fireEvent.change(document.querySelector('input[name="code"]'), {
      target: { name: "code", value: "COMBO-PHO" },
    });
    fireEvent.change(document.querySelector('select[name="type"]'), {
      target: { name: "type", value: "combo" },
    });
    fireEvent.change(document.querySelector('input[name="discountValue"]'), {
      target: { name: "discountValue", value: "10000" },
    });
    fireEvent.change(document.querySelector('input[name="startDate"]'), {
      target: { name: "startDate", value: "2026-05-01T10:00" },
    });
    fireEvent.change(document.querySelector('input[name="endDate"]'), {
      target: { name: "endDate", value: "2026-05-05T22:00" },
    });
    fireEvent.change(screen.getByLabelText("Món combo 1"), {
      target: { value: "item-1" },
    });

    fireEvent.click(document.querySelector('button[form="promoForm"]'));

    expect(await screen.findByText("Combo cần ít nhất 2 món")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("submits comboItems with itemId and quantity", async () => {
    const onSave = vi.fn();

    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={onSave}
        restaurants={restaurants}
      />,
    );

    fireEvent.change(document.querySelector('input[name="name"]'), {
      target: { name: "name", value: "Combo pho tra" },
    });
    fireEvent.change(document.querySelector('input[name="code"]'), {
      target: { name: "code", value: "COMBO-PHO" },
    });
    fireEvent.change(document.querySelector('select[name="type"]'), {
      target: { name: "type", value: "combo" },
    });
    fireEvent.change(document.querySelector('select[name="discountType"]'), {
      target: { name: "discountType", value: "fixed" },
    });
    fireEvent.change(document.querySelector('input[name="discountValue"]'), {
      target: { name: "discountValue", value: "10000" },
    });
    fireEvent.change(document.querySelector('input[name="startDate"]'), {
      target: { name: "startDate", value: "2026-05-01T10:00" },
    });
    fireEvent.change(document.querySelector('input[name="endDate"]'), {
      target: { name: "endDate", value: "2026-05-05T22:00" },
    });
    fireEvent.change(screen.getByLabelText("Món combo 1"), {
      target: { value: "item-1" },
    });
    fireEvent.change(screen.getByLabelText("Số lượng món combo 1"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Món combo 2"), {
      target: { value: "item-3" },
    });
    fireEvent.change(screen.getByLabelText("Số lượng món combo 2"), {
      target: { value: "2" },
    });

    fireEvent.click(document.querySelector('button[form="promoForm"]'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "combo",
          discountType: "fixed",
          comboItems: [
            { itemId: "item-1", quantity: 1 },
            { itemId: "item-3", quantity: 2 },
          ],
        }),
      );
    });
  });

  it("forces combo scope to order and clears gift item", async () => {
    const onSave = vi.fn();

    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={onSave}
        restaurants={restaurants}
      />,
    );

    fireEvent.change(document.querySelector('input[name="name"]'), {
      target: { name: "name", value: "Combo order" },
    });
    fireEvent.change(document.querySelector('input[name="code"]'), {
      target: { name: "code", value: "COMBO-ORDER" },
    });
    fireEvent.change(document.querySelector('select[name="type"]'), {
      target: { name: "type", value: "combo" },
    });
    fireEvent.change(document.querySelector('input[name="discountValue"]'), {
      target: { name: "discountValue", value: "10" },
    });
    fireEvent.change(document.querySelector('input[name="startDate"]'), {
      target: { name: "startDate", value: "2026-05-01T10:00" },
    });
    fireEvent.change(document.querySelector('input[name="endDate"]'), {
      target: { name: "endDate", value: "2026-05-05T22:00" },
    });
    fireEvent.change(screen.getByLabelText("Món combo 1"), {
      target: { value: "item-1" },
    });
    fireEvent.change(screen.getByLabelText("Món combo 2"), {
      target: { value: "item-2" },
    });

    const scopeSelect = document.querySelector('select[name="scope"]');
    expect(scopeSelect).toBeDisabled();
    expect(scopeSelect.value).toBe("order");

    fireEvent.click(document.querySelector('button[form="promoForm"]'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "order",
          giftItemId: null,
          productId: null,
        }),
      );
    });
  });

  it("shows the promotion restaurant when editing an existing record", () => {
    render(
      <PromotionModal
        categories={categories}
        defaultRestaurantId="restaurant-1"
        menuItems={menuItems}
        onClose={vi.fn()}
        onSave={vi.fn()}
        promotion={{
          id: "promotion-1",
          name: "Khuyen mai cu",
          code: "PROMO1",
          type: "percentage",
          discountValue: 10,
          restaurantId: "restaurant-2",
          startDate: "2026-05-01T10:00",
          endDate: "2026-05-05T22:00",
          conditions: [],
        }}
        restaurants={restaurants}
      />,
    );

    const restaurantSelect = document.querySelector(
      'select[name="restaurantId"]',
    );

    expect(
      screen.getByRole("option", { name: "Chi nhanh Quan 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Chi nhanh Phu Nhuan" }),
    ).toBeInTheDocument();
    expect(restaurantSelect.value).toBe("restaurant-2");
  });
});
