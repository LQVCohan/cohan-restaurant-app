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
export function buildVerifyMail({ to, link }) {
  return {
    to,
    subject: "Xác minh tài khoản FoodHub",
    html: `
      <h2>Xin chào,</h2>
      <p>Cảm ơn bạn đã đăng ký tài khoản tại FoodHub.</p>
      <p>Vui lòng nhấn vào liên kết dưới đây để xác minh email của bạn:</p>
      <p><a href="${link}" style="background:#2563eb;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;">Xác minh ngay</a></p>
      <p>Liên kết sẽ hết hạn sau 24 giờ.</p>
    `,
  };
}
