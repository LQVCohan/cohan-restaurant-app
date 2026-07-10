import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/mailer.js", () => ({
  mailer: { sendMail: vi.fn() },
}));

import { buildStaffInvitationMail } from "../../src/services/auth/staffInvitation.service.js";

describe("staffInvitation service", () => {
  it("includes credentials in the message but never puts the password in the login URL", () => {
    process.env.APP_PUBLIC_URL = "https://app.cohan.vn";
    const mail = buildStaffInvitationMail({
      staff: {
        fullName: "Nguyễn Văn A",
        email: "staff@example.com",
      },
      initialPassword: "Secret#123",
    });

    expect(mail.to).toBe("staff@example.com");
    expect(mail.text).toContain("Email đăng nhập: staff@example.com");
    expect(mail.text).toContain("Mật khẩu ban đầu: Secret#123");
    expect(mail.html).toContain("Secret#123");

    const loginUrl = mail.text
      .split("\n")
      .find((line) => line.startsWith("Đăng nhập tại:"));
    expect(loginUrl).toContain("https://app.cohan.vn/login?");
    expect(loginUrl).toContain("email=staff%40example.com");
    expect(loginUrl).not.toContain("Secret%23123");
    expect(loginUrl).not.toContain("password=");
  });
});
