import React from "react";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import CombosPage, { CUSTOMER_COMBOS } from "./CombosPage";

vi.mock("@/context/AuthContext", () => ({ AuthContext: React.createContext({ isAuthenticated: false, user: null }) }));
vi.mock("@/context/CartProvider", () => ({ useCart: () => ({ addToCart: vi.fn(), refetchServerCart: vi.fn() }) }));
vi.mock("@/hooks/useNotification", () => ({ useNotification: () => ({ showNotification: vi.fn() }) }));

const renderPage = (mocks) => render(
  <MockedProvider mocks={mocks}>
    <MemoryRouter><CombosPage /></MemoryRouter>
  </MockedProvider>,
);

const baseVariables = { filter: { onlyAvailable: true, limit: 36 } };

const promoComboFixture = {
  id: "1",
  sourceType: "PROMOTION",
  restaurantId: "r1",
  restaurantName: "Cơm Cohan",
  name: "Combo trưa",
  description: "No nhanh",
  imageUrl: "",
  originalPrice: 120000,
  comboPrice: 99000,
  discountAmount: 21000,
  discountPercent: 18,
  badge: "Tiết kiệm 21.000đ",
  isAvailable: true,
  startsAt: null,
  endsAt: null,
  items: [
    { menuItemId: "m1", name: "Cơm gà", qty: 1, imageUrl: "", price: 70000 },
    { menuItemId: "m2", name: "Canh", qty: 1, imageUrl: "", price: 50000 },
  ],
};

describe("CombosPage", () => {
  it("renders loading then empty state", async () => {
    renderPage([{ request: { query: CUSTOMER_COMBOS, variables: baseVariables }, result: { data: { customerCombos: [] } } }]);
    expect(screen.getByLabelText("Đang tải combo")).toBeInTheDocument();
    expect(await screen.findByText("Chưa có combo phù hợp")).toBeInTheDocument();
  });

  it("renders promo combo cards and opens detail modal", async () => {
    renderPage([{ request: { query: CUSTOMER_COMBOS, variables: baseVariables }, result: { data: { customerCombos: [promoComboFixture] } } }]);
    expect(await screen.findByText("Combo trưa")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Xem ưu đãi" })[0]);
    expect(screen.getByRole("dialog", { name: /combo trưa/i })).toBeInTheDocument();
    expect(screen.getByText("Ưu đãi này sẽ tự áp dụng ở bước thanh toán khi giỏ hàng đủ điều kiện.")).toBeInTheDocument();
  });

  it("sends people and budget filters to the query", async () => {
    const filteredVariables = { filter: { people: "two", budget: "100k_200k", onlyAvailable: true, limit: 36 } };
    renderPage([
      { request: { query: CUSTOMER_COMBOS, variables: baseVariables }, result: { data: { customerCombos: [] } } },
      { request: { query: CUSTOMER_COMBOS, variables: { filter: { people: "two", onlyAvailable: true, limit: 36 } } }, result: { data: { customerCombos: [] } } },
      { request: { query: CUSTOMER_COMBOS, variables: filteredVariables }, result: { data: { customerCombos: [] } } },
    ]);
    fireEvent.change(screen.getByLabelText("Số người"), { target: { value: "two" } });
    fireEvent.change(screen.getByLabelText("Ngân sách"), { target: { value: "100k_200k" } });
    await waitFor(() => expect(screen.getByText("Chưa có combo phù hợp")).toBeInTheDocument());
  });
});
