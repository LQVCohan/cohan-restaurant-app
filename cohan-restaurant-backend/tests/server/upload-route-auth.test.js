import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

vi.mock("../../src/server/authUserResolver.js", () => ({ resolveAuthenticatedUserFromRequest: vi.fn(async () => null) }));

import uploadRoutes from "../../src/server/plugins/upload.route.js";

describe("upload routes auth", () => {
  beforeEach(() => {
    process.env.UPLOAD_MODE = "s3";
    process.env.S3_BUCKET = "b";
    process.env.S3_ENDPOINT = "https://s3.example.com";
    process.env.S3_ACCESS_KEY_ID = "k";
    process.env.S3_SECRET_ACCESS_KEY = "s";
  });

  it("rejects unauthenticated /upload/sign", async () => {
    const app = Fastify();
    await app.register(uploadRoutes, { prefix: "/api" });
    const res = await app.inject({ method: "POST", url: "/upload/sign", payload: { mimeType: "image/png", fileSize: 100 } });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
