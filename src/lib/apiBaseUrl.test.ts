import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("apiBaseUrl", () => {
  it("derives GraphQL, API and backend-root URLs from configured backends", async () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:4000/graphql");
    let mod = await import("./apiBaseUrl");
    expect(mod.getRefreshUrl()).toBe(
      "http://localhost:4000/api/auth/refresh",
    );
    expect(mod.toBackendRootUrl("/table-3d-ai/generate")).toBe(
      "http://localhost:4000/table-3d-ai/generate",
    );

    vi.resetModules();
    vi.stubEnv("VITE_API_URL", "https://api.example.com/api/graphql");
    mod = await import("./apiBaseUrl");
    expect(mod.getRefreshUrl()).toBe(
      "https://api.example.com/api/auth/refresh",
    );
    expect(mod.toBackendRootUrl("/table-3d-assets/upload")).toBe(
      "https://api.example.com/table-3d-assets/upload",
    );

    vi.resetModules();
    vi.stubEnv("VITE_API_URL", "/graphql");
    mod = await import("./apiBaseUrl");
    expect(mod.getRefreshUrl()).toBe("/api/auth/refresh");
    expect(mod.toBackendRootUrl("/table-3d-ai/generate")).toBe(
      "/table-3d-ai/generate",
    );

    vi.resetModules();
    vi.unstubAllEnvs();
    mod = await import("./apiBaseUrl");
    expect(mod.getRefreshUrl()).toBe(
      "http://localhost:4000/api/auth/refresh",
    );
  });

  it("uses the same-origin proxy when local browser and API hostnames differ", async () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:4000/graphql");
    vi.stubGlobal("window", { location: { hostname: "127.0.0.1" } });

    const mod = await import("./apiBaseUrl");

    expect(mod.getGraphqlUrl()).toBe("/graphql");
    expect(mod.getRefreshUrl()).toBe("/api/auth/refresh");
    expect(mod.toBackendRootUrl("/table-3d-ai/generate")).toBe(
      "/table-3d-ai/generate",
    );
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
