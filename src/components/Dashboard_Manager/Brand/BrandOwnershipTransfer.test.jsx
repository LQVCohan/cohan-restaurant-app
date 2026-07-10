import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { message } from "antd";
import { useMutation } from "@apollo/client/react";
import BrandOwnershipTransfer from "./BrandOwnershipTransfer";

vi.mock("antd", () => ({
  message: { success: vi.fn() },
}));

vi.mock("@apollo/client/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("@/hooks/useBrandManagement", () => ({
  MY_BRANDS_QUERY: {},
}));

const updateMemberMock = vi.fn();
const transferOwnershipMock = vi.fn();

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
    restaurantIds: [],
    user: { fullName: "Chủ hiện tại", email: "owner@cohan.vn" },
  },
  {
    id: "membership-manager",
    userId: "manager-1",
    role: "manager",
    status: "active",
    restaurantIds: ["restaurant-1"],
    user: { fullName: "Nguyễn Minh An", email: "an@cohan.vn" },
  },
  {
    id: "membership-staff",
    userId: "staff-1",
    role: "staff",
    status: "active",
    restaurantIds: ["restaurant-2"],
    user: { fullName: "Lê Thu Lan", email: "lan@cohan.vn" },
  },
];

const restaurants = [
  { id: "restaurant-1", name: "Cohan Quận 1" },
  { id: "restaurant-2", name: "Cohan Thủ Đức" },
];

const operationSource = (operation) =>
  String(operation?.loc?.source?.body || operation || "");

beforeEach(() => {
  vi.clearAllMocks();
  updateMemberMock.mockResolvedValue({
    data: {
      updateBrandMember: {
        id: "membership-staff",
        role: "manager",
        status: "active",
        restaurantIds: ["restaurant-2"],
      },
    },
  });
  transferOwnershipMock.mockResolvedValue({
    data: {
      transferBrandOwnership: {
        brand: { id: "brand-1", ownerId: "manager-1" },
        previousOwnerMembership: {
          id: "membership-owner",
          role: "admin",
          restaurantIds: [],
        },
        newOwnerMembership: {
          id: "membership-manager",
          role: "owner",
          restaurantIds: [],
        },
      },
    },
  });
  useMutation.mockImplementation((operation) => {
    const source = operationSource(operation);
    if (source.includes("UpdateBrandMemberAccess")) {
      return [updateMemberMock, { loading: false }];
    }
    return [transferOwnershipMock, { loading: false }];
  });
});

const renderActions = (selectedBrand = ownerBrand) =>
  render(
    <BrandOwnershipTransfer
      selectedBrand={selectedBrand}
      members={members}
      restaurants={restaurants}
      assignedManagerByRestaurant={new Map([
        ["restaurant-1", members[1]],
      ])}
    />,
  );

describe("Brand membership actions", () => {
  it("shows the membership editor to owners and administrators", () => {
    const { rerender } = renderActions({
      ...ownerBrand,
      membership: { role: "manager" },
    });
    expect(screen.queryByText("Đổi vai trò và phạm vi")).not.toBeInTheDocument();

    rerender(
      <BrandOwnershipTransfer
        selectedBrand={{ ...ownerBrand, membership: { role: "admin" } }}
        members={members}
        restaurants={restaurants}
        assignedManagerByRestaurant={new Map()}
      />,
    );
    expect(screen.getByText("Đổi vai trò và phạm vi")).toBeInTheDocument();
    expect(screen.queryByText("Chuyển quyền chủ chuỗi")).not.toBeInTheDocument();
  });

  it("updates a staff membership to one restaurant manager scope", async () => {
    renderActions();
    fireEvent.click(screen.getByText("Đổi vai trò và phạm vi"));

    fireEvent.change(screen.getByLabelText("Thành viên cần đổi quyền"), {
      target: { value: "membership-staff" },
    });
    fireEvent.change(screen.getByLabelText("Vai trò mới của thành viên"), {
      target: { value: "manager" },
    });
    expect(
      screen.getByRole("option", { name: "Cohan Quận 1 — đã có quản lý" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Chi nhánh quản lý mới"), {
      target: { value: "restaurant-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu quyền thành viên" }));

    await waitFor(() => expect(updateMemberMock).toHaveBeenCalledTimes(1));
    expect(updateMemberMock.mock.calls[0][0].variables.input).toEqual({
      id: "membership-staff",
      role: "manager",
      restaurantIds: ["restaurant-2"],
    });
    expect(message.success).toHaveBeenCalledWith("Đã cập nhật quyền thành viên");
  });

  it("does not offer staff as a target membership role", () => {
    renderActions();
    fireEvent.click(screen.getByText("Đổi vai trò và phạm vi"));

    fireEvent.change(screen.getByLabelText("Thành viên cần đổi quyền"), {
      target: { value: "membership-manager" },
    });

    const roleSelect = screen.getByLabelText("Vai trò mới của thành viên");
    expect(
      roleSelect.querySelector('option[value="staff"]'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Quản trị chuỗi" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Quản lý chi nhánh" })).toBeInTheDocument();
  });

  it("transfers ownership without requiring a branch", async () => {
    const navigateHandler = vi.fn();
    window.addEventListener("manager:navigate", navigateHandler);
    renderActions();
    fireEvent.click(screen.getByText("Chuyển quyền chủ chuỗi"));

    expect(screen.queryByLabelText("Chi nhánh của chủ cũ sau khi chuyển quyền")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Thành viên nhận quyền chủ chuỗi"), {
      target: { value: "manager-1" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /chuyển thành quản trị chuỗi/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận chuyển quyền" }));

    await waitFor(() => expect(transferOwnershipMock).toHaveBeenCalledTimes(1));
    expect(transferOwnershipMock.mock.calls[0][0].variables.input).toEqual({
      brandId: "brand-1",
      newOwnerUserId: "manager-1",
    });
    expect(message.success).toHaveBeenCalledWith("Đã chuyển quyền chủ chuỗi");
    expect(navigateHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ page: "dashboard" }),
      }),
    );

    window.removeEventListener("manager:navigate", navigateHandler);
  });
});
