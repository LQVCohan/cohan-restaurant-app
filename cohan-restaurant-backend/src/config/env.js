import fs from "node:fs";
import path from "node:path";
import process from "process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function candidateEnvPaths() {
  const backendRoot = path.resolve(__dirname, "../..");
  const repoRoot = path.resolve(backendRoot, "..");

  return [
    path.resolve(process.cwd(), ".env"),
    path.resolve(backendRoot, ".env"),
    path.resolve(repoRoot, ".env"),
  ];
}

export function loadEnv() {
  const loadedFrom = [];
  const seen = new Set();

  for (const envPath of candidateEnvPaths()) {
    if (seen.has(envPath)) continue;
    seen.add(envPath);

    if (!fs.existsSync(envPath)) continue;

    const result = dotenv.config({ path: envPath, override: false });
    if (!result.error) loadedFrom.push(envPath);
  }

  return loadedFrom;
}


function applyDevelopmentDefaults() {
  if ((process.env.NODE_ENV || "development") === "production") return;

  if (!process.env.JWT_SECRET || !String(process.env.JWT_SECRET).trim()) {
    process.env.JWT_SECRET = "dev_jwt_secret_change_me";
  }

  if (!process.env.MONGO_URI || !String(process.env.MONGO_URI).trim()) {
    process.env.MONGO_URI = "mongodb://127.0.0.1:27017/RestaurantDB";
  }

  if (!process.env.MONGO_DB || !String(process.env.MONGO_DB).trim()) {
    process.env.MONGO_DB = "RestaurantDB";
  }
}

export function validateEnv() {
  applyDevelopmentDefaults();

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
