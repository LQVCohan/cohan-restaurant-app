import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "@apollo/client";
import ReviewManagement from "./ReviewManagement";

const permissionMocks = vi.hoisted(() => ({
  hasPermission: vi.fn(() => true),
}));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
});

vi.mock("@/utils/frontendPermissionAccess", () => permissionMocks);

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
    onSearchChange,
  }) => (
    <nav>
      {onSearchChange && (
        <input
          aria-label="Tìm đánh giá"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      )}
      {tabs.map((tab) => (
        <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  ),
}));

vi.mock("./components/ReviewsSidebarFilters", () => ({
  default: ({ onReset = () => {} }) => (
    <aside data-testid="reviews-sidebar">
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
  reportedCount: 2,
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
    summary: "Tóm tắt thử nghiệm",
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
    if (source.includes("ScopedRestaurants")) {
      return {
        data: {
          scopedRestaurants: {
            edges: restaurants.map((node) => ({ node })),
          },
        },
      };
    }
    if (source.includes("AllRestaurants")) {
      return {
        data: { restaurants: { edges: restaurants.map((node) => ({ node })) } },
      };
    }
    if (source.includes("GetReviews")) {
      return {
        data: { reviews: { total: reviews.length, items: reviews } },
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (source.includes("GetReviewStats")) {
      return {
        data: {
          reviewStats: {
            total: reviews.length,
            avgRating: 2.33,
            pending: 0,
            ratingBreakdown: { 1: 1, 2: 1, 4: 1 },
          },
        },
      };
    }
    if (source.includes("GetReviewReports")) {
      if (options.skip) {
        return { data: undefined, loading: false, error: null, refetch: vi.fn() };
      }
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
        loading: false,
        error: null,
        refetch: vi.fn(),
      };
    }
    if (source.includes("GetReviewAnalytics")) {
      if (options.skip) {
        return { data: undefined, loading: false, error: null, refetch: vi.fn() };
      }
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

const manager = {
  id: "m1",
  fullName: "Manager",
  roleName: "Manager",
  role: managerRole,
};

beforeEach(() => {
  vi.clearAllMocks();
  permissionMocks.hasPermission.mockReturnValue(true);
  useMutation.mockReturnValue([vi.fn(), {}]);
});

describe("ReviewManagement dedicated analytics tab", () => {
  it("opens on the review list and keeps analytics out of the operational view", () => {
    const queryCalls = [];
    mockQueries(manager, { queryCalls });

    render(<ReviewManagement />);

    expect(
      screen.getByRole("heading", { name: "Quản lý đánh giá" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("reviews-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("reviews-list")).toBeInTheDocument();
    expect(screen.getByLabelText("Tìm đánh giá")).toBeInTheDocument();
    expect(screen.queryByText("Tổng quan đánh giá")).not.toBeInTheDocument();

    const analyticsCalls = queryCalls.filter((call) =>
      call.source.includes("GetReviewAnalytics"),
    );
    expect(analyticsCalls.at(-1)?.options.skip).toBe(true);
  });

  it("renders analytics as a separate full-width tab and hides review controls", () => {
    const queryCalls = [];
    mockQueries(manager, { queryCalls });

    render(<ReviewManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Phân tích" }));

    expect(screen.getByText("Tổng quan đánh giá")).toBeInTheDocument();
    expect(screen.getByLabelText("Phạm vi nhà hàng phân tích")).toBeInTheDocument();
    expect(screen.getByText("Tóm tắt thử nghiệm")).toBeInTheDocument();
    expect(screen.getByText("service_speed")).toBeInTheDocument();
    expect(screen.queryByTestId("reviews-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tìm đánh giá")).not.toBeInTheDocument();

    const analyticsCalls = queryCalls.filter((call) =>
      call.source.includes("GetReviewAnalytics"),
    );
    expect(analyticsCalls.at(-1)?.options.skip).toBe(false);
  });

  it("returns from an analytics queue to the correctly filtered review list", () => {
    mockQueries(manager);

    render(<ReviewManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Phân tích" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Báo cáo cần xử lý/i }),
    );

    expect(screen.queryByText("Tổng quan đánh giá")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bị báo cáo" })).toBeInTheDocument();

    const list = screen.getByTestId("reviews-list");
    expect(within(list).getByText(/Cần phản hồi/i)).toBeInTheDocument();
    expect(within(list).getByText(/Published review with report/i)).toBeInTheDocument();
    expect(within(list).getByText(/Reported review/i)).toBeInTheDocument();
  });

  it("keeps search and filtered empty state working on review tabs", () => {
    mockQueries(manager);

    render(<ReviewManagement />);
    fireEvent.change(screen.getByLabelText("Tìm đánh giá"), {
      target: { value: "khong-co-review" },
    });

    expect(
      screen.getByText("Không có đánh giá phù hợp với bộ lọc hiện tại."),
    ).toBeInTheDocument();
  });

  it("maps the reported tab to status without using a target type", () => {
    const queryCalls = [];
    mockQueries(manager, { queryCalls });

    render(<ReviewManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Bị báo cáo" }));

    const reviewQueries = queryCalls.filter((call) =>
      call.source.includes("GetReviews"),
    );
    const latestReviewQuery = reviewQueries.at(-1);
    expect(latestReviewQuery.options.variables.status).toBe("reported");
    expect(latestReviewQuery.options.variables.targetType).toBeUndefined();
  });

  it("shows the scope message and keeps analytics skipped when a manager has no restaurant", () => {
    const queryCalls = [];
    mockQueries(manager, { restaurants: [], queryCalls });

    render(<ReviewManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Phân tích" }));

    expect(
      screen.getByText("Chọn nhà hàng để xem phân tích trong phạm vi quản lý."),
    ).toBeInTheDocument();
    const analyticsCalls = queryCalls.filter((call) =>
      call.source.includes("GetReviewAnalytics"),
    );
    expect(analyticsCalls.at(-1)?.options.skip).toBe(true);
  });

  it("allows admin analytics without a selected restaurant", () => {
    const queryCalls = [];
    mockQueries(
      {
        id: "a1",
        fullName: "Admin",
        roleName: "ADMIN",
        role: { ...managerRole, slug: "admin" },
      },
      { restaurants: [], queryCalls },
    );

    render(<ReviewManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Phân tích" }));

    expect(screen.getByText("Tổng quan đánh giá")).toBeInTheDocument();
    const analyticsCalls = queryCalls.filter((call) =>
      call.source.includes("GetReviewAnalytics"),
    );
    expect(analyticsCalls.at(-1)?.options.skip).toBe(false);
  });

  it("hides the analytics tab and never runs analytics without permission", () => {
    const queryCalls = [];
    permissionMocks.hasPermission.mockImplementation(
      (_user, code) => code !== "review.analytics.read",
    );
    mockQueries(manager, { queryCalls });

    render(<ReviewManagement />);

    expect(
      screen.queryByRole("button", { name: "Phân tích" }),
    ).not.toBeInTheDocument();
    const analyticsCalls = queryCalls.filter((call) =>
      call.source.includes("GetReviewAnalytics"),
    );
    expect(analyticsCalls.at(-1)?.options.skip).toBe(true);
  });
});
