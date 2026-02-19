// src/server/createServer.js
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
import cron from "node-cron";
import { autoCancelExpiredReservations } from "../services/reservationAutoCancel.service.js";
import {
  predictTableTurnover,
  suggestTableMerge,
  suggestTablePromo,
  generateSmartFloorLayout,
} from "../services/ai/aiTable.service.js";
import { registerObservability } from "../observability/observability.js";
import { initBackendSentry } from "../observability/sentry.js";

export async function createServer() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || "debug" },
    trustProxy: true,
  });

  const sentry = await initBackendSentry(app.log);
  registerObservability(app, { sentry });

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

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  await app.register(mercurius, {
    schema,
    graphiql: process.env.NODE_ENV !== "production",
    ide: process.env.NODE_ENV !== "production",
    subscription: false,
    context: async (request, reply) => {
      const baseContext = await buildContext(request, reply);
      return {
        ...baseContext,
        loaders: createLoaders(),
        io: app.io,
      };
    },
  });

  await app.register(uploadRoutes, { prefix: "/api" });

  // ===== REVERSE GEOCODE API =====
  app.get("/api/reverse-geocode", async (req, reply) => {
    const { lat, lng } = req.query || {};

    if (!lat || !lng) {
      return reply.code(400).send({
        ok: false,
        message: "Thiếu tham số lat / lng",
      });
    }

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "vi");

    try {
      const res = await fetch(url.toString(), {
        headers: {
          // BẮT BUỘC phải có User-Agent khi gọi Nominatim
          "User-Agent": "FoodHubPOS/1.0 (your-email@example.com)",
        },
      });

      if (!res.ok) {
        req.log.error(
          { status: res.status },
          "Nominatim HTTP error khi reverse geocode"
        );
        return reply.code(502).send({
          ok: false,
          message: "Không truy cập được dịch vụ địa chỉ (Nominatim).",
        });
      }

      const data = await res.json();
      const addr = data.address || {};

      const cityName =
        addr.city || addr.town || addr.village || addr.state || "";
      const districtName =
        addr.county || addr.district || addr.city_district || addr.suburb || "";
      const wardName =
        addr.suburb || addr.city_district || addr.quarter || addr.hamlet || "";
      const street =
        addr.road ||
        addr.residential ||
        addr.neighbourhood ||
        addr.house_number ||
        "";

      return reply.send({
        ok: true,
        address: {
          full: data.display_name || "",
          street,
          cityName,
          districtName,
          wardName,
        },
      });
    } catch (err) {
      req.log.error({ err }, "Reverse geocode error");
      return reply.code(500).send({
        ok: false,
        message: "Không truy cập được dịch vụ địa chỉ (Nominatim).",
        error: err.message,
      });
    }
  });
  // ===== END REVERSE GEOCODE API =====

  // ===== AI TABLE SUGGESTIONS =====
  app.post("/api/ai/table/merge-suggestion", async (req, reply) => {
    const payload = req.body || {};
    const suggestion = await suggestTableMerge(payload);
    return reply.send({ ok: true, suggestion });
  });

  app.post("/api/ai/table/promo-suggestion", async (req, reply) => {
    const payload = req.body || {};
    const suggestion = await suggestTablePromo(payload);
    return reply.send({ ok: true, suggestion });
  });

  app.post("/api/ai/table/turnover-prediction", async (req, reply) => {
    const payload = req.body || {};
    const suggestion = await predictTableTurnover(payload);
    return reply.send({ ok: true, suggestion });
  });
  app.post("/api/ai/floor/generate-layout", async (req, reply) => {
    const payload = req.body || {};
    const layout = await generateSmartFloorLayout(payload);
    return reply.send({ ok: true, layout });
  });
  // ===== END AI TABLE SUGGESTIONS =====

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).type("application/json").send({
      ok: false,
      message: "Route not found",
      method: req.method,
      url: req.url,
      hint: "Expected POST /api/upload for uploads.",
    });
  });

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

  app.decorate("io", io);

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
      if (!restaurantId) return;
      const roomName = `restaurant_${restaurantId}`;
      socket.leave(roomName);
      app.log.info(`🚪 Socket ${socket.id} left room ${roomName}`);
    });

    socket.on("joinOrder", (orderCode) => {
      if (!orderCode) return;
      const roomName = `order_${orderCode}`;
      socket.join(roomName);
      app.log.info(`👀 Socket ${socket.id} joined order room ${roomName}`);
      socket.emit("joinedOrderRoom", { room: roomName });
    });

    socket.on("leaveOrder", (orderCode) => {
      if (!orderCode) return;
      const roomName = `order_${orderCode}`;
      socket.leave(roomName);
      app.log.info(`🚪 Socket ${socket.id} left order room ${roomName}`);
    });

    socket.on("disconnect", (reason) => {
      app.log.warn(`❌ Socket ${socket.id} disconnected: ${reason}`);
    });
  });

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

  app.decorate("broadcastOrderCustomerEvent", (orderCode, payload) => {
    if (!orderCode || !payload) return;
    const room = `order_${orderCode}`;
    io.to(room).emit("orderCustomerEvents", payload);
    app.log.info(
      `[Socket.IO] Broadcast ${payload.type} → ${room} (${
        payload?.order?.orderCode || orderCode || "?"
      })`
    );
  });

  app.addHook("onReady", () => {
    app.log.info("✅ Server ready, routes:");
    app.printRoutes();
  });

  app.ready(() => {
    app.log.info("=== ROUTES ===");
    app.log.info("\n" + app.printRoutes());
  });

  cron.schedule("* * * * *", async () => {
    try {
      const result = await autoCancelExpiredReservations();
      if (result?.modifiedCount) {
        app.log.info(
          `[Reservation AutoCancel] Cancelled ${result.modifiedCount} expired reservations`
        );
      }
    } catch (err) {
      app.log.error(
        { err },
        "[Reservation AutoCancel] Error while cancelling expired reservations"
      );
    }
  });

  return app;
}
