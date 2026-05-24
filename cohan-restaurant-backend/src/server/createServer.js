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
import { autoCancelExpiredReservations, cleanupExpiredTableViewLocks } from "../services/reservationAutoCancel.service.js";
import { cleanupExpiredCartHolds } from "../services/cartHoldCleanup.service.js";
import { runAttendanceExceptionDetectionForAllRestaurants } from "../jobs/attendanceException.job.js";
import {
  predictTableTurnover,
  suggestTableMerge,
  suggestTablePromo,
  generateSmartFloorLayout,
} from "../services/ai/aiTable.service.js";
import { registerObservability } from "../observability/observability.js";
import { initBackendSentry } from "../observability/sentry.js";
import { applyPaymentProviderCallback, createReservationPayment, getPaymentSessionById, listReservationPayments, reconcileBankTransferWebhook } from "../services/payment/paymentSession.service.js";
import { resolveAuthenticatedUserFromRequest } from "./authUserResolver.js";
import { requireRestaurantPermission } from "../services/auth/authorization.service.js";
import { PERMISSIONS } from "../constants/permissions.js";

const parseAllowedOrigins = () => {
  const rawOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const filtered = rawOrigins.filter((origin) => origin !== "*");
  return filtered.length > 0 ? filtered : ["http://localhost:5173"];
};

export async function createServer() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || "debug" },
    trustProxy: true,
  });

  const sentry = await initBackendSentry(app.log);
  registerObservability(app, { sentry });

  const allowedOrigins = parseAllowedOrigins();

  await app.register(cors, {
    origin: allowedOrigins,
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
        menuPresenceStore: app.menuPresenceStore,
      };
    },
  });

  await app.register(uploadRoutes, { prefix: "/api" });

  app.post("/api/payments/reservations/:reservationId/create", async (req, reply) => {
    try {
      const reservationId = req.params?.reservationId;
      const { provider } = req.body || {};
      const authUser = await resolveAuthenticatedUserFromRequest(req);
      const userId = authUser?.id;
      if (!userId) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${process.env.PORT || 4000}`;
      const proto = req.headers["x-forwarded-proto"] || "http";
      const baseApiUrl = `${proto}://${host}`;
      const ip = req.headers["x-forwarded-for"] || req.ip || "127.0.0.1";

      const payment = await createReservationPayment({
        reservationId,
        provider,
        userId,
        baseApiUrl,
        clientIp: Array.isArray(ip) ? ip[0] : String(ip).split(",")[0],
      });

      return reply.send({ ok: true, payment });
    } catch (err) {
      req.log.error({ err }, "create reservation payment failed");
      return reply.code(400).send({ ok: false, message: err?.message || "Create payment failed" });
    }
  });

  app.get("/api/payments/:paymentId/status", async (req, reply) => {
    try {
      const authUser = await resolveAuthenticatedUserFromRequest(req);
      const payment = await getPaymentSessionById(req.params?.paymentId);
      const isOwner = authUser?.id && String(authUser.id) === String(payment.userId);
      if (!isOwner) {
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
        if (!token) return reply.code(403).send({ ok: false, message: "Forbidden" });
      }
      return reply.send({ ok: true, payment: { id: payment._id, status: payment.status, callbackStatus: payment.callbackStatus, provider: payment.provider, amount: payment.amount, currency: payment.currency } });
    } catch (err) {
      return reply.code(404).send({ ok: false, message: err?.message || "Payment not found" });
    }
  });

  app.get("/api/payments/reservations/:reservationId", async (req, reply) => {
    try {
      const authUser = await resolveAuthenticatedUserFromRequest(req);
      const userId = authUser?.id;
      if (!userId) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const list = await listReservationPayments(req.params?.reservationId, userId);
      return reply.send({ ok: true, items: list });
    } catch (err) {
      return reply.code(400).send({ ok: false, message: err?.message || "List payments failed" });
    }
  });


  app.post("/api/payments/webhooks/bank-transfer/:provider", async (req, reply) => {
    try {
      const expectedSecret = process.env.BANK_TRANSFER_WEBHOOK_SECRET || "";
      const receivedSecret = req.headers["x-bank-webhook-secret"];
      if ((expectedSecret && receivedSecret !== expectedSecret) || (!expectedSecret && process.env.NODE_ENV === "production")) {
        req.log.warn({ provider: req.params?.provider }, "bank transfer webhook rejected due to invalid/missing secret");
        return reply.code(401).send({ ok: false, message: "Unauthorized webhook" });
      }
      const result = await reconcileBankTransferWebhook({ provider: req.params?.provider || "bank_transfer", payload: req.body || {} });
      return reply.send({ ok: true, result });
    } catch (err) {
      req.log.error({ err }, "bank transfer webhook failed");
      return reply.code(400).send({ ok: false, message: err?.message || "Webhook failed" });
    }
  });

  app.post("/api/payments/webhooks/:provider", async (req, reply) => {
    try {
      const payment = await applyPaymentProviderCallback({
        provider: req.params?.provider,
        payload: req.body || {},
        source: "webhook",
      });
      return reply.send({ ok: true, paymentId: String(payment._id), status: payment.status });
    } catch (err) {
      req.log.error({ err }, "payment webhook failed");
      return reply.code(400).send({ ok: false, message: err?.message || "Webhook failed" });
    }
  });

  app.get("/api/payments/return/:provider", async (req, reply) => {
    try {
      const payment = await applyPaymentProviderCallback({
        provider: req.params?.provider,
        payload: req.query || {},
        source: "return",
      });
      return reply.send({ ok: true, paymentId: String(payment._id), status: payment.status, message: "Payment return captured. Backend remains source of truth." });
    } catch (err) {
      return reply.code(400).send({ ok: false, message: err?.message || "Return processing failed" });
    }
  });

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
    const restaurantId = payload?.restaurantId;
    if (!restaurantId) {
      return reply.code(400).send({ ok: false, message: "restaurantId is required" });
    }
    const authUser = await resolveAuthenticatedUserFromRequest(req);
    const userId = authUser?.id || authUser?._id;
    if (!userId) {
      return reply.code(401).send({ ok: false, message: "Unauthorized" });
    }
    try {
      await requireRestaurantPermission({ user: authUser }, restaurantId, PERMISSIONS.TABLE_WRITE);
    } catch (err) {
      req.log.warn({ err, restaurantId, userId: String(userId) }, "Forbidden floor layout generation");
      return reply.code(403).send({ ok: false, message: "Forbidden" });
    }
    const layout = await generateSmartFloorLayout(payload);
    return reply.send({ ok: true, layout });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).type("application/json").send({
      ok: false,
      message: "Route not found",
      method: req.method,
      url: req.url,
      hint: "Expected POST /upload (local) or POST /upload/sign (S3 mode).",
    });
  });

  const io = new SocketIOServer(app.server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  app.decorate("io", io);
  app.decorate("menuPresenceStore", new Map());

  io.on("connection", (socket) => {
    const joinedMenuKeys = new Set();
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

    socket.on("joinUserChannel", (userId) => {
      if (!userId) return;
      const roomName = `user_${userId}`;
      socket.join(roomName);
      socket.emit("joinedUserChannel", { room: roomName });
    });

    socket.on("leaveUserChannel", (userId) => {
      if (!userId) return;
      socket.leave(`user_${userId}`);
    });

    socket.on("joinChatThread", (threadId) => {
      if (!threadId) return;
      const roomName = `chat_thread_${threadId}`;
      socket.join(roomName);
      socket.emit("joinedChatThread", { room: roomName });
    });

    socket.on("leaveChatThread", (threadId) => {
      if (!threadId) return;
      socket.leave(`chat_thread_${threadId}`);
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
    socket.on("join-order-tracking", ({ trackingToken } = {}) => {
      if (!trackingToken || typeof trackingToken !== "string") return;
      socket.join(`order-tracking:${trackingToken}`);
    });

    socket.on("leave-order-tracking", ({ trackingToken } = {}) => {
      if (!trackingToken || typeof trackingToken !== "string") return;
      socket.leave(`order-tracking:${trackingToken}`);
    });

    socket.on("joinMenuItemView", ({ restaurantId, menuItemId }) => {
      if (!restaurantId || !menuItemId) return;
      const key = `${restaurantId}:${menuItemId}`;
      joinedMenuKeys.add(key);
      const cur = Number(app.menuPresenceStore.get(key) || 0) + 1;
      app.menuPresenceStore.set(key, cur);
      io.to(`restaurant_${restaurantId}`).emit("inventoryEvents", {
        type: "MENU_VIEWERS_UPDATED",
        restaurantId: String(restaurantId),
        menuItemId: String(menuItemId),
        viewerCount: cur,
      });
    });

    socket.on("leaveMenuItemView", ({ restaurantId, menuItemId }) => {
      if (!restaurantId || !menuItemId) return;
      const key = `${restaurantId}:${menuItemId}`;
      const cur = Math.max(0, Number(app.menuPresenceStore.get(key) || 0) - 1);
      if (cur === 0) app.menuPresenceStore.delete(key);
      else app.menuPresenceStore.set(key, cur);
      joinedMenuKeys.delete(key);
      io.to(`restaurant_${restaurantId}`).emit("inventoryEvents", {
        type: "MENU_VIEWERS_UPDATED",
        restaurantId: String(restaurantId),
        menuItemId: String(menuItemId),
        viewerCount: cur,
      });
    });

    socket.on("disconnect", (reason) => {
      for (const key of joinedMenuKeys) {
        const [restaurantId, menuItemId] = String(key).split(":");
        const cur = Math.max(0, Number(app.menuPresenceStore.get(key) || 0) - 1);
        if (cur === 0) app.menuPresenceStore.delete(key);
        else app.menuPresenceStore.set(key, cur);
        io.to(`restaurant_${restaurantId}`).emit("inventoryEvents", {
          type: "MENU_VIEWERS_UPDATED",
          restaurantId: String(restaurantId),
          menuItemId: String(menuItemId),
          viewerCount: cur,
        });
      }
      app.log.warn(`❌ Socket ${socket.id} disconnected: ${reason}`);
    });
  });

  app.decorate("broadcastOrderEvent", (restaurantId, payload) => {
    if (!restaurantId || !payload) return;
    const room = `restaurant_${restaurantId}`;
    io.to(room).emit("orderEvents", payload);
    app.log.info(
      `[Socket.IO] Broadcast ${payload.type} → ${room} (${payload?.order?.orderCode || "?"})`
    );
  });

  app.decorate("broadcastOrderCustomerEvent", (orderCode, payload) => {
    if (!orderCode || !payload) return;
    const room = `order_${orderCode}`;
    io.to(room).emit("orderCustomerEvents", payload);
    app.log.info(
      `[Socket.IO] Broadcast ${payload.type} → ${room} (${payload?.order?.orderCode || orderCode || "?"})`
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

  if (process.env.ENABLE_ATTENDANCE_EXCEPTION_JOB === "true") {
    cron.schedule("*/30 * * * *", async () => {
      try {
        const result = await runAttendanceExceptionDetectionForAllRestaurants({
          triggeredBy: "system",
        });
        if (result?.summary?.scannedShifts || result?.failedCount) {
          app.log.info(
            `[Attendance Exception Job] status=${result.status} restaurants=${result.restaurantCount} failed=${result.failedCount} scanned=${result.summary.scannedShifts}`
          );
        }
      } catch (err) {
        app.log.error(
          { err },
          "[Attendance Exception Job] Error while detecting attendance exceptions"
        );
      }
    });
  }

  cron.schedule("* * * * *", async () => {
    try {
      const result = await autoCancelExpiredReservations({ io: app.io });
      await cleanupExpiredTableViewLocks();
      if (result?.modifiedCount) {
        app.log.info(
          `[Reservation AutoCancel] Cancelled ${result.modifiedCount} expired reservations`
        );
      }

      const holdResult = await cleanupExpiredCartHolds(app.io, app.log);
      if (holdResult?.released || holdResult?.failed) {
        app.log.info(
          `[CartHold Cleanup] scanned=${holdResult.cartsScanned || 0} touched=${holdResult.cartsTouched || 0} released=${holdResult.released || 0} failed=${holdResult.failed || 0}`
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
