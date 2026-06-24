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

// helper dựng nội dung email xác minh
export function buildVerifyMail({ to, link, user, reason, ttlHours = 24 }) {
  const name = user?.fullName || user?.username || "bạn";
  const isStaff = String(user?.userType || "").toUpperCase() === "STAFF";
  const subject = isStaff
    ? "Xác minh tài khoản nhân viên Cohan/FoodHub"
    : "Xác minh tài khoản Cohan/FoodHub";
  const intro = reason === "resend"
    ? "Bạn vừa yêu cầu gửi lại liên kết xác minh tài khoản."
    : "Tài khoản của bạn đã được tạo trên hệ thống Cohan/FoodHub.";
  const text = [
    `Xin chào ${name},`,
    intro,
    "Vui lòng mở liên kết dưới đây để xác minh email và kích hoạt tài khoản:",
    link,
    `Liên kết sẽ hết hạn sau ${ttlHours} giờ. Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email.`,
  ].join("\n\n");
  return {
    to,
    subject,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;">
        <h2>Xin chào ${name},</h2>
        <p>${intro}</p>
        <p>Vui lòng xác nhận email để kích hoạt tài khoản và bảo vệ quyền truy cập của bạn.</p>
        <p><a href="${link}" style="display:inline-block;background:#2563eb;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Xác minh ngay</a></p>
        <p>Nếu nút không hoạt động, hãy sao chép liên kết này vào trình duyệt:</p>
        <p style="word-break:break-all;color:#2563eb;">${link}</p>
        <p>Liên kết sẽ hết hạn sau ${ttlHours} giờ. Không chia sẻ liên kết này với người khác.</p>
        <p style="color:#6b7280;font-size:13px;">Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email.</p>
      </div>
    `,
  };
}

export function buildContactChangeOtpMail({ to, otp, user, target, ttlMinutes = 10 }) {
  const name = user?.fullName || user?.username || "bạn";
  const targetLabel = target === "phone" ? "số điện thoại" : "email";
  const text = [
    `Chào ${name},`,
    `Bạn vừa yêu cầu đổi ${targetLabel} đăng nhập FoodHub.`,
    `Mã OTP ${String(otp).length} số của bạn là: ${otp}`,
    `Mã sẽ hết hạn sau ${ttlMinutes} phút. Không chia sẻ mã này với người khác.`,
    "Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email này hoặc đổi mật khẩu để bảo vệ tài khoản.",
  ].join("\n\n");
  return {
    to,
    subject: target === "phone" ? "Mã xác minh đổi số điện thoại FoodHub" : "Mã xác minh đổi email FoodHub",
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;">
        <h2>Chào ${name},</h2>
        <p>Bạn vừa yêu cầu đổi ${targetLabel} đăng nhập FoodHub.</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:6px;background:#f3f4f6;padding:14px 18px;border-radius:10px;text-align:center;">${otp}</p>
        <p>Mã sẽ hết hạn sau ${ttlMinutes} phút. Không chia sẻ mã này với người khác.</p>
        <p style="color:#6b7280;font-size:13px;">Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email này hoặc đổi mật khẩu để bảo vệ tài khoản.</p>
      </div>
    `,
  };
}
