import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRestaurantAccess = vi.fn();

const modelMocks = vi.hoisted(() => ({
  Reservation: {
    findById: vi.fn(),
    findOne: vi.fn(),
    exists: vi.fn(),
  },
  Restaurant: { findById: vi.fn() },
  Table: { updateOne: vi.fn(), findById: vi.fn(), findOne: vi.fn() },
  User: { findById: vi.fn() },
  PaymentTransaction: { create: vi.fn() },
  EventLog: { log: vi.fn() },
}));

vi.mock('../../models/index.js', () => modelMocks);
vi.mock('../../graphql/guards.js', () => ({ requireRestaurantAccess }));
vi.mock('mongoose', async () => {
  const actual = await vi.importActual('mongoose');
  return {
    ...actual,
    default: {
      ...actual.default,
      isValidObjectId: (v) => (typeof v === 'string' && (v.startsWith('valid-') || /^[a-fA-F0-9]{24}$/.test(v))),
      Types: {
        ...actual.default.Types,
        ObjectId: function ObjectId(v) { return v; },
      },
    },
    isValidObjectId: (v) => (typeof v === 'string' && (v.startsWith('valid-') || /^[a-fA-F0-9]{24}$/.test(v))),
    Types: {
      ...actual.Types,
      ObjectId: function ObjectId(v) { return v; },
    },
  };
});

describe('Reservation access hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireRestaurantAccess.mockResolvedValue(true);
    modelMocks.EventLog.log.mockResolvedValue(true);
    modelMocks.Table.updateOne.mockResolvedValue({ matchedCount: 1 });
    modelMocks.Reservation.exists.mockResolvedValue(false);
  });

  it('reservation by id allows owner without requireRestaurantAccess', async () => {
    const doc = { _id: 'valid-rsv', userId: 'user-1', restaurantId: 'valid-r1' };
    modelMocks.Reservation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(doc) });
    const { ReservationQuery } = await import('../../graphql/resolvers/reservation/query.js');

    const result = await ReservationQuery.reservation(null, { id: 'valid-rsv' }, { user: { id: 'user-1' } });

    expect(result).toEqual(doc);
    expect(requireRestaurantAccess).not.toHaveBeenCalled();
  });

  it('reservation by id denies other customer', async () => {
    modelMocks.Reservation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ userId: 'user-1', restaurantId: 'valid-r1' }) });
    const { ReservationQuery } = await import('../../graphql/resolvers/reservation/query.js');

    await expect(ReservationQuery.reservation(null, { id: 'valid-rsv' }, { user: { id: 'user-2', roleName: 'customer' } }))
      .rejects.toThrow('Unauthorized');
  });

  it('reservation by id for manager calls requireRestaurantAccess', async () => {
    const doc = { userId: 'user-1', restaurantId: 'valid-r1' };
    modelMocks.Reservation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(doc) });
    const { ReservationQuery } = await import('../../graphql/resolvers/reservation/query.js');

    const result = await ReservationQuery.reservation(null, { id: 'valid-rsv' }, { user: { id: 'm1', roleName: 'manager' } });

    expect(requireRestaurantAccess).toHaveBeenCalledWith({ user: { id: 'm1', roleName: 'manager' } }, 'valid-r1');
    expect(result).toEqual(doc);
  });

  it('reservation by id manager denied does not return doc', async () => {
    modelMocks.Reservation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ userId: 'user-1', restaurantId: 'valid-r1' }) });
    requireRestaurantAccess.mockRejectedValueOnce(new Error('FORBIDDEN_SCOPE'));
    const { ReservationQuery } = await import('../../graphql/resolvers/reservation/query.js');

    await expect(ReservationQuery.reservation(null, { id: 'valid-rsv' }, { user: { id: 'm1', roleName: 'manager' } }))
      .rejects.toThrow('FORBIDDEN_SCOPE');
  });

  it('confirmedReservationByTable denied does not call Reservation.findOne', async () => {
    requireRestaurantAccess.mockRejectedValueOnce(new Error('FORBIDDEN_SCOPE'));
    const { ReservationQuery } = await import('../../graphql/resolvers/reservation/query.js');

    await expect(ReservationQuery.confirmedReservationByTable(null, { restaurantId: 'valid-r1', tableId: 'valid-t1' }, { user: { id: 'm1', roleName: 'manager' } }))
      .rejects.toThrow('FORBIDDEN_SCOPE');
    expect(modelMocks.Reservation.findOne).not.toHaveBeenCalled();
  });

  it('confirmedReservationByTable allowed calls requireRestaurantAccess before query', async () => {
    modelMocks.Reservation.findOne.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) });
    const { ReservationQuery } = await import('../../graphql/resolvers/reservation/query.js');

    await ReservationQuery.confirmedReservationByTable(null, { restaurantId: 'valid-r1', tableId: 'valid-t1' }, { user: { id: 'm1', roleName: 'manager' } });

    expect(requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.Reservation.findOne).toHaveBeenCalled();
  });

  it('updateReservationStatus denied manager scope before save/table update', async () => {
    const current = { _id: 'valid-rsv', userId: 'u1', restaurantId: 'valid-r1', tableId: 'valid-t1', save: vi.fn() };
    modelMocks.Reservation.findById.mockResolvedValue(current);
    requireRestaurantAccess.mockRejectedValueOnce(new Error('FORBIDDEN_SCOPE'));
    const { ReservationMutation } = await import('../../graphql/resolvers/reservation/mutation.js');

    await expect(ReservationMutation.updateReservationStatus(null, { input: { id: 'valid-rsv', status: 'confirmed' } }, { user: { id: 'm1', roleName: 'manager' } }))
      .rejects.toThrow('FORBIDDEN_SCOPE');
    expect(current.save).not.toHaveBeenCalled();
    expect(modelMocks.Table.updateOne).not.toHaveBeenCalled();
  });

  it('updateReservationStatus allowed manager saves and updates table status', async () => {
    const current = { _id: 'valid-rsv', userId: 'u1', restaurantId: 'valid-r1', tableId: 'valid-t1', save: vi.fn() };
    modelMocks.Reservation.findById.mockResolvedValue(current);
    const { ReservationMutation } = await import('../../graphql/resolvers/reservation/mutation.js');

    await ReservationMutation.updateReservationStatus(null, { input: { id: 'valid-rsv', status: 'confirmed' } }, { user: { id: 'm1', roleName: 'manager' } });

    expect(current.save).toHaveBeenCalled();
    expect(modelMocks.Reservation.exists).toHaveBeenCalled();
    expect(modelMocks.Table.updateOne).toHaveBeenCalled();
  });

  it('updateReservationStatus rejects unauthenticated/customer owner', async () => {
    const current = { _id: 'valid-rsv', userId: 'user-1', restaurantId: 'valid-r1', tableId: 'valid-t1', save: vi.fn() };
    modelMocks.Reservation.findById.mockResolvedValue(current);
    const { ReservationMutation } = await import('../../graphql/resolvers/reservation/mutation.js');

    await expect(ReservationMutation.updateReservationStatus(null, { input: { id: 'valid-rsv', status: 'confirmed' } }, {}))
      .rejects.toThrow('Unauthorized');
    await expect(ReservationMutation.updateReservationStatus(null, { input: { id: 'valid-rsv', status: 'confirmed' } }, { user: { id: 'user-1', roleName: 'customer' } }))
      .rejects.toThrow('Unauthorized');
    expect(current.save).not.toHaveBeenCalled();
  });

  it('submitReservationPayment owner allowed without requireRestaurantAccess', async () => {
    const reservation = { _id: 'valid-rsv', userId: 'user-1', restaurantId: 'valid-r1', tableId: 'valid-t1', depositStatus: 'pending', save: vi.fn() };
    modelMocks.Reservation.findById.mockResolvedValue(reservation);
    const { ReservationMutation } = await import('../../graphql/resolvers/reservation/mutation.js');

    await ReservationMutation.submitReservationPayment(null, { input: { reservationId: 'valid-rsv', method: 'momo', paymentStatus: 'pending' } }, { user: { id: 'user-1', roleName: 'customer' } });

    expect(requireRestaurantAccess).not.toHaveBeenCalled();
    expect(reservation.save).toHaveBeenCalled();
  });

  it('submitReservationPayment manager denied by restaurant scope before save/payment transaction/event log', async () => {
    const reservation = { _id: 'valid-rsv', userId: 'user-1', restaurantId: 'valid-r1', tableId: 'valid-t1', depositStatus: 'pending', save: vi.fn() };
    modelMocks.Reservation.findById.mockResolvedValue(reservation);
    requireRestaurantAccess.mockRejectedValueOnce(new Error('FORBIDDEN_SCOPE'));
    const { ReservationMutation } = await import('../../graphql/resolvers/reservation/mutation.js');

    await expect(ReservationMutation.submitReservationPayment(null, { input: { reservationId: 'valid-rsv', method: 'momo', paymentStatus: 'paid' } }, { user: { id: 'm1', roleName: 'manager' } }))
      .rejects.toThrow('FORBIDDEN_SCOPE');
    expect(reservation.save).not.toHaveBeenCalled();
    expect(modelMocks.PaymentTransaction.create).not.toHaveBeenCalled();
    expect(modelMocks.EventLog.log).not.toHaveBeenCalled();
  });

  it('cancelReservation owner allowed without requireRestaurantAccess', async () => {
    const current = { _id: 'valid-rsv', userId: 'u1', restaurantId: 'valid-r1', tableId: 'valid-t1', depositStatus: 'pending', save: vi.fn() };
    modelMocks.Reservation.findById.mockResolvedValue(current);
    const { ReservationMutation } = await import('../../graphql/resolvers/reservation/mutation.js');

    await ReservationMutation.cancelReservation(null, { id: 'valid-rsv' }, { user: { id: 'u1', roleName: 'customer' } });
    expect(requireRestaurantAccess).not.toHaveBeenCalled();
    expect(current.save).toHaveBeenCalled();
    expect(modelMocks.EventLog.log).toHaveBeenCalled();
  });

  it('cancelReservation manager denied by restaurant scope before save', async () => {
    const current = { _id: 'valid-rsv', userId: 'u1', restaurantId: 'valid-r1', tableId: 'valid-t1', depositStatus: 'pending', save: vi.fn() };
    modelMocks.Reservation.findById.mockResolvedValue(current);
    requireRestaurantAccess.mockRejectedValueOnce(new Error('FORBIDDEN_SCOPE'));
    const { ReservationMutation } = await import('../../graphql/resolvers/reservation/mutation.js');

    await expect(ReservationMutation.cancelReservation(null, { id: 'valid-rsv' }, { user: { id: 'm1', roleName: 'manager' } }))
      .rejects.toThrow('FORBIDDEN_SCOPE');
    expect(current.save).not.toHaveBeenCalled();
    expect(modelMocks.EventLog.log).not.toHaveBeenCalled();
  });

  it('deleteReservation denied by restaurant scope before no_show/save', async () => {
    const current = { _id: 'valid-rsv', userId: 'u1', restaurantId: 'valid-r1', tableId: 'valid-t1', save: vi.fn() };
    modelMocks.Reservation.findById.mockResolvedValue(current);
    requireRestaurantAccess.mockRejectedValueOnce(new Error('FORBIDDEN_SCOPE'));
    const { ReservationMutation } = await import('../../graphql/resolvers/reservation/mutation.js');

    await expect(ReservationMutation.deleteReservation(null, { id: 'valid-rsv' }, { user: { id: 'm1', roleName: 'manager' } }))
      .rejects.toThrow('FORBIDDEN_SCOPE');
    expect(current.save).not.toHaveBeenCalled();
    expect(modelMocks.Table.updateOne).not.toHaveBeenCalled();
  });

  it('deleteReservation allowed manager sets no_show and updates table status', async () => {
    const current = { _id: 'valid-rsv', userId: 'u1', restaurantId: 'valid-r1', tableId: 'valid-t1', status: 'confirmed', save: vi.fn() };
    modelMocks.Reservation.findById.mockResolvedValue(current);
    const { ReservationMutation } = await import('../../graphql/resolvers/reservation/mutation.js');

    await ReservationMutation.deleteReservation(null, { id: 'valid-rsv' }, { user: { id: 'm1', roleName: 'manager' } });

    expect(current.status).toBe('no_show');
    expect(current.save).toHaveBeenCalled();
    expect(modelMocks.Table.updateOne).toHaveBeenCalled();
  });
});
