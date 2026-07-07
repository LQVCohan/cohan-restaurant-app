import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { message } from "antd";
import { useMutation } from "@apollo/client/react";
import BrandOwnershipTransfer from "./BrandOwnershipTransfer";

vi.mock("antd", () => ({
  message: {
    success: vi.fn(),
  },
}));

vi.mock("@apollo/client/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("@/hooks/useBrandManagement", () => ({
  MY_BRANDS_QUERY: {},
}));

const transferOwnershipMock = vi.fn();
const setSelectedRestaurantIdMock = vi.fn();

const ownerBrand = {
  id: "brand-1",
  membership: { role: "owner" },
};

const members = [
  {
    id: "membership-owner",
    userId: "owner-1",
    role: "owner",
    status: "active",
    user: { fullName: "Chủ hiện tại", email: "owner@cohan.vn" },
  },
  {
    id: "membership-target",
    userId: "manager-1",
    role: "manager",
    status: "active",
    restaurantIds: ["restaurant-1"],
    user: { fullName: "Nguyễn Minh An", email: "an@cohan.vn" },
  },
];

const restaurants = [
  { id: "restaurant-1", name: "Cohan Quận 1" },
  { id: "restaurant-2", name: "Cohan Thủ Đức" },
];

beforeEach(() => {
  vi.clearAllMocks();
  transferOwnershipMock.mockResolvedValue({
    data: {
      transferBrandOwnership: {
        brand: { id: "brand-1", ownerId: "manager-1" },
        previousOwnerMembership: {
          id: "membership-owner",
          role: "manager",
          restaurantIds: ["restaurant-1"],
        },
        newOwnerMembership: {
          id: "membership-target",
          role: "owner",
          restaurantIds: [],
        },
      },
    },
  });
  useMutation.mockReturnValue([transferOwnershipMock, { loading: false }]);
});

describe("BrandOwnershipTransfer", () => {
  it("only renders for the current owner", () => {
    const { rerender } = render(
      <BrandOwnershipTransfer
        selectedBrand={{ ...ownerBrand, membership: { role: "admin" } }}
        members={members}
        restaurants={restaurants}
        assignedManagerByRestaurant={new Map()}
      />,
    );

    expect(screen.queryByText("Chuyển quyền chủ chuỗi")).not.toBeInTheDocument();

    rerender(
      <BrandOwnershipTransfer
        selectedBrand={ownerBrand}
        members={members}
        restaurants={restaurants}
        assignedManagerByRestaurant={new Map()}
      />,
    );

    expect(screen.getByText("Chuyển quyền chủ chuỗi")).toBeInTheDocument();
  });

  it("transfers ownership and assigns the previous owner to one branch", async () => {
    const navigateHandler = vi.fn();
    window.addEventListener("manager:navigate", navigateHandler);

    render(
      <BrandOwnershipTransfer
        selectedBrand={ownerBrand}
        members={members}
        restaurants={restaurants}
        assignedManagerByRestaurant={new Map([
          ["restaurant-1", members[1]],
        ])}
        setSelectedRestaurantId={setSelectedRestaurantIdMock}
      />,
    );

    fireEvent.click(screen.getByText("Chuyển quyền chủ chuỗi"));
    fireEvent.change(
      screen.getByLabelText("Thành viên nhận quyền chủ chuỗi"),
      { target: { value: "manager-1" } },
    );
    fireEvent.change(
      screen.getByLabelText("Chi nhánh của chủ cũ sau khi chuyển quyền"),
      { target: { value: "restaurant-1" } },
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Tôi hiểu mình sẽ không còn là chủ chuỗi/i,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận chuyển quyền" }),
    );

    await waitFor(() => expect(transferOwnershipMock).toHaveBeenCalledTimes(1));
    expect(transferOwnershipMock.mock.calls[0][0].variables.input).toEqual({
      brandId: "brand-1",
      newOwnerUserId: "manager-1",
      previousOwnerRestaurantId: "restaurant-1",
    });
    expect(setSelectedRestaurantIdMock).toHaveBeenCalledWith("restaurant-1");
    expect(message.success).toHaveBeenCalledWith("Đã chuyển quyền chủ chuỗi");
    expect(navigateHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ page: "dashboard" }),
      }),
    );

    window.removeEventListener("manager:navigate", navigateHandler);
  });
});
