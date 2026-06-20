import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeAvatarFileUrl,
  resolveAvatarUpdate,
} from "../../src/services/media/avatarStorage.service.js";

const previousS3Base = process.env.S3_PUBLIC_BASE_URL;

afterEach(() => {
  if (previousS3Base === undefined) delete process.env.S3_PUBLIC_BASE_URL;
  else process.env.S3_PUBLIC_BASE_URL = previousS3Base;
});

describe("avatar storage validation", () => {
  it("accepts local upload paths", () => {
    expect(normalizeAvatarFileUrl("/uploads/avatars/staff.webp")).toBe(
      "/uploads/avatars/staff.webp",
    );
  });

  it("rejects path traversal attempts", () => {
    expect(() =>
      normalizeAvatarFileUrl("/uploads/avatars/../secret.webp"),
    ).toThrow("Đường dẫn ảnh đại diện không được hỗ trợ.");
  });

  it("accepts only URLs under the configured public storage base", () => {
    process.env.S3_PUBLIC_BASE_URL = "https://cdn.example.com/uploads";

    expect(
      normalizeAvatarFileUrl(
        "https://cdn.example.com/uploads/staff/avatar.webp",
      ),
    ).toBe("https://cdn.example.com/uploads/staff/avatar.webp");
    expect(() =>
      normalizeAvatarFileUrl("https://other.example.com/avatar.webp"),
    ).toThrow("Đường dẫn ảnh ngoài hệ thống không được hỗ trợ.");
  });

  it("uses an empty input to remove the current avatar", async () => {
    await expect(resolveAvatarUpdate({ input: {}, userId: "staff-1" })).resolves.toBeNull();
  });
});
