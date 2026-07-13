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

const recentDate = (hoursAgo = 1) =>
  new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

const completedOrder = {
  id: "order-1",
  orderCode: "ORD-001",
  restaurantId: "restaurant-1",
  currentStatus: "completed",
  orderPaymentStatus: "unpaid",
  createdAt: recentDate(3),
  updatedAt: recentDate(1),
  payment: { status: "unpaid", paidAt: null },
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
  let orders = [completedOrder];

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    orders = [completedOrder];
    useMutation.mockReturnValue([createReview, { loading: false }]);
    useQuery.mockImplementation((query) => {
      const source = String(query?.loc?.source?.body || query || "");
      if (source.includes("OrdersByUserForReviewPrompt")) {
        return {
          data: {
            ordersByUser: {
              edges: orders.map((order) => ({ node: order })),
            },
          },
          refetch: refetchOrders,
        };
      }
      return { data: {} };
    });
    refetchOrders.mockResolvedValue({ data: {} });
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

  it("stores the completed order only after the backend confirms success", async () => {
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
    expect(createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: expect.objectContaining({
            targetType: "restaurant",
            targetId: "restaurant-1",
            tags: ["order"],
          }),
        },
      }),
    );
    expect(JSON.parse(window.localStorage.getItem("cohan.reviewedCompletedOrders.v1"))).toContain(
      "order:order-1",
    );
    expect(refetchOrders).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Đánh giá nhà hàng sau đơn hoàn tất")).not.toBeInTheDocument();
  });

  it("does not query reservations or show a prompt for an unfinished order", () => {
    orders = [
      {
        ...completedOrder,
        id: "order-pending",
        currentStatus: "pending",
        orderPaymentStatus: "unpaid",
        payment: { status: "unpaid", paidAt: null },
      },
    ];

    renderPrompt();

    expect(useQuery).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Đánh giá nhà hàng sau đơn hoàn tất")).not.toBeInTheDocument();
  });

  it("shows the restaurant review prompt after payment is completed", () => {
    orders = [
      {
        ...completedOrder,
        id: "order-paid",
        orderCode: "ORD-PAID",
        currentStatus: "served",
        orderPaymentStatus: "paid",
        payment: { status: "paid", paidAt: recentDate(1) },
      },
    ];

    renderPrompt();

    expect(screen.getByLabelText("Đánh giá nhà hàng sau đơn hoàn tất")).toBeInTheDocument();
    expect(screen.getByText("ORD-PAID")).toBeInTheDocument();
  });

  it("does not surface stale completed orders", () => {
    orders = [
      {
        ...completedOrder,
        id: "order-old",
        createdAt: recentDate(24 * 10),
        updatedAt: recentDate(24 * 8),
      },
    ];

    renderPrompt();

    expect(screen.queryByLabelText("Đánh giá nhà hàng sau đơn hoàn tất")).not.toBeInTheDocument();
  });
});
