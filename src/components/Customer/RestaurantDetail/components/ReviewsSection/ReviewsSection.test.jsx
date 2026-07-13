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

const sampleReview = {
  id: "rv-published-1",
  customerName: "Khách B",
  customerAvatar: "",
  rating: 5,
  title: "Tốt",
  content: "Nội dung đánh giá hợp lệ",
  images: [],
  tags: [],
  createdAt: "2026-05-29T00:00:00.000Z",
  likesCount: 0,
  helpfulCount: 0,
  commentsCount: 0,
  verifiedPurchase: true,
  firstOfficialReply: {
    id: "c-official-1",
    authorName: "Nhà hàng Cohan",
    content: "Cảm ơn bạn đã góp ý, nhà hàng đã ghi nhận.",
    createdAt: "2026-05-29T01:00:00.000Z",
  },
};

const renderWithAuth = (ui, value = { isAuthenticated: true, user: { id: "u1", fullName: "Khách A" } }) => render(
  <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>,
);

describe("ReviewsSection staff tagging", () => {
  const createReviewMock = vi.fn();
  const reactReviewMock = vi.fn();
  const helpfulReviewMock = vi.fn();
  const reportReviewMock = vi.fn();
  const passthroughMutation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useMutation.mockImplementation((mutation) => {
      const source = String(mutation?.loc?.source?.body || mutation || "");
      if (source.includes("CreateReview")) return [createReviewMock, { loading: false }];
      if (source.includes("ReactReview")) return [reactReviewMock, { loading: false }];
      if (source.includes("HelpfulReview")) return [helpfulReviewMock, { loading: false }];
      if (source.includes("ReportReview")) return [reportReviewMock, { loading: false }];
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
    expect(screen.getAllByText("Vui lòng đăng nhập để gửi đánh giá.")[0]).toBeInTheDocument();
  });

  it("does not call react/helpful/report mutations when user is not logged in", async () => {
    useQuery.mockImplementation((query) => {
      const source = String(query?.loc?.source?.body || query || "");
      if (source.includes("GetRestaurantReviews")) return { data: { reviews: { items: [sampleReview], total: 1 } }, loading: false };
      if (source.includes("GetRestaurantReviewStats")) return { data: { reviewStats: { total: 1, avgRating: 5, ratingBreakdown: { 5: 1 } } }, loading: false };
      if (source.includes("GetPublicRestaurantStaff")) return { data: { publicRestaurantStaff: [{ id: "s1", fullName: "NV A" }] }, loading: false };
      expect(source).not.toContain("GetReviewComments");
      return { data: {}, loading: false };
    });

    renderWithAuth(<ReviewsSection restaurantId="r1" />, { isAuthenticated: false, user: null });

    fireEvent.click(screen.getByRole("button", { name: /thích/i }));
    expect(reactReviewMock).not.toHaveBeenCalled();
    expect((await screen.findAllByText("Vui lòng đăng nhập để thích đánh giá."))[0]).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /hữu ích/i }));
    expect(helpfulReviewMock).not.toHaveBeenCalled();
    expect((await screen.findAllByText("Vui lòng đăng nhập để đánh dấu hữu ích."))[0]).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /báo cáo/i }));
    expect(reportReviewMock).not.toHaveBeenCalled();
    expect((await screen.findAllByText("Vui lòng đăng nhập để báo cáo đánh giá."))[0]).toBeInTheDocument();
  });



  it("renders firstOfficialReply from restaurant reviews query without N+1 comment query", async () => {
    const queryNames = [];
    useQuery.mockImplementation((query) => {
      const source = String(query?.loc?.source?.body || query || "");
      queryNames.push(source);
      if (source.includes("GetRestaurantReviews")) return { data: { reviews: { items: [sampleReview], total: 1 } }, loading: false };
      if (source.includes("GetRestaurantReviewStats")) return { data: { reviewStats: { total: 1, avgRating: 5, ratingBreakdown: { 5: 1 } } }, loading: false };
      if (source.includes("GetPublicRestaurantStaff")) return { data: { publicRestaurantStaff: [] }, loading: false };
      return { data: {}, loading: false };
    });

    renderWithAuth(<ReviewsSection restaurantId="r1" />);

    expect(await screen.findByText("Phản hồi từ nhà hàng")).toBeInTheDocument();
    expect(screen.getByText("Cảm ơn bạn đã góp ý, nhà hàng đã ghi nhận.")).toBeInTheDocument();
    expect(queryNames.some((source) => source.includes("GetReviewComments"))).toBe(false);
  });

  it("sends staffId only when staff is selected because backend derives staffName", async () => {
    renderWithAuth(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Nội dung đánh giá hợp lệ" } });
    fireEvent.change(screen.getByLabelText("Nhân viên phục vụ (không bắt buộc)"), { target: { value: "s1" } });
    createReviewMock.mockResolvedValueOnce({ data: { createReview: { id: "rv1", status: "published" } } });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    await waitFor(() => expect(createReviewMock).toHaveBeenCalled());
    expect(createReviewMock.mock.calls[0][0].variables.input.staffId).toBe("s1");
    expect(createReviewMock.mock.calls[0][0].variables.input.staffName).toBeUndefined();
    expect(createReviewMock.mock.calls[0][0].variables.input.customerName).toBeUndefined();
  });

  it('sends null when no staff is selected and shows published message', async () => {
    renderWithAuth(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Nội dung đánh giá hợp lệ" } });
    createReviewMock.mockResolvedValueOnce({ data: { createReview: { id: "rv1", status: "published" } } });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    await waitFor(() => expect(createReviewMock).toHaveBeenCalled());
    expect(createReviewMock.mock.calls[0][0].variables.input.staffId).toBeNull();
    expect(screen.getAllByText("Đánh giá của bạn đã được đăng. Cảm ơn bạn đã chia sẻ trải nghiệm.")[0]).toBeInTheDocument();
  });

  it("shows error and not success when mutation resolves with GraphQL errors", async () => {
    renderWithAuth(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Nội dung đánh giá hợp lệ" } });
    createReviewMock.mockResolvedValueOnce({ errors: [{ message: "Lỗi GraphQL" }], data: null });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    expect(
      (await screen.findAllByText("Không thể gửi đánh giá."))[0],
    ).toBeInTheDocument();
    expect(screen.queryByText("Lỗi GraphQL")).not.toBeInTheDocument();
    expect(screen.queryByText("Đánh giá của bạn đã được đăng. Cảm ơn bạn đã chia sẻ trải nghiệm.")).not.toBeInTheDocument();
  });

  it("shows error when mutation succeeds without createReview id", async () => {
    renderWithAuth(<ReviewsSection restaurantId="r1" />);
    fireEvent.click(screen.getByRole("button", { name: /viết đánh giá/i }));
    fireEvent.change(screen.getByLabelText("Nội dung đánh giá"), { target: { value: "Nội dung đánh giá hợp lệ" } });
    createReviewMock.mockResolvedValueOnce({ data: { createReview: null } });

    fireEvent.click(screen.getByRole("button", { name: /gửi đánh giá/i }));

    expect((await screen.findAllByText("Không thể gửi đánh giá."))[0]).toBeInTheDocument();
    expect(screen.queryByText("Đánh giá của bạn đã được đăng. Cảm ơn bạn đã chia sẻ trải nghiệm.")).not.toBeInTheDocument();
  });
});
