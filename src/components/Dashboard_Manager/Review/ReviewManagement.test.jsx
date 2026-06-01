import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useMutation, useQuery } from "@apollo/client";
import ReviewManagement from "./ReviewManagement";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
});

vi.mock("@/utils/frontendPermissionAccess", () => ({ hasPermission: vi.fn(() => true) }));
vi.mock("../shared/ManagementPageHeader", () => ({ default: ({ title, stats = [] }) => <header><h1>{title}</h1>{stats.map((item) => <span key={item.id}>{item.label}: {item.value}</span>)}</header> }));
vi.mock("../shared/ManagerCommandBar", () => ({ default: ({ tabs = [] }) => <nav>{tabs.map((tab) => <button key={tab.id}>{tab.label}</button>)}</nav> }));
vi.mock("./components/ReviewsSidebarFilters", () => ({ default: () => <aside>Bộ lọc</aside> }));
vi.mock("./components/ReviewsList", () => ({ default: ({ reviews = [] }) => <section data-testid="reviews-list">{reviews.map((review) => <article key={review.id}>{review.title}</article>)}</section> }));
vi.mock("./components/ReviewModal", () => ({ default: () => null }));
vi.mock("@/components/common/NotificationBell", () => ({ default: () => <button>Thông báo review</button> }));

const managerRole = { slug: "manager", name: "Manager", permissions: [{ code: "review.analytics.read" }], directPermissions: [], parentRole: null };

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
    id: "rv-pending",
    rating: 4,
    title: "Pending review",
    content: "Review đang chờ duyệt",
    status: "pending",
    reportsCount: 0,
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
  pendingCount: 1,
  negativeCount: 2,
  reportedCount: 1,
  ratingTrend: [{ date: "2026-05-29", total: 1, avgRating: 2 }],
  topTags: [{ name: "service_speed", count: 1 }],
  topStaffMentioned: [{ id: "staff1", name: "NV Demo", count: 1 }],
  lowRatedTargets: [{ id: "65f100000000000000000102", name: "Tốc độ phục vụ", targetType: "service", count: 1, avgRating: 2 }],
  reportBreakdown: [],
  actionQueueCounts: { needsModeration: 2, needsReply: 1, highRisk: 1 },
  reviewInsightSummary: { summary: "Heuristic summary", positives: ["ngon"], negatives: ["chậm"], recommendedActions: ["Phản hồi review 1–2 sao"], topPriorities: ["Ưu tiên high risk"], confidence: 0.7, source: "heuristic" },
};

function mockQueries(me, { restaurants = [{ id: "res1", name: "Cohan Demo" }] } = {}) {
  useQuery.mockImplementation((query, options = {}) => {
    const source = String(query?.loc?.source?.body || query || "");
    if (source.includes("query Me")) return { data: { me } };
    if (source.includes("ManagerRestaurants")) return { data: { restaurantsByManager: { edges: restaurants.map((node) => ({ node })) } } };
    if (source.includes("AllRestaurants")) return { data: { restaurants: { edges: restaurants.map((node) => ({ node })) } } };
    if (source.includes("GetReviews")) return { data: { reviews: { total: reviews.length, items: reviews } }, loading: false, error: null, refetch: vi.fn() };
    if (source.includes("GetReviewStats")) return { data: { reviewStats: { total: 1, avgRating: 2, pending: 0, ratingBreakdown: { 2: 1 } } } };
    if (source.includes("GetReviewReports")) return { data: { reviewReports: { total: 1, items: [{ id: "rp1", reviewId: "rv-reported", restaurantId: "res1", reporterUserId: "cus2", reason: "spam", detail: "Report cần xử lý", status: "pending", createdAt: "2026-05-30T00:00:00.000Z" }] }, reviewReportStats: { total: 1, pending: 1, resolved: 0, rejected: 0, byReason: { spam: 1 } } }, refetch: vi.fn() };
    if (source.includes("GetReviewAnalytics")) {
      if (options.skip) return { data: undefined, loading: false, error: null, refetch: vi.fn() };
      return { data: { reviewAnalytics: analyticsPayload }, loading: false, error: null, refetch: vi.fn() };
    }
    return { data: {}, loading: false, error: null, refetch: vi.fn() };
  });
}

describe("ReviewManagement analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMutation.mockReturnValue([vi.fn(), {}]);
  });

  it("renders analytics cards, queues, and review data for manager role after restaurant scope is selected", () => {
    mockQueries({ id: "m1", fullName: "Manager", roleName: "Manager", role: managerRole });
    render(<ReviewManagement />);

    expect(screen.getByText("Tổng quan đánh giá")).toBeInTheDocument();
    expect(screen.getByText("Tỷ lệ verified")).toBeInTheDocument();
    expect(screen.getAllByText("Cần phản hồi").length).toBeGreaterThan(1);
    expect(screen.getByText("service_speed")).toBeInTheDocument();
    expect(screen.getByText("Cần phản hồi", { selector: "article" })).toBeInTheDocument();
  });

  it("keeps pending and reported reviews visible when clicking needs moderation queue", () => {
    mockQueries({ id: "m1", fullName: "Manager", roleName: "Manager", role: managerRole });
    render(<ReviewManagement />);

    fireEvent.click(screen.getByRole("button", { name: /Cần kiểm duyệt/i }));

    const list = screen.getByTestId("reviews-list");
    expect(within(list).getByText("Pending review")).toBeInTheDocument();
    expect(within(list).getByText("Reported review")).toBeInTheDocument();
    expect(within(list).queryByText("Cần phản hồi")).not.toBeInTheDocument();
  });

  it("supports report queue click without hiding the reported review", () => {
    mockQueries({ id: "m1", fullName: "Manager", roleName: "Manager", role: managerRole });
    render(<ReviewManagement />);

    fireEvent.click(screen.getByRole("button", { name: /Report cần xử lý/i }));

    const list = screen.getByTestId("reviews-list");
    expect(within(list).getByText("Reported review")).toBeInTheDocument();
  });

  it("skips analytics for non-admin manager until restaurantId is available", () => {
    const analyticsCalls = [];
    mockQueries({ id: "m1", fullName: "Manager", roleName: "Manager", role: managerRole }, { restaurants: [] });
    const baseImplementation = useQuery.getMockImplementation();
    useQuery.mockImplementation((query, options = {}) => {
      const source = String(query?.loc?.source?.body || query || "");
      if (source.includes("GetReviewAnalytics")) analyticsCalls.push(options);
      return baseImplementation(query, options);
    });

    render(<ReviewManagement />);

    expect(analyticsCalls[0]?.skip).toBe(true);
    expect(screen.getByText("Đang chuẩn bị dữ liệu phân tích...")).toBeInTheDocument();
    expect(screen.queryByText("Không thể tải analytics. Dữ liệu review vẫn hiển thị bên dưới.")).not.toBeInTheDocument();
  });

  it("keeps ADMIN as admin and supports role.slug fallback without restaurantId", () => {
    const analyticsCalls = [];
    mockQueries({ id: "a1", fullName: "Admin", roleName: "ADMIN", role: { ...managerRole, slug: "admin" } }, { restaurants: [] });
    const baseImplementation = useQuery.getMockImplementation();
    useQuery.mockImplementation((query, options = {}) => {
      const source = String(query?.loc?.source?.body || query || "");
      if (source.includes("GetReviewAnalytics")) analyticsCalls.push(options);
      return baseImplementation(query, options);
    });

    render(<ReviewManagement />);

    expect(analyticsCalls[0]?.skip).toBe(false);
    expect(screen.getByText("Tổng quan đánh giá")).toBeInTheDocument();
    expect(screen.getByText("Tỷ lệ verified")).toBeInTheDocument();
  });
});
