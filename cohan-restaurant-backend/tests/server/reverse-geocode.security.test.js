import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "../../src/server/createServer.js";

const originalFetch = global.fetch;

describe("reverse geocode hardening", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "x";
    process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/test";
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 400 for missing and out-of-range coordinates", async () => {
    const app = await createServer();
    const a = await app.inject({ method: "GET", url: "/api/reverse-geocode" });
    expect(a.statusCode).toBe(400);
    const b = await app.inject({ method: "GET", url: "/api/reverse-geocode?lat=999&lng=10" });
    expect(b.statusCode).toBe(400);
    await app.close();
  });

  it("calls upstream for valid request and hides upstream message", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ address: { city: "HCM" }, display_name: "x" }) })
      .mockRejectedValueOnce(new Error("internal details"));
    const app = await createServer();
    const ok = await app.inject({ method: "GET", url: "/api/reverse-geocode?lat=10&lng=106" });
    expect(ok.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const bad = await app.inject({ method: "GET", url: "/api/reverse-geocode?lat=10&lng=106" });
    expect(bad.statusCode).toBe(500);
    expect(bad.json().error).not.toContain("internal details");
    await app.close();
  });
});
