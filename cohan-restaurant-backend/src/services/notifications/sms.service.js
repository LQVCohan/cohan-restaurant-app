import process from "process";

function nodeEnv() {
  return String(process.env.NODE_ENV || "development").toLowerCase();
}

function providerName() {
  return String(process.env.SMS_PROVIDER || "mock").trim().toLowerCase() || "mock";
}

function maskPhone(phone = "") {
  const raw = String(phone || "");
  if (raw.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
}

export function isSmsConfigured() {
  const provider = providerName();
  if (provider === "mock") return nodeEnv() !== "production";
  if (provider === "http") return Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY);
  if (provider === "twilio") {
    return Boolean(
      process.env.SMS_TWILIO_ACCOUNT_SID &&
        process.env.SMS_TWILIO_AUTH_TOKEN &&
        (process.env.SMS_TWILIO_FROM || process.env.SMS_FROM),
    );
  }
  return false;
}

async function sendViaHttp({ to, text }) {
  const res = await fetch(process.env.SMS_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.SMS_API_KEY}`,
      ...(process.env.SMS_API_SECRET ? { "x-sms-secret": process.env.SMS_API_SECRET } : {}),
    },
    body: JSON.stringify({
      to,
      from: process.env.SMS_FROM,
      message: text,
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`SMS_HTTP_${res.status}`);
  }
  let parsed = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = null;
  }
  return {
    provider: "http",
    messageId: parsed?.messageId || parsed?.id || null,
    rawStatus: parsed?.status || String(res.status),
  };
}

async function sendViaTwilioPlaceholder() {
  throw new Error("SMS_TWILIO_PROVIDER_REQUIRES_HTTP_OR_SDK_ADAPTER");
}

export async function sendSms({ to, text }) {
  const provider = providerName();

  if (provider === "mock") {
    if (nodeEnv() === "production") {
      return {
        provider,
        sent: false,
        skipped: true,
        error: "SMS_PROVIDER_NOT_CONFIGURED",
      };
    }
    console.info(`[SMS mock] to=${maskPhone(to)} message=${text}`);
    return {
      provider,
      sent: true,
      skipped: false,
      messageId: `mock-${Date.now()}`,
    };
  }

  if (!isSmsConfigured()) {
    return {
      provider,
      sent: false,
      skipped: true,
      error: "SMS_PROVIDER_NOT_CONFIGURED",
    };
  }

  if (provider === "http") {
    const result = await sendViaHttp({ to, text });
    return { ...result, sent: true, skipped: false };
  }

  if (provider === "twilio") {
    const result = await sendViaTwilioPlaceholder({ to, text });
    return { ...result, sent: true, skipped: false };
  }

  return {
    provider,
    sent: false,
    skipped: true,
    error: "SMS_PROVIDER_NOT_CONFIGURED",
  };
}

export function buildVerificationSms({ link }) {
  return `Cohan/FoodHub: Xac minh tai khoan cua ban tai ${link}. Link het han sau 24 gio.`;
}
