import "dotenv/config";
import nodemailer from "nodemailer";
import process from "process";
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

transporter.set("logger", true);
transporter.set("debug", true);

const from = process.env.MAIL_FROM || process.env.SMTP_USER;
const to = process.env.TEST_MAIL_TO || process.env.SMTP_USER;

try {
  const info = await transporter.sendMail({
    from,
    to,
    subject: "SMTP test",
    text: "Hello from Cohan SMTP test",
  });
  console.log("OK:", info.messageId);
} catch (e) {
  console.error("Send failed:", e);
}
