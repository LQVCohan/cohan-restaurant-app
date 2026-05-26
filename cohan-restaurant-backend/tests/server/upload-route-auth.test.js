import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const authMocks = vi.hoisted(() => ({ resolveAuthenticatedUserFromRequest: vi.fn(async () => null) }));
vi.mock("../../src/server/authUserResolver.js", () => authMocks);

import uploadRoutes from "../../src/server/plugins/upload.route.js";

const baseEnv = () => {
  process.env.UPLOAD_MODE = "s3";
  process.env.S3_BUCKET = "b";
  process.env.S3_ENDPOINT = "https://s3.example.com";
  process.env.S3_ACCESS_KEY_ID = "k";
  process.env.S3_SECRET_ACCESS_KEY = "s";
  process.env.S3_UPLOAD_PREFIX = "uploads";
};

describe("upload routes auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    baseEnv();
  });

  it("rejects unauthenticated /upload/sign", async () => {
    authMocks.resolveAuthenticatedUserFromRequest.mockResolvedValue(null);
    const app = Fastify();
    await app.register(uploadRoutes, { prefix: "/api" });
    const res = await app.inject({ method: "POST", url: "/upload/sign", payload: { mimeType: "image/png", fileSize: 100 } });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("returns user-scoped key for authenticated /upload/sign", async () => {
    authMocks.resolveAuthenticatedUserFromRequest.mockResolvedValue({ id: "user-a" });
    const app = Fastify();
    await app.register(uploadRoutes, { prefix: "/api" });
    const res = await app.inject({ method: "POST", url: "/upload/sign", payload: { mimeType: "image/png", fileSize: 100 } });
    expect(res.statusCode).toBe(200);
    expect(res.json().key.startsWith("uploads/user-a/")).toBe(true);
    await app.close();
  });

  it("accepts own key on /upload/complete", async () => {
    authMocks.resolveAuthenticatedUserFromRequest.mockResolvedValue({ id: "user-a" });
    const app = Fastify();
    await app.register(uploadRoutes, { prefix: "/api" });
    const res = await app.inject({ method: "POST", url: "/upload/complete", payload: { key: "uploads/user-a/file.webp" } });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("rejects another user's key on /upload/complete", async () => {
    authMocks.resolveAuthenticatedUserFromRequest.mockResolvedValue({ id: "user-a" });
    const app = Fastify();
    await app.register(uploadRoutes, { prefix: "/api" });
    const res = await app.inject({ method: "POST", url: "/upload/complete", payload: { key: "uploads/user-b/file.webp" } });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("rejects keys outside configured prefix", async () => {
    authMocks.resolveAuthenticatedUserFromRequest.mockResolvedValue({ id: "user-a" });
    const app = Fastify();
    await app.register(uploadRoutes, { prefix: "/api" });
    const res = await app.inject({ method: "POST", url: "/upload/complete", payload: { key: "private/user-a/file.webp" } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
