import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const baseEnv = process.env;

const modelMocks = vi.hoisted(() => ({
  Order: {},
  Table: {},
}));

vi.mock("../../models/index.js", () => modelMocks);

describe("publicTableOrderAccess service security", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...baseEnv,
      NODE_ENV: "test",
      TABLE_ORDER_SESSION_TOKEN_SECRET:
        "table-order-session-secret-for-tests-123456789",
      JWT_ISSUER: "cohan-test",
    };
  });

  afterEach(() => {
    process.env = baseEnv;
  });

  it("derives a stable six-digit confirmation code from session, request and device", async () => {
    const {
      buildPublicTableOrderConfirmationCode,
      hashPublicTableOrderDevice,
    } = await import("../../src/services/publicTableOrderAccess.service.js");

    const deviceHash = hashPublicTableOrderDevice(
      "table-device-11111111-2222-4333-8444-555555555555",
    );
    const first = buildPublicTableOrderConfirmationCode({
      sessionId: "64b000000000000000000001",
      requestId: "request-1",
      deviceHash,
    });
    const second = buildPublicTableOrderConfirmationCode({
      sessionId: "64b000000000000000000001",
      requestId: "request-1",
      deviceHash,
    });
    const otherDevice = buildPublicTableOrderConfirmationCode({
      sessionId: "64b000000000000000000001",
      requestId: "request-1",
      deviceHash: hashPublicTableOrderDevice(
        "table-device-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      ),
    });

    expect(first).toMatch(/^\d{6}$/);
    expect(second).toBe(first);
    expect(otherDevice).not.toBe(first);
  });

  it("signs request and order-session tokens with exact table-session-device scope", async () => {
    const {
      hashPublicTableOrderDevice,
      __testables,
    } = await import("../../src/services/publicTableOrderAccess.service.js");
    const deviceHash = hashPublicTableOrderDevice(
      "table-device-11111111-2222-4333-8444-555555555555",
    );
    const scope = {
      restaurantId: "64b000000000000000000001",
      tableId: "64b000000000000000000002",
      sessionId: "64b000000000000000000003",
      requestId: "request-1",
      deviceHash,
    };

    const requestToken = __testables.signAccessRequestToken(scope);
    expect(
      __testables.verifyScopedToken(
        requestToken,
        __testables.ACCESS_REQUEST_PURPOSE,
      ),
    ).toMatchObject(scope);

    const sessionToken = __testables.signOrderSessionToken(scope);
    expect(
      __testables.verifyScopedToken(
        sessionToken,
        __testables.ORDER_SESSION_PURPOSE,
      ),
    ).toMatchObject(scope);
    expect(() =>
      __testables.verifyScopedToken(
        sessionToken,
        __testables.ACCESS_REQUEST_PURPOSE,
      ),
    ).toThrow(/xác nhận thiết bị/i);
  });

  it("rejects short or malformed browser device identifiers", async () => {
    const { hashPublicTableOrderDevice } = await import(
      "../../src/services/publicTableOrderAccess.service.js"
    );

    expect(() => hashPublicTableOrderDevice("short")).toThrow(
      /Thiết bị gọi món không hợp lệ/i,
    );
    expect(() =>
      hashPublicTableOrderDevice("table-device-valid-but-has-space value"),
    ).toThrow(/Thiết bị gọi món không hợp lệ/i);
  });
});
