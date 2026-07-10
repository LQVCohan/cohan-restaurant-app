// src/server/createServer.js
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import mercurius from "mercurius";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { makeExecutableSchema } from "@graphql-tools/schema";
import process from "process";
import crypto from "crypto";
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
import { isVnpaySuccessful, verifyMomoCallback, verifyVnpayCallback } from "../services/payment/providers.js";
import { emitPaymentRealtime } from "../services/payment/paymentRealtime.service.js";
import { expireStaleTransferPayments } from "../services/payment/transferExpiry.service.js";
import { resolveAuthenticatedUserFromRequest } from "./authUserResolver.js";
import { requireRestaurantPermission } from "../services/auth/authorization.service.js";
import { validateGuestConversationOwnership, isValidConversationId, getAiConversationGuestRoomName } from "../services/ai/restaurantChatbotRealtime.service.js";
import { AI_CHATBOT_RATE_LIMIT_POLICIES, consumeAiChatbotRateLimit } from "../services/ai/restaurantChatbotRateLimit.service.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { ChatThread, Order, PaymentSession } from "../../models/index.js";
import mongoose from "mongoose";
import { clearRefreshCookie, revokeRefreshToken, rotateRefreshToken } from "../security/authTokens.js";
import { createGraphqlValidationRules } from "../security/graphqlLimits.js";
import { validateOrderTrackingToken } from "../services/orderTracking.service.js";

export async function authorizeChatThreadJoin({ socketUser, threadId, findThreadById, requireRestaurantPermissionFn, permissionCode }) {
  if (!socketUser?.id || !threadId) return { ok: false, code: "FORBIDDEN" };
  const thread = await findThreadById(threadId);
  if (!thread) return { ok: false, code: "FORBIDDEN" };

  const ownerId = String(thread?.userId || thread?.customerId || "");
  if (ownerId && ownerId === String(socketUser.id)) return { ok: true, thread };

  if (!thread?.restaurantId) return { ok: false, code: "FORBIDDEN" };

  try {
    await requireRestaurantPermissionFn({ user: socketUser }, thread.restaurantId, permissionCode);
    return { ok: true, thread };
  } catch {
    return { ok: false, code: "FORBIDDEN" };
  }
}

const parseAllowedOrigins = () => {
  const rawOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const filtered = rawOrigins.filter((origin) => origin !== "*");
  return filtered.length > 0 ? filtered : ["http://localhost:5173"];
};




function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildPaymentReturnPage({ provider, verified, successful, paymentFound, reference }) {
  const providerLabel = String(provider || "").toLowerCase() === "momo" ? "MoMo" : "VNPAY";
  let title = "Đã ghi nhận kết quả thanh toán";
  let message = "Vui lòng quay lại cửa sổ COHAN. Hệ thống sẽ tự động cập nhật khi cổng thanh toán gửi xác nhận.";

  if (!verified) {
    title = "Không thể xác thực kết quả thanh toán";
    message = "Dữ liệu trả về không hợp lệ. Vui lòng quay lại COHAN và kiểm tra trạng thái giao dịch trước khi thử lại.";
  } else if (!paymentFound) {
    title = "Không tìm thấy phiên thanh toán";
    message = "COHAN chưa xác định được giao dịch tương ứng. Vui lòng quay lại ứng dụng để kiểm tra.";
  } else if (!successful) {
    title = "Giao dịch chưa hoàn tất";
    message = "Cổng thanh toán chưa xác nhận giao dịch thành công. Vui lòng quay lại COHAN để thử lại hoặc chọn phương thức khác.";
  }

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p>Phương thức: <strong>${escapeHtml(providerLabel)}</strong></p>
      ${reference ? `<p>Mã tham chiếu: <strong>${escapeHtml(reference)}</strong></p>` : ""}
      <p>Bạn có thể đóng trang này sau khi quay lại COHAN.</p>
    </main>
  </body>
</html>`;
}

export function getVnpayIpnValidationError({ signatureValid, payment, payload = {} }) {
  if (!signatureValid) return { RspCode: "97", Message: "Invalid Checksum" };
  if (!payment) return { RspCode: "01", Message: "Order not found" };

  const providerAmount = Math.round(Number(payload.vnp_Amount || 0) / 100);
  const expectedAmount = Math.round(Number(payment.amount || 0));
  if (providerAmount !== expectedAmount) {
    return { RspCode: "04", Message: "Invalid Amount" };
  }
  return null;
}

export async function settleVerifiedVnpayReturn({
  provider,
  payload,
  payment,
  verified,
  successful,
  io,
}) {
  if (
    String(provider || "").toLowerCase() !== "vnpay" ||
    !verified ||
    !successful ||
    !payment
  ) {
    return payment;
  }

  const updatedPayment = await applyPaymentProviderCallback({
    provider: "vnpay",
    payload: { ...(payload || {}) },
    source: "return_fallback",
  });

  if (
    updatedPayment?.status === "success" &&
    !updatedPayment?.realtimeEmitSkipped
  ) {
    await emitPaymentRealtime({
      io,
      payment: updatedPayment,
      eventType: "PAYMENT_VERIFIED",
    });
  }

  return updatedPayment;
}

export function buildContentSecurityPolicyDirectives({ inProduction, allowedOrigins, s3PublicBase, allowUnsafeInlineStyle }) {
  if (!inProduction) return false;
  const styleSrc = ["'self'", "https://fonts.googleapis.com"];
  if (allowUnsafeInlineStyle) styleSrc.splice(1, 0, "'unsafe-inline'");
  return {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc,
      imgSrc: ["'self'", "data:", "blob:", s3PublicBase || ""].filter(Boolean),
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      connectSrc: ["'self'", ...(allowedOrigins || []), ...(s3PublicBase ? [s3PublicBase] : [])],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  };
}

export function shouldAllowAuthCookieRequestOrigin({ origin, allowedOrigins, nodeEnv, allowNoOriginValue }) {
  const normalizedAllowedOrigins = Array.isArray(allowedOrigins) ? allowedOrigins : [];
  if (origin) return normalizedAllowedOrigins.includes(origin);
  const env = String(nodeEnv || "development").toLowerCase();
  const allowNoOrigin = String(allowNoOriginValue || "").toLowerCase() === "true";
  if (env === "production") return allowNoOrigin;
  return String(allowNoOriginValue || "").toLowerCase() !== "false";
}
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
  await app.register(cookie);

  const inProduction = process.env.NODE_ENV === "production";
  const s3PublicBase = String(process.env.S3_PUBLIC_BASE_URL || "").trim();
  const allowUnsafeInlineStyle = String(process.env.CSP_ALLOW_UNSAFE_INLINE_STYLE || "false").toLowerCase() === "true";
  await app.register(helmet, {
    contentSecurityPolicy: buildContentSecurityPolicyDirectives({ inProduction, allowedOrigins, s3PublicBase, allowUnsafeInlineStyle }),
  });

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
    validationRules: createGraphqlValidationRules(process.env),
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

  app.post("/api/auth/refresh", {
    config: {
      rateLimit: {
        max: Number(process.env.RL_AUTH_REFRESH_MAX || 30),
        timeWindow: process.env.RL_AUTH_REFRESH_WINDOW || "1 minute",
      },
    },
  }, async (req, reply) => {
    const origin = req.headers.origin;
    const allowOrigin = shouldAllowAuthCookieRequestOrigin({
      origin,
      allowedOrigins,
      nodeEnv: process.env.NODE_ENV,
      allowNoOriginValue: process.env.ALLOW_AUTH_COOKIE_NO_ORIGIN,
    });
    if (!allowOrigin) return reply.code(403).send({ ok: false, message: "Forbidden" });

    const cookieName = process.env.REFRESH_TOKEN_COOKIE_NAME || "refresh_token";
    const currentToken = req.cookies?.[cookieName];
    if (!currentToken) {
      clearRefreshCookie(reply);
      return reply.code(401).send({ ok: false, message: "Authentication failed" });
    }
    const result = await rotateRefreshToken({
      logger: req.log,
      currentRawToken: currentToken,
      reply,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    if (!result) {
      clearRefreshCookie(reply);
      return reply.code(401).send({ ok: false, message: "Authentication failed" });
    }
    return reply.send({ ok: true, token: result.token, user: result.user });
  });

  app.post("/api/auth/logout", {
    config: {
      rateLimit: {
        max: Number(process.env.RL_AUTH_LOGOUT_MAX || 60),
        timeWindow: process.env.RL_AUTH_LOGOUT_WINDOW || "1 minute",
      },
    },
  }, async (req, reply) => {
    const origin = req.headers.origin;
    const allowOrigin = shouldAllowAuthCookieRequestOrigin({
      origin,
      allowedOrigins,
      nodeEnv: process.env.NODE_ENV,
      allowNoOriginValue: process.env.ALLOW_AUTH_COOKIE_NO_ORIGIN,
    });
    if (!allowOrigin) return reply.code(403).send({ ok: false, message: "Forbidden" });

    const cookieName = process.env.REFRESH_TOKEN_COOKIE_NAME || "refresh_token";
    await revokeRefreshToken(req.cookies?.[cookieName]);
    clearRefreshCookie(reply);
    return reply.send({ ok: true });
  });

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
      if (!authUser?.id) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      const payment = await getPaymentSessionById(req.params?.paymentId);
      const isOwner = authUser?.id && String(authUser.id) === String(payment.userId);
      if (!isOwner) {
        await requireRestaurantPermission(
          { user: authUser },
          payment.restaurantId,
          PERMISSIONS.PAYMENT_READ,
        );
      }
      return reply.send({ ok: true, payment: { id: payment._id, status: payment.status, callbackStatus: payment.callbackStatus, provider: payment.provider, amount: payment.amount, currency: payment.currency } });
    } catch (err) {
      const message = err?.message || "Payment status lookup failed";
      if (message.toLowerCase().includes("forbidden")) return reply.code(403).send({ ok: false, message: "Forbidden" });
      if (message.toLowerCase().includes("unauthorized")) return reply.code(401).send({ ok: false, message: "Unauthorized" });
      if (message.toLowerCase().includes("not found")) return reply.code(404).send({ ok: false, message });
      return reply.code(400).send({ ok: false, message });
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
      const inProduction = process.env.NODE_ENV === "production";
      const hmacSecret = String(process.env.BANK_TRANSFER_WEBHOOK_HMAC_SECRET || "");
      const expectedStaticSecret = String(process.env.BANK_TRANSFER_WEBHOOK_SECRET || "");
      const toleranceSeconds = Math.max(1, Number(process.env.BANK_TRANSFER_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS || 300));
      const timestampHeader = String(req.headers["x-bank-webhook-timestamp"] || "").trim();
      const signatureHeader = String(req.headers["x-bank-webhook-signature"] || "").trim().toLowerCase();
      const staticSecretHeader = String(req.headers["x-bank-webhook-secret"] || "");

      let authorized = false;
      if (hmacSecret) {
        const timestampSeconds = Number(timestampHeader);
        if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0 || !signatureHeader) {
          return reply.code(401).send({ ok: false, message: "Unauthorized webhook" });
        }
        const skew = Math.abs(Math.floor(Date.now() / 1000) - Math.floor(timestampSeconds));
        if (skew > toleranceSeconds) {
          return reply.code(401).send({ ok: false, message: "Unauthorized webhook" });
        }
        const rawPayload = typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(req.body || {});
        const signedPayload = `${Math.floor(timestampSeconds)}.${rawPayload}`;
        const expected = crypto.createHmac("sha256", hmacSecret).update(signedPayload).digest("hex");
        const expectedBuffer = Buffer.from(expected, "hex");
        const receivedBuffer = Buffer.from(signatureHeader, "hex");
        authorized = expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
      } else if (expectedStaticSecret) {
        authorized = staticSecretHeader === expectedStaticSecret;
      } else if (!inProduction && staticSecretHeader) {
        authorized = true;
      } else {
        authorized = false;
      }

      if (!authorized || (inProduction && !hmacSecret && !expectedStaticSecret)) {
        req.log.warn({ provider: req.params?.provider }, "bank transfer webhook rejected");
        return reply.code(401).send({ ok: false, message: "Unauthorized webhook" });
      }
      const result = await reconcileBankTransferWebhook({ provider: req.params?.provider || "bank_transfer", payload: req.body || {} });
      if (result?.matched && result?.payment?.status === "success") {
        await emitPaymentRealtime({ io: app.io, payment: result.payment, eventType: "PAYMENT_VERIFIED" });
      }
      return reply.send({ ok: true, result });
    } catch (err) {
      req.log.error({ err }, "bank transfer webhook failed");
      return reply.code(400).send({ ok: false, message: err?.message || "Webhook failed" });
    }
  });

  app.get("/api/payments/webhooks/vnpay", async (req, reply) => {
    try {
      const payload = { ...(req.query || {}) };
      const reference = payload.vnp_TxnRef;
      const payment = reference
        ? await PaymentSession.findOne({ provider: "vnpay", reference })
        : null;
      const signatureValid = verifyVnpayCallback({ ...payload });
      const validationError = getVnpayIpnValidationError({ signatureValid, payment, payload });
      if (validationError) return reply.code(200).send(validationError);

      const alreadyConfirmed = String(payment.status || "").toLowerCase() === "success";
      const updatedPayment = await applyPaymentProviderCallback({
        provider: "vnpay",
        payload: { ...payload },
        source: "webhook",
      });
      if (updatedPayment?.status === "success" && !updatedPayment?.realtimeEmitSkipped) {
        await emitPaymentRealtime({ io: app.io, payment: updatedPayment, eventType: "PAYMENT_VERIFIED" });
      }
      return reply.code(200).send({
        RspCode: alreadyConfirmed ? "02" : "00",
        Message: alreadyConfirmed ? "Order already confirmed" : "Confirm Success",
      });
    } catch (err) {
      req.log.error({ err }, "VNPAY IPN failed");
      return reply.code(200).send({ RspCode: "99", Message: "Unknown error" });
    }
  });

  app.post("/api/payments/webhooks/:provider", async (req, reply) => {
    try {
      const payment = await applyPaymentProviderCallback({
        provider: req.params?.provider,
        payload: req.body || {},
        source: "webhook",
      });
      if (payment?.status === "success" && !payment?.realtimeEmitSkipped) {
        await emitPaymentRealtime({ io: app.io, payment, eventType: "PAYMENT_VERIFIED" });
      }
      return reply.send({ ok: true, paymentId: String(payment._id), status: payment.status });
    } catch (err) {
      req.log.error({ err }, "payment webhook failed");
      return reply.code(400).send({ ok: false, message: err?.message || "Webhook failed" });
    }
  });

  app.get("/api/payments/return/:provider", async (req, reply) => {
    const provider = String(req.params?.provider || "").toLowerCase();
    const payload = { ...(req.query || {}) };
    const reference = provider === "momo" ? payload.orderId : payload.vnp_TxnRef;
    try {
      const payment = reference
        ? await PaymentSession.findOne({ provider, reference })
        : null;
      const verified = provider === "momo"
        ? verifyMomoCallback(payload)
        : provider === "vnpay"
          ? verifyVnpayCallback(payload)
          : false;
      const successful = verified && (
        provider === "momo"
          ? Number(payload.resultCode) === 0
          : provider === "vnpay" && isVnpaySuccessful(payload)
      );
      await settleVerifiedVnpayReturn({
        provider,
        payload,
        payment,
        verified,
        successful,
        io: app.io,
      });
      return reply
        .type("text/html; charset=utf-8")
        .send(buildPaymentReturnPage({
          provider,
          verified,
          successful,
          paymentFound: Boolean(payment),
          reference,
        }));
    } catch (err) {
      req.log.warn({ err, provider, reference }, "payment return display failed");
      return reply
        .type("text/html; charset=utf-8")
        .send(buildPaymentReturnPage({
          provider,
          verified: false,
         successful: false,
          paymentFound: false,
          reference,
        }));
    }
  });

  app.get("/api/reverse-geocode", {
    config: {
      rateLimit: {
        max: Number(process.env.RL_REVERSE_GEOCODE_MAX || 30),
        timeWindow: process.env.RL_REVERSE_GEOCODE_WINDOW || "1 minute",
      },
    },
  }, async (req, reply) => {
    const lat = Number(req.query?.lat);
    const lng = Number(req.query?.lng);
    const invalidCoordinate = !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180;
    if (invalidCoordinate) {
      return reply.code(400).send({ ok: false, message: "lat,lng không hợp lệ" });
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
          "User-Agent": "CohanPOS/1.0 (your-email@example.com)",
        },
      });

      if (!res.ok) {
        req.log.error({ status: res.status }, "Nominatim HTTP error khi reverse geocode");
        return reply.code(502).send({ ok: false, message: "Không truy cập được dịch vụ địa chỉ (Nominatim)." });
      }

      const data = await res.json();
      const addr = data.address || {};
      const provinceName = addr.state || addr.region || "";
      const cityName = addr.city || addr.town || addr.municipality || addr.village || provinceName;
      const districtName = addr.city_district || addr.district || addr.county || "";
      const wardName = addr.suburb || addr.quarter || addr.neighbourhood || addr.hamlet || "";
      const streetName = addr.road || addr.pedestrian || addr.residential || addr.neighbourhood || "";
      const street = [addr.house_number, streetName].filter(Boolean).join(" ").trim();

      return reply.send({
        ok: true,
        address: {
          full: data.display_name || "",
          street,
          provinceName,
          cityName,
          districtName,
          wardName,
          countryName: addr.country || "",
          postalCode: addr.postcode || "",
        },
      });
    } catch (err) {
      req.log.error({ err }, "Reverse geocode error");
      return reply.code(500).send({ ok: false, message: "Không truy cập được dịch vụ địa chỉ (Nominatim).", error: "Internal server error" });
    }
  });

  app.post("/api/ai/table/merge-suggestion", {
    config: { rateLimit: { max: Number(process.env.RL_AI_TABLE_MAX || 30), timeWindow: process.env.RL_AI_TABLE_WINDOW || "1 minute" } },
  }, async (req, reply) => {
    const payload = await aiRouteGuard(req, reply, PERMISSIONS.TABLE_WRITE);
    if (!payload) return;
    const suggestion = await suggestTableMerge(payload);
    return reply.send({ ok: true, suggestion });
  });

  app.post("/api/ai/table/promo-suggestion", {
    config: { rateLimit: { max: Number(process.env.RL_AI_TABLE_MAX || 30), timeWindow: process.env.RL_AI_TABLE_WINDOW || "1 minute" } },
  }, async (req, reply) => {
    const payload = await aiRouteGuard(req, reply, PERMISSIONS.TABLE_READ);
    if (!payload) return;
    const suggestion = await suggestTablePromo(payload);
    return reply.send({ ok: true, suggestion });
  });

  app.post("/api/ai/table/turnover-prediction", {
    config: { rateLimit: { max: Number(process.env.RL_AI_TABLE_MAX || 30), timeWindow: process.env.RL_AI_TABLE_WINDOW || "1 minute" } },
  }, async (req, reply) => {
    const payload = await aiRouteGuard(req, reply, PERMISSIONS.TABLE_READ);
    if (!payload) return;
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

  io.use(async (socket, next) => {
    try {
      const headerAuth = String(socket.handshake?.headers?.authorization || "").trim();
      const authTokenRaw = String(socket.handshake?.auth?.token || "").trim();
      const resolvedAuthHeader = headerAuth
        || (authTokenRaw
          ? (authTokenRaw.toLowerCase().startsWith("bearer ") ? authTokenRaw : `Bearer ${authTokenRaw}`)
          : "");

      if (!resolvedAuthHeader) {
        socket.user = null;
        next();
        return;
      }

      const fakeReq = { headers: { authorization: resolvedAuthHeader }, log: app.log };
      const authUser = await resolveAuthenticatedUserFromRequest(fakeReq);
      socket.user = authUser || null;
      next();
    } catch {
      socket.user = null;
      next();
    }
  });

  io.on("connection", (socket) => {
    const joinedMenuKeys = new Set();
    app.log.info(`🔌 Client connected: ${socket.id}`);

    socket.on("joinRestaurant", async (restaurantId, ack) => {
      try {
        if (!socket.user?.id) throw new Error("Unauthorized");
        await requireRestaurantPermission({ user: socket.user }, restaurantId, PERMISSIONS.ORDER_READ);

        if (!restaurantId) return;
        const roomName = `restaurant_${restaurantId}`;
        socket.join(roomName);
        app.log.info(`👋 Socket ${socket.id} joined room ${roomName}`);
        socket.emit("joinedRoom", { room: roomName });
        if (typeof ack === "function") ack({ ok: true });
      } catch { if (typeof ack === "function") ack({ ok: false, code: "FORBIDDEN" }); }
    });

    socket.on("leaveRestaurant", (restaurantId) => {
      if (!restaurantId) return;
      const roomName = `restaurant_${restaurantId}`;
      socket.leave(roomName);
      app.log.info(`🚪 Socket ${socket.id} left room ${roomName}`);
    });

    socket.on("joinUserChannel", (userId, ack) => {
      const isAdmin = ["admin"].includes(String(socket.user?.roleName || "").toLowerCase());
      if (!socket.user?.id || (!isAdmin && String(socket.user.id) !== String(userId))) { if (typeof ack==="function") ack({ ok:false, code:"FORBIDDEN"}); return; }
      if (!userId) return;
      const roomName = `user_${userId}`;
      socket.join(roomName);
      socket.emit("joinedUserChannel", { room: roomName });
      if (typeof ack === "function") ack({ ok: true });
    });

    socket.on("leaveUserChannel", (userId) => {
      if (!userId) return;
      socket.leave(`user_${userId}`);
    });

    socket.on("joinChatThread", async (threadId, ack) => {
      const decision = await authorizeChatThreadJoin({
        socketUser: socket.user,
        threadId,
        findThreadById: async (id) => ChatThread.findById(id).lean(),
        requireRestaurantPermissionFn: requireRestaurantPermission,
        permissionCode: PERMISSIONS.ORDER_READ,
      });

      if (!decision.ok) {
        if (typeof ack === "function") ack({ ok: false, code: "FORBIDDEN" });
        return;
      }

      const roomName = `chat_thread_${threadId}`;
      socket.join(roomName);
      socket.emit("joinedChatThread", { room: roomName });
      if (typeof ack === "function") ack({ ok: true });
    });

    socket.on("leaveChatThread", (threadId) => {
      if (!threadId) return;
      socket.leave(`chat_thread_${threadId}`);
    });


    socket.on("joinAiChatbotConversation", async (payload = {}, ack) => {
      try {
        const rateResult = consumeAiChatbotRateLimit({
          policy: AI_CHATBOT_RATE_LIMIT_POLICIES.joinAiChatbotConversation,
          keyParts: {
            socketId: socket.id,
            guestId: String(payload?.guestId || ""),
            conversationId: String(payload?.conversationId || ""),
            clientIp: socket.handshake?.address || "",
          },
        });
        if (!rateResult.allowed) {
          if (typeof ack === "function") ack({ ok: false, code: rateResult.code });
          return;
        }

        const result = await validateGuestConversationOwnership({
          conversationId: payload?.conversationId,
          guestId: payload?.guestId,
        });
        if (!result.ok) {
          if (typeof ack === "function") ack({ ok: false, code: result.code });
          return;
        }

        socket.join(result.roomName);
        if (typeof ack === "function") ack({ ok: true });
        socket.emit("joinedAiChatbotConversation", { ok: true, room: result.roomName });
      } catch {
        if (typeof ack === "function") ack({ ok: false, code: "FORBIDDEN" });
      }
    });

    socket.on("leaveAiChatbotConversation", (payload = {}, ack) => {
      const conversationId = String(payload?.conversationId || "").trim();
      if (!isValidConversationId(conversationId)) {
        if (typeof ack === "function") ack({ ok: false, code: "INVALID" });
        return;
      }
      socket.leave(getAiConversationGuestRoomName(conversationId));
      if (typeof ack === "function") ack({ ok: true });
    });
    socket.on("joinOrder", async (orderCode, ack) => {
      if (!orderCode || !socket.user?.id) { if (typeof ack === "function") ack({ ok:false, code:"FORBIDDEN"}); return; }
      const order = await Order.findOne({ orderCode: String(orderCode) }).select("restaurantId userId").lean();
      if (!order) { if (typeof ack === "function") ack({ ok:false, code:"NOT_FOUND"}); return; }
      const ownsOrder = String(order.userId || "") === String(socket.user.id);
      if (!ownsOrder) {
        try { await requireRestaurantPermission({ user: socket.user }, order.restaurantId, PERMISSIONS.ORDER_READ); } catch { if (typeof ack === "function") ack({ok:false, code:"FORBIDDEN"}); return; }
      }
      const roomName = `order_${orderCode}`;
      socket.join(roomName);
      app.log.info(`👀 Socket ${socket.id} joined order room ${roomName}`);
      socket.emit("joinedOrderRoom", { room: roomName });
      if (typeof ack === "function") ack({ ok: true });
    });

    socket.on("leaveOrder", (orderCode) => {
      if (!orderCode) return;
      const roomName = `order_${orderCode}`;
      socket.leave(roomName);
      app.log.info(`🚪 Socket ${socket.id} left order room ${roomName}`);
    });
    socket.on("join-order-tracking", async ({ trackingToken } = {}, ack) => {
      if (!trackingToken || typeof trackingToken !== "string") { if (typeof ack === "function") ack({ ok:false, code:"INVALID"}); return; }
      const result = await validateOrderTrackingToken(trackingToken);
      if (!result.ok) { if (typeof ack === "function") ack({ ok:false, code: result.code}); return; }
      const token = result.token;
      socket.join(`order-tracking:${token}`);
      if (typeof ack === "function") ack({ ok:true });
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


  if (process.env.ENABLE_TRANSFER_EXPIRY_SWEEP !== "false") {
    setInterval(() => {
      expireStaleTransferPayments({ io: app.io }).catch((err) => {
        app.log.warn({ err }, "transfer expiry sweep failed");
      });
    }, 60 * 1000).unref?.();
  }

  return app;
}
  const aiRouteGuard = async (req, reply, permissionCode) => {
    const payload = req.body || {};
    const restaurantId = payload?.restaurantId;
    if (!restaurantId || !mongoose.isValidObjectId(String(restaurantId))) {
      reply.code(400).send({ ok: false, message: "restaurantId is required and must be valid" });
      return null;
    }
    const authUser = await resolveAuthenticatedUserFromRequest(req);
    const userId = authUser?.id || authUser?._id;
    if (!userId) {
      reply.code(401).send({ ok: false, message: "Unauthorized" });
      return null;
    }
    try {
      await requireRestaurantPermission({ user: authUser }, restaurantId, permissionCode);
    } catch {
      reply.code(403).send({ ok: false, message: "Forbidden" });
      return null;
    }
    return payload;
  };
