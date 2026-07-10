import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  hasValidPublicTableOrderSessionAccess: vi.fn(),
  validatePublicTableOrderSessionAccess: vi.fn(),
  requestPublicTableOrderAccess: vi.fn(),
  confirmPublicTableOrderAccess: vi.fn(),
  listPendingPublicTableOrderAccessRequests: vi.fn(),
}));
const bootstrapMocks = vi.hoisted(() => ({
  ensurePublicTableSessionForAccess: vi.fn(),
}));
const baseMocks = vi.hoisted(() => ({
  publicActiveTableSessionOrders: vi.fn(),
  publicRequestTableIdentityOtp: vi.fn(),
  publicSubmitTableOrder: vi.fn(),
}));
const cookieMocks = vi.hoisted(() => ({
  withTableOrderSessionCookieCredentials: vi.fn((ctx) => ctx),
  setTableOrderSessionCookies: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({
  emitRestaurantEvent: vi.fn(),
}));

vi.mock("../../src/services/publicTableOrderAccess.service.js", () => ({
  ...serviceMocks,
}));
vi.mock("../../src/services/publicTableSessionBootstrap.service.js", () => ({
  ...bootstrapMocks,
}));
vi.mock(
  "../../graphql/resolvers/order/publicTableSessionQuery.js",
  () => ({
    default: {
      publicActiveTableSessionOrders:
        baseMocks.publicActiveTableSessionOrders,
    },
  }),
);
vi.mock(
  "../../graphql/resolvers/order/publicTableOrderMutation.js",
  () => ({
    default: {
      publicRequestTableIdentityOtp:
        baseMocks.publicRequestTableIdentityOtp,
      publicSubmitTableOrder: baseMocks.publicSubmitTableOrder,
    },
  }),
);
vi.mock(
  "../../graphql/resolvers/shared/tableOrderSessionCookies.js",
  () => cookieMocks,
);
vi.mock(
  "../../src/services/auth/authorization.service.js",
  () => authMocks,
);
vi.mock(
  "../../graphql/resolvers/order/helper/emitOrderEvent.js",
  () => eventMocks,
);

const restaurantId = "64b000000000000000000001";
const tableId = "64b000000000000000000002";

function buildBaseResult() {
  return {
    tableId,
    tableCode: "A01",
    tableStatus: "occupied",
    canOrder: true,
    orderBlockedReason: null,
    session: {
      id: "64b000000000000000000003",
      orderCode: "POS-A01",
      orderKind: "table_session",
      currentStatus: "pending",
      sessionStatus: "dining",
      orderPaymentStatus: "unpaid",
      payment: { status: "pending" },
    },
    orders: [{ id: "order-private", orderCode: "QR-A01" }],
    customerRequests: [{ requestId: "support-private" }],
  };
}

describe("PublicTableOrderAccess resolver boundary", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { __testables } = await import(
      "../../graphql/resolvers/order/publicTableOrderAccess.js"
    );
    __testables.confirmationAttempts.clear();
    bootstrapMocks.ensurePublicTableSessionForAccess.mockResolvedValue({
      _id: "64b000000000000000000003",
    });
    serviceMocks.requestPublicTableOrderAccess.mockResolvedValue({
      ok: true,
      restaurantId,
      tableId,
      tableCode: "A01",
      requestId: "request-1",
      requestLabel: "A1B2",
      requestToken: "request-token",
      expiresAt: "2026-07-11T03:00:00.000Z",
    });
    baseMocks.publicActiveTableSessionOrders.mockResolvedValue(
      buildBaseResult(),
    );
    baseMocks.publicSubmitTableOrder.mockResolvedValue({
      ok: true,
      order: { id: "order-1" },
    });
    serviceMocks.validatePublicTableOrderSessionAccess.mockResolvedValue({
      session: { _id: "session-1" },
    });
    eventMocks.emitRestaurantEvent.mockResolvedValue(undefined);
  });

  it("hides table orders and disables ordering when the scanned device is not confirmed", async () => {
    serviceMocks.hasValidPublicTableOrderSessionAccess.mockResolvedValue(false);
    const { PublicTableOrderAccessQuery } = await import(
      "../../graphql/resolvers/order/publicTableOrderAccess.js"
    );

    const result = await PublicTableOrderAccessQuery.publicActiveTableSessionOrders(
      null,
      { restaurantId, tableId, token: "printed-token" },
      { request: { cookies: {} } },
    );

    expect(result.orderAccessConfirmed).toBe(false);
    expect(result.canRequestOrderAccess).toBe(true);
    expect(result.canOrder).toBe(false);
    expect(result.orders).toEqual([]);
    expect(result.customerRequests).toEqual([]);
    expect(result.session.orderCode).toBeNull();
  });

  it("does not let a reserved table request verification before staff opens service", async () => {
    serviceMocks.hasValidPublicTableOrderSessionAccess.mockResolvedValue(false);
    baseMocks.publicActiveTableSessionOrders.mockResolvedValue({
      ...buildBaseResult(),
      tableStatus: "reserved",
      session: null,
      orders: [],
      customerRequests: [],
    });
    const { PublicTableOrderAccessQuery } = await import(
      "../../graphql/resolvers/order/publicTableOrderAccess.js"
    );

    const result = await PublicTableOrderAccessQuery.publicActiveTableSessionOrders(
      null,
      { restaurantId, tableId, token: "printed-token" },
      { request: { cookies: {} } },
    );

    expect(result.canRequestOrderAccess).toBe(false);
    expect(result.canOrder).toBe(false);
    expect(result.orderAccessBlockedReason).toMatch(/đang phục vụ/i);
    expect(
      serviceMocks.hasValidPublicTableOrderSessionAccess,
    ).not.toHaveBeenCalled();
  });

  it("returns the active table-session data after the cookie-bound device is confirmed", async () => {
    serviceMocks.hasValidPublicTableOrderSessionAccess.mockResolvedValue(true);
    const { PublicTableOrderAccessQuery } = await import(
      "../../graphql/resolvers/order/publicTableOrderAccess.js"
    );

    const result = await PublicTableOrderAccessQuery.publicActiveTableSessionOrders(
      null,
      { restaurantId, tableId, token: "printed-token" },
      { request: { cookies: {} } },
    );

    expect(result.orderAccessConfirmed).toBe(true);
    expect(result.canOrder).toBe(true);
    expect(result.orders).toHaveLength(1);
    expect(result.customerRequests).toHaveLength(1);
    expect(result.session.orderCode).toBe("POS-A01");
  });

  it("opens or reuses the table session before creating the staff verification request", async () => {
    const { PublicTableOrderAccessMutation } = await import(
      "../../graphql/resolvers/order/publicTableOrderAccess.js"
    );
    const input = {
      restaurantId,
      tableId,
      token: "printed-token",
      deviceId: "table-device-11111111-2222-4333-8444-555555555555",
    };

    const result =
      await PublicTableOrderAccessMutation.publicRequestTableOrderAccess(
        null,
        { input },
        { io: {} },
      );

    expect(result.requestLabel).toBe("A1B2");
    expect(
      bootstrapMocks.ensurePublicTableSessionForAccess,
    ).toHaveBeenCalledWith(input);
    expect(serviceMocks.requestPublicTableOrderAccess).toHaveBeenCalledWith(
      input,
    );
    expect(
      bootstrapMocks.ensurePublicTableSessionForAccess.mock.invocationCallOrder[0],
    ).toBeLessThan(
      serviceMocks.requestPublicTableOrderAccess.mock.invocationCallOrder[0],
    );
  });

  it("limits one confirmation request token to five attempts per window", async () => {
    const { __testables } = await import(
      "../../graphql/resolvers/order/publicTableOrderAccess.js"
    );
    const now = 1000;

    for (let index = 0; index < 5; index += 1) {
      expect(() =>
        __testables.consumeConfirmationAttempt("request-token", now),
      ).not.toThrow();
    }
    expect(() =>
      __testables.consumeConfirmationAttempt("request-token", now),
    ).toThrow(/quá nhiều lần/i);
  });

  it("validates the verified table session before the original submit-order resolver runs", async () => {
    const { PublicTableOrderAccessMutation } = await import(
      "../../graphql/resolvers/order/publicTableOrderAccess.js"
    );
    const input = {
      restaurantId,
      tableId,
      token: "printed-token",
      items: [],
      idempotencyKey: "retry-1",
    };
    const ctx = { request: { cookies: {} } };

    await PublicTableOrderAccessMutation.publicSubmitTableOrder(
      null,
      { input },
      ctx,
      {},
    );

    expect(
      serviceMocks.validatePublicTableOrderSessionAccess,
    ).toHaveBeenCalledWith({
      ctx,
      restaurantId,
      tableId,
      requireOrderable: true,
    });
    expect(baseMocks.publicSubmitTableOrder).toHaveBeenCalledOnce();
    expect(
      serviceMocks.validatePublicTableOrderSessionAccess.mock.invocationCallOrder[0],
    ).toBeLessThan(
      baseMocks.publicSubmitTableOrder.mock.invocationCallOrder[0],
    );
  });
});
