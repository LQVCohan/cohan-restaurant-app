// src/createServer.js
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import mercurius from "mercurius";
import rateLimit from "@fastify/rate-limit";
import { makeExecutableSchema } from "@graphql-tools/schema";
import process from "process";
import { Server as SocketIOServer } from "socket.io";
import typeDefs from "../../graphql/schema/index.js";
import resolvers from "../../graphql/resolvers/index.js";
import buildContext from "../../graphql/context.js";
import uploadRoutes from "./plugins/upload.route.js";
import { createLoaders } from "../../graphql/loaders/index.js";

export async function createServer() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || "debug" },
    trustProxy: true,
  });

  // ---------------- Middleware ----------------
  await app.register(cors, {
    origin: (process.env.CORS_ORIGINS || "http://localhost:5173")
      .split(",")
      .map((s) => s.trim()),
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  const RL_GLOBAL_MAX = Number(process.env.RL_GLOBAL_MAX || 200);
  const RL_GLOBAL_WINDOW = process.env.RL_GLOBAL_WINDOW || "1 minute";

  await app.register(rateLimit, {
    global: true,
    enableDraftSpec: true,
    addHeaders: { "retry-after": true },
    max: RL_GLOBAL_MAX,
    timeWindow: RL_GLOBAL_WINDOW,
    hook: "preHandler",
    keyGenerator: (req) => {
      const xfwd = req.headers["x-forwarded-for"];
      return (Array.isArray(xfwd) ? xfwd[0] : xfwd) || req.ip;
    },
  });

  // ---------------- GraphQL ----------------
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  await app.register(mercurius, {
    schema,
    graphiql: process.env.NODE_ENV !== "production",
    ide: process.env.NODE_ENV !== "production",
    subscription: false, // ❌ tắt pubsub Mercurius (dùng Socket.IO thay thế)
    context: async (request, reply) => {
      const baseContext = await buildContext(request, reply);
      return {
        ...baseContext,
        loaders: createLoaders(),
        io: app.io, // ✅ truyền socket.io instance vào context
      };
    },
  });

  // ---------------- API routes ----------------
  await app.register(uploadRoutes, { prefix: "/api" });

  app.get("/health", async () => ({ ok: true, ts: Date.now() }));

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).type("application/json").send({
      ok: false,
      message: "Route not found",
      method: req.method,
      url: req.url,
      hint: "Expected POST /api/upload for uploads.",
    });
  });

  // ---------------- Socket.IO setup ----------------
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: (process.env.CORS_ORIGINS || "http://localhost:5173")
        .split(",")
        .map((s) => s.trim()),
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // ✅ Gắn io vào Fastify instance để context GraphQL có thể dùng
  app.decorate("io", io);

  // ---------------- Socket Events ----------------
  io.on("connection", (socket) => {
    app.log.info(`🔌 Client connected: ${socket.id}`);

    socket.on("joinRestaurant", (restaurantId) => {
      if (!restaurantId) return;
      const roomName = `restaurant_${restaurantId}`;
      socket.join(roomName);
      app.log.info(`👋 Socket ${socket.id} joined room ${roomName}`);
      socket.emit("joinedRoom", { room: roomName });
    });

    socket.on("leaveRestaurant", (restaurantId) => {
      const roomName = `restaurant_${restaurantId}`;
      socket.leave(roomName);
      app.log.info(`🚪 Socket ${socket.id} left room ${roomName}`);
    });

    socket.on("disconnect", (reason) => {
      app.log.warn(`❌ Socket ${socket.id} disconnected: ${reason}`);
    });
  });

  // ---------------- Broadcast Helper ----------------
  // Cho phép emit tới tất cả client trong phòng nhà hàng
  app.decorate("broadcastOrderEvent", (restaurantId, payload) => {
    if (!restaurantId || !payload) return;
    const room = `restaurant_${restaurantId}`;
    io.to(room).emit("orderEvents", payload);
    app.log.info(
      `[Socket.IO] Broadcast ${payload.type} → ${room} (${
        payload?.order?.orderCode || "?"
      })`
    );
  });

  // ---------------- Lifecycle hooks ----------------
  app.addHook("onReady", () => {
    app.log.info("✅ Server ready, routes:");
    app.printRoutes();
  });

  app.ready(() => {
    app.log.info("=== ROUTES ===");
    app.log.info("\n" + app.printRoutes());
  });

  return app;
}
