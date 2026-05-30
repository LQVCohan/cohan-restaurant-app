import React from "react";
import { render, screen } from "@testing-library/react";
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

const managerRole = { slug: "manager", name: "Manager", permissions: [{ code: "review.analytics.read" }], directPermissions: [], parentRole: null };

const review = {
  id: "rv1",
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
  rating: 2,
  title: "Cần phản hồi",
  content: "Phục vụ chậm cần phản hồi",
  images: [],
  location: "Hà Nội",
  verifiedPurchase: true,
  tags: ["service_speed"],
  status: "published",
  likesCount: 1,
  commentsCount: 0,
  reportsCount: 1,
  helpfulCount: 2,
  reactions: { like: 1, total: 1 },
  createdAt: "2026-05-29T00:00:00.000Z",
  firstOfficialReply: null,
};

const analyticsPayload = {
  totalReviews: 1,
  avgRating: 2,
  verifiedRate: 1,
  pendingCount: 0,
  negativeCount: 1,
  reportedCount: 0,
  ratingTrend: [{ date: "2026-05-29", total: 1, avgRating: 2 }],
  topTags: [{ name: "service_speed", count: 1 }],
  topStaffMentioned: [{ id: "staff1", name: "NV Demo", count: 1 }],
  lowRatedTargets: [{ id: "65f100000000000000000102", name: "Tốc độ phục vụ", targetType: "service", count: 1, avgRating: 2 }],
  reportBreakdown: [],
  actionQueueCounts: { needsModeration: 0, needsReply: 1, highRisk: 1 },
};

function mockQueries(me, { restaurants = [{ id: "res1", name: "Cohan Demo" }] } = {}) {
  useQuery.mockImplementation((query, options = {}) => {
    const source = String(query?.loc?.source?.body || query || "");
    if (source.includes("query Me")) return { data: { me } };
    if (source.includes("ManagerRestaurants")) return { data: { restaurantsByManager: { edges: restaurants.map((node) => ({ node })) } } };
    if (source.includes("AllRestaurants")) return { data: { restaurants: { edges: restaurants.map((node) => ({ node })) } } };
    if (source.includes("GetReviews")) return { data: { reviews: { total: 1, items: [review] } }, loading: false, error: null, refetch: vi.fn() };
    if (source.includes("GetReviewStats")) return { data: { reviewStats: { total: 1, avgRating: 2, pending: 0, ratingBreakdown: { 2: 1 } } } };
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
