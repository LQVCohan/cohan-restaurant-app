import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    // Scrolling is not part of these component assertions. Prevent jsdom from
    // creating its persistent requestAnimationFrame interval after pager clicks.
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the empty state with backend pagination summary", () => {
    const pagination = makePagination();

    render(<CustomerList customers={[]} loading={false} pagination={pagination} />);

    expect(screen.getByText("Danh sách khách")).toBeInTheDocument();
    expect(screen.getByText("Chưa có khách phù hợp")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /chưa tìm thấy khách hàng/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /thêm khách hàng/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /xóa bộ lọc/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bảng/i })).toBeDisabled();
    expect(screen.queryByLabelText("Phân trang khách hàng")).not.toBeInTheDocument();
  });

  it("shows loading skeletons while customer data is loading", () => {
    const { container } = render(
      <CustomerList customers={[]} loading pagination={makePagination({ isLoading: true })} />,
    );

    expect(screen.getByText("Đang tải danh sách khách...")).toBeInTheDocument();
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

    expect(screen.getByText("Hiển thị 1-2 / 2 khách")).toBeInTheDocument();
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

    expect(screen.getByRole("region", { name: /bảng khách hàng/i })).toBeInTheDocument();
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

    expect(screen.getAllByText("Hiển thị 21-21 / 67 khách")).toHaveLength(2);
    const pagers = screen.getAllByLabelText("Phân trang khách hàng");
    expect(pagers).toHaveLength(2);
    pagers.forEach((pager) => expect(pager).toHaveTextContent(/Trang\s+2\s+\/\s+4/));

    const topPager = pagers[0];
    fireEvent.click(within(topPager).getByRole("button", { name: /trước/i }));
    fireEvent.click(within(topPager).getByRole("button", { name: /sau/i }));

    expect(pagination.onPrevious).toHaveBeenCalledTimes(1);
    expect(pagination.onNext).toHaveBeenCalledTimes(1);
    expect(screen.getByText("20/trang")).toBeInTheDocument();
  });
});
