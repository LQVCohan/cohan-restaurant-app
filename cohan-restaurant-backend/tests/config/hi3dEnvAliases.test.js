import { describe, expect, it } from "vitest";
import { normalizeHi3dEnvVars } from "../../src/config/env.js";

describe("Hi3D environment aliases", () => {
  it("maps Access Key and Secret Key names to the existing internal credentials", () => {
    const env = normalizeHi3dEnvVars({
      TABLE_3D_AI_HI3D_ACCESS_KEY: " access-key ",
      TABLE_3D_AI_HI3D_SECRET_KEY: " secret-key ",
    });

    expect(env.TABLE_3D_AI_HI3D_CLIENT_ID).toBe("access-key");
    expect(env.TABLE_3D_AI_HI3D_CLIENT_SECRET).toBe("secret-key");
  });

  it("does not overwrite explicitly configured legacy credential names", () => {
    const env = normalizeHi3dEnvVars({
      TABLE_3D_AI_HI3D_ACCESS_KEY: "new-access-key",
      TABLE_3D_AI_HI3D_SECRET_KEY: "new-secret-key",
      TABLE_3D_AI_HI3D_CLIENT_ID: "legacy-client-id",
      TABLE_3D_AI_HI3D_CLIENT_SECRET: "legacy-client-secret",
    });

    expect(env.TABLE_3D_AI_HI3D_CLIENT_ID).toBe("legacy-client-id");
    expect(env.TABLE_3D_AI_HI3D_CLIENT_SECRET).toBe("legacy-client-secret");
  });
});
