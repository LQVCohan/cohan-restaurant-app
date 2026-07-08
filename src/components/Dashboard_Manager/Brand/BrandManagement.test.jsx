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

const memberCandidates = [
  {
    id: "u-new-manager",
    fullName: "Lê Thu Lan",
    username: "thu.lan",
    email: "lan@cohan.vn",
    userType: "MANAGER",
    status: "active",
  },
  {
    id: "u-customer",
    fullName: "Phạm Minh Khôi",
    username: "minh.khoi",
    email: "khoi@example.com",
    userType: "CUSTOMER",
    status: "active",
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
    data: { addBrandMember: { id: "m3", role: "manager", status: "invited" } },
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

  useQuery.mockImplementation((operation) => {
    const source = operationSource(operation);
    if (source.includes("query BrandMemberCandidates")) {
      return {
        data: { brandMemberCandidates: memberCandidates },
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (source.includes("query BrandMembers")) {
      return {
        data: { brandMembers: members },
        loading: false,
        error: null,
        refetch: refetchMembersMock,
      };
    }
    throw new Error(`Unexpected query in BrandManagement test: ${source}`);
  });

  useMutation.mockImplementation((operation) => {
    const source = operationSource(operation);
    if (source.includes("mutation UpdateBrandMember")) {
      return [updateMemberMock, { loading: false }];
    }
    if (source.includes("mutation UpdateBrand")) {
      return [updateBrandMock, { loading: false }];
    }
    if (source.includes("mutation CreateRestaurant")) {
      return [createRestaurantMock, { loading: false }];
    }
    if (source.includes("mutation AddBrandMember")) {
      return [addMemberMock, { loading: false }];
    }
    throw new Error(`Unexpected mutation in BrandManagement test: ${source}`);
  });
});

describe("BrandManagement", () => {
  it("renders concise production wording, metrics, branches and member filters", () => {
    render(<BrandManagement />);

    expect(
      screen.getByRole("heading", { name: "Quản lý chuỗi" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Chuỗi: 1")).toBeInTheDocument();
    expect(screen.getByText("Chi nhánh: 2")).toBeInTheDocument();
    expect(screen.getByText("Thành viên: 1")).toBeInTheDocument();
    expect(screen.getByText("Thông tin doanh nghiệp")).toBeInTheDocument();
    expect(screen.getByText("Tìm và lọc thành viên")).toBeInTheDocument();
    expect(screen.getByLabelText("Tìm người cần thêm theo tên, email hoặc mã tài khoản")).toBeInTheDocument();
    expect(screen.getAllByText("Cohan Quận 1").length).toBeGreaterThan(0);
    expect(screen.getByText("Quản lý: Nguyễn Minh An")).toBeInTheDocument();
    expect(screen.getAllByText("Quản trị chuỗi").length).toBeGreaterThan(0);
    expect(screen.getByText("Toàn bộ chuỗi Cohan Group")).toBeInTheDocument();
    expect(screen.queryByText(/Thành viên Brand/i)).not.toBeInTheDocument();
  });

  it("collapses and reopens the existing-member filters", async () => {
    render(<BrandManagement />);

    const summary = screen.getByText("Tìm và lọc thành viên").closest("summary");
    const details = summary.closest("details");
    expect(details.open).toBe(true);

    fireEvent.click(summary);
    await waitFor(() => expect(details.open).toBe(false));

    fireEvent.click(summary);
    await waitFor(() => expect(details.open).toBe(true));
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
        businessName: "Công ty Cohan",
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

  it("searches, selects and adds a manager without entering a raw account ID", async () => {
    render(<BrandManagement />);

    fireEvent.click(screen.getByRole("button", { name: "Gửi lời mời" }));
    expect(screen.getByText("Chọn tài khoản cần thêm.")).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText("Tìm người cần thêm theo tên, email hoặc mã tài khoản"),
      { target: { value: "Lê Thu Lan" } },
    );

    const accountSelect = screen.getByLabelText("Chọn tài khoản cần thêm");
    await waitFor(() => expect(accountSelect).not.toBeDisabled());
    fireEvent.change(accountSelect, { target: { value: "u-new-manager" } });

    fireEvent.click(screen.getByRole("button", { name: "Gửi lời mời" }));
    expect(
      screen.getByText("Quản lý chi nhánh phải phụ trách đúng một chi nhánh."),
    ).toBeInTheDocument();
    expect(addMemberMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Chi nhánh phụ trách"), {
      target: { value: "r2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi lời mời" }));

    await waitFor(() => expect(addMemberMock).toHaveBeenCalledTimes(1));
    expect(addMemberMock.mock.calls[0][0].variables.input).toEqual({
      brandId: "b1",
      userId: "u-new-manager",
      role: "manager",
      restaurantIds: ["r2"],
    });
    expect(refetchMembersMock).toHaveBeenCalledTimes(1);
  });


it("shows that an existing Customer is promoted only after accepting the email", async () => {
  render(<BrandManagement />);

  fireEvent.change(
    screen.getByLabelText("Tìm người cần thêm theo tên, email hoặc mã tài khoản"),
    { target: { value: "Phạm Minh Khôi" } },
  );
  const accountSelect = screen.getByLabelText("Chọn tài khoản cần thêm");
  await waitFor(() => expect(accountSelect).not.toBeDisabled());
  fireEvent.change(accountSelect, { target: { value: "u-customer" } });

  expect(screen.getByText("Tài khoản khách hàng hiện có")).toBeInTheDocument();
  expect(screen.getByText(/Quyền chỉ chuyển sang Manager/)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Chi nhánh phụ trách"), {
    target: { value: "r2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi lời mời" }));

  await waitFor(() => expect(addMemberMock).toHaveBeenCalledTimes(1));
  expect(addMemberMock.mock.calls[0][0].variables.input).toEqual({
    brandId: "b1",
    userId: "u-customer",
    role: "manager",
    restaurantIds: ["r2"],
  });
  expect(message.success).toHaveBeenCalledWith("Đã gửi lời mời tham gia chuỗi");
});

  it("clears a stale selected account when the candidate search changes", async () => {
    render(<BrandManagement />);

    const candidateSearch = screen.getByLabelText(
      "Tìm người cần thêm theo tên, email hoặc mã tài khoản",
    );
    const accountSelect = screen.getByLabelText("Chọn tài khoản cần thêm");

    fireEvent.change(candidateSearch, { target: { value: "Lê Thu Lan" } });
    await waitFor(() => expect(accountSelect).not.toBeDisabled());
    fireEvent.change(accountSelect, { target: { value: "u-new-manager" } });
    expect(accountSelect).toHaveValue("u-new-manager");

    fireEvent.change(candidateSearch, { target: { value: "Người khác" } });
    expect(accountSelect).toHaveValue("");
  });

  it("searches by employee name or account ID and filters by role and branch", async () => {
    render(<BrandManagement />);

    const searchInput = screen.getByLabelText(
      "Tìm tài khoản theo tên nhân viên hoặc mã tài khoản",
    );
    const roleFilter = screen.getByLabelText("Lọc theo vai trò");
    const branchFilter = screen.getByLabelText("Lọc theo chi nhánh");

    fireEvent.change(searchInput, { target: { value: "Nguyễn Minh An" } });
    expect(screen.getByText("Nguyễn Minh An")).toBeInTheDocument();
    expect(screen.queryByText("Trần Hoài Nam")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "u-admin" } });
    expect(screen.getByText("Trần Hoài Nam")).toBeInTheDocument();
    expect(screen.queryByText("Nguyễn Minh An")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "" } });
    fireEvent.change(roleFilter, { target: { value: "manager" } });
    expect(screen.getByText("Nguyễn Minh An")).toBeInTheDocument();
    expect(screen.queryByText("Trần Hoài Nam")).not.toBeInTheDocument();

    fireEvent.change(roleFilter, { target: { value: "all" } });
    fireEvent.change(branchFilter, { target: { value: "r2" } });
    expect(screen.queryByText("Nguyễn Minh An")).not.toBeInTheDocument();
    expect(screen.getByText("Trần Hoài Nam")).toBeInTheDocument();

    fireEvent.change(branchFilter, { target: { value: "all" } });
    fireEvent.change(searchInput, { target: { value: "u-manager" } });
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
