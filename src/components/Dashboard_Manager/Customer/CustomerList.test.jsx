import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CustomerList from "./CustomerList";

vi.mock("./CustomerCard", () => ({
  default: ({ customer, onClick }) => (
    <button type="button" onClick={() => onClick?.(customer)}>
      Card {customer.displayName || customer.name}
    </button>
  ),
}));

const makePagination = (overrides = {}) => ({
  page: 1,
  totalPages: 1,
  pageSize: 30,
  pageSizeOptions: [10, 20, 30, 50],
  totalCount: 0,
  hasNextPage: false,
  hasPreviousPage: false,
  isLoading: false,
  onNext: vi.fn(),
  onPrevious: vi.fn(),
  onPageSizeChange: vi.fn(),
  ...overrides,
});

const customers = [
  {
    id: "customer-000001",
    displayName: "Nguyễn Linh",
    phone: "0909000001",
    email: "linh@example.com",
    rankName: "VIP",
    loyaltyPoints: 1200,
    isGuest: false,
    recentOrders: [
      {
        amount: 250000,
        date: "2026-06-10",
      },
    ],
  },
  {
    id: "customer-000002",
    displayName: "Guest bàn 04",
    phone: "",
    email: "",
    customerType: "Mới",
    loyaltyPoints: 0,
    isGuest: true,
    recentOrders: [],
  },
];

describe("CustomerList manager workflow", () => {
  it("renders the empty state with backend pagination summary", () => {
    const pagination = makePagination();

    render(<CustomerList customers={[]} loading={false} pagination={pagination} />);

    expect(screen.getByText("Danh sách khách hàng")).toBeInTheDocument();
    expect(screen.getByText("Không có khách hàng phù hợp")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /không tìm thấy khách hàng/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /thêm khách hàng/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /đặt lại bộ lọc/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bảng/i })).toBeDisabled();
    expect(screen.queryByLabelText("Phân trang danh sách khách hàng")).not.toBeInTheDocument();
  });

  it("shows loading skeletons while customer data is loading", () => {
    const { container } = render(
      <CustomerList customers={[]} loading pagination={makePagination({ isLoading: true })} />,
    );

    expect(screen.getByText("Đang tải danh sách khách hàng...")).toBeInTheDocument();
    expect(container.querySelectorAll(".cl-skeleton-card")).toHaveLength(9);
  });

  it("renders customer cards by default and opens customer details from grid view", () => {
    const onCustomerClick = vi.fn();

    render(
      <CustomerList
        customers={customers}
        loading={false}
        onCustomerClick={onCustomerClick}
        pagination={makePagination({ totalCount: 2 })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /card nguyễn linh/i }));

    expect(screen.getByText("Trang 1/1 · 1–2 trên 2 khách hàng")).toBeInTheDocument();
    expect(onCustomerClick).toHaveBeenCalledWith(customers[0]);
  });

  it("switches to table view and keeps row click and keyboard access", () => {
    const onCustomerClick = vi.fn();

    render(
      <CustomerList
        customers={customers}
        loading={false}
        onCustomerClick={onCustomerClick}
        pagination={makePagination({ totalCount: 2 })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /bảng/i }));

    expect(screen.getByRole("region", { name: /bảng danh sách khách hàng/i })).toBeInTheDocument();
    expect(screen.getByText("Liên hệ")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText(/250\.000/)).toBeInTheDocument();

    const row = screen.getByText("Nguyễn Linh").closest("tr");
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });

    expect(onCustomerClick).toHaveBeenCalledTimes(2);
    expect(onCustomerClick).toHaveBeenCalledWith(customers[0]);
  });

  it("delegates page changes to backend pagination handlers after local pages are exhausted", () => {
    const pagination = makePagination({
      page: 2,
      totalPages: 4,
      pageSize: 20,
      totalCount: 67,
      hasNextPage: true,
      hasPreviousPage: true,
      pageSizeOptions: [10, 20, 50],
    });

    render(
      <CustomerList
        customers={[customers[0]]}
        loading={false}
        pagination={pagination}
      />,
    );

    expect(screen.getByText("Trang 3/8 · 21–21 trên 67 khách hàng")).toBeInTheDocument();

    const topPager = screen.getAllByLabelText("Phân trang danh sách khách hàng")[0];
    fireEvent.click(within(topPager).getByRole("button", { name: /trước/i }));
    fireEvent.click(within(topPager).getByRole("button", { name: /sau/i }));

    expect(pagination.onPrevious).toHaveBeenCalledTimes(1);
    expect(pagination.onNext).toHaveBeenCalledTimes(1);
  });
});
