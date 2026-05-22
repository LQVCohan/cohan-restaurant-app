import { beforeEach, describe, expect, it, vi } from 'vitest';

const orderFindOneMock = vi.fn();
const orderFindMock = vi.fn();
const reservationFindOneMock = vi.fn();

vi.mock('../../models/order.model.js', () => ({
  default: { findOne: orderFindOneMock, find: orderFindMock },
}));
vi.mock('../../models/reservation.model.js', () => ({
  default: { findOne: reservationFindOneMock },
}));

describe('tableStateGuards helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderFindMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    });
  });

  it('hasActiveReservationsForTable returns true with active status', async () => {
    reservationFindOneMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: 'rsv-1', status: 'pending_payment' }),
    });
    const { hasActiveReservationsForTable, ACTIVE_RESERVATION_STATUSES } = await import('../../utils/tableStateGuards.js');

    const result = await hasActiveReservationsForTable({ restaurantId: 'valid-r1', tableId: 'valid-t1' });

    expect(result).toBe(true);
    expect(ACTIVE_RESERVATION_STATUSES).toEqual(['pending_payment', 'confirmed', 'seated', 'pending_change']);
    expect(reservationFindOneMock).toHaveBeenCalledWith({
      restaurantId: 'valid-r1',
      tableId: 'valid-t1',
      status: { $in: ['pending_payment', 'confirmed', 'seated', 'pending_change'] },
    });
  });

  it('hasActiveReservationsForTable returns false when no active reservation', async () => {
    reservationFindOneMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });
    const { hasActiveReservationsForTable } = await import('../../utils/tableStateGuards.js');

    const result = await hasActiveReservationsForTable({ restaurantId: 'valid-r1', tableId: 'valid-t1' });

    expect(result).toBe(false);
  });

  it("getTableAvailabilityBlockReason returns unsserved item reason first", async () => {
    orderFindOneMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: "ord-1",
        items: [{ status: "preparing" }],
        orderPaymentStatus: "paid",
        totals: { grandTotal: 100 },
      }),
    });
    const { getTableAvailabilityBlockReason } = await import("../../utils/tableStateGuards.js");
    const reason = await getTableAvailabilityBlockReason({
      restaurantId: "valid-r1",
      tableId: "valid-t1",
      tableCode: "A1",
    });
    expect(reason?.code).toBe("TABLE_HAS_UNSERVED_ITEMS");
  });

  it("getTableAvailabilityBlockReason returns unpaid reason", async () => {
    orderFindOneMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: "ord-1",
        items: [{ status: "served" }],
        orderPaymentStatus: "unpaid",
        totals: { grandTotal: 200 },
      }),
    });
    const { getTableAvailabilityBlockReason } = await import("../../utils/tableStateGuards.js");
    const reason = await getTableAvailabilityBlockReason({
      restaurantId: "valid-r1",
      tableId: "valid-t1",
      tableCode: "A1",
    });
    expect(reason?.code).toBe("TABLE_HAS_UNPAID_ORDERS");
  });
});
