import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useApolloClient,
  useMutation,
  useQuery,
} from "@apollo/client";
import ReviewModal from "./ReviewModal";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useApolloClient: vi.fn(),
    useMutation: vi.fn(),
    useQuery: vi.fn(),
  };
});

const review = {
  id: "review-1",
  restaurantId: "restaurant-1",
  customer_name: "Khách A",
  rating: 2,
  title: "Phục vụ chậm",
  content: "Nội dung đánh giá hợp lệ",
  images: "[]",
  created_at: "2026-07-10T10:00:00.000Z",
};

describe("ReviewModal official reply", () => {
  const createReply = vi.fn();
  const refetchComments = vi.fn();
  const refetchQueries = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useApolloClient.mockReturnValue({ refetchQueries });
    useMutation.mockReturnValue([createReply, { loading: false }]);
    useQuery.mockImplementation((query) => {
      const source = String(query?.loc?.source?.body || query || "");
      if (source.includes("GetReviewDetail")) {
        return {
          data: {
            review: {
              id: "review-1",
              restaurantId: "restaurant-1",
              customerName: "Khách A",
              rating: 2,
              title: "Phục vụ chậm",
              content: "Nội dung đánh giá hợp lệ",
              images: [],
              createdAt: "2026-07-10T10:00:00.000Z",
            },
          },
          loading: false,
        };
      }
      if (source.includes("GetReviewComments")) {
        return {
          data: { reviewComments: { total: 0, items: [] } },
          loading: false,
          refetch: refetchComments,
        };
      }
      if (source.includes("GetReviewTimeline")) {
        return {
          data: { reviewTimeline: [] },
          loading: false,
        };
      }
      return { data: {}, loading: false };
    });
    createReply.mockResolvedValue({
      data: {
        createReviewComment: {
          id: "comment-1",
          reviewId: "review-1",
          restaurantId: "restaurant-1",
          officialReply: true,
          content: "Nhà hàng đã ghi nhận.",
          status: "published",
        },
      },
    });
    refetchComments.mockResolvedValue({ data: {} });
    refetchQueries.mockResolvedValue([]);
  });

  it("refetches list, statistics and analytics after a successful official reply", async () => {
    render(
      <ReviewModal
        visible
        review={review}
        canReply
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Phản hồi chính thức"), {
      target: { value: "Nhà hàng đã ghi nhận." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));

    await waitFor(() => expect(createReply).toHaveBeenCalledTimes(1));
    expect(createReply).toHaveBeenCalledWith({
      variables: {
        input: {
          reviewId: "review-1",
          restaurantId: "restaurant-1",
          officialReply: true,
          content: "Nhà hàng đã ghi nhận.",
        },
      },
    });
    expect(refetchComments).toHaveBeenCalledTimes(1);
    expect(refetchQueries).toHaveBeenCalledWith({
      include: [
        "GetReviews",
        "GetReviewStats",
        "GetReviewAnalytics",
        "GetRestaurantReviews",
        "GetRestaurantReviewStats",
      ],
    });
    expect(screen.getByText("Đã gửi phản hồi chính thức.")).toBeInTheDocument();
  });

  it("shows a recoverable error when the reply mutation fails", async () => {
    createReply.mockRejectedValueOnce(new Error("Không thể gửi"));
    render(
      <ReviewModal
        visible
        review={review}
        canReply
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Phản hồi chính thức"), {
      target: { value: "Nhà hàng đã ghi nhận." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể gửi");
    expect(refetchQueries).not.toHaveBeenCalled();
  });
});
