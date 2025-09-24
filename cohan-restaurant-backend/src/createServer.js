// src/createServer.js
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import mercurius from "mercurius";
import rateLimit from "@fastify/rate-limit";
import typeDefs from "../graphql/schema.js";
import resolvers from "../graphql/resolvers/index.js";
import buildContext from "../graphql/context.js";

export async function createServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
  });

  await app.register(mercurius, {
    schema: typeDefs,
    resolvers,
    graphiql: true,
    ide: true,
    subscription: true,
    context: buildContext,
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}
