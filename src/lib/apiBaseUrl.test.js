import { describe, expect, it } from "vitest";
import { getApiBaseUrl, getBackendRootUrl, toApiAssetUrl, toApiUrl, toBackendRootUrl } from "./apiBaseUrl";

describe("apiBaseUrl helpers", () => {
  it("keeps GraphQL/API routes separate from backend root upload routes", () => {
    expect(getApiBaseUrl()).toBe("http://localhost:4000/api");
    expect(getBackendRootUrl()).toBe("http://localhost:4000");
    expect(toApiUrl("/orders")).toBe("http://localhost:4000/api/orders");
    expect(toBackendRootUrl("/upload")).toBe("http://localhost:4000/upload");
    expect(toBackendRootUrl("/upload/sign")).toBe("http://localhost:4000/upload/sign");
  });

  it("does not duplicate /api when callers pass an /api-prefixed REST path", () => {
    expect(toApiUrl("/api/reverse-geocode?lat=10&lng=106")).toBe(
      "http://localhost:4000/api/reverse-geocode?lat=10&lng=106",
    );
  });

  it("normalizes local uploaded asset paths away from /api/uploads", () => {
    expect(toApiAssetUrl("/api/uploads/avatar.webp")).toBe("http://localhost:4000/uploads/avatar.webp");
    expect(toApiAssetUrl("uploads/avatar.webp")).toBe("http://localhost:4000/uploads/avatar.webp");
  });

  it("leaves external asset urls untouched", () => {
    expect(toApiAssetUrl("https://cdn.example.com/image.webp")).toBe("https://cdn.example.com/image.webp");
    expect(toApiAssetUrl("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(toApiAssetUrl("local-image://abc")).toBe("local-image://abc");
  });
});
