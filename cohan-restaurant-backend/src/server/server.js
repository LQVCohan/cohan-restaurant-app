// src/server.js
import "dotenv/config";
import { connectDB } from "../../config/db.js";
import { createServer } from "./createServer.js";
import process from "process";
const startServer = async () => {
  try {
    await connectDB();
    const app = await createServer();
    const port = process.env.PORT || 4000;

    app.listen({ port, host: "0.0.0.0" });

    console.log(`🚀 Server running at http://localhost:${port}`);
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
