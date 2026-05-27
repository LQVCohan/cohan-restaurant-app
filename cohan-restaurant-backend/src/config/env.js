import fs from "node:fs";
import path from "node:path";
import process from "process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

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
  const accessExp = String(process.env.ACCESS_TOKEN_EXPIRES_IN || "15m").toLowerCase();
  if (accessExp.endsWith("d")) {
    const d = Number(accessExp.replace("d", ""));
    if (Number.isFinite(d) && d > 1) issues.push("ACCESS_TOKEN_EXPIRES_IN (must not exceed 1d in production)");
  }
  return issues;
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

  missing.push(...validateProductionTableAccessSecret());
  missing.push(...validateProductionAuthTokenSettings());

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
