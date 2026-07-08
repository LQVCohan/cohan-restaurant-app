import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";
import useBrandManagement from "./useBrandManagement";

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useQuery: vi.fn() };
});

const brandData = {
  myBrands: [
    {
      id: "brand-1",
      name: "Cohan",
      restaurants: [
        { id: "restaurant-1", name: "Chi nhánh 1", brandId: "brand-1" },
        { id: "restaurant-2", name: "Chi nhánh 2", brandId: "brand-1" },
      ],
    },
  ],
  myBrandMemberships: [
    {
      id: "membership-1",
      brandId: "brand-1",
      role: "manager",
      status: "active",
      restaurantIds: ["restaurant-1"],
    },
  ],
};

const wrapperFor = (user, context = {}) => ({ children }) => (
  <AuthContext.Provider value={{ user, restaurants: [], ...context }}>
    {children}
  </AuthContext.Provider>
);

describe("useBrandManagement restaurant scope", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("manager.selectedBrandId", "brand-1");
    useQuery.mockReturnValue({
      data: brandData,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("limits a Brand manager to membership restaurantIds even when Brand.restaurants is stale", async () => {
    const { result } = renderHook(() => useBrandManagement(), {
      wrapper: wrapperFor({ id: "user-1", roleName: "manager" }),
    });

    await waitFor(() => {
      expect(result.current.restaurantsInSelectedBrand.map((item) => item.id)).toEqual([
        "restaurant-1",
      ]);
    });
    expect(result.current.allManageableRestaurants.map((item) => item.id)).toEqual([
      "restaurant-1",
    ]);
  });

  it("keeps true System Admin access global", async () => {
    const { result } = renderHook(() => useBrandManagement(), {
      wrapper: wrapperFor({ id: "admin-1", roleName: "admin" }),
    });

    await waitFor(() => {
      expect(result.current.restaurantsInSelectedBrand.map((item) => item.id)).toEqual([
        "restaurant-1",
        "restaurant-2",
      ]);
    });
  });

  it("reuses authenticated Brand context without requesting MyBrands", async () => {
    const { result } = renderHook(
      () => useBrandManagement(undefined, { loadFullBrands: false }),
      {
        wrapper: wrapperFor(
          { id: "owner-1", roleName: "manager" },
          {
            brandMemberships: [
              {
                id: "membership-owner",
                brandId: "brand-1",
                role: "owner",
                status: "active",
                restaurantIds: [],
                brand: { id: "brand-1", name: "Cohan", slug: "cohan" },
              },
            ],
            restaurants: [
              { id: "restaurant-1", name: "Chi nhánh 1", brandId: "brand-1" },
              { id: "restaurant-2", name: "Chi nhánh 2", brandId: "brand-1" },
            ],
            restaurantsLoading: false,
          },
        ),
      },
    );

    await waitFor(() => {
      expect(result.current.restaurantsInSelectedBrand.map((item) => item.id)).toEqual([
        "restaurant-1",
        "restaurant-2",
      ]);
    });
    expect(useQuery.mock.calls.at(-1)?.[1]?.skip).toBe(true);
    expect(result.current.selectedBrand).toMatchObject({
      id: "brand-1",
      name: "Cohan",
      membershipRole: "owner",
    });
  });
});
