// src/createServer.js
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import mercurius from "mercurius";
import rateLimit from "@fastify/rate-limit";
import typeDefs from "../graphql/schema/index.js";
import resolvers from "../graphql/resolvers/index.js";
import buildContext from "../graphql/context.js";

import { makeExecutableSchema } from "@graphql-tools/schema";

export async function createServer() {
  const app = Fastify({
    logger: {
      level: "info",
    },
  });

  await app.register(cors, {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4000",
    ],
    credentials: true,
  });

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });
  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
  });

  await app.register(mercurius, {
    schema,
    graphiql: true,
    ide: true,
    subscription: true,
    context: (request, reply) => buildContext(request, reply),
  });

  app.get("/health", async () => ({ ok: true }));

  return app;
}
