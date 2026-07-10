import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import ReviewsSection from "./ReviewsSection";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useMutation: vi.fn(),
    useQuery: vi.fn(),
  };
});

const sampleReview = {
  id: "review-1",
  customerName: "Khách A",
  customerAvatar: "",
  rating: 4,
  title: "Khá tốt",
  content: "Nội dung đánh giá hợp lệ",
  images: [],
  tags: [],
  createdAt: "2026-07-10T10:00:00.000Z",
  status: "published",
  reportsCount: 0,
  likesCount: 0,
  helpfulCount: 0,
  commentsCount: 2,
  verifiedPurchase: true,
  firstOfficialReply: null,
};

const renderWithAuth = () =>
  render(
    <AuthContext.Provider
      value={{
        isAuthenticated: true,
        user: { id: "customer-1", roleName: "customer" },
      }}
    >
      <ReviewsSection restaurantId="restaurant-1" />
    </AuthContext.Provider>,
  );

describe("ReviewsSection customer flow", () => {
  const createReview = vi.fn();
  const reportReview = vi.fn();
  const reactReview = vi.fn();
  const helpfulReview = vi.fn();
  const refetchReviews = vi.fn();
  const refetchStats = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useQuery.mockImplementation((query) => {
      const source = String(query?.loc?.source?.body || query || "");
      if (source.includes("GetRestaurantReviews")) {
        return {
          data: { reviews: { total: 1, items: [sampleReview] } },
          loading: false,
          error: null,
          fetchMore: vi.fn(),
          refetch: refetchReviews,
        };
      }
      if (source.includes("GetRestaurantReviewStats")) {
        return {
          data: {
            reviewStats: {
              total: 1,
              avgRating: 4,
              pending: 0,
              ratingBreakdown: { 4: 1 },
            },
          },
          refetch: refetchStats,
        };
      }
      if (source.includes("GetPublicRestaurantStaff")) {
        return { data: { publicRestaurantStaff: [] } };
      }
      return { data: {} };
    });
    useMutation.mockImplementation((mutation) => {
      const source = String(mutation?.loc?.source?.body || mutation || "");
      if (source.includes("CreateReview")) {
        return [createReview, { loading: false }];
      }
      if (source.includes("ReportReview")) {
        return [reportReview, { loading: false }];
      }
      if (source.includes("ReactReview")) {
        return [reactReview, { loading: false }];
      }
      if (source.includes("HelpfulReview")) {
        return [helpfulReview, { loading: false }];
      }
      return [vi.fn(), { loading: false }];
    });
    refetchReviews.mockResolvedValue({ data: {} });
    refetchStats.mockResolvedValue({ data: {} });
  });

  it("rejects content shorter than the backend minimum before calling createReview", async () => {
    renderWithAuth();

    fireEvent.click(screen.getByRole("button", { name: "Viết đánh giá" }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), {
      target: { value: "Quá ngắn" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));

    expect(createReview).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nội dung đánh giá phải có ít nhất 10 ký tự.",
    );
  });

  it("renders the reply count as non-interactive information", () => {
    renderWithAuth();

    expect(screen.queryByRole("button", { name: /bình luận/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("2 phản hồi")).toBeInTheDocument();
  });

  it("refetches the current review list and statistics after reporting", async () => {
    reportReview.mockResolvedValueOnce({
      data: {
        reportReview: {
          id: "report-1",
          status: "pending",
          reason: "spam",
        },
      },
    });
    renderWithAuth();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Báo cáo đánh giá của Khách A",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Gửi báo cáo" }));

    await waitFor(() => expect(reportReview).toHaveBeenCalledTimes(1));
    expect(refetchReviews).toHaveBeenCalledTimes(1);
    expect(refetchStats).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Đã gửi báo cáo đánh giá.")).toBeInTheDocument();
  });
});
