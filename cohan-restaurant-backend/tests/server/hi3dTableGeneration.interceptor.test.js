import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

vi.mock("../../src/server/authUserResolver.js", () => ({
  resolveAuthenticatedUserFromRequest: vi.fn(async () => ({ id: "user-1" })),
}));
vi.mock("../../src/services/table3d/hi3dClient.js", () => ({
  getHi3dConfig: vi.fn(() => ({ isHi3d: true })),
  pollHi3dJob: vi.fn(async () => ({ ok: true, status: "completed", provider: "hi3d" })),
  submitHi3dJob: vi.fn(),
}));

const { registerHi3dTableGenerationInterceptor } = await import("../../src/server/hi3dTableGeneration.interceptor.js");

describe("Hi3D route interceptor", () => {
  it("reuses the existing job URL without changing the frontend", async () => {
    const app = Fastify({ logger: false });
    app.get("/api/table-3d-ai/jobs/:jobId", async () => ({ oldHandler: true }));
    registerHi3dTableGenerationInterceptor(app);

    const response = await app.inject({ method: "GET", url: "/api/table-3d-ai/jobs/job-1" });
    expect(response.json()).toMatchObject({ ok: true, status: "completed", provider: "hi3d" });
    await app.close();
  });
});
