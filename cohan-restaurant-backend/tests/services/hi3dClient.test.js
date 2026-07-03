import { describe, expect, it } from "vitest";
import { getHi3dConfig } from "../../src/services/table3d/hi3dClient.js";

describe("hi3dClient", () => {
  it("enables Hi3D only when credentials are present", () => {
    expect(getHi3dConfig({
      TABLE_3D_AI_ENABLED: "true",
      TABLE_3D_AI_PROVIDER: "hi3d",
      HI3D_CLIENT_ID: "demo-id",
      HI3D_CLIENT_SECRET: "demo-value",
    })).toMatchObject({
      isHi3d: true,
      configured: true,
      endpoint: "https://api.hitem3d.ai",
      model: "hitem3dv2.1",
      resolution: "1536fast",
    });

    expect(getHi3dConfig({ TABLE_3D_AI_PROVIDER: "hi3d" })).toMatchObject({
      isHi3d: true,
      configured: false,
    });
  });
});
