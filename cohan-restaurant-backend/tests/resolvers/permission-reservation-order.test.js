const modelMocks = vi.hoisted(() => ({
  Permission: { find: vi.fn() },
  Reservation: { find: vi.fn(), findById: vi.fn(), findOne: vi.fn() },
  Order: { updateMany: vi.fn(), findOne: vi.fn() },
  User: {},
  Role: {},
  Customer: {},
  TableCustomer: { findOneAndUpdate: vi.fn() },
  Warehouse: {},
  Recipe: {},
  Ingredient: {},
  ModifierGroup: {},
}));

vi.mock('../../models/index.js', () => modelMocks);
vi.mock('../../graphql/resolvers/order/helper/userUtils.js', () => ({
  ensureUserForOrder: vi.fn(async () => '67a1f8f6a2df3b17f0c99999'),
  resolveTable: vi.fn(),
}));

describe('Permission + Reservation + Order resolver integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('filters permission query by group', async () => {
    const fake = [{ code: 'order.read' }];
    modelMocks.Permission.find.mockReturnValue({ sort: async () => fake });
    const { PermissionQuery } = await import('../../graphql/resolvers/permission/query.js');

    const result = await PermissionQuery.permissions(null, { group: 'ORDER' });

    expect(result).toEqual(fake);
    expect(modelMocks.Permission.find).toHaveBeenCalledWith({ group: 'order' });
  });

  it('rejects myReservations when missing auth user', async () => {
    const { ReservationQuery } = await import('../../graphql/resolvers/reservation/query.js');
    await expect(ReservationQuery.myReservations(null, {}, {})).rejects.toThrow('Unauthorized');
  });

  it('updates order customer by code with minimal order flow', async () => {
    modelMocks.Order.updateMany.mockResolvedValue({ modifiedCount: 1 });
    modelMocks.Order.findOne.mockReturnValue({
      select: () => ({ lean: async () => ({ tableId: '67a1f8f6a2df3b17f0111111', tableCode: 'T1' }) }),
    });

    const { OrderMutation } = await import('../../graphql/resolvers/order/mutation.js');
    const result = await OrderMutation.updateOrderCustomerByCode(
      null,
      {
        input: {
          restaurantId: '67a1f8f6a2df3b17f0222222',
          orderCode: 'ORD-1',
          userId: '67a1f8f6a2df3b17f0333333',
          customer: { fullName: 'Test User', phone: '0901' },
        },
      },
      {}
    );

    expect(result).toEqual({ success: true, modifiedCount: 1 });
    expect(modelMocks.Order.updateMany).toHaveBeenCalled();
  });
});
