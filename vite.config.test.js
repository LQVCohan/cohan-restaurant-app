import { afterEach, describe, expect, it, vi } from "vitest";
import createViteConfig from "./vite.config.js";

afterEach(() => {
  vi.unstubAllEnvs();

  it("disables HMR for the stable mobile camera profile", () => {
    vi.stubEnv("VITE_DEV_HMR", "false");
    vi.stubEnv("VITE_DEV_INFER_REQUEST_HOST", "true");

    const config = createViteConfig({ mode: "test" });

    expect(config.server.hmr).toBe(false);
  });
});

describe("Vite development proxy", () => {
  it("forwards table 3D generation and asset routes to Fastify", () => {
    vi.stubEnv("VITE_DEV_BACKEND_URL", "http://127.0.0.1:4999");

    const config = createViteConfig({ mode: "test" });

    expect(config.server.proxy["/table-3d-ai"]).toEqual({
      target: "http://127.0.0.1:4999",
      changeOrigin: true,
    });
    expect(config.server.proxy["/table-3d-assets"]).toEqual({
      target: "http://127.0.0.1:4999",
      changeOrigin: true,
    });
  });
});
