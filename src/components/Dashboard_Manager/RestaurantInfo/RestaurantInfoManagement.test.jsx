import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RestaurantInfoManagement from "./RestaurantInfoManagement";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const updateRestaurantMock = vi.fn();
const updateIndexMock = vi.fn();
const refetchRestaurantDetailMock = vi.fn();
const refetchIndexesMock = vi.fn();
const refetchCategoriesMock = vi.fn();

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings,
  useQuery: (...args) => useQueryMock(...args),
  useMutation: (...args) => useMutationMock(...args),
}));

vi.mock("../../../hooks/useAvatarUploadLocal", () => ({
  useAvatarUploadLocal: () => ({ upload: vi.fn() }),
}));

vi.mock("../shared/ManagementPageHeader", () => ({
  default: ({ primaryAction, selectedRestaurant }) => (
    <header>
      <span data-testid="selected-restaurant">{selectedRestaurant}</span>
      <button
        type="button"
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled}
      >
        {primaryAction.label}
      </button>
    </header>
  ),
}));

const customerInfo = {
  story: "",
  chef: "",
  dressCode: "",
  website: "",
  extraAmenities: [],
  parkingDetail: "",
  suitableFor: [],
  faqs: [
    { q: "", a: "" },
    { q: "", a: "" },
    { q: "", a: "" },
  ],
};

const initialCapabilities = {
  acceptsReservations: false,
  acceptsOrders: true,
  acceptsTableOrders: true,
  acceptsDelivery: true,
  acceptsPickup: false,
};

const restaurant = {
  id: "r1",
  name: "COHAN",
  brandId: "b1",
  brand: { id: "b1", name: "COHAN", slug: "cohan" },
  phone: "",
  email: "",
  description: "",
  openingHours: "",
  closingHours: "",
  notesOnHours: "",
  cuisineType: "",
  priceRange: "",
  status: "active",
  businessStatus: "active",
  operationalStatus: "normal",
  capabilities: initialCapabilities,
  orderPolicy: { allowWhenClosed: false, minAdvanceMinutes: 0 },
  amenities: [],
  notesOnAmenities: JSON.stringify(customerInfo),
  avgRating: 0,
  seatingCapacity: 0,
  avatar: "",
  coverImage: "",
  address: {
    line1: "",
    line2: "",
    ward: "",
    district: "",
    city: "",
    country: "",
    postalCode: "",
    lat: null,
    lng: null,
  },
  reservationSettings: {
    baseDepositAmount: 0,
    menuDepositPercent: 50,
    changeTimeFee: 0,
    changeTableFee: 0,
    vatRate: 0,
    serviceFee: 0,
  },
  paymentSettings: {
    defaultProvider: "momo",
    providers: [
      { provider: "momo", label: "MoMo", active: true, priority: 1, mode: "sandbox" },
      { provider: "vnpay", label: "VNPAY", active: true, priority: 2, mode: "sandbox" },
    ],
  },
};

const savedRestaurant = {
  ...restaurant,
  capabilities: {
    ...initialCapabilities,
    acceptsOrders: false,
  },
};

const operationSource = (operation) => String(operation?.[0] || operation || "");

beforeEach(() => {
  vi.clearAllMocks();

  refetchRestaurantDetailMock.mockResolvedValue({
    data: { restaurant: savedRestaurant },
  });
  refetchIndexesMock.mockResolvedValue({ data: { restaurantCategoryIndexes: [] } });
  refetchCategoriesMock.mockResolvedValue({ data: { categories: [] } });

  updateRestaurantMock.mockResolvedValue({
    data: { updateRestaurant: savedRestaurant },
  });
  updateIndexMock.mockResolvedValue({
    data: { updateRestaurantCategoryIndex: { id: "idx1" } },
  });

  useQueryMock.mockImplementation((operation) => {
    const source = operationSource(operation);

    if (source.includes("query Me")) {
      return { data: { me: { id: "u1", roleName: "manager" } } };
    }
    if (source.includes("query ScopedRestaurants")) {
      return {
        data: {
          scopedRestaurants: {
            edges: [{ node: { id: "r1", name: "COHAN", brandId: "b1", brand: restaurant.brand } }],
          },
        },
        loading: false,
      };
    }
    if (source.includes("query AllRestaurants")) {
      return { data: { restaurants: { edges: [] } }, loading: false };
    }
    if (source.includes("query StaffListForChefPicker")) {
      return { data: { staffList: [] }, loading: false };
    }
    if (source.includes("query GetRestaurantDetail")) {
      return {
        data: { restaurant },
        loading: false,
        error: null,
        refetch: refetchRestaurantDetailMock,
      };
    }
    if (source.includes("query GetRestaurantLayoutMetrics")) {
      return { data: { floors: [], tables: [] } };
    }
    if (source.includes("query GetRestaurantCategoryIndexes")) {
      return {
        data: { restaurantCategoryIndexes: [] },
        refetch: refetchIndexesMock,
      };
    }
    if (source.includes("query GetCategories")) {
      return { data: { categories: [] }, refetch: refetchCategoriesMock };
    }

    return { data: {}, loading: false };
  });

  useMutationMock.mockImplementation((operation) => {
    const source = operationSource(operation);
    if (source.includes("mutation UpdateRestaurantInfo")) {
      return [updateRestaurantMock, { loading: false }];
    }
    return [updateIndexMock, { loading: false }];
  });
});

describe("RestaurantInfoManagement remote orders", () => {
  it("preserves other capabilities when the manager disables remote orders", async () => {
    render(<RestaurantInfoManagement />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    const remoteOrderSwitch = screen.getByRole("switch", {
      name: "Nhận đơn từ xa",
    });
    expect(remoteOrderSwitch).toBeChecked();

    fireEvent.click(remoteOrderSwitch);
    expect(remoteOrderSwitch).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateRestaurantMock).toHaveBeenCalledTimes(1));

    expect(
      updateRestaurantMock.mock.calls[0][0].variables.input.capabilities,
    ).toEqual({
      ...initialCapabilities,
      acceptsOrders: false,
    });
    expect(refetchRestaurantDetailMock).toHaveBeenCalledTimes(1);
  });
});
