import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  hasValidPublicTableOrderSessionAccess: vi.fn(),
  validatePublicTableOrderSessionAccess: vi.fn(),
  requestPublicTableOrderAccess: vi.fn(),
  confirmPublicTableOrderAccess: vi.fn(),
  listPendingPublicTableOrderAccessRequests: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
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
