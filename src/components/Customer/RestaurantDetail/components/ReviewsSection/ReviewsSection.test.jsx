import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReviewsSection from "./ReviewsSection";
import { useMutation, useQuery } from "@apollo/client";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: vi.fn(), useMutation: vi.fn() };
});

describe("ReviewsSection staff tagging", () => {
  const createReviewMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useMutation.mockReturnValue([createReviewMock, { loading: false }]);
    const responses = [
      { data: { reviews: { items: [], total: 0 } }, loading: false },
      { data: { reviewStats: { total: 0, avgRating: 0, ratingBreakdown: {} } }, loading: false },
      { data: { publicRestaurantStaff: [{ id: "s1", fullName: "NV A" }] }, loading: false },
    ];
    let i = 0;
    useQuery.mockImplementation(() => responses[Math.min(i++, responses.length - 1)]);
  });

  it("sends staffId/staffName when staff is selected", async () => {
    render(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Ổn" } });
    fireEvent.change(screen.getByLabelText("Nhân viên phục vụ (không bắt buộc)"), { target: { value: "s1" } });
    createReviewMock.mockResolvedValueOnce({ data: { createReview: { id: "rv1" } } });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    await waitFor(() => expect(createReviewMock).toHaveBeenCalled());
    expect(createReviewMock.mock.calls[0][0].variables.input.staffId).toBe("s1");
    expect(createReviewMock.mock.calls[0][0].variables.input.staffName).toBe("NV A");
  });

  it('sends null/"" when no staff is selected and shows pending message', async () => {
    render(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Ổn" } });
    createReviewMock.mockResolvedValueOnce({ data: { createReview: { id: "rv1" } } });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    await waitFor(() => expect(createReviewMock).toHaveBeenCalled());
    expect(createReviewMock.mock.calls[0][0].variables.input.staffId).toBeNull();
    expect(createReviewMock.mock.calls[0][0].variables.input.staffName).toBe("");
    expect(screen.getByText("Đánh giá đã được gửi và đang chờ duyệt.")).toBeInTheDocument();
  });

  it("shows error and not success when mutation resolves with GraphQL errors", async () => {
    render(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Ổn" } });
    createReviewMock.mockResolvedValueOnce({ errors: [{ message: "Lỗi GraphQL" }], data: null });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    expect(await screen.findByText("Lỗi GraphQL")).toBeInTheDocument();
    expect(screen.queryByText("Đánh giá đã được gửi và đang chờ duyệt.")).not.toBeInTheDocument();
  });

  it("shows error when mutation succeeds without createReview id", async () => {
    render(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Ổn" } });
    createReviewMock.mockResolvedValueOnce({ data: { createReview: null } });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    expect(await screen.findByText("Không thể gửi đánh giá.")).toBeInTheDocument();
    expect(screen.queryByText("Đánh giá đã được gửi và đang chờ duyệt.")).not.toBeInTheDocument();
  });
});
