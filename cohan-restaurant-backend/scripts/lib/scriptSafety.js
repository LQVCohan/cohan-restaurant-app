const DEFAULT_DEMO_PASSWORD = "Demo@123456";
const WEAK_PRODUCTION_PASSWORDS = new Set([
  "demo@123456",
  "password",
  "secret",
  "changeme",
  "demo",
]);

const PRODUCTION_MARKERS = new Set(["production", "prod", "live"]);

function hasCredentials(uri) {
  return /:\/\/.+:.+@/.test(uri);
}

export function maskMongoUri(uri) {
  if (!uri || typeof uri !== "string") {
    return "[invalid-or-hidden-mongo-uri]";
  }

  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    return "[invalid-or-hidden-mongo-uri]";
  }

  try {
    if (hasCredentials(uri)) {
      return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:@/]+):([^@/]+)@/, "$1***:***@");
    }
    return uri;
  } catch {
    return "[invalid-or-hidden-mongo-uri]";
  }
}

function isProdValue(value) {
  return PRODUCTION_MARKERS.has(String(value || "").trim().toLowerCase());
}

export function isProductionLikeEnv() {
  return [
    process.env.NODE_ENV,
    process.env.APP_ENV,
    process.env.DEPLOY_ENV,
    process.env.VERCEL_ENV,
    process.env.RAILWAY_ENV,
    process.env.RENDER_ENV,
  ].some(isProdValue);
}

export function safeDbInfo() {
  return {
    mongoUri: maskMongoUri(process.env.MONGO_URI),
    mongoDb: process.env.MONGO_DB || "(db from URI or not set)",
  };
}

export function assertDemoScriptAllowed(scriptName) {
  if (!isProductionLikeEnv()) return;

  if (process.env.ALLOW_DEMO_SEED_IN_PRODUCTION !== "true") {
    throw new Error(`${scriptName} is blocked in production-like environments`);
  }

  if (!process.env.DEMO_PASSWORD || !process.env.DEMO_PASSWORD.trim()) {
    throw new Error(`${scriptName} requires DEMO_PASSWORD in production-like environments`);
  }
}

export function getDemoPassword() {
  const configured = process.env.DEMO_PASSWORD?.trim();
  if (!isProductionLikeEnv()) {
    return configured || DEFAULT_DEMO_PASSWORD;
  }

  if (!configured) {
    throw new Error("DEMO_PASSWORD is required in production-like environments");
  }

  if (WEAK_PRODUCTION_PASSWORDS.has(configured.toLowerCase())) {
    throw new Error("DEMO_PASSWORD is too weak for production-like environments");
  }

  return configured;
}
