import { describe, expect, it } from "vitest";
import {
  getApiBaseUrl,
  getBackendRootUrl,
  toApiAssetUrl,
  toApiUrl,
  toBackendRootUrl,
} from "./apiBaseUrl";

const joinUrl = (base, path) =>
  `${base}${path.startsWith("/") ? path : `/${path}`}`;

describe("apiBaseUrl helpers", () => {
  it("routes Fastify plugin endpoints through the shared /api prefix", () => {
    const apiBase = getApiBaseUrl();

    expect(apiBase.endsWith("/api")).toBe(true);
    expect(getBackendRootUrl()).toBe(apiBase);
    expect(toApiUrl("/orders")).toBe(joinUrl(apiBase, "/orders"));
    expect(toBackendRootUrl("/upload")).toBe(joinUrl(apiBase, "/upload"));
    expect(toBackendRootUrl("/upload/sign")).toBe(
      joinUrl(apiBase, "/upload/sign"),
    );
    expect(toBackendRootUrl("/table-3d-assets/upload")).toBe(
      joinUrl(apiBase, "/table-3d-assets/upload"),
    );
    expect(toBackendRootUrl("/table-3d-ai/generate")).toBe(
      joinUrl(apiBase, "/table-3d-ai/generate"),
    );
  });

  it("does not duplicate /api when callers pass an /api-prefixed REST path", () => {
    expect(toApiUrl("/api/reverse-geocode?lat=10&lng=106")).toBe(
      joinUrl(getApiBaseUrl(), "/reverse-geocode?lat=10&lng=106"),
    );
    expect(toBackendRootUrl("/api/table-3d-ai/generate")).toBe(
      joinUrl(getApiBaseUrl(), "/table-3d-ai/generate"),
    );
  });

  it("normalizes local uploaded asset paths away from /api/uploads", () => {
    const uploadUrl = toApiAssetUrl("/api/uploads/avatar.webp");

    expect(uploadUrl).toContain("/uploads/avatar.webp");
    expect(uploadUrl).not.toContain("/api/uploads/avatar.webp");
    expect(toApiAssetUrl("uploads/avatar.webp")).toContain(
      "/uploads/avatar.webp",
    );
  });

  it("leaves external asset urls untouched", () => {
    expect(toApiAssetUrl("https://cdn.example.com/image.webp")).toBe(
      "https://cdn.example.com/image.webp",
    );
    expect(toApiAssetUrl("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc",
    );
    expect(toApiAssetUrl("local-image://abc")).toBe("local-image://abc");
  });
});
