import { describe, it, expect } from "vitest";
import { buildContentSecurityPolicyDirectives } from "../../src/server/createServer.js";

describe("CSP production style policy", () => {
  it("omits unsafe-inline by default", () => {
    const csp = buildContentSecurityPolicyDirectives({ inProduction: true, allowedOrigins: [], s3PublicBase: "", allowUnsafeInlineStyle: false });
    expect(csp.directives.styleSrc).not.toContain("'unsafe-inline'");
  });
  it("includes unsafe-inline only when enabled", () => {
    const csp = buildContentSecurityPolicyDirectives({ inProduction: true, allowedOrigins: [], s3PublicBase: "", allowUnsafeInlineStyle: true });
    expect(csp.directives.styleSrc).toContain("'unsafe-inline'");
  });
});
