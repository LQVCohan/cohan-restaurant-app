import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apolloMocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutate: vi.fn(),
  refetchQueries: vi.fn(),
}));

vi.mock("@/apollo/client", () => ({
  apolloClient: apolloMocks,
}));

import { installCustomerReviewOwnerActions } from "./installCustomerReviewOwnerActions";

const review = {
  id: "review-1",
  customerId: "customer-1",
  rating: 5,
  title: "Món ngon",
  content: "Nội dung đánh giá ban đầu đủ dài",
  staffId: null,
  status: "published",
  createdAt: "2026-07-14T01:00:00.000Z",
  updatedAt: "2026-07-14T01:00:00.000Z",
};

function reviewQueryResult(item = review) {
  return {
    data: {
      me: { id: "customer-1" },
      reviews: { items: item ? [item] : [] },
      publicRestaurantStaff: [{ id: "staff-1", fullName: "Nhân viên A" }],
    },
  };
}

function renderStaticReviewCard() {
  document.body.innerHTML = `
    <div class="reviews-section tab-panel-shell">
      <div class="reviews-list">
        <article class="review-item">
          <div class="review-header">
            <div class="reviewer-details">
              <h4 class="reviewer-name">Khách hàng A</h4>
              <div class="review-meta"></div>
            </div>
            <div class="review-actions"></div>
          </div>
          <div class="review-content">
            <h4 class="review-title">Món ngon</h4>
            <p class="review-text">Nội dung đánh giá ban đầu đủ dài</p>
          </div>
        </article>
      </div>
    </div>
  `;
}

class StableMutationObserver {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

describe("customer review owner actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("MutationObserver", StableMutationObserver);
    window.history.replaceState({}, "", "/restaurant/restaurant-1#reviews");
    window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    renderStaticReviewCard();

    apolloMocks.query.mockResolvedValue(reviewQueryResult());
    apolloMocks.refetchQueries.mockResolvedValue([]);
    apolloMocks.mutate.mockImplementation(({ mutation }) => {
      const source = String(mutation?.loc?.source?.body || mutation || "");
      if (source.includes("UpdateOwnReviewFromCustomerPage")) {
        return Promise.resolve({
          data: {
            updateReview: {
              ...review,
              rating: 4,
              title: "Đã cập nhật",
              updatedAt: "2026-07-14T02:00:00.000Z",
            },
          },
        });
      }
      if (source.includes("DeleteOwnReviewFromCustomerPage")) {
        return Promise.resolve({ data: { deleteReview: true } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows edit/delete only on the owner's card and calls both owner mutations", async () => {
    installCustomerReviewOwnerActions();

    const editButton = await screen.findByRole("button", {
      name: "Sửa đánh giá của bạn",
    });
    expect(
      screen.getByRole("button", { name: "Xóa đánh giá của bạn" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Đánh giá của bạn")).toBeInTheDocument();

    fireEvent.click(editButton);
    const dialog = await screen.findByRole("dialog", {
      name: "Chỉnh sửa đánh giá",
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Tiêu đề/ }), {
      target: { value: "Đã cập nhật" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu thay đổi" }),
    );

    await waitFor(() =>
      expect(apolloMocks.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            id: "review-1",
            input: expect.objectContaining({ title: "Đã cập nhật" }),
          }),
        }),
      ),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());

    fireEvent.click(
      screen.getByRole("button", { name: "Xóa đánh giá của bạn" }),
    );
    expect(
      await screen.findByRole("alertdialog", { name: "Xóa đánh giá này?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xóa đánh giá" }));

    await waitFor(() =>
      expect(apolloMocks.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { id: "review-1" },
        }),
      ),
    );
    expect(apolloMocks.refetchQueries).toHaveBeenCalledWith({
      include: "active",
    });
  });
});
