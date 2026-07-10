import process from "process";
import { GraphQLError } from "graphql";
import { mailer } from "../../../lib/mailer.js";

function appPublicUrl() {
  return String(process.env.APP_PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLoginUrl(email) {
  const params = new URLSearchParams({ email, staffInvite: "1" });
  return `${appPublicUrl()}/login?${params.toString()}`;
}

export function buildStaffInvitationMail({ staff, initialPassword }) {
  const email = String(staff?.email || "").trim().toLowerCase();
  const password = String(initialPassword || "");
  const name = String(staff?.fullName || staff?.employeeCode || "bạn").trim();

  if (!email || !password) {
    throw new GraphQLError("STAFF_INVITATION_CREDENTIALS_MISSING", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const loginUrl = buildLoginUrl(email);
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(password);
  const safeLoginUrl = escapeHtml(loginUrl);

  return {
    to: email,
    subject: "Thông tin đăng nhập tài khoản nhân viên COHAN",
    text: [
      `Xin chào ${name},`,
      "Tài khoản nhân viên COHAN của bạn đã được tạo.",
      `Email đăng nhập: ${email}`,
      `Mật khẩu ban đầu: ${password}`,
      `Đăng nhập tại: ${loginUrl}`,
      "Tài khoản sẽ được xác minh sau khi bạn đăng nhập thành công lần đầu.",
      "Không chia sẻ mật khẩu này với người khác.",
    ].join("\n\n"),
    html: `
      <!doctype html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Thông tin đăng nhập COHAN</title>
        </head>
        <body style="margin:0;padding:0;background:#f7f4ee;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px;background:#f7f4ee;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;overflow:hidden;border:1px solid #dce5df;border-radius:24px;background:#ffffff;box-shadow:0 18px 44px rgba(41,65,51,0.12);">
                  <tr>
                    <td style="padding:28px 30px;background:#285c40;color:#ffffff;">
                      <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.82;">COHAN Restaurant</div>
                      <h1 style="margin:12px 0 6px;font-size:27px;line-height:1.12;">Tài khoản nhân viên đã sẵn sàng</h1>
                      <p style="margin:0;color:#e8f5ed;font-size:14px;line-height:1.6;">Đăng nhập lần đầu để xác minh và kích hoạt tài khoản.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:30px;">
                      <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Xin chào <strong>${safeName}</strong>,</p>
                      <p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.7;">Quản lý đã tạo tài khoản nhân viên COHAN cho bạn. Dùng thông tin bên dưới để đăng nhập.</p>
                      <div style="margin-bottom:22px;padding:18px;border:1px solid #dce5df;border-radius:16px;background:#f5f8f6;">
                        <p style="margin:0 0 10px;color:#5f6963;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Email đăng nhập</p>
                        <p style="margin:0 0 18px;word-break:break-all;color:#18211c;font-size:16px;font-weight:700;">${safeEmail}</p>
                        <p style="margin:0 0 10px;color:#5f6963;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Mật khẩu ban đầu</p>
                        <p style="margin:0;font-family:Consolas,Monaco,monospace;color:#18211c;font-size:18px;font-weight:800;letter-spacing:.02em;">${safePassword}</p>
                      </div>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;">
                        <tr>
                          <td bgcolor="#285c40" style="border-radius:12px;">
                            <a href="${safeLoginUrl}" target="_blank" style="display:inline-block;padding:14px 24px;border-radius:12px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;">Đăng nhập COHAN</a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.65;">Tài khoản sẽ chuyển sang trạng thái đã xác minh ngay sau khi email và mật khẩu trên được đăng nhập thành công. Không chia sẻ mật khẩu với người khác.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}

export async function sendStaffInvitationEmail({ staff, initialPassword }) {
  const result = await mailer.sendMail(
    buildStaffInvitationMail({ staff, initialPassword }),
  );

  const rejected = Array.isArray(result?.rejected) ? result.rejected : [];
  if (result?.skipped || rejected.length > 0) {
    throw new GraphQLError("STAFF_INVITATION_EMAIL_NOT_SENT", {
      extensions: {
        code: "STAFF_INVITATION_EMAIL_NOT_SENT",
        deliveryError: result?.error || null,
      },
    });
  }

  return {
    sent: true,
    messageId: result?.messageId || null,
  };
}

export default {
  buildStaffInvitationMail,
  sendStaffInvitationEmail,
};
