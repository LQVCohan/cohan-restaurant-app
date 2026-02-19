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
        "⚠️ No .env file found. Expected one of: ./cohan-restaurant-backend/.env, ./.env"
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
