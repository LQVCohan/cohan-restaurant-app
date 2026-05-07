import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRestaurantAccess = vi.fn();
const requireRoles = vi.fn();

const EventLog = vi.hoisted(() => ({
  find: vi.fn(),
  countDocuments: vi.fn(),
}));

vi.mock('../../models/event-log.model.js', () => ({ default: EventLog }));
vi.mock('../../graphql/guards.js', () => ({ requireRestaurantAccess, requireRoles }));
vi.mock('mongoose', async () => {
  const actual = await vi.importActual('mongoose');
  return {
    ...actual,
    default: {
      ...actual.default,
      isValidObjectId: (v) => v === 'valid-r1',
    },
    isValidObjectId: (v) => v === 'valid-r1',
  };
});

describe('eventLogs access guard', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireRestaurantAccess.mockResolvedValue(true);
    requireRoles.mockResolvedValue(true);

    EventLog.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
    EventLog.countDocuments.mockResolvedValue(0);
  });

  it('eventLogs with restaurantId denied does not query DB', async () => {
    requireRestaurantAccess.mockRejectedValueOnce(new Error('FORBIDDEN_SCOPE'));
    const resolver = (await import('../../graphql/resolvers/event_log/query.js')).default;

    await expect(resolver.eventLogs(null, { filter: { restaurantId: 'valid-r1' } }, { user: { id: 'm1' } }))
      .rejects.toThrow('FORBIDDEN_SCOPE');
    expect(EventLog.find).not.toHaveBeenCalled();
    expect(EventLog.countDocuments).not.toHaveBeenCalled();
  });

  it('eventLogs with restaurantId allowed calls requireRestaurantAccess and queries scoped logs', async () => {
    const ctx = { user: { id: 'm1', roleName: 'manager' } };
    const resolver = (await import('../../graphql/resolvers/event_log/query.js')).default;

    const result = await resolver.eventLogs(null, { filter: { restaurantId: 'valid-r1' } }, ctx);

    expect(requireRestaurantAccess).toHaveBeenCalledWith(ctx, 'valid-r1');
    expect(EventLog.find).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: 'valid-r1' }));
    expect(result).toEqual({ total: 0, items: [] });
  });

  it('eventLogs without restaurantId requires ADMIN', async () => {
    const ctx = { user: { id: 'a1', roleName: 'admin' } };
    const resolver = (await import('../../graphql/resolvers/event_log/query.js')).default;

    await resolver.eventLogs(null, { filter: {} }, ctx);

    expect(requireRoles).toHaveBeenCalledWith(ctx, ['ADMIN']);
    expect(EventLog.find).toHaveBeenCalled();
  });

  it('eventLogs without restaurantId denied does not query DB', async () => {
    requireRoles.mockRejectedValueOnce(new Error('FORBIDDEN'));
    const resolver = (await import('../../graphql/resolvers/event_log/query.js')).default;

    await expect(resolver.eventLogs(null, { filter: {} }, { user: { id: 's1' } })).rejects.toThrow('FORBIDDEN');
    expect(EventLog.find).not.toHaveBeenCalled();
    expect(EventLog.countDocuments).not.toHaveBeenCalled();
  });

  it('invalid restaurantId throws BAD_USER_INPUT before guards/DB', async () => {
    const resolver = (await import('../../graphql/resolvers/event_log/query.js')).default;

    await expect(resolver.eventLogs(null, { filter: { restaurantId: 'bad-id' } }, { user: { id: 'm1' } }))
      .rejects.toThrow('Invalid restaurantId');
    expect(requireRestaurantAccess).not.toHaveBeenCalled();
    expect(EventLog.find).not.toHaveBeenCalled();
  });

  it('preserves existing filters after authorization', async () => {
    const resolver = (await import('../../graphql/resolvers/event_log/query.js')).default;
    const filter = {
      restaurantId: 'valid-r1',
      floorId: 'floor-1',
      tableId: 'table-1',
      orderId: 'order-1',
      actorUserId: 'user-1',
      verb: 'table.update',
      status: 'success',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-02T00:00:00.000Z',
      text: 'abc',
    };

    await resolver.eventLogs(null, { filter }, { user: { id: 'm1' } });

    const q = EventLog.find.mock.calls[0][0];
    expect(q.restaurantId).toBe('valid-r1');
    expect(q.floorId).toBe('floor-1');
    expect(q.tableId).toBe('table-1');
    expect(q.orderId).toBe('order-1');
    expect(q.actorUserId).toBe('user-1');
    expect(q.verb).toBe('table.update');
    expect(q.status).toBe('success');
    expect(q.at.$gte).toEqual(new Date('2026-05-01T00:00:00.000Z'));
    expect(q.at.$lte).toEqual(new Date('2026-05-02T00:00:00.000Z'));
    expect(q.$text).toEqual({ $search: 'abc' });
  });
});
