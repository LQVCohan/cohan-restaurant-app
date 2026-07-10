import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import PostOrderReviewPrompt from "./PostOrderReviewPrompt";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useMutation: vi.fn(),
    useQuery: vi.fn(),
  };
});

const completedOrder = {
  id: "order-1",
  orderCode: "ORD-001",
  restaurantId: "restaurant-1",
  currentStatus: "completed",
  createdAt: "2026-07-10T10:00:00.000Z",
  items: [{ name: "Món A" }],
};

const renderPrompt = () =>
  render(
    <AuthContext.Provider
      value={{
        isAuthenticated: true,
        user: { id: "customer-1", roleName: "customer" },
      }}
    >
      <PostOrderReviewPrompt />
    </AuthContext.Provider>,
  );

describe("PostOrderReviewPrompt", () => {
  const createReview = vi.fn();
  const refetchOrders = vi.fn();
  const refetchReservations = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useMutation.mockReturnValue([createReview, { loading: false }]);
    useQuery.mockImplementation((query) => {
      const source = String(query?.loc?.source?.body || query || "");
      if (source.includes("OrdersByUserForReviewPrompt")) {
        return {
          data: {
            ordersByUser: { edges: [{ node: completedOrder }] },
          },
          refetch: refetchOrders,
        };
      }
      if (source.includes("MyReservationsForReviewPrompt")) {
        return {
          data: { myReservations: [] },
          refetch: refetchReservations,
        };
      }
      return { data: {} };
    });
    refetchOrders.mockResolvedValue({ data: {} });
    refetchReservations.mockResolvedValue({ data: {} });
  });

  it("keeps the prompt open and displays the mutation error", async () => {
    createReview.mockRejectedValueOnce(new Error("Bạn đã gửi đánh giá gần đây."));
    renderPrompt();

    fireEvent.click(screen.getByRole("button", { name: "Đánh giá" }));
    fireEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bạn đã gửi đánh giá gần đây.",
    );
    expect(screen.getByRole("button", { name: "Gửi đánh giá" })).toBeInTheDocument();
    expect(window.localStorage.getItem("cohan.reviewedCompletedOrders.v1")).toBeNull();
  });

  it("stores the completed target only after the backend confirms success", async () => {
    createReview.mockResolvedValueOnce({
      data: {
        createReview: {
          id: "review-1",
          rating: 5,
          status: "published",
        },
      },
    });
    renderPrompt();

    fireEvent.click(screen.getByRole("button", { name: "Đánh giá" }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), {
      target: { value: "Món ăn ngon và phục vụ nhanh." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));

    await waitFor(() => expect(createReview).toHaveBeenCalledTimes(1));
    expect(JSON.parse(window.localStorage.getItem("cohan.reviewedCompletedOrders.v1"))).toContain(
      "order:order-1",
    );
    expect(refetchOrders).toHaveBeenCalledTimes(1);
    expect(refetchReservations).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Đánh giá sau đơn hoàn tất")).not.toBeInTheDocument();
  });
});
