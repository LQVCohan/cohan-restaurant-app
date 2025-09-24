// src/graphql/context.js
import jwt from "jsonwebtoken";
import createLoaders from "./loaders/index.js";
import process from "process";
export default async (req, reply) => {
  // req là FastifyRequest
  const auth = req.headers["authorization"];
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  let user = null;
  if (token) {
    try {
      user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {}
  }

  return {
    user,
    loaders: createLoaders(),
    // có thể thêm pubsub từ mercurius qua reply.server.graphql
  };
};
