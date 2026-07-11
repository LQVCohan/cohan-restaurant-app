import process from "process";
import { mailer } from "../../lib/mailer.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAvailabilityEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function absoluteActionUrl(actionPath) {
  const path = String(actionPath || "/").trim() || "/";
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(process.env.APP_PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendAvailabilityEmail({
  to,
  subject,
  title,
  message,
  actionLabel = "Xem ngay",
  actionPath = "/",
}) {
  const email = normalizeAvailabilityEmail(to);
  if (!email) {
    return { delivered: false, skipped: true, error: "INVALID_EMAIL" };
  }

  const actionUrl = absoluteActionUrl(actionPath);
  const text = `${title}\n\n${message}\n\n${actionLabel}: ${actionUrl}`;
  const html = `
    <!doctype html>
    <html lang="vi">
      <body style="margin:0;background:#fff7ed;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#fff7ed;">
          <tr><td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #fed7aa;border-radius:22px;overflow:hidden;">
              <tr><td style="padding:26px 28px;background:#f97316;color:#fff;">
                <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Cohan</div>
                <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;">${escapeHtml(title)}</h1>
              </td></tr>
              <tr><td style="padding:28px;">
                <p style="margin:0 0 22px;font-size:15px;line-height:1.7;">${escapeHtml(message)}</p>
                <a href="${escapeHtml(actionUrl)}" target="_blank" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#f97316;color:#fff;text-decoration:none;font-weight:800;">${escapeHtml(actionLabel)}</a>
                <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#78716c;">Thông báo không đồng nghĩa với việc bàn hoặc món đã được giữ. Tình trạng có thể thay đổi theo thời gian thực.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
    </html>`;

  const result = await mailer.sendMail({ to: email, subject, text, html });
  return {
    ...result,
    delivered: !result?.skipped && Array.isArray(result?.accepted) && result.accepted.length > 0,
  };
}
