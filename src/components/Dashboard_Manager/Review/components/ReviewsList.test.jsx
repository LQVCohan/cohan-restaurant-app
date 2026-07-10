import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReviewsList from "./ReviewsList";

const review = {
  id: "review-1",
  customer_name: "Khách A",
  customer_avatar: "",
  rating: 2,
  title: "Phục vụ chậm",
  content: "Nội dung đánh giá hợp lệ",
  images: "[]",
  tags: "[]",
  status: "published",
  location: "TP.HCM",
  verified_purchase: true,
  likes: 0,
  replies: 0,
  helpful_count: 0,
  reports_count: 1,
  reactions: {},
  created_at: "2026-07-10T10:00:00.000Z",
};

describe("ReviewsList moderation actions", () => {
  it("does not expose the unsupported direct-delete action", () => {
    render(
      <ReviewsList
        reviews={[review]}
        currentTab="all"
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        permissions={{
          canModerate: true,
          canAdminModerate: true,
          canDelete: true,
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Chuyển sang xem xét" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ẩn đánh giá" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xóa" })).not.toBeInTheDocument();
  });
});
