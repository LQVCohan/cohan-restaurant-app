import fs from "node:fs";
import path from "node:path";
import process from "process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { parseDurationMs } from "../utils/duration.js";

const MAX_SAFE_PRODUCTION_GRAPHQL_DEPTH = 25;
const MAX_SAFE_PRODUCTION_GRAPHQL_FIELD_COUNT = 2000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET"];

const WEAK_SECRET_VALUES = new Set([
  "changeme",
  "change-me",
  "replace-me",
  "your-secret",
  "your-table-access-token-secret",
  "table-access-token-secret",
  "dev_table_access_secret_change_me",
  "default",
  "secret",
  "test",
  "password",
]);

function normalizeMongoEnvVars() {
  const mongoUriCandidates = [
    process.env.MONGO_URI,
    process.env.MONGODB_URI,
    process.env.DATABASE_URL,
  ];

  const mongoUri = mongoUriCandidates.find((v) => v && String(v).trim());
  if (mongoUri && !process.env.MONGO_URI) {
    process.env.MONGO_URI = String(mongoUri).trim();
  }

  if (!process.env.MONGO_DB || !String(process.env.MONGO_DB).trim()) {
    const dbNameCandidates = [process.env.MONGODB_DB, process.env.DB_NAME];
    const dbName = dbNameCandidates.find((v) => v && String(v).trim());
    if (dbName) process.env.MONGO_DB = String(dbName).trim();
  }
}

export function normalizeHi3dEnvVars(env = process.env) {
  const accessKey = [
    env.TABLE_3D_AI_HI3D_ACCESS_KEY,
    env.HI3D_ACCESS_KEY,
  ].find((value) => value && String(value).trim());
  const secretKey = [
    env.TABLE_3D_AI_HI3D_SECRET_KEY,
    env.HI3D_SECRET_KEY,
  ].find((value) => value && String(value).trim());

  if ((!env.TABLE_3D_AI_HI3D_CLIENT_ID || !String(env.TABLE_3D_AI_HI3D_CLIENT_ID).trim()) && accessKey) {
    env.TABLE_3D_AI_HI3D_CLIENT_ID = String(accessKey).trim();
  }
  if ((!env.TABLE_3D_AI_HI3D_CLIENT_SECRET || !String(env.TABLE_3D_AI_HI3D_CLIENT_SECRET).trim()) && secretKey) {
    env.TABLE_3D_AI_HI3D_CLIENT_SECRET = String(secretKey).trim();
  }

  return env;
}

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

  // Priority (low -> high): repo root, current cwd, backend root.
  // backend/.env must win to avoid accidentally using frontend/root values.
  return [
    path.resolve(repoRoot, ".env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(backendRoot, ".env"),
  ];
}

export function loadEnv() {
  const loadedFrom = [];
  const seen = new Set();

  for (const envPath of candidateEnvPaths()) {
    if (seen.has(envPath)) continue;
    seen.add(envPath);

    if (!fs.existsSync(envPath)) continue;

    const result = dotenv.config({ path: envPath, override: true });
    if (!result.error) loadedFrom.push(envPath);
  }

  return loadedFrom;
}

function applyDevelopmentDefaults() {
  normalizeMongoEnvVars();

  if ((process.env.NODE_ENV || "development") === "production") return;

  if (!process.env.JWT_SECRET || !String(process.env.JWT_SECRET).trim()) {
    process.env.JWT_SECRET = "dev_jwt_secret_change_me";
  }

  if (
    !process.env.TABLE_ACCESS_TOKEN_SECRET ||
    !String(process.env.TABLE_ACCESS_TOKEN_SECRET).trim()
  ) {
    process.env.TABLE_ACCESS_TOKEN_SECRET = "dev_table_access_secret_change_me";
  }

  if (
    !process.env.ACCESS_TOKEN_EXPIRES_IN ||
    !String(process.env.ACCESS_TOKEN_EXPIRES_IN).trim()
  ) {
    process.env.ACCESS_TOKEN_EXPIRES_IN = "15m";
  }
  if (
    !process.env.REFRESH_TOKEN_EXPIRES_IN ||
    !String(process.env.REFRESH_TOKEN_EXPIRES_IN).trim()
  ) {
    process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";
  }
  if (!process.env.REFRESH_TOKEN_COOKIE_NAME) process.env.REFRESH_TOKEN_COOKIE_NAME = "refresh_token";
  if (!process.env.REFRESH_TOKEN_COOKIE_SAMESITE) process.env.REFRESH_TOKEN_COOKIE_SAMESITE = "lax";

  if (
    !process.env.TABLE_ACCESS_TOKEN_EXPIRES_IN ||
    !String(process.env.TABLE_ACCESS_TOKEN_EXPIRES_IN).trim()
  ) {
    process.env.TABLE_ACCESS_TOKEN_EXPIRES_IN = "8h";
  }
}

function validateProductionTableAccessSecret() {
  if ((process.env.NODE_ENV || "development") !== "production") return [];

  const issues = [];
  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  const tableSecret = String(process.env.TABLE_ACCESS_TOKEN_SECRET || "").trim();

  if (!tableSecret) {
    issues.push("TABLE_ACCESS_TOKEN_SECRET (required in production)");
    return issues;
  }

  if (jwtSecret && tableSecret === jwtSecret) {
    issues.push("TABLE_ACCESS_TOKEN_SECRET (must differ from JWT_SECRET in production)");
  }

  const normalized = tableSecret.toLowerCase();
  if (tableSecret.length < 16 || WEAK_SECRET_VALUES.has(normalized)) {
    issues.push("TABLE_ACCESS_TOKEN_SECRET (weak value is not allowed in production)");
  }

  return issues;
}

function validateProductionAuthTokenSettings() {
  if ((process.env.NODE_ENV || "development") !== "production") return [];
  const issues = [];
  const jwtSecret = String(process.env.JWT_SECRET || "");
  if (jwtSecret.trim().length < 32 || WEAK_SECRET_VALUES.has(jwtSecret.trim().toLowerCase())) {
    issues.push("JWT_SECRET (must be strong and >= 32 chars in production)");
  }
  try {
    const ttlMs = parseDurationMs(process.env.ACCESS_TOKEN_EXPIRES_IN, "15m");
    if (ttlMs > 24 * 60 * 60 * 1000) {
      issues.push("ACCESS_TOKEN_EXPIRES_IN (must not exceed 1d in production)");
    }
  } catch {
    issues.push("ACCESS_TOKEN_EXPIRES_IN (invalid duration in production)");
  }
  return issues;
}

function validateProductionRecaptchaPolicy() {
  if ((process.env.NODE_ENV || "development") !== "production") return [];
  const issues = [];
  const enabled = String(process.env.ENABLE_RECAPTCHA ?? "true").toLowerCase() === "true";
  const allowDisable = String(process.env.ALLOW_DISABLE_RECAPTCHA_IN_PRODUCTION || "false").toLowerCase() === "true";
  const secret = String(process.env.RECAPTCHA_SECRET || "").trim();
  if (!enabled && !allowDisable) issues.push("ENABLE_RECAPTCHA (cannot be false in production unless ALLOW_DISABLE_RECAPTCHA_IN_PRODUCTION=true)");
  if (enabled) {
    if (!secret) issues.push("RECAPTCHA_SECRET (required when ENABLE_RECAPTCHA=true in production)");
    if (["replace-with-recaptcha-secret","your_recaptcha_secret","changeme","replace-me"].includes(secret.toLowerCase())) {
      issues.push("RECAPTCHA_SECRET (placeholder/weak value is not allowed in production)");
    }
  }
  return issues;
}

function validateProductionGraphqlLimits() {
  if ((process.env.NODE_ENV || "development") !== "production") return [];

  const issues = [];
  const allowUnsafe = String(process.env.ALLOW_UNSAFE_GRAPHQL_LIMITS || "false").toLowerCase() === "true";

  const rules = [
    ["GRAPHQL_MAX_DEPTH", MAX_SAFE_PRODUCTION_GRAPHQL_DEPTH],
    ["GRAPHQL_MAX_FIELD_COUNT", MAX_SAFE_PRODUCTION_GRAPHQL_FIELD_COUNT],
  ];

  for (const [key, safeMax] of rules) {
    const rawValue = process.env[key];
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") continue;

    const parsed = Number(rawValue);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      issues.push(`${key} (must be a positive integer in production)`);
      continue;
    }

    if (!allowUnsafe && parsed > safeMax) {
      issues.push(`${key} (must not exceed ${safeMax} in production unless ALLOW_UNSAFE_GRAPHQL_LIMITS=true)`);
    }
  }

  return issues;
}

export function validateEnv() {
  normalizeHi3dEnvVars();
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

  missing.push(...validateProductionTableAccessSecret());
  missing.push(...validateProductionAuthTokenSettings());
  missing.push(...validateProductionRecaptchaPolicy());
  missing.push(...validateProductionGraphqlLimits());

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
