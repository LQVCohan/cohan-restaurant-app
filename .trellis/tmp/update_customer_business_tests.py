from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise RuntimeError(f'anchor not found in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')

path = 'cohan-restaurant-backend/tests/resolvers/user-admin-management-access.test.js'
replace_once(path,
'''const requireRoleMock = vi.hoisted(() => vi.fn());
const requireRestaurantPermissionMock''',
'''const requireRoleMock = vi.hoisted(() => vi.fn());
const requireRestaurantAccessMock = vi.hoisted(() => vi.fn(async () => true));
const requireRestaurantPermissionMock''')
replace_once(path,
'''  return ctor;
});''',
'''  ctor.findOne = vi.fn(async () => null);
  return ctor;
});''')
replace_once(path,
'''vi.mock("../../utils/authz.js", () => ({ requireRole: requireRoleMock }));''',
'''vi.mock("../../utils/authz.js", () => ({ requireRole: requireRoleMock }));
vi.mock("../../graphql/guards.js", () => ({
  requireRestaurantAccess: requireRestaurantAccessMock,
}));''')
replace_once(path,
'''    requireRoleMock.mockImplementation(() => {});
  });''',
'''    requireRoleMock.mockImplementation(() => {});
    requireRestaurantAccessMock.mockResolvedValue(true);
    CustomerMock.findOne.mockResolvedValue(null);
  });''')
replace_once(path,
'''  it("createGuestUser rejects manager before Customer save", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new GraphQLError("FORBIDDEN");
    });
    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");

    await expect(
      UserMutation.createGuestUser(null, { fullName: "G", phone: "090" }, ctxFor("manager")),
    ).rejects.toThrow("FORBIDDEN");

    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), ["admin"]);
    expect(CustomerMock).not.toHaveBeenCalled();
  });''',
'''  it("createGuestUser allows a scoped manager", async () => {
    modelMocks.User.findById.mockReturnValueOnce({
      populate: () => ({ lean: async () => ({ _id: "valid-guest-1", isGuest: true }) }),
    });
    const ctx = ctxFor("manager");
    const { UserMutation } = await import("../../graphql/resolvers/user/mutation.js");

    const result = await UserMutation.createGuestUser(
      null,
      {
        fullName: "G",
        phone: "090",
        restaurantId: "valid-restaurant",
      },
      ctx,
    );

    expect(requireRoleMock).toHaveBeenCalledWith(ctx.user, ["admin", "manager"]);
    expect(requireRestaurantAccessMock).toHaveBeenCalledWith(
      ctx,
      "valid-restaurant",
    );
    expect(CustomerMock).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ isGuest: true }));
  });''')
replace_once(path,
'''      { fullName: "Guest", phone: "090" },''',
'''      {
        fullName: "Guest",
        phone: "090",
        restaurantId: "valid-restaurant",
      },''')
replace_once(path,
'''    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), ["admin"]);
    expect(CustomerMock).toHaveBeenCalled();''',
'''    expect(requireRoleMock).toHaveBeenCalledWith(expect.anything(), [
      "admin",
      "manager",
    ]);
    expect(requireRestaurantAccessMock).toHaveBeenCalled();
    expect(CustomerMock).toHaveBeenCalled();''')

path = 'cohan-restaurant-backend/tests/resolvers/user-customer-restaurant-access.test.js'
replace_once(path,
'''    expect(modelMocks.Order.find).toHaveBeenCalledWith({
      userId: expect.objectContaining({ _mockObjectId: "valid-u1" }),
      restaurantId: expect.objectContaining({ _mockObjectId: "valid-r1" }),
    });''',
'''    expect(modelMocks.Order.find).toHaveBeenCalledWith({
      userId: expect.objectContaining({ _mockObjectId: "valid-u1" }),
      restaurantId: expect.objectContaining({ _mockObjectId: "valid-r1" }),
      currentStatus: { $nin: ["cancelled", "failed", "draft"] },
    });''')
replace_once(path,
'''    expect(modelMocks.Order.find).toHaveBeenCalledWith({
      userId: expect.objectContaining({ _mockObjectId: "valid-u1" }),
    });''',
'''    expect(modelMocks.Order.find).toHaveBeenCalledWith({
      userId: expect.objectContaining({ _mockObjectId: "valid-u1" }),
      currentStatus: { $nin: ["cancelled", "failed", "draft"] },
    });''')
replace_once(path,
'''      userId: {
        $in: [
          expect.objectContaining({ _mockObjectId: "valid-u1" }),
          expect.objectContaining({ _mockObjectId: "valid-u2" }),
        ],
      },
    });''',
'''      userId: {
        $in: [
          expect.objectContaining({ _mockObjectId: "valid-u1" }),
          expect.objectContaining({ _mockObjectId: "valid-u2" }),
        ],
      },
      currentStatus: { $nin: ["cancelled", "failed", "draft"] },
    });''')
replace_once(path,
'''      { restaurantId: "valid-r1", ranks: [{ name: "VIP", minPoints: 10, benefits: "prio" }] },''',
'''      {
        restaurantId: "valid-r1",
        ranks: [
          { name: "Mới", minPoints: 0, benefits: "" },
          { name: "VIP", minPoints: 10, benefits: "prio" },
        ],
      },''')

print('Updated customer business regression tests.')
