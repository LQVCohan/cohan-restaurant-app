// src/server.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, validateEnv } from "../config/env.js";
import process from "process";
import { installHostedAiFetchTimeout } from "../services/ai/aiRuntimeTimeout.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");
const defaultUploadDir = path.join(backendRoot, "uploads");
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

const applyAiProviderPolicy = () => {
  // Cohan uses Gemini as the hosted model and Ollama as the only local fallback.
  // Ignore any legacy OpenAI secret that may still exist in a developer machine's .env.
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  process.env.AI_PROVIDER = "gemini";
  process.env.AI_FALLBACK_PROVIDER = "local";
  process.env.GEMINI_MODEL = DEFAULT_GEMINI_MODEL;
  process.env.AI_CHATBOT_MODEL = DEFAULT_GEMINI_MODEL;
  process.env.AI_CHATBOT_GEMINI_TIMEOUT_MS ||= "30000";
  process.env.AI_CHATBOT_LOCAL_TIMEOUT_MS ||= "15000";
  process.env.AI_CHATBOT_EMBEDDING_TIMEOUT_MS ||= "8000";
};

const startServer = async () => {
  try {
    const loadedEnvFiles = loadEnv();
    if (!loadedEnvFiles.length) {
      console.warn(
        "⚠️ No .env file found. Searched: <repo>/.env, <cwd>/.env, <repo>/cohan-restaurant-backend/.env. Run `npm run env:local` from repo root to generate local .env files. Note: .env.example is a template and is not auto-loaded.",
      );
    } else if (process.env.NODE_ENV !== "production") {
      console.log(`🔧 Loaded env files: ${loadedEnvFiles.join(", ")}`);
      console.log(
        `✉️ SMTP env: user=${process.env.SMTP_USER ? "set" : "missing"}, pass=${process.env.SMTP_PASS ? "set" : "missing"}, host=${process.env.SMTP_HOST || "gmail-service"}, port=${process.env.SMTP_PORT || "default"}`,
      );
    }

    applyAiProviderPolicy();
    installHostedAiFetchTimeout();

    // Keep local uploads in one stable directory regardless of whether the
    // backend is started from the repository root or from its own package.
    if (!process.env.UPLOAD_DIR) {
      process.env.UPLOAD_DIR = defaultUploadDir;
    }

    const env = validateEnv();

    // Import env-dependent modules only after .env has been loaded.
    const [{ connectDB }, { createServer }] = await Promise.all([
      import("../../config/db.js"),
      import("./createServer.js"),
    ]);

    await connectDB();
    const app = await createServer();

    const address = await app.listen({ port: env.PORT, host: env.HOST });

    console.log(`🚀 Server running at ${address}`);
    console.log(`📁 Upload directory: ${process.env.UPLOAD_DIR}`);
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
