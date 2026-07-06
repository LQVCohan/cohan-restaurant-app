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
  default: ({ title, subtitle, stats = [], customFilters, secondaryActions = [], footerLeft, footerRight }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {stats.map((stat) => (
        <span key={stat.id}>{stat.label}: {stat.value}</span>
      ))}
      {customFilters}
      {secondaryActions.map((action) => (
        <button key={action.label} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
      <span>{footerLeft}</span>
      <span>{footerRight}</span>
    </header>
  ),
}));

const selectedBrand = {
  id: "b1",
  name: "Cohan Group",
  slug: "cohan-group",
  description: "Chuỗi nhà hàng Việt hiện đại",
  logoUrl: "",
  status: "active",
  businessName: "Công ty Cohan",
  businessTaxCode: "0312345678",
  businessEmail: "contact@cohan.vn",
  businessPhone: "0908000000",
  ownerId: "owner-1",
  restaurantCount: 2,
  membership: { role: "admin" },
  restaurants: [
    { id: "r1", name: "Cohan Quận 1", brandId: "b1", avatar: "" },
    { id: "r2", name: "Cohan Thủ Đức", brandId: "b1", avatar: "" },
  ],
};

const members = [
  {
    id: "m1",
    userId: "u-manager",
    role: "manager",
    status: "active",
    restaurantIds: ["r1"],
    user: {
      id: "u-manager",
      fullName: "Nguyễn Minh An",
      email: "an@cohan.vn",
    },
  },
  {
    id: "m2",
    userId: "u-admin",
    role: "admin",
    status: "inactive",
    restaurantIds: [],
    user: {
      id: "u-admin",
      fullName: "Trần Hoài Nam",
      email: "nam@cohan.vn",
    },
  },
];

const setSelectedBrandIdMock = vi.fn();
const setSelectedRestaurantIdMock = vi.fn();
const refetchBrandsMock = vi.fn();
const refetchMembersMock = vi.fn();
const updateBrandMock = vi.fn();
const createRestaurantMock = vi.fn();
const addMemberMock = vi.fn();
const updateMemberMock = vi.fn();

const operationSource = (operation) =>
  String(operation?.loc?.source?.body || operation || "");

beforeEach(() => {
  vi.clearAllMocks();

  refetchBrandsMock.mockResolvedValue({ data: {} });
  refetchMembersMock.mockResolvedValue({ data: {} });
  updateBrandMock.mockResolvedValue({ data: { updateBrand: selectedBrand } });
  createRestaurantMock.mockResolvedValue({
    data: { createRestaurant: { id: "r3", name: "Cohan Nguyễn Huệ", brandId: "b1" } },
  });
  addMemberMock.mockResolvedValue({
    data: { addBrandMember: { id: "m3", role: "manager", status: "active" } },
  });
  updateMemberMock.mockResolvedValue({
    data: { updateBrandMember: { id: "m1", role: "manager", status: "inactive" } },
  });

  useBrandManagement.mockReturnValue({
    brands: [selectedBrand],
    selectedBrandId: "b1",
    setSelectedBrandId: setSelectedBrandIdMock,
    selectedBrand,
    setSelectedRestaurantId: setSelectedRestaurantIdMock,
    refetch: refetchBrandsMock,
    loading: false,
    error: null,
  });

  useQuery.mockReturnValue({
    data: { brandMembers: members },
    loading: false,
    error: null,
    refetch: refetchMembersMock,
  });

  useMutation.mockImplementation((operation) => {
    const source = operationSource(operation);
    if (source.includes("mutation UpdateBrand")) {
      return [updateBrandMock, { loading: false }];
    }
    if (source.includes("mutation CreateRestaurant")) {
      return [createRestaurantMock, { loading: false }];
    }
    if (source.includes("mutation AddBrandMember")) {
      return [addMemberMock, { loading: false }];
    }
    return [updateMemberMock, { loading: false }];
  });
});

describe("BrandManagement", () => {
  it("renders production chain wording, metrics, branches and member scopes", () => {
    render(<BrandManagement />);

    expect(
      screen.getByRole("heading", { name: "Quản lý chuỗi nhà hàng" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Chuỗi đang quản lý: 1")).toBeInTheDocument();
    expect(screen.getByText("Tổng chi nhánh: 2")).toBeInTheDocument();
    expect(screen.getByText("Thông tin doanh nghiệp")).toBeInTheDocument();
    expect(screen.getAllByText("Cohan Quận 1").length).toBeGreaterThan(0);
    expect(screen.getByText("Quản lý: Nguyễn Minh An")).toBeInTheDocument();
    expect(screen.getAllByText("Quản trị chuỗi").length).toBeGreaterThan(0);
    expect(screen.getByText("Toàn bộ chuỗi Cohan Group")).toBeInTheDocument();
    expect(screen.queryByText(/Thành viên Brand/i)).not.toBeInTheDocument();
  });

  it("saves required fields and clears empty optional business fields", async () => {
    render(<BrandManagement />);

    fireEvent.change(screen.getByLabelText("Email doanh nghiệp"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Số điện thoại doanh nghiệp"), {
      target: { value: "" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu thông tin chuỗi" }),
    );

    await waitFor(() => expect(updateBrandMock).toHaveBeenCalledTimes(1));

    expect(updateBrandMock.mock.calls[0][0].variables).toEqual({
      id: "b1",
      input: {
        name: "Cohan Group",
        slug: "cohan-group",
        description: "Chuỗi nhà hàng Việt hiện đại",
        businessName: "Công ty Cohan",
        businessTaxCode: "0312345678",
        businessEmail: null,
        businessPhone: null,
      },
    });
    expect(refetchBrandsMock).not.toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith(
      "Đã lưu thông tin chuỗi nhà hàng",
    );
  });

  it("adds a branch and switches the global restaurant scope to it", async () => {
    render(<BrandManagement />);

    fireEvent.change(screen.getByLabelText("Tên chi nhánh mới"), {
      target: { value: "Cohan Nguyễn Huệ" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm chi nhánh" }));

    await waitFor(() => expect(createRestaurantMock).toHaveBeenCalledTimes(1));

    expect(createRestaurantMock.mock.calls[0][0].variables.input).toEqual({
      name: "Cohan Nguyễn Huệ",
      brandId: "b1",
    });
    expect(setSelectedRestaurantIdMock).toHaveBeenCalledWith("r3");
    expect(refetchBrandsMock).not.toHaveBeenCalled();
  });

  it("requires one available branch for a manager before adding the member", async () => {
    render(<BrandManagement />);

    fireEvent.change(screen.getByLabelText(/Mã tài khoản/i), {
      target: { value: "u-new-manager" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm thành viên" }));

    expect(
      screen.getByText("Quản lý chi nhánh phải phụ trách đúng một chi nhánh."),
    ).toBeInTheDocument();
    expect(addMemberMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Chi nhánh phụ trách"), {
      target: { value: "r2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm thành viên" }));

    await waitFor(() => expect(addMemberMock).toHaveBeenCalledTimes(1));
    expect(addMemberMock.mock.calls[0][0].variables.input).toEqual({
      brandId: "b1",
      userId: "u-new-manager",
      role: "manager",
      restaurantIds: ["r2"],
    });
    expect(refetchMembersMock).toHaveBeenCalledTimes(1);
  });

  it("filters members and changes the selected member status", async () => {
    render(<BrandManagement />);

    fireEvent.change(screen.getByLabelText("Tìm thành viên trong chuỗi"), {
      target: { value: "Nguyễn Minh An" },
    });

    expect(screen.getByText("Nguyễn Minh An")).toBeInTheDocument();
    expect(screen.queryByText("Trần Hoài Nam")).not.toBeInTheDocument();

    const memberCard = screen.getByText("Nguyễn Minh An").closest("article");
    fireEvent.click(within(memberCard).getByRole("button", { name: "Tạm ngưng" }));

    await waitFor(() => expect(updateMemberMock).toHaveBeenCalledTimes(1));
    expect(updateMemberMock.mock.calls[0][0].variables.input).toEqual({
      id: "m1",
      status: "inactive",
    });
    expect(refetchMembersMock).toHaveBeenCalledTimes(1);
  });
});
