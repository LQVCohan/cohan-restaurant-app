import uploadRoutes from "./upload.route.js";

/**
 * Preserve the /api prefix for upload routes.
 *
 * upload.route.js is wrapped with fastify-plugin, so registering it directly
 * with { prefix: "/api" } does not reliably create the expected prefixed
 * route scope. This plain Fastify plugin creates that scope first, then mounts
 * the existing upload plugin inside it.
 */
export default async function uploadApiScopeRoutes(app) {
  await app.register(uploadRoutes);
}
