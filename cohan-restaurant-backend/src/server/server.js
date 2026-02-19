// src/server.js
import "dotenv/config";
import { connectDB } from "../../config/db.js";
import { createServer } from "./createServer.js";
import { validateEnv } from "../config/env.js";
import process from "process";
const startServer = async () => {
  try {
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
