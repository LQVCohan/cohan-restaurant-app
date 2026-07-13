import crypto from "node:crypto";
import { GraphQLError } from "graphql";
import { RefreshToken, User } from "../../../models/index.js";
import PasswordResetToken from "../../../models/password-reset-token.model.js";
import { isMailerConfigured, mailer } from "../../../lib/mailer.js";
import { validatePasswordStrong } from "../../../lib/passwordPolicy.js";
import { logAuthAuditEvent } from "../../../src/security/loginSecurity.js";

const RESET_TTL_MINUTES = Math.max(
  10,
  Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30),
);
const RESET_REQUEST_COOLDOWN_MS = Math.max(
  30_000,
  Number(process.env.PASSWORD_RESET_REQUEST_COOLDOWN_MS || 60_000),
);

const bad = (message) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

const unavailable = (message) =>
  new GraphQLError(message, {
    extensions: { code: "SERVICE_UNAVAILABLE" },
  });

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function tokenHash(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requestIp(ctx) {
  return (
    ctx?.request?.ip ||
    ctx?.request?.headers?.["x-forwarded-for"] ||
    "unknown"
  );
}

function frontendBaseUrl() {
  return String(
    process.env.PUBLIC_WEB_URL ||
      process.env.FRONTEND_URL ||
      process.env.CLIENT_URL ||
      process.env.APP_URL ||
      "http://localhost:5173",
  ).trim();
}

function buildResetLink(rawToken) {
  const base = frontendBaseUrl().replace(/\/+$/, "");
  const url = new URL("/login", `${base}/`);
  url.searchParams.set("resetToken", rawToken);
  return url.toString();
}

function buildResetMail({ user, link }) {
  const name = escapeHtml(user?.fullName || user?.username || "bạn");
  const safeLink = escapeHtml(link);
  const text = [
    `Xin chào ${user?.fullName || user?.username || "bạn"},`,
    "Bạn vừa yêu cầu đặt lại mật khẩu tài khoản Cohan.",
    `Mở liên kết sau để tạo mật khẩu mới: ${link}`,
    `Liên kết hết hạn sau ${RESET_TTL_MINUTES} phút và chỉ sử dụng được một lần.`,
    "Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.",
  ].join("\n\n");

  return {
    to: user.email,
    subject: "Đặt lại mật khẩu Cohan",
    text,
    html: `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Đặt lại mật khẩu Cohan</title>
  </head>
  <body style="margin:0;padding:0;background:#fff7ed;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:28px 12px;background:#fff7ed;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:26px;overflow:hidden;border:1px solid #fed7aa;box-shadow:0 18px 44px rgba(124,45,18,0.14);">
            <tr>
              <td style="padding:28px 30px;background:linear-gradient(135deg,#ff6a00,#ff9a4f);color:#ffffff;">
                <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Cohan Security</div>
                <h1 style="margin:16px 0 6px;font-size:28px;line-height:1.1;">Đặt lại mật khẩu</h1>
                <p style="margin:0;color:#fff7ed;font-size:14px;line-height:1.6;">Liên kết bảo mật chỉ sử dụng được một lần.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <p style="margin:0 0 14px;font-size:16px;line-height:1.7;">Xin chào <strong>${name}</strong>,</p>
                <p style="margin:0 0 22px;color:#4b5563;font-size:15px;line-height:1.7;">Bạn vừa yêu cầu đặt lại mật khẩu tài khoản Cohan. Nhấn nút bên dưới để tạo mật khẩu mới.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td bgcolor="#ff6600" style="border-radius:14px;">
                      <a href="${safeLink}" target="_blank" rel="noreferrer" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:900;border-radius:14px;">Tạo mật khẩu mới</a>
                    </td>
                  </tr>
                </table>
                <div style="padding:16px;border:1px solid #ffedd5;border-radius:18px;background:#fffaf4;">
                  <p style="margin:0 0 8px;color:#7c2d12;font-size:13px;font-weight:800;">Nếu nút không hoạt động</p>
                  <p style="margin:0;word-break:break-all;color:#2563eb;font-size:12px;line-height:1.6;">${safeLink}</p>
                </div>
                <p style="margin:22px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">Liên kết hết hạn sau <strong>${RESET_TTL_MINUTES} phút</strong>. Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}

export async function requestPasswordReset(_, { email }, ctx) {
  const normalizedEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw bad("Email không hợp lệ.");
  }

  if (!isMailerConfigured()) {
    throw unavailable(
      "Dịch vụ email chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
    );
  }

  const user = await User.findOne({
    email: normalizedEmail,
    deletedAt: null,
  });

  // Luôn trả về cùng một kết quả để không tiết lộ email có tồn tại hay không.
  if (!user) return true;

  const recentRequest = await PasswordResetToken.findOne({
    userId: user._id,
    createdAt: { $gt: new Date(Date.now() - RESET_REQUEST_COOLDOWN_MS) },
    usedAt: null,
  })
    .select("_id")
    .lean();

  if (recentRequest) return true;

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);

  await PasswordResetToken.updateMany(
    { userId: user._id, usedAt: null },
    { $set: { usedAt: new Date() } },
  );

  const resetRecord = await PasswordResetToken.create({
    userId: user._id,
    tokenHash: tokenHash(rawToken),
    expiresAt,
    requestedIp: requestIp(ctx),
    userAgent: ctx?.request?.headers?.["user-agent"] || null,
  });

  try {
    const delivery = await mailer.sendMail(
      buildResetMail({ user, link: buildResetLink(rawToken) }),
    );
    if (delivery?.skipped || delivery?.rejected?.length) {
      throw unavailable(
        "Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.",
      );
    }
  } catch (error) {
    await PasswordResetToken.deleteOne({ _id: resetRecord._id });
    if (error instanceof GraphQLError) throw error;
    throw unavailable(
      "Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.",
    );
  }

  logAuthAuditEvent(ctx, "password_reset_requested", {
    ip: requestIp(ctx),
    identifierType: "email",
    userId: String(user._id),
  });

  return true;
}

export async function resetPassword(_, { token, newPassword }, ctx) {
  const rawToken = String(token || "").trim();
  if (rawToken.length < 32) throw bad("Liên kết đặt lại mật khẩu không hợp lệ.");

  const passwordCheck = validatePasswordStrong(String(newPassword || ""));
  if (!passwordCheck.ok) {
    throw bad(
      passwordCheck.reason ||
        "Mật khẩu chưa đủ mạnh. Hãy dùng ít nhất 8 ký tự gồm chữ hoa, chữ thường, số và ký tự đặc biệt.",
    );
  }

  const now = new Date();
  const claimedToken = await PasswordResetToken.findOneAndUpdate(
    {
      tokenHash: tokenHash(rawToken),
      usedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { usedAt: now } },
    { new: true },
  );

  if (!claimedToken) {
    throw bad("Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng.");
  }

  const user = await User.findById(claimedToken.userId);
  const status = String(user?.status || "").toLowerCase();
  if (!user || ["blocked", "inactive"].includes(status) || user.deletedAt) {
    throw bad("Liên kết đặt lại mật khẩu không hợp lệ.");
  }

  try {
    await user.setPassword(newPassword);
    user.forcePasswordChange = false;
    await user.save();
  } catch (error) {
    claimedToken.usedAt = null;
    await claimedToken.save().catch(() => {});
    throw error;
  }

  await Promise.all([
    PasswordResetToken.updateMany(
      { userId: user._id, usedAt: null },
      { $set: { usedAt: now } },
    ),
    RefreshToken.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: now } },
    ),
  ]);

  logAuthAuditEvent(ctx, "password_reset_completed", {
    ip: requestIp(ctx),
    identifierType: "email",
    userId: String(user._id),
  });

  return true;
}
