import fs from "node:fs";
import path from "node:path";
import process from "process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET"];

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
