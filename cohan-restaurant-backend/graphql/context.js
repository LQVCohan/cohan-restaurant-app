import process from "process";
// src/graphql/context.js
import { createLoaders } from "./loaders/index.js"; // DataLoader per-request
import { resolveAuthenticatedUserFromRequest } from "../src/server/authUserResolver.js";

export default async function buildContext(request, reply) {
  const user = await resolveAuthenticatedUserFromRequest(request);


  if (user?.id) {
    request.userId = user.id;
  }

  return {
    user,
    loaders: createLoaders ? createLoaders() : undefined, // per-request
    request,
    reply,
  };
}
