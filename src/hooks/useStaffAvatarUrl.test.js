import { describe, expect, it } from "vitest";
import { normalizeStoredAvatarUrl } from "./useStaffAvatar";

describe("staff avatar URL normalization", () => {
  it("stores local uploaded assets as portable relative paths", () => {
    expect(
      normalizeStoredAvatarUrl(
        "http://localhost:4000/api/uploads/avatars/staff.webp",
      ),
    ).toBe("/uploads/avatars/staff.webp");
    expect(
      normalizeStoredAvatarUrl("/api/uploads/avatars/staff.webp"),
    ).toBe("/uploads/avatars/staff.webp");
  });

  it("keeps approved external storage URLs unchanged", () => {
    expect(
      normalizeStoredAvatarUrl(
        "https://cdn.example.com/uploads/avatars/staff.webp",
      ),
    ).toBe("https://cdn.example.com/uploads/avatars/staff.webp");
  });
});
