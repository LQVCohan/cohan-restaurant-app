import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import RestaurantDetail from "./RestaurantDetail";

const apollo = vi.hoisted(() => ({
  recordRecent: vi.fn(),
  queryData: { publicRestaurant: { id: "r1", name: "Nhà hàng 1", canReserve: true, canOrder: true, address: {} } },
}));

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings.join(""),
  useQuery: (query, options = {}) => {
    const text = String(query);
    if (text.includes("publicRestaurant")) return { data: apollo.queryData, loading: false, error: null };
    if (text.includes("reviewStats")) return { data: { reviewStats: { total: 0, avgRating: 0 } }, loading: false };
    if (text.includes("myFavorites")) return { data: { myFavorites: [] }, loading: false, refetch: vi.fn() };
    return { data: {}, loading: false };
  },
  useMutation: (mutation) => {
    const text = String(mutation);
    if (text.includes("recordRecentRestaurant")) return [apollo.recordRecent, { loading: false }];
    return [vi.fn(), { loading: false }];
  },
}));

vi.mock("@/components/common/LoadingSpinner", () => ({ default: () => <div>loading</div> }));
vi.mock("./components/MenuSection/MenuSection", () => ({ default: () => <div /> }));
vi.mock("./components/PhotoGallery/PhotoGallery", () => ({ default: () => <div /> }));
vi.mock("./components/PromotionsSection/PromotionsSection", () => ({ default: () => <div /> }));
vi.mock("./components/RestaurantInfo/RestaurantInfo", () => ({ default: () => <div /> }));
vi.mock("./components/ReviewsSection/ReviewsSection", () => ({ default: () => <div /> }));
vi.mock("./components/SimilarRestaurants/SimilarRestaurants", () => ({ default: () => <div /> }));
vi.mock("@/utils/aiChatbotEvents", () => ({ openAiMenuAssistant: vi.fn() }));

const auth = { user: { id: "customer-1", roleName: "customer" }, isAuthenticated: true };
const renderDetail = (route = "/restaurant/r1", value = auth) => render(
  <MemoryRouter initialEntries={[route]}>
    <AuthContext.Provider value={value}>
      <Routes>
        <Route path="/restaurant/:id" element={<RestaurantDetail />} />
      </Routes>
    </AuthContext.Provider>
  </MemoryRouter>,
);

describe("RestaurantDetail recordRecentRestaurant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apollo.queryData = { publicRestaurant: { id: "r1", name: "Nhà hàng 1", canReserve: true, canOrder: true, address: {} } };
    apollo.recordRecent.mockResolvedValue({ data: { recordRecentRestaurant: true } });
  });

  it("does not duplicate calls while the same restaurant request is in flight", async () => {
    let resolve;
    apollo.recordRecent.mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = renderDetail();
    view.rerender(
      <MemoryRouter initialEntries={["/restaurant/r1"]}>
        <AuthContext.Provider value={auth}>
          <Routes><Route path="/restaurant/:id" element={<RestaurantDetail />} /></Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(apollo.recordRecent).toHaveBeenCalledTimes(1));
    resolve({ data: { recordRecentRestaurant: true } });
  });

  it("records again after navigating to a different restaurant id", async () => {
    const view = renderDetail();
    await waitFor(() => expect(apollo.recordRecent).toHaveBeenCalledTimes(1));
    apollo.queryData = { publicRestaurant: { id: "r2", name: "Nhà hàng 2", canReserve: true, canOrder: true, address: {} } };
    view.rerender(
      <MemoryRouter initialEntries={["/restaurant/r2"]}>
        <AuthContext.Provider value={auth}>
          <Routes><Route path="/restaurant/:id" element={<RestaurantDetail />} /></Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(apollo.recordRecent).toHaveBeenCalledTimes(2));
  });

  it("does not record in preview mode or when mutation fails", async () => {
    renderDetail("/restaurant/r1?preview=1");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apollo.recordRecent).not.toHaveBeenCalled();

    apollo.recordRecent.mockRejectedValueOnce(new Error("network"));
    renderDetail("/restaurant/r1");
    await waitFor(() => expect(apollo.recordRecent).toHaveBeenCalledTimes(1));
  });
});
