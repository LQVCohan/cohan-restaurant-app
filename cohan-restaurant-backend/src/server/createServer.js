// src/createServer.js
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import mercurius from "mercurius";
import rateLimit from "@fastify/rate-limit";
import { makeExecutableSchema } from "@graphql-tools/schema";

import typeDefs from "../../graphql/schema/index.js";
import resolvers from "../../graphql/resolvers/index.js";
import buildContext from "../../graphql/context.js";
import process from "process";
export async function createServer() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || "info" },
    trustProxy: true,
  });

  await app.register(cors, {
    origin: (process.env.CORS_ORIGINS || "http://localhost:5173").split(","),
    credentials: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // ——— LOG cấu hình Rate limit ngay khi khởi động ———
  const RL_GLOBAL_MAX = Number(process.env.RL_GLOBAL_MAX || 200);
  const RL_GLOBAL_WINDOW = process.env.RL_GLOBAL_WINDOW || "1 minute";
  const RL_AUTH_MAX = Number(process.env.RL_AUTH_MAX || 12);
  const RL_AUTH_WINDOW = process.env.RL_AUTH_WINDOW || "1 minute";

  app.log.info(
    { RL_GLOBAL_MAX, RL_GLOBAL_WINDOW, RL_AUTH_MAX, RL_AUTH_WINDOW },
    "Rate limit configured"
  );

  // ——— Rate limit GLOBAL + log khi gần/vượt ngưỡng ———
  await app.register(rateLimit, {
    global: true,
    enableDraftSpec: true, // dùng ratelimit-limit / -remaining / -reset
    addHeaders: {
      "x-ratelimit-limit": false,
      "x-ratelimit-remaining": false,
      "x-ratelimit-reset": false,
      "retry-after": true,
    },
    max: RL_GLOBAL_MAX,
    timeWindow: RL_GLOBAL_WINDOW,
    hook: "preHandler", // để đọc được body ở /graphql sau này
    keyGenerator: (req) => {
      const xfwd = req.headers["x-forwarded-for"];
      return (Array.isArray(xfwd) ? xfwd[0] : xfwd) || req.ip;
    },
    onExceeding: (req, key) => {
      app.log.debug({ key, url: req.url }, "rate-limit nearing (global)");
    },
    onExceeded: (req, key) => {
      app.log.warn({ key, url: req.url }, "rate-limit exceeded (global)");
    },
    errorResponseBuilder: (_req, ctx) => {
      const retryAfterSec = Number(
        ctx.after || Math.ceil((ctx.ttl || 0) / 1000) || 1
      );
      return {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
        retryAfter: retryAfterSec,
        limit: ctx.max,
      };
    },
  });

  // Mercurius
  await app.register(mercurius, {
    schema,
    graphiql: process.env.NODE_ENV !== "production",
    ide: process.env.NODE_ENV !== "production",
    subscription: true,
    context: (request, reply) => buildContext(request, reply),
  });

  // ——— Siết riêng login/createUser theo operationName + log ———
  app.addHook("preHandler", async (req, reply) => {
    if (req.routerPath !== "/graphql" || req.method !== "POST") return;

    // Ở preHandler body đã parse được:
    const opName =
      (req.body &&
        (req.body.operationName || req.body?.operations?.operationName)) ||
      "anonymous";

    if (opName === "login" || opName === "createUser") {
      const strictLimiter = app.rateLimit({
        hook: "preHandler",
        max: RL_AUTH_MAX,
        timeWindow: RL_AUTH_WINDOW,
        groupId: `gql:${opName}`,
        onExceeding: (r, key) => {
          app.log.debug({ key, opName }, "rate-limit nearing (auth)");
        },
        onExceeded: (r, key) => {
          app.log.warn({ key, opName }, "rate-limit exceeded (auth)");
        },
      });

      await strictLimiter(req, reply);
    }
  });

  app.get("/health", async () => ({ ok: true, ts: Date.now() }));

  return app;
}
