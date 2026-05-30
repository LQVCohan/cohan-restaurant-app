// src/lib/mailer.js
import nodemailer from "nodemailer";
import process from "process";

let warnedMissingSmtp = false;

function hasSmtpCredentials() {
  const { SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_USER && SMTP_PASS);
}

function makeTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!hasSmtpCredentials()) {
    return null;
  }

  // Nếu có HOST/PORT -> dùng SMTP chuẩn (Mailtrap, SendGrid,...)
  // Nếu không -> dùng service Gmail (App Password)
  const transporter =
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

  // bật log/debug khi cần
  if (process.env.NODE_ENV !== "production") {
    transporter.set("logger", true);
    transporter.set("debug", true);
  }

  return transporter;
}

const transporter = makeTransport();

export const isMailerConfigured = hasSmtpCredentials();

export const mailer = {
  async sendMail({ to, subject, html, text }) {
    if (!transporter) {
      if (!warnedMissingSmtp) {
        warnedMissingSmtp = true;
        console.warn(
          "[Mailer] SMTP_USER/SMTP_PASS is missing. Email sending is disabled."
        );
      }
      return { accepted: [], rejected: [to], messageId: null, skipped: true };
    }

    const from = process.env.MAIL_FROM || process.env.SMTP_USER;
    return transporter.sendMail({ from, to, subject, html, text });
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
