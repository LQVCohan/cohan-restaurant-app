import { beforeEach, describe, expect, it, vi } from "vitest";

const orderFindOneMock = vi.fn();
const orderFindMock = vi.fn();
const orderUpdateOneMock = vi.fn();
const reservationFindOneMock = vi.fn();

vi.mock("../../models/order.model.js", () => ({
  default: {
    findOne: orderFindOneMock,
    find: orderFindMock,
    updateOne: orderUpdateOneMock,
  },
}));

vi.mock("../../models/reservation.model.js", () => ({
  default: { findOne: reservationFindOneMock },
}));

const leanResult = (value) => ({
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

describe("empty reservation table session cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderFindMock.mockReturnValue(leanResult([]));
    orderUpdateOneMock.mockResolvedValue({ modifiedCount: 1 });
  });

  it("cancels an empty internal table session so the table can be released", async () => {
    const now = new Date("2026-07-14T02:00:00.000Z");
    orderFindOneMock
      .mockReturnValueOnce(
        leanResult({
          _id: "session-empty",
          items: [],
          totals: { grandTotal: 0 },
          orderPaymentStatus: "unpaid",
          payment: { status: "pending" },
          sessionStatus: "dining",
        }),
      )
      .mockReturnValueOnce(leanResult(null));

    const { closeEmptyTableSessionForTable } = await import(
      "../../utils/tableStateGuards.js"
    );
    const closed = await closeEmptyTableSessionForTable({
      restaurantId: "restaurant-1",
      tableId: "table-1",
      tableCode: "A1",
      now,
    });

    expect(closed).toBe(true);
    expect(orderUpdateOneMock).toHaveBeenCalledWith(
      {
        _id: "session-empty",
        sessionStatus: { $in: ["open", "dining", "ready_to_pay"] },
      },
      {
        $set: {
          sessionStatus: "cancelled",
          kitchenStatus: "cancelled",
          currentStatus: "cancelled",
          closedAt: now,
        },
        $unset: { activeSessionKey: 1 },
      },
    );
  });

  it("does not close a table session that still has an active order batch", async () => {
    orderFindOneMock
      .mockReturnValueOnce(
        leanResult({
          _id: "session-1",
          items: [],
          totals: { grandTotal: 0 },
          orderPaymentStatus: "unpaid",
        }),
      )
      .mockReturnValueOnce(leanResult({ _id: "batch-2" }));

    const { closeEmptyTableSessionForTable } = await import(
      "../../utils/tableStateGuards.js"
    );
    const closed = await closeEmptyTableSessionForTable({
      restaurantId: "restaurant-1",
      tableId: "table-1",
      tableCode: "A1",
    });

    expect(closed).toBe(false);
    expect(orderUpdateOneMock).not.toHaveBeenCalled();
  });

  it("does not close a session with billable items or an unpaid amount", async () => {
    orderFindOneMock
      .mockReturnValueOnce(
        leanResult({
          _id: "session-1",
          items: [{ status: "served" }],
          totals: { grandTotal: 100000 },
          orderPaymentStatus: "unpaid",
        }),
      )
      .mockReturnValueOnce(leanResult(null));

    const { closeEmptyTableSessionForTable } = await import(
      "../../utils/tableStateGuards.js"
    );
    const closed = await closeEmptyTableSessionForTable({
      restaurantId: "restaurant-1",
      tableId: "table-1",
      tableCode: "A1",
    });

    expect(closed).toBe(false);
    expect(orderUpdateOneMock).not.toHaveBeenCalled();
  });
});
