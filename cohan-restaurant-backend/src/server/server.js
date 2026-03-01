// src/server.js
import { connectDB } from "../../config/db.js";
import { createServer } from "./createServer.js";
import { loadEnv, validateEnv } from "../config/env.js";
import process from "process";

const startServer = async () => {
  try {
    const loadedEnvFiles = loadEnv();
    if (!loadedEnvFiles.length) {
      console.warn(
        "⚠️ No .env file found. Searched: <repo>/.env, <cwd>/.env, <repo>/cohan-restaurant-backend/.env. Run `npm run env:local` from repo root to generate local .env files. Note: .env.example is a template and is not auto-loaded."
      );
    }

    const env = validateEnv();

    await connectDB();
    const app = await createServer();

    app.listen({ port: env.PORT, host: env.HOST });

    console.log(`🚀 Server running at http://localhost:${env.PORT}`);
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
