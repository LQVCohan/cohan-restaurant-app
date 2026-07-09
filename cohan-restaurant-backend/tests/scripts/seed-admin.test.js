import { describe, it, expect } from "vitest";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildAdminUserPayload, isDirectExecution } from "../../scripts/seed-admin.js";

describe("seed-admin payload", () => {
  it("uses ObjectId role value instead of array", () => {
    const payload = buildAdminUserPayload({ email: "a@b.com", passwordHash: "h", adminRoleId: "role1" });
    expect(Array.isArray(payload.role)).toBe(false);
    expect(payload.role).toBe("role1");
  });

  it("creates an active verified local admin account", () => {
    const payload = buildAdminUserPayload({ email: "a@b.com", passwordHash: "h", adminRoleId: "role1" });
    expect(payload.status).toBe("active");
    expect(payload.provider).toBe("local");
    expect(payload.userType).toBe("ADMIN");
    expect(payload.emailVerified).toBe(true);
    expect(payload.verifiedAt).toBeInstanceOf(Date);
    expect(payload.forcePasswordChange).toBe(false);
  });

  it("detects direct execution through file URL conversion", () => {
    const scriptPath = fileURLToPath(new URL("../../scripts/seed-admin.js", import.meta.url));
    expect(isDirectExecution(pathToFileURL(scriptPath).href, scriptPath)).toBe(true);
    expect(isDirectExecution("file:///not-seed-admin.js", scriptPath)).toBe(false);
  });
});
