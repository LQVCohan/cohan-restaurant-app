import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { message } from "antd";
import { useMutation, useQuery } from "@apollo/client/react";
import useBrandManagement from "@/hooks/useBrandManagement";
import BrandManagement from "./BrandManagement";

vi.mock("antd", () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@apollo/client/react", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@/hooks/useBrandManagement", () => ({
  default: vi.fn(),
  MY_BRANDS_QUERY: {},
}));

vi.mock("../shared/ManagementPageHeader", () => ({
  default: ({ title }) => <header><h1>{title}</h1></header>,
}));

vi.mock("./BrandOwnershipTransfer", () => ({
  default: () => null,
}));

const refetchMembersMock = vi.fn();
const updateMemberMock = vi.fn();

const operationSource = (operation) =>
  String(operation?.loc?.source?.body || operation || "");

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
  refetchMembersMock.mockResolvedValue({ data: {} });
  updateMemberMock.mockResolvedValue({
    data: {
      updateBrandMember: {
        id: "invite-membership",
        role: "manager",
        status: "inactive",
        restaurantIds: ["restaurant-1"],
      },
    },
  });

  useBrandManagement.mockReturnValue({
    brands: [
      {
        id: "brand-1",
        name: "Ginn",
        restaurantCount: 1,
        restaurants: [
          {
            id: "restaurant-1",
            name: "Ginn Restaurant",
            brandId: "brand-1",
            avatar: "",
          },
        ],
      },
    ],
    selectedBrandId: "brand-1",
    setSelectedBrandId: vi.fn(),
    selectedBrand: {
      id: "brand-1",
      name: "Ginn",
      slug: "ginn",
      status: "active",
      membership: { role: "owner" },
      restaurants: [
        {
          id: "restaurant-1",
          name: "Ginn Restaurant",
          brandId: "brand-1",
          avatar: "",
        },
      ],
    },
    setSelectedRestaurantId: vi.fn(),
    refetch: vi.fn(),
    loading: false,
    error: null,
  });

  useQuery.mockImplementation((operation) => {
    const source = operationSource(operation);
    if (source.includes("query BrandMembers")) {
      return {
        data: {
          brandMembers: [
            {
              id: "invite-membership",
              userId: "guest-user",
              role: "manager",
              status: "invited",
              revokedFromStatus: null,
              restaurantIds: ["restaurant-1"],
              user: {
                id: "guest-user",
                fullName: "Guest sinh nhật",
                email: "guest.birthday@customer-demo.cohan.local",
              },
            },
          ],
        },
        loading: false,
        error: null,
        refetch: refetchMembersMock,
      };
    }

    return {
      data: { brandMemberCandidates: [] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  useMutation.mockImplementation((operation) => {
    const source = operationSource(operation);
    if (source.includes("mutation UpdateBrandMember")) {
      return [updateMemberMock, { loading: false }];
    }
    return [vi.fn().mockResolvedValue({ data: {} }), { loading: false }];
  });
});

describe("BrandManagement pending invitation actions", () => {
  it("cancels a pending invitation directly from its member card", async () => {
    render(<BrandManagement />);

    const memberCard = screen.getByText("Guest sinh nhật").closest("article");
    fireEvent.click(
      within(memberCard).getByRole("button", { name: "Hủy lời mời" }),
    );

    expect(window.confirm).toHaveBeenCalledWith(
      "Hủy lời mời này? Liên kết trong email sẽ không còn hiệu lực.",
    );
    await waitFor(() => expect(updateMemberMock).toHaveBeenCalledTimes(1));
    expect(updateMemberMock.mock.calls[0][0].variables.input).toEqual({
      id: "invite-membership",
      status: "inactive",
    });
    expect(refetchMembersMock).toHaveBeenCalledTimes(1);
    expect(message.success).toHaveBeenCalledWith("Đã hủy lời mời");
  });
});
