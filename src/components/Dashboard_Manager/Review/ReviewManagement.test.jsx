import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useMutation, useQuery } from "@apollo/client";
import ReviewManagement from "./ReviewManagement";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
});

vi.mock("@/utils/frontendPermissionAccess", () => ({
  hasPermission: vi.fn(() => true),
}));
vi.mock("../shared/ManagementPageHeader", () => ({
  default: ({ title, subtitle, stats = [] }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {stats.map((item) => (
        <span key={item.id}>
          {item.label}: {item.value}
        </span>
      ))}
    </header>
  ),
}));
vi.mock("../shared/ManagerCommandBar", () => ({
  default: ({
    tabs = [],
    onTabChange = () => {},
    searchValue = "",
    onSearchChange = () => {},
  }) => (
    <nav>
      <input
        aria-label="Tìm đánh giá"
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  ),
}));
vi.mock("./components/ReviewsSidebarFilters", () => ({
  default: ({ onReset = () => {} }) => (
    <aside>
      <span>Bộ lọc</span>
      <button type="button" onClick={onReset}>
        Reset
      </button>
    </aside>
  ),
}));
vi.mock("./components/ReviewsList", () => ({
  default: ({ reviews = [], emptyType }) => (
    <section data-testid="reviews-list">
      {reviews.length ? (
        reviews.map((review) => (
          <article key={review.id}>
            {review.customer_name} · {review.title} · {review.content}
          </article>
        ))
      ) : (
        <p>
          {emptyType === "filtered"
            ? "Không có đánh giá phù hợp với bộ lọc hiện tại."
            : "Chưa có đánh giá"}
        </p>
      )}
    </section>
  ),
}));
vi.mock("./components/ReviewModal", () => ({ default: () => null }));
vi.mock("@/components/common/NotificationBell", () => ({
  default: () => <button>Thông báo review</button>,
}));

const managerRole = {
  slug: "manager",
  name: "Manager",
  permissions: [{ code: "review.analytics.read" }],
  directPermissions: [],
  parentRole: null,
};

const baseReview = {
  targetType: "service",
  targetId: "65f100000000000000000102",
  targetName: "Tốc độ phục vụ",
  restaurantId: "res1",
  restaurantName: "Cohan Demo",
  customerId: "cus1",
  customerName: "Khách Demo",
  customerAvatar: "",
  staffId: "staff1",
  staffName: "NV Demo",
  images: [],
  location: "Hà Nội",
  verifiedPurchase: true,
  tags: ["service_speed"],
  likesCount: 1,
  commentsCount: 0,
  helpfulCount: 2,
  reactions: { like: 1, total: 1 },
  firstOfficialReply: null,
};

const reviews = [
  {
    ...baseReview,
    id: "rv-published-negative",
    rating: 2,
    title: "Cần phản hồi",
    content: "Phục vụ chậm cần phản hồi",
    status: "published",
    reportsCount: 1,
    createdAt: "2026-05-29T00:00:00.000Z",
  },
  {
    ...baseReview,
    id: "rv-published-reported-once",
    rating: 4,
    title: "Published review with report",
    content: "Review đã công khai nhưng có report cần hậu kiểm",
    status: "published",
    reportsCount: 1,
    createdAt: "2026-05-28T00:00:00.000Z",
  },
  {
    ...baseReview,
    id: "rv-reported",
    rating: 1,
    title: "Reported review",
    content: "Review đã bị báo cáo",
    status: "reported",
    reportsCount: 3,
    createdAt: "2026-05-27T00:00:00.000Z",
  },
];

const analyticsPayload = {
  totalReviews: 3,
  avgRating: 2.33,
  verifiedRate: 1,
  pendingCount: 0,
  negativeCount: 2,
  reportedCount: 1,
  ratingTrend: [{ date: "2026-05-29", total: 1, avgRating: 2 }],
  topTags: [{ name: "service_speed", count: 1 }],
  topStaffMentioned: [{ id: "staff1", name: "NV Demo", count: 1 }],
  lowRatedTargets: [
    {
      id: "65f100000000000000000102",
      name: "Tốc độ phục vụ",
      targetType: "service",
      count: 1,
      avgRating: 2,
    },
  ],
  reportBreakdown: [],
  actionQueueCounts: { needsModeration: 2, needsReply: 1, highRisk: 1 },
  reviewInsightSummary: {
    summary: "Heuristic summary",
    positives: ["ngon"],
    negatives: ["chậm"],
    recommendedActions: ["Phản hồi review 1–2 sao"],
    topPriorities: ["Ưu tiên high risk"],
    confidence: 0.7,
    source: "heuristic",
  },
};

function mockQueries(
  me,
  { restaurants = [{ id: "res1", name: "Cohan Demo" }], queryCalls = [] } = {},
) {
  useQuery.mockImplementation((query, options = {}) => {
    const source = String(query?.loc?.source?.body || query || "");
    queryCalls.push({ source, options });
    if (source.includes("query Me")) return { data: { me } };
    if (source.includes("ScopedRestaurants"))
      return {
        data: {
          scopedRestaurants: {
            edges: restaurants.map((node) => ({ node })),
          },
        },
      };
    if (source.includes("AllRestaurants"))
      return {
        data: { restaurants: { edges: restaurants.map((node) => ({ node })) } },
      };
    if (source.includes("GetReviews"))
      return {
        data: { reviews: { total: reviews.length, items: reviews } },
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    if (source.includes("GetReviewStats"))
      return {
        data: {
          reviewStats: {
            total: 1,
            avgRating: 2,
            pending: 99,
            ratingBreakdown: { 2: 1 },
          },
        },
      };
    if (source.includes("GetReviewReports"))
      return {
        data: {
          reviewReports: {
            total: 1,
            items: [
              {
                id: "rp1",
                reviewId: "rv-reported",
                restaurantId: "res1",
                reporterUserId: "cus2",
                reason: "spam",
                detail: "Report cần xử lý",
                status: "pending",
                createdAt: "2026-05-30T00:00:00.000Z",
              },
            ],
          },
          reviewReportStats: {
            total: 1,
            pending: 1,
            resolved: 0,
            rejected: 0,
            byReason: { spam: 1 },
          },
        },
        refetch: vi.fn(),
      };
    if (source.includes("GetReviewAnalytics")) {
      if (options.skip)
        return {
          data: undefined,
          loading: false,
          error: null,
          refetch: vi.fn(),
        };
      return {
        data: { reviewAnalytics: analyticsPayload },
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    return { data: {}, loading: false, error: null, refetch: vi.fn() };
  });
}

describe("ReviewManagement analytics", () => {
  it("renders the operations title, KPI copy, review customer/content, and filtered empty state", () => {
    mockQueries({
      id: "m1",
      fullName: "Manager",
      roleName: "Manager",
      role: managerRole,
    });
    render(<ReviewManagement />);

    expect(
      screen.getByRole("heading", { name: "Quản lý đánh giá" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Theo dõi phản hồi, điểm đánh giá và trạng thái xử lý/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Tổng đánh giá: 1")).toBeInTheDocument();
    expect(screen.getByText("Điểm trung bình: 2.0")).toBeInTheDocument();
    expect(screen.getAllByText(/Khách Demo/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Phục vụ chậm cần phản hồi/i)).toBeInTheDocument();
    expect(screen.queryByText(baseReview.customerId)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Tìm đánh giá"), {
      target: { value: "khong-co-review" },
    });

    expect(
      screen.getByText("Không có đánh giá phù hợp với bộ lọc hiện tại."),
    ).toBeInTheDocument();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    useMutation.mockReturnValue([vi.fn(), {}]);
  });

  it("renders analytics cards, queues, and review data for manager role after restaurant scope is selected", () => {
    mockQueries({
      id: "m1",
      fullName: "Manager",
      roleName: "Manager",
      role: managerRole,
    });
    render(<ReviewManagement />);

    expect(screen.getByText("Tổng quan đánh giá")).toBeInTheDocument();
    expect(screen.getByText("Chưa phản hồi: 1")).toBeInTheDocument();
    expect(screen.getByText("Tiêu cực/cảnh báo: 2")).toBeInTheDocument();
    expect(screen.queryByText("Đang xem xét: 99")).not.toBeInTheDocument();
    expect(screen.getAllByText("Cần phản hồi").length).toBeGreaterThan(1);
    expect(screen.getByText("service_speed")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Khách Demo · Cần phản hồi · Phục vụ chậm cần phản hồi/i,
      ),
    ).toBeInTheDocument();
  });

  it("keeps reported and report-backed public reviews visible when clicking moderation queue", () => {
    mockQueries({
      id: "m1",
      fullName: "Manager",
      roleName: "Manager",
      role: managerRole,
    });
    render(<ReviewManagement />);

    fireEvent.click(screen.getByRole("button", { name: /Báo cáo cần xử lý/i }));

    const list = screen.getByTestId("reviews-list");
    expect(
      within(list).getByText(
        /Khách Demo · Cần phản hồi · Phục vụ chậm cần phản hồi/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(list).getByText(/Published review with report/i),
    ).toBeInTheDocument();
    expect(within(list).getByText(/Reported review/i)).toBeInTheDocument();
  });

  it("supports report queue click without hiding the reported review", () => {
    mockQueries({
      id: "m1",
      fullName: "Manager",
      roleName: "Manager",
      role: managerRole,
    });
    render(<ReviewManagement />);

    fireEvent.click(screen.getByRole("button", { name: /Báo cáo cần xử lý/i }));

    const list = screen.getByTestId("reviews-list");
    expect(within(list).getByText(/Reported review/i)).toBeInTheDocument();
  });

  it("maps the Đang xem xét tab to reported status without targetType pending", () => {
    const queryCalls = [];
    mockQueries(
      { id: "m1", fullName: "Manager", roleName: "Manager", role: managerRole },
      { queryCalls },
    );
    render(<ReviewManagement />);

    fireEvent.click(screen.getByRole("button", { name: "Bị báo cáo" }));

    const reviewQueries = queryCalls.filter((call) =>
      call.source.includes("GetReviews"),
    );
    const latestReviewQuery = reviewQueries[reviewQueries.length - 1];
    expect(latestReviewQuery.options.variables.status).toBe("reported");
    expect(latestReviewQuery.options.variables.targetType).toBeUndefined();
    expect(latestReviewQuery.options.variables.targetType).not.toBe("pending");
  });

  it("skips analytics for non-admin manager until restaurantId is available", () => {
    const analyticsCalls = [];
    mockQueries(
      { id: "m1", fullName: "Manager", roleName: "Manager", role: managerRole },
      { restaurants: [] },
    );
    const baseImplementation = useQuery.getMockImplementation();
    useQuery.mockImplementation((query, options = {}) => {
      const source = String(query?.loc?.source?.body || query || "");
      if (source.includes("GetReviewAnalytics")) analyticsCalls.push(options);
      return baseImplementation(query, options);
    });

    render(<ReviewManagement />);

    expect(analyticsCalls[0]?.skip).toBe(true);
    expect(
      screen.getByText(
        "Chọn nhà hàng để xem phân tích trong phạm vi quản lý.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Không thể tải phân tích. Dữ liệu đánh giá vẫn hiển thị bên dưới.",
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps ADMIN as admin and supports role.slug fallback without restaurantId", () => {
    const analyticsCalls = [];
    mockQueries(
      {
        id: "a1",
        fullName: "Admin",
        roleName: "ADMIN",
        role: { ...managerRole, slug: "admin" },
      },
      { restaurants: [] },
    );
    const baseImplementation = useQuery.getMockImplementation();
    useQuery.mockImplementation((query, options = {}) => {
      const source = String(query?.loc?.source?.body || query || "");
      if (source.includes("GetReviewAnalytics")) analyticsCalls.push(options);
      return baseImplementation(query, options);
    });

    render(<ReviewManagement />);

    expect(analyticsCalls[0]?.skip).toBe(false);
    expect(screen.getByText("Tổng quan đánh giá")).toBeInTheDocument();
    expect(screen.getAllByText("Trung tâm xử lý đánh giá").length).toBeGreaterThan(0);
  });
});
