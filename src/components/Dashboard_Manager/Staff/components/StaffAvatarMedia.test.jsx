import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import StaffAvatarMedia, {
  getInitials,
  isImageReference,
  resolveAvatarCandidate,
} from "./StaffAvatarMedia";

vi.mock("@/lib/apiBaseUrl", () => ({
  toApiAssetUrl: (value) =>
    String(value || "").startsWith("/")
      ? `http://localhost:4000${value}`
      : value,
}));

describe("StaffAvatarMedia", () => {
  it("renders avatarUrl from the staff profile", () => {
    render(
      <StaffAvatarMedia
        employee={{ avatarUrl: "/uploads/staff/linh.webp" }}
        name="Nguyễn Mỹ Linh"
        className="avatar-img"
      />,
    );

    const image = screen.getByRole("img", {
      name: "Ảnh đại diện của Nguyễn Mỹ Linh",
    });

    expect(image).toHaveAttribute(
      "src",
      "http://localhost:4000/uploads/staff/linh.webp",
    );
    expect(image).toHaveAttribute("loading", "lazy");
  });

  it("falls back to initials when the image cannot load", () => {
    render(
      <StaffAvatarMedia
        employee={{ avatarUrl: "https://example.com/broken.jpg" }}
        name="Nguyễn Mỹ Linh"
        className="avatar-img"
      />,
    );

    fireEvent.error(
      screen.getByRole("img", { name: "Ảnh đại diện của Nguyễn Mỹ Linh" }),
    );

    expect(screen.getByLabelText("Ảnh đại diện của Nguyễn Mỹ Linh")).toHaveTextContent(
      "NL",
    );
  });

  it("resolves legacy and nested avatar fields", () => {
    expect(resolveAvatarCandidate({ avatar: "/avatar.png" })).toBe("/avatar.png");
    expect(resolveAvatarCandidate({ raw: { avatarUrl: "/raw-avatar.png" } })).toBe(
      "/raw-avatar.png",
    );
  });

  it("validates image references and creates two-letter initials", () => {
    expect(isImageReference("uploads/staff/avatar.webp")).toBe(true);
    expect(isImageReference("not-an-image-token")).toBe(false);
    expect(getInitials("Nguyễn Mỹ Linh")).toBe("NL");
  });
});
