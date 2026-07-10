import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Customer: { findOne: vi.fn() },
  Order: {
    findOne: vi.fn(),
    exists: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
  },
  Table: { findOne: vi.fn(), updateOne: vi.fn() },
  Warehouse: { findOne: vi.fn() },
}));
const inventoryMocks = vi.hoisted(() => ({ reserveForOrderTx: vi.fn() }));
const hydrationMocks = vi.hoisted(() => ({ hydrateOrderItems: vi.fn() }));
const trackingMocks = vi.hoisted(() => ({
  ensureOrderTracking: vi.fn(),
  updatePublicStatusHistory: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({ emitOrderEvent: vi.fn() }));
const userMocks = vi.hoisted(() => ({
  resolveOrCreateGuestCustomerForOrder: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/inventory.service.js", () => inventoryMocks);
vi.mock("../../src/services/orderItemHydration.service.js", () => hydrationMocks);
vi.mock("../../src/services/orderTracking.service.js", () => trackingMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => eventMocks);
vi.mock("../../graphql/resolvers/order/helper/userUtils.js", () => userMocks);

const restaurantId = "64b000000000000000000001";
const tableId = "64b000000000000000000002";
const registeredCustomerId = "64b000000000000000000003";
const orderId = "64b000000000000000000004";

function mockTableAccess(tableToken, status = "occupied") {
  modelMocks.Table.findOne.mockReturnValue({
    select: vi.fn(() => ({
      lean: vi.fn(async () => ({
        _id: tableId,
        code: "A01",
        status,
        tableAccessToken: tableToken,
      })),
    })),
  });
}

function mockActiveSession(session = null) {
  modelMocks.Order.findOne.mockReturnValue({
    sort: vi.fn(() => ({ lean: vi.fn(async () => session) })),
  });
}

describe("public table order demo identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
    process.env.TABLE_QR_DEMO_OTP = "123456";
    process.env.TABLE_ACCESS_TOKEN_SECRET = "table-demo-secret-123456789";
  });

  it("returns the thesis OTP only after validating an orderable table QR", async () => {
    const { signTableAccessToken } = await import("../../utils/publicTableSession.js");
    const tableToken = signTableAccessToken({ restaurantId, tableId, tableCode: "A01" });
    mockTableAccess(tableToken);
    mockActiveSession({
      _id: "session-1",
      sessionStatus: "dining",
      orderPaymentStatus: "unpaid",
      payment: { status: "pending" },
    });
    const { publicRequestTableIdentityOtp } = await import(
      "../../graphql/resolvers/order/publicTableOrderMutation.js"
    );

    const result = await publicRequestTableIdentityOtp(null, {
      input: {
        restaurantId,
        tableId,
        token: tableToken,
        phone: "+84 912 345 678",
      },
    });

    expect(result).toMatchObject({
      ok: true,
      maskedPhone: "******5678",
      demoOtp: "123456",
    });
    expect(result.challengeToken).toEqual(expect.any(String));
  });

  it("requires explicit confirmation before linking a registered customer", async () => {
    const {
      publicVerifyTableIdentityOtp,
      publicConfirmTableIdentity,
    } = await import("../../graphql/resolvers/order/publicTableOrderMutation.js");
    const { signTableIdentityChallenge } = await import("../../utils/publicTableSession.js");
    const challengeToken = signTableIdentityChallenge({
      restaurantId,
      tableId,
      phone: "0912345678",
    });
    modelMocks.Customer.findOne.mockReturnValue({
      lean: vi.fn(async () => ({
        _id: registeredCustomerId,
        fullName: "Nguyễn Văn An",
        phone: "0912345678",
        isGuest: false,
      })),
    });

    const verification = await publicVerifyTableIdentityOtp(null, {
      input: { challengeToken, otp: "123456" },
    });

    expect(verification).toMatchObject({
      ok: true,
      requiresAccountConfirmation: true,
      identityToken: null,
      linkedAsGuest: false,
    });
    expect(verification.candidateToken).toEqual(expect.any(String));

    const declined = await publicConfirmTableIdentity(null, {
      input: { candidateToken: verification.candidateToken, accept: false },
    });
    expect(declined.identityToken).toBeNull();
  });

  it("returns an existing QR order for the same idempotency key without creating another batch", async () => {
    const { signTableAccessToken } = await import("../../utils/publicTableSession.js");
    const tableToken = signTableAccessToken({ restaurantId, tableId, tableCode: "A01" });
    mockTableAccess(tableToken);
    const existingOrder = {
      _id: orderId,
      orderCode: "QR-20260710-A01-ABC123",
      currentStatus: "pending",
      totals: { grandTotal: 50000 },
      items: [
        {
          _id: "64b000000000000000000010",
          name: "Cơm gà",
          quantity: 1,
          unit: "portion",
          servingKey: "portion",
          unitPrice: 50000,
          lineSubtotal: 50000,
          status: "pending",
        },
      ],
      toObject() { return { ...this }; },
    };
    modelMocks.Order.findOne.mockReturnValue({
      sort: vi.fn(async () => existingOrder),
    });
    const { publicSubmitTableOrder } = await import(
      "../../graphql/resolvers/order/publicTableOrderMutation.js"
    );

    const result = await publicSubmitTableOrder(
      null,
      {
        input: {
          restaurantId,
          tableId,
          token: tableToken,
          identityToken: null,
          idempotencyKey: "same-request",
          items: [
            {
              dishId: "64b000000000000000000020",
              menuId: "64b000000000000000000021",
              categoryId: "64b000000000000000000022",
              name: "Cơm gà",
              quantity: 1,
              basePrice: 50000,
              servingKey: "portion",
              servingVariant: {
                key: "portion",
                name: "Phần tiêu chuẩn",
                mode: "PORTION",
                price: 50000,
                sellQty: 1,
                sellUnit: "portion",
              },
            },
          ],
        },
      },
      {},
    );

    expect(result).toMatchObject({
      ok: true,
      message: "Đợt gọi món này đã được gửi trước đó.",
      order: { id: orderId, currentStatus: "pending" },
    });
    expect(modelMocks.Order.create).not.toHaveBeenCalled();
    expect(inventoryMocks.reserveForOrderTx).not.toHaveBeenCalled();
  });
});
