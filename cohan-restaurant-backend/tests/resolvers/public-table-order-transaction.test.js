import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  withTransaction: vi.fn(async (work) => work()),
  endSession: vi.fn(async () => {}),
}));

const mongooseMocks = vi.hoisted(() => ({
  startSession: vi.fn(async () => sessionMocks),
  isValidObjectId: vi.fn(() => true),
  Types: {
    ObjectId: class ObjectId {
      constructor(value) {
        this.value = String(value);
      }
      toString() {
        return this.value;
      }
    },
  },
}));

const modelMocks = vi.hoisted(() => ({
  Customer: { findOne: vi.fn() },
  Order: {
    findOne: vi.fn(),
    exists: vi.fn(),
    updateOne: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
  Table: {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
  Warehouse: { findOne: vi.fn() },
}));

const lifecycleMocks = vi.hoisted(() => ({
  ensureActiveTableSessionForDineInOrder: vi.fn(),
}));
const inventoryMocks = vi.hoisted(() => ({ reserveForOrderTx: vi.fn() }));
const hydrationMocks = vi.hoisted(() => ({ hydrateOrderItems: vi.fn() }));
const trackingMocks = vi.hoisted(() => ({
  ensureOrderTracking: vi.fn(),
  updatePublicStatusHistory: vi.fn(),
}));
const eventMocks = vi.hoisted(() => ({ emitOrderEvent: vi.fn() }));
const qrSessionMocks = vi.hoisted(() => ({
  verifyTableAccessToken: vi.fn(),
  getPublicTableOrderCapability: vi.fn(),
  mapPublicTableOrder: vi.fn((order) => ({
    id: String(order?._id || order?.id || ""),
    orderCode: order?.orderCode || null,
    currentStatus: order?.currentStatus || null,
  })),
}));

vi.mock("mongoose", () => ({ default: mongooseMocks }));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../utils/orderLifecycle.js", () => ({
  KITCHEN_STATUS: { DRAFT: "draft" },
  ORDER_KIND: { TABLE_SESSION: "table_session", ORDER_BATCH: "order_batch" },
  ORDER_PAYMENT_STATUS: { UNPAID: "unpaid" },
  SESSION_STATUS: { DINING: "dining" },
  SPLIT_STATUS: { NONE: "none" },
  activeTableSessionLookupFilter: ({ restaurantId, tableId, tableCode }) => ({
    restaurantId,
    tableId,
    tableCode,
    orderKind: "table_session",
  }),
  childOrdersForSessionFilter: ({ restaurantId, parentOrderId }) => ({
    restaurantId,
    parentOrderId,
    orderKind: "order_batch",
  }),
  ensureActiveTableSessionForDineInOrder:
    lifecycleMocks.ensureActiveTableSessionForDineInOrder,
}));
vi.mock("../../utils/publicTableSession.js", () => ({
  TABLE_ACCESS_TOKEN_ERROR: "Invalid table access token",
  TABLE_IDENTITY_TOKEN_ERROR: "Invalid table identity token",
  getPublicTableDemoOtp: vi.fn(() => "123456"),
  getPublicTableOrderCapability: qrSessionMocks.getPublicTableOrderCapability,
  mapPublicTableOrder: qrSessionMocks.mapPublicTableOrder,
  maskPublicCustomerName: vi.fn((value) => value),
  maskPublicPhone: vi.fn((value) => value),
  normalizePublicPhone: vi.fn((value) => value),
  normalizePublicTableCode: vi.fn((value) => String(value || "").toUpperCase()),
  signTableIdentityCandidate: vi.fn(),
  signTableIdentityChallenge: vi.fn(),
  signTableIdentityToken: vi.fn(),
  verifyTableAccessToken: qrSessionMocks.verifyTableAccessToken,
  verifyTableIdentityCandidate: vi.fn(),
  verifyTableIdentityChallenge: vi.fn(),
  verifyTableIdentityToken: vi.fn(),
}));
vi.mock("../../src/services/inventory.service.js", () => inventoryMocks);
vi.mock("../../src/services/orderItemHydration.service.js", () => hydrationMocks);
vi.mock("../../src/services/orderTracking.service.js", () => trackingMocks);
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => eventMocks);
vi.mock("../../graphql/resolvers/order/helper/orderUtils.js", () => ({
  normalizeItem: vi.fn((item) => ({ ...item })),
}));
vi.mock("../../graphql/resolvers/order/helper/userUtils.js", () => ({
  resolveOrCreateGuestCustomerForOrder: vi.fn(),
}));
vi.mock("../../utils/generateOrderCode.js", () => ({
  default: vi.fn((source) => `${source}-ORDER-1`),
}));

const restaurantId = "64b000000000000000000001";
const tableId = "64b000000000000000000002";
const tableToken = "signed-table-token";
const activeSession = {
  _id: "64b000000000000000000003",
  userId: null,
  sessionStatus: "dining",
  orderPaymentStatus: "unpaid",
};

function makeThenableQuery(value) {
  return {
    session: vi.fn(function session() {
      return this;
    }),
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function makeIdempotencyQuery(value) {
  return {
    sort: vi.fn(async () => value),
    session: vi.fn(async () => value),
  };
}

function makeActiveSessionQuery(value) {
  const query = {
    sort: vi.fn(() => query),
    session: vi.fn(() => query),
    lean: vi.fn(async () => value),
  };
  return query;
}

function makeTableQuery(table) {
  const query = {
    select: vi.fn(() => query),
    session: vi.fn(() => query),
    lean: vi.fn(async () => table),
  };
  return query;
}

function makeWarehouseQuery(warehouseId) {
  const query = {
    sort: vi.fn(() => query),
    session: vi.fn(() => query),
    lean: vi.fn(async () => ({ _id: warehouseId })),
  };
  return query;
}

function createOrderDocument(overrides = {}) {
  const document = {
    _id: "64b000000000000000000010",
    restaurantId,
    tableId,
    orderCode: "QR-ORDER-1",
    currentStatus: "pending",
    clientMeta: {
      source: "customer_table_qr",
      idempotencyKey: "request-1",
    },
    items: [],
    totals: { grandTotal: 50000 },
    save: vi.fn(async function save() {
      return this;
    }),
    toObject: vi.fn(function toObject() {
      return {
        _id: this._id,
        restaurantId: this.restaurantId,
        tableId: this.tableId,
        orderCode: this.orderCode,
        currentStatus: this.currentStatus,
        clientMeta: this.clientMeta,
        items: this.items,
        totals: this.totals,
      };
    }),
    ...overrides,
  };
  return document;
}

function buildInput() {
  return {
    restaurantId,
    tableId,
    token: tableToken,
    idempotencyKey: "request-1",
    items: [
      {
        dishId: "64b000000000000000000020",
        menuId: "64b000000000000000000021",
        categoryId: "64b000000000000000000022",
        name: "Cơm gà",
        quantity: 1,
        servingKey: "portion",
        unit: "portion",
      },
    ],
  };
}

describe("publicSubmitTableOrder transaction boundary", () => {
  let idempotencyResults;

  beforeEach(() => {
    vi.clearAllMocks();
    idempotencyResults = [null, null];
    sessionMocks.withTransaction.mockImplementation(async (work) => work());
    sessionMocks.endSession.mockResolvedValue(undefined);
    mongooseMocks.startSession.mockResolvedValue(sessionMocks);

    modelMocks.Table.findOne.mockReturnValue(
      makeTableQuery({
        _id: tableId,
        restaurantId,
        code: "A01",
        status: "occupied",
        tableAccessToken: tableToken,
      }),
    );
    modelMocks.Table.updateOne.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.Order.findOne.mockImplementation((filter) => {
      if (filter?.orderKind === "table_session") {
        return makeActiveSessionQuery(activeSession);
      }
      return makeIdempotencyQuery(idempotencyResults.shift() ?? null);
    });
    modelMocks.Order.exists.mockReturnValue(makeThenableQuery(false));
    modelMocks.Order.updateOne.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.Order.countDocuments.mockReturnValue({
      session: vi.fn(async () => 0),
    });
    modelMocks.Warehouse.findOne.mockReturnValue(
      makeWarehouseQuery("64b000000000000000000030"),
    );

    lifecycleMocks.ensureActiveTableSessionForDineInOrder.mockResolvedValue({
      sessionOrder: activeSession,
      created: false,
    });
    qrSessionMocks.verifyTableAccessToken.mockReturnValue({
      restaurantId,
      tableId,
      tableCode: "A01",
    });
    qrSessionMocks.getPublicTableOrderCapability.mockReturnValue({
      canOrder: true,
      reason: null,
    });
    hydrationMocks.hydrateOrderItems.mockImplementation(async ({ items }) => {
      items.forEach((item) => {
        item.servingVariant = {
          key: "portion",
          name: "Phần tiêu chuẩn",
          mode: "PORTION",
          sellQty: 1,
          sellUnit: "portion",
        };
        item.baseUnitPrice = 50000;
        item.unitPrice = 50000;
        item.lineSubtotal = 50000;
        item.status = "pending";
      });
    });
    inventoryMocks.reserveForOrderTx.mockResolvedValue(undefined);
    trackingMocks.ensureOrderTracking.mockImplementation(async (order) => {
      order.trackingCode = "ORD-TRACK-1";
      return order;
    });
    trackingMocks.updatePublicStatusHistory.mockImplementation((order) => {
      order.publicStatus = "ORDER_RECEIVED";
    });
    eventMocks.emitOrderEvent.mockResolvedValue(undefined);
  });

  it("persists tracking and table state before ending the Mongo session", async () => {
    const createdOrder = createOrderDocument();
    modelMocks.Order.create.mockResolvedValue([createdOrder]);

    const { publicSubmitTableOrder } = await import(
      "../../graphql/resolvers/order/publicTableOrderMutation.js"
    );
    const result = await publicSubmitTableOrder(
      null,
      { input: buildInput() },
      { io: {} },
    );

    expect(result.ok).toBe(true);
    expect(createdOrder.save).toHaveBeenCalledOnce();
    expect(createdOrder.save).toHaveBeenCalledWith({ session: sessionMocks });
    expect(modelMocks.Table.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: expect.anything(), restaurantId: expect.anything() }),
      { $set: { status: "occupied" } },
      { session: sessionMocks },
    );
    expect(modelMocks.Order.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: activeSession._id,
        orderKind: "table_session",
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          "clientMeta.lastQrSubmissionAt": expect.any(Date),
        }),
      }),
      { session: sessionMocks },
    );

    expect(createdOrder.save.mock.invocationCallOrder[0]).toBeLessThan(
      sessionMocks.endSession.mock.invocationCallOrder[0],
    );
    expect(modelMocks.Table.updateOne.mock.invocationCallOrder[0]).toBeLessThan(
      sessionMocks.endSession.mock.invocationCallOrder[0],
    );
    expect(sessionMocks.endSession.mock.invocationCallOrder[0]).toBeLessThan(
      eventMocks.emitOrderEvent.mock.invocationCallOrder[0],
    );
  });

  it("reuses the first committed batch after a concurrent retry serializes on the table session", async () => {
    const existingOrder = createOrderDocument({
      _id: "64b000000000000000000099",
      orderCode: "QR-EXISTING",
    });
    idempotencyResults = [null, existingOrder];

    const { publicSubmitTableOrder } = await import(
      "../../graphql/resolvers/order/publicTableOrderMutation.js"
    );
    const result = await publicSubmitTableOrder(
      null,
      { input: buildInput() },
      { io: {} },
    );

    expect(result.ok).toBe(true);
    expect(result.message).toContain("đã được gửi trước đó");
    expect(result.order.orderCode).toBe("QR-EXISTING");
    expect(modelMocks.Order.create).not.toHaveBeenCalled();
    expect(inventoryMocks.reserveForOrderTx).not.toHaveBeenCalled();
    expect(modelMocks.Table.updateOne).not.toHaveBeenCalled();
    expect(eventMocks.emitOrderEvent).not.toHaveBeenCalled();
  });
});
