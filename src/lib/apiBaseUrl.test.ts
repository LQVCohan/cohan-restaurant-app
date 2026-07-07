import { afterEach, describe, expect, it, vi } from "vitest";

const originalWindow = globalThis.window;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("apiBaseUrl", () => {
  it("derives from graphql url cases", async () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:4000/graphql");
    let mod = await import("./apiBaseUrl");
    expect(mod.getRefreshUrl()).toBe("http://localhost:4000/api/auth/refresh");

    vi.resetModules();
    vi.stubEnv("VITE_API_URL", "https://api.example.com/graphql");
    mod = await import("./apiBaseUrl");
    expect(mod.getRefreshUrl()).toBe("https://api.example.com/api/auth/refresh");

    vi.resetModules();
    vi.stubEnv("VITE_API_URL", "/graphql");
    mod = await import("./apiBaseUrl");
    expect(mod.getRefreshUrl()).toBe("/api/auth/refresh");

    vi.resetModules();
    vi.unstubAllEnvs();
    mod = await import("./apiBaseUrl");
    expect(mod.getRefreshUrl()).toBe("http://localhost:4000/api/auth/refresh");
  });

  it("uses the same-origin proxy when local browser and API hostnames differ", async () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:4000/graphql");
    vi.stubGlobal("window", {
      ...originalWindow,
      location: { hostname: "127.0.0.1" },
    });

    const mod = await import("./apiBaseUrl");

    expect(mod.getGraphqlUrl()).toBe("/graphql");
    expect(mod.getRefreshUrl()).toBe("/api/auth/refresh");
    expect(
      mod.normalizeLocalDevGraphqlUrl(
        "https://api.example.com/graphql",
        "127.0.0.1",
        true,
      ),
    ).toBe("https://api.example.com/graphql");
    expect(
      mod.normalizeLocalDevGraphqlUrl(
        "http://localhost:4000/graphql",
        "localhost",
        true,
      ),
    ).toBe("http://localhost:4000/graphql");
    expect(
      mod.normalizeLocalDevGraphqlUrl(
        "http://localhost:4000/graphql",
        "127.0.0.1",
        false,
      ),
    ).toBe("http://localhost:4000/graphql");
  });
});
