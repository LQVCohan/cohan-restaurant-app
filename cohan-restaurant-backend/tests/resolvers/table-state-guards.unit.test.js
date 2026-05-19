import { beforeEach, describe, expect, it, vi } from 'vitest';

const orderFindOneMock = vi.fn();
const reservationFindOneMock = vi.fn();

vi.mock('../../models/order.model.js', () => ({
  default: { findOne: orderFindOneMock },
}));
vi.mock('../../models/reservation.model.js', () => ({
  default: { findOne: reservationFindOneMock },
}));

describe('tableStateGuards helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
