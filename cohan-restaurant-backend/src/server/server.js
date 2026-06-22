// src/server.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "../../config/db.js";
import { createServer } from "./createServer.js";
import { loadEnv, validateEnv } from "../config/env.js";
import process from "process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");
const defaultUploadDir = path.join(backendRoot, "uploads");

const startServer = async () => {
  try {
    const loadedEnvFiles = loadEnv();
    if (!loadedEnvFiles.length) {
      console.warn(
        "⚠️ No .env file found. Searched: <repo>/.env, <cwd>/.env, <repo>/cohan-restaurant-backend/.env. Run `npm run env:local` from repo root to generate local .env files. Note: .env.example is a template and is not auto-loaded.",
      );
    }

    // Keep local uploads in one stable directory regardless of whether the
    // backend is started from the repository root or from its own package.
    if (!process.env.UPLOAD_DIR) {
      process.env.UPLOAD_DIR = defaultUploadDir;
    }

    const env = validateEnv();

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
