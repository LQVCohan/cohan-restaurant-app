import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReviewsSection from "./ReviewsSection";
import { useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
});

const renderWithAuth = (ui, value = { isAuthenticated: true, user: { id: "u1", fullName: "Khách A" } }) => render(
  <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>,
);

describe("ReviewsSection staff tagging", () => {
  const createReviewMock = vi.fn();
  const passthroughMutation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useMutation.mockImplementation((mutation) => {
      const source = String(mutation?.loc?.source?.body || mutation || "");
      if (source.includes("CreateReview")) return [createReviewMock, { loading: false }];
      return [passthroughMutation, { loading: false }];
    });
    const responses = [
      { data: { reviews: { items: [], total: 0 } }, loading: false },
      { data: { reviewStats: { total: 0, avgRating: 0, ratingBreakdown: {} } }, loading: false },
      { data: { publicRestaurantStaff: [{ id: "s1", fullName: "NV A" }] }, loading: false },
    ];
    let i = 0;
    useQuery.mockImplementation(() => responses[Math.min(i++, responses.length - 1)]);
  });

  it("does not submit review when user is not logged in", async () => {
    renderWithAuth(<ReviewsSection restaurantId="r1" />, { isAuthenticated: false, user: null });
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Nội dung đánh giá hợp lệ" } });
    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    expect(createReviewMock).not.toHaveBeenCalled();
    expect(screen.getByText("Vui lòng đăng nhập để gửi đánh giá.")).toBeInTheDocument();
  });

  it("sends staffId only when staff is selected because backend derives staffName", async () => {
    renderWithAuth(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Nội dung đánh giá hợp lệ" } });
    fireEvent.change(screen.getByLabelText("Nhân viên phục vụ (không bắt buộc)"), { target: { value: "s1" } });
    createReviewMock.mockResolvedValueOnce({ data: { createReview: { id: "rv1" } } });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    await waitFor(() => expect(createReviewMock).toHaveBeenCalled());
    expect(createReviewMock.mock.calls[0][0].variables.input.staffId).toBe("s1");
    expect(createReviewMock.mock.calls[0][0].variables.input.staffName).toBeUndefined();
    expect(createReviewMock.mock.calls[0][0].variables.input.customerName).toBeUndefined();
  });

  it('sends null when no staff is selected and shows pending message', async () => {
    renderWithAuth(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Nội dung đánh giá hợp lệ" } });
    createReviewMock.mockResolvedValueOnce({ data: { createReview: { id: "rv1" } } });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    await waitFor(() => expect(createReviewMock).toHaveBeenCalled());
    expect(createReviewMock.mock.calls[0][0].variables.input.staffId).toBeNull();
    expect(screen.getByText("Đánh giá đã gửi và đang chờ duyệt.")).toBeInTheDocument();
  });

  it("shows error and not success when mutation resolves with GraphQL errors", async () => {
    renderWithAuth(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Nội dung đánh giá hợp lệ" } });
    createReviewMock.mockResolvedValueOnce({ errors: [{ message: "Lỗi GraphQL" }], data: null });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    expect(await screen.findByText("Lỗi GraphQL")).toBeInTheDocument();
    expect(screen.queryByText("Đánh giá đã gửi và đang chờ duyệt.")).not.toBeInTheDocument();
  });

  it("shows error when mutation succeeds without createReview id", async () => {
    renderWithAuth(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Nội dung đánh giá hợp lệ" } });
    createReviewMock.mockResolvedValueOnce({ data: { createReview: null } });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    expect(await screen.findByText("Không thể gửi đánh giá.")).toBeInTheDocument();
    expect(screen.queryByText("Đánh giá đã gửi và đang chờ duyệt.")).not.toBeInTheDocument();
  });
});
