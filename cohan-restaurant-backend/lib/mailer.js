// src/lib/mailer.js
import nodemailer from "nodemailer";
import process from "process";

let warnedMissingSmtp = false;
let transporter = null;
let transporterKey = "";

function envValue(name) {
  return String(process.env[name] || "").trim();
}

function hasSmtpCredentials() {
  return Boolean(envValue("SMTP_USER") && envValue("SMTP_PASS"));
}

function currentTransporterKey() {
  return [
    envValue("SMTP_HOST"),
    envValue("SMTP_PORT"),
    envValue("SMTP_USER"),
    envValue("SMTP_PASS") ? "pass:set" : "pass:missing",
  ].join("|");
}

function makeTransport() {
  const SMTP_HOST = envValue("SMTP_HOST");
  const SMTP_PORT = envValue("SMTP_PORT");
  const SMTP_USER = envValue("SMTP_USER");
  const SMTP_PASS = envValue("SMTP_PASS");

  if (!hasSmtpCredentials()) {
    return null;
  }

  const nextTransporter =
    SMTP_HOST && SMTP_PORT
      ? nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT),
          secure: Number(SMTP_PORT) === 465,
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        })
      : nodemailer.createTransport({
          service: "gmail",
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        });

  if (process.env.NODE_ENV !== "production") {
    nextTransporter.set("logger", true);
    nextTransporter.set("debug", true);
  }

  return nextTransporter;
}

function getTransporter() {
  const key = currentTransporterKey();
  if (!transporter || transporterKey !== key) {
    transporter = makeTransport();
    transporterKey = key;
  }
  return transporter;
}

export const isMailerConfigured = () => hasSmtpCredentials();

export const mailer = {
  async sendMail({ to, subject, html, text }) {
    const activeTransporter = getTransporter();

    if (!activeTransporter) {
      const missing = [
        !envValue("SMTP_USER") && "SMTP_USER",
        !envValue("SMTP_PASS") && "SMTP_PASS",
      ].filter(Boolean);

      if (!warnedMissingSmtp) {
        warnedMissingSmtp = true;
        console.warn(
          `[Mailer] Email sending is disabled. Missing env: ${missing.join(", ") || "unknown"}.`,
        );
      }
      return {
        accepted: [],
        rejected: [to],
        messageId: null,
        skipped: true,
        error: missing.length ? `MISSING_${missing.join("_")}` : "SMTP_NOT_CONFIGURED",
      };
    }

    const from = envValue("MAIL_FROM") || envValue("SMTP_FROM") || envValue("SMTP_USER");
    return activeTransporter.sendMail({ from, to, subject, html, text });
  },
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailShell({ preview, badge, title, body, footer }) {
  return `
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#fff7ed;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff7ed;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #fed7aa;box-shadow:0 18px 44px rgba(124,45,18,0.14);">
            <tr>
              <td style="padding:0;background:linear-gradient(135deg,#ff6a00 0%,#ff8a3d 52%,#ffb86b 100%);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:28px 30px;color:#ffffff;">
                      <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,0.18);font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(badge)}</div>
                      <h1 style="margin:16px 0 6px;font-size:28px;line-height:1.08;font-weight:900;letter-spacing:-0.04em;">${escapeHtml(title)}</h1>
                      <p style="margin:0;font-size:14px;line-height:1.6;color:#fff7ed;">Bảo vệ tài khoản và tiếp tục sử dụng Cohan an toàn.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">${body}</td>
            </tr>
            <tr>
              <td style="padding:20px 30px;background:#fffaf4;border-top:1px solid #ffedd5;color:#78716c;font-size:12px;line-height:1.6;">
                ${footer}
                <div style="margin-top:12px;color:#9a3412;font-weight:700;">Cohan</div>
              </td>
            </tr>
          </table>
          <p style="max-width:640px;margin:14px auto 0;color:#a8a29e;font-size:11px;line-height:1.5;text-align:center;">Email này được gửi tự động từ hệ thống Cohan. Vui lòng không trả lời trực tiếp email này.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// helper dựng nội dung email xác minh
export function buildVerifyMail({ to, link, user, reason, ttlHours = 24 }) {
  const name = escapeHtml(user?.fullName || user?.username || "bạn");
  const safeLink = escapeHtml(link);
  const isStaff = String(user?.userType || "").toUpperCase() === "STAFF";
  const subject = isStaff
    ? "Xác minh tài khoản nhân viên Cohan"
    : "Xác minh tài khoản Cohan";
  const intro = reason === "resend"
    ? "Bạn vừa yêu cầu gửi lại liên kết xác minh tài khoản."
    : "Tài khoản của bạn đã được tạo trên hệ thống Cohan.";
  const text = [
    `Xin chào ${user?.fullName || user?.username || "bạn"},`,
    intro,
    "Vui lòng mở liên kết dưới đây để xác minh email và kích hoạt tài khoản:",
    link,
    `Liên kết sẽ hết hạn sau ${ttlHours} giờ. Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email.`,
  ].join("\n\n");

  const body = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#374151;">Xin chào <strong style="color:#111827;">${name}</strong>,</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#4b5563;">${escapeHtml(intro)} Vui lòng nhấn nút bên dưới để xác minh email và kích hoạt tài khoản.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td align="center" bgcolor="#ff6600" style="border-radius:14px;box-shadow:0 10px 22px rgba(255,102,0,0.24);">
          <a href="${safeLink}" target="_blank" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:900;border-radius:14px;">Xác minh ngay</a>
        </td>
      </tr>
    </table>
    <div style="padding:16px;border:1px solid #ffedd5;border-radius:18px;background:#fffaf4;">
      <p style="margin:0 0 8px;color:#7c2d12;font-size:13px;font-weight:800;">Nếu nút không hoạt động</p>
      <p style="margin:0;color:#57534e;font-size:13px;line-height:1.7;">Sao chép liên kết sau và dán vào trình duyệt:</p>
      <p style="margin:10px 0 0;word-break:break-all;color:#2563eb;font-size:12px;line-height:1.6;">${safeLink}</p>
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;">
      <tr>
        <td style="padding:14px 16px;border-radius:16px;background:#f9fafb;color:#6b7280;font-size:13px;line-height:1.6;">
          Liên kết hết hạn sau <strong style="color:#111827;">${Number(ttlHours)}</strong> giờ. Không chia sẻ liên kết này với người khác.
        </td>
      </tr>
    </table>
  `;

  const footer = `<div>Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email. Tài khoản sẽ chỉ được kích hoạt sau khi email được xác minh.</div>`;

  return {
    to,
    subject,
    text,
    html: buildEmailShell({
      preview: "Xác minh email để kích hoạt tài khoản Cohan.",
      badge: "Cohan Account",
      title: "Xác minh tài khoản",
      body,
      footer,
    }),
  };
}

export function buildContactChangeOtpMail({ to, otp, user, target, ttlMinutes = 10 }) {
  const name = escapeHtml(user?.fullName || user?.username || "bạn");
  const targetLabel = target === "phone" ? "số điện thoại" : "email";
  const safeOtp = escapeHtml(otp);
  const text = [
    `Chào ${user?.fullName || user?.username || "bạn"},`,
    `Bạn vừa yêu cầu đổi ${targetLabel} đăng nhập Cohan.`,
    `Mã OTP ${String(otp).length} số của bạn là: ${otp}`,
    `Mã sẽ hết hạn sau ${ttlMinutes} phút. Không chia sẻ mã này với người khác.`,
    "Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email này hoặc đổi mật khẩu để bảo vệ tài khoản.",
  ].join("\n\n");

  const body = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.7;color:#374151;">Chào <strong style="color:#111827;">${name}</strong>,</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#4b5563;">Bạn vừa yêu cầu đổi ${escapeHtml(targetLabel)} đăng nhập Cohan. Nhập mã dưới đây để tiếp tục.</p>
    <div style="margin:0 0 20px;padding:18px;border-radius:20px;background:#111827;color:#ffffff;text-align:center;font-size:32px;font-weight:900;letter-spacing:8px;">${safeOtp}</div>
    <div style="padding:14px 16px;border-radius:16px;background:#fffaf4;border:1px solid #ffedd5;color:#7c2d12;font-size:13px;line-height:1.6;">Mã hết hạn sau <strong>${Number(ttlMinutes)}</strong> phút. Không chia sẻ mã này với người khác.</div>
  `;

  const footer = `<div>Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email này hoặc đổi mật khẩu để bảo vệ tài khoản.</div>`;

  return {
    to,
    subject: target === "phone" ? "Mã xác minh đổi số điện thoại Cohan" : "Mã xác minh đổi email Cohan",
    text,
    html: buildEmailShell({
      preview: "Mã OTP xác minh thay đổi thông tin Cohan.",
      badge: "Cohan Security",
      title: "Mã xác minh bảo mật",
      body,
      footer,
    }),
  };
}
