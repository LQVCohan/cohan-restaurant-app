// src/createServer.js
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import mercurius from "mercurius";
import rateLimit from "@fastify/rate-limit";
import { makeExecutableSchema } from "@graphql-tools/schema";
import process from "process";

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

    subscription: {
      context: async (connection, req) => {
        const baseContext = await buildContext(
          { headers: connection?.context?.headers || {} },
          {}
        );
        return {
          ...baseContext,
          loaders: createLoaders(),
          pubsub: app.graphql.pubsub, // 👈 thêm dòng này
        };
      },
    },

    // Context cho HTTP query/mutation
    context: async (request, reply) => {
      const baseContext = await buildContext(request, reply);
      return {
        ...baseContext,
        loaders: createLoaders(),
        pubsub: app.graphql.pubsub,
      };
    },
  });

  // Mount /api (=> có POST /api/upload) + /uploads static
  await app.register(uploadRoutes, { prefix: "/api" });

  app.get("/health", async () => ({ ok: true, ts: Date.now() }));

  app.addHook("onReady", () => {
    app.log.info("Registered routes:");
    app.printRoutes();
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).type("application/json").send({
      ok: false,
      message: "Route not found",
      method: req.method,
      url: req.url,
      hint: "Expected POST /api/upload for uploads.",
    });
  });
  app.ready(() => {
    app.log.info("=== ROUTES ===");
    app.log.info("\n" + app.printRoutes());
  });
  return app;
}
