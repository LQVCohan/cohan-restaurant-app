import process from "process";

const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET"];

const CONDITIONAL_REQUIRED = [
  {
    when: (env) => String(env.ENABLE_RECAPTCHA || "").toLowerCase() === "true",
    required: ["RECAPTCHA_SECRET"],
    reason: "ENABLE_RECAPTCHA=true",
  },
  {
    when: (env) =>
      String(env.ENABLE_EMAIL_VERIFICATION || "").toLowerCase() === "true",
    required: ["SMTP_USER", "SMTP_PASS", "MAIL_FROM", "APP_PUBLIC_URL"],
    reason: "ENABLE_EMAIL_VERIFICATION=true",
  },
];

export function validateEnv() {
  const missing = [];

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key] || !String(process.env[key]).trim()) {
      missing.push(key);
    }
  }

  for (const rule of CONDITIONAL_REQUIRED) {
    if (!rule.when(process.env)) continue;
    for (const key of rule.required) {
      if (!process.env[key] || !String(process.env[key]).trim()) {
        missing.push(`${key} (${rule.reason})`);
      }
    }
  }

  if (missing.length) {
    const error =
      "Missing required environment variables:\n" +
      missing.map((item) => ` - ${item}`).join("\n");
    throw new Error(error);
  }

  return {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: Number(process.env.PORT || 4000),
    HOST: process.env.HOST || "0.0.0.0",
  };
}
