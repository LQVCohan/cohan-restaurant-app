import { describe, expect, it } from "vitest";
import { getBackendApiBase } from "./apiBase";

describe("getBackendApiBase", () => {
  it("derives origin from absolute graphql URL", () => {
    expect(getBackendApiBase("http://localhost:4000/graphql")).toBe("http://localhost:4000");
  });

  it("keeps base path when graphql nested", () => {
    expect(getBackendApiBase("https://api.example.com/backend/graphql")).toBe("https://api.example.com/backend");
  });
});
