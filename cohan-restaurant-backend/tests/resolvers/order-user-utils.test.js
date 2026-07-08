import { describe, it, expect, vi, beforeEach } from "vitest";

const makeQuery = (doc) => ({
  sort: vi.fn().mockReturnThis(),
  session: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(doc),
  then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
});

const makeGuestDoc = (overrides = {}) => {
  const doc = { _id: "guest-1", isGuest: true, ...overrides };
  doc.save = vi.fn().mockResolvedValue(doc);
  return doc;
};

const modelMocks = vi.hoisted(() => ({
  Customer: { findOne: vi.fn(), create: vi.fn() },
  Table: {},
}));

vi.mock("../../models/index.js", () => modelMocks);

describe("order userUtils identity helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.Customer.findOne.mockReset();
    modelMocks.Customer.create.mockReset();
  });

  it("normalizes and compacts customer input without empty email/phone", async () => {
    const { compactCustomerInput } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );
    const out = compactCustomerInput({
      fullName: "  A  ",
      email: "   ",
      phone: "  ",
    });
    expect(out).toEqual({
      fullName: "A",
      email: undefined,
      phone: undefined,
    });
  });

  it("normalizes phone +84/84 to 0", async () => {
    const { normalizePhone } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );
    expect(normalizePhone("+84901234567")).toBe("0901234567");
    expect(normalizePhone("84901234567")).toBe("0901234567");
  });

  it("resolves same user for email + phone", async () => {
    const guest = { _id: "u1", isGuest: true, save: vi.fn() };
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery(guest))
      .mockReturnValueOnce(makeQuery(guest));

    const { resolveCustomerIdentity } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );
    const out = await resolveCustomerIdentity({
      email: "a@b.com",
      phone: "0901",
    });

    expect(out.userId).toBe("u1");
    expect(out.conflict).toBeUndefined();
    expect(guest.save).not.toHaveBeenCalled();
  });

  it("returns conflict when email and phone map to different users", async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery({ _id: "u1", isGuest: true }))
      .mockReturnValueOnce(makeQuery({ _id: "u2", isGuest: true }));

    const { resolveCustomerIdentity } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );
    const out = await resolveCustomerIdentity({
      email: "a@b.com",
      phone: "0902",
    });

    expect(out.conflict).toBe(true);
  });

  it("returns conflict when email matches registered and phone matches guest", async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery({ _id: "user-1", isGuest: false }))
      .mockReturnValueOnce(makeQuery({ _id: "guest-1", isGuest: true }));

    const { resolveCustomerIdentity } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );
    const out = await resolveCustomerIdentity({
      email: "registered@example.com",
      phone: "0903",
    });

    expect(out.conflict).toBe(true);
  });

  it("throws when email matches registered and phone matches guest", async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery({ _id: "user-1", isGuest: false }))
      .mockReturnValueOnce(makeQuery({ _id: "guest-1", isGuest: true }));

    const { resolveOrCreateGuestCustomerForOrder } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );

    await expect(
      resolveOrCreateGuestCustomerForOrder({
        customer: {
          email: "registered@example.com",
          phone: "0903",
        },
      })
    ).rejects.toThrow(
      "Thông tin liên hệ khớp với nhiều hồ sơ khách hàng. Vui lòng liên hệ bộ phận hỗ trợ.",
    );
  });

  it("uses registered customer when only one registered profile matches", async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery({ _id: "user-1", isGuest: false }))
      .mockReturnValueOnce(makeQuery(null));

    const { resolveOrCreateGuestCustomerForOrder } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );
    const out = await resolveOrCreateGuestCustomerForOrder({
      customer: { email: "registered@example.com" },
    });

    expect(out).toEqual({
      userId: "user-1",
      mode: "matched_registered",
      isGuestCustomer: false,
    });
  });

  it("creates a guest customer when contact does not match anyone", async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery(null))
      .mockReturnValueOnce(makeQuery(null));
    modelMocks.Customer.create.mockResolvedValueOnce([{ _id: "guest-1" }]);

    const { resolveOrCreateGuestCustomerForOrder } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );
    const out = await resolveOrCreateGuestCustomerForOrder({
      customer: { fullName: "Guest", email: "guest@example.com" },
    });

    expect(out).toEqual({
      userId: "guest-1",
      mode: "created_guest",
      isGuestCustomer: true,
    });
    expect(modelMocks.Customer.create).toHaveBeenCalledTimes(1);
  });

  it("updates matched guest when resolving/creating order customer", async () => {
    const guest = makeGuestDoc({ email: "guest@example.com" });
    modelMocks.Customer.findOne.mockImplementation((query) => {
      if (query?.email) return makeQuery(guest);
      if (query?.phone) return makeQuery(null);
      return makeQuery(null);
    });

    const { resolveOrCreateGuestCustomerForOrder } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );

    const out = await resolveOrCreateGuestCustomerForOrder({
      customer: { fullName: "Guest Updated", email: "guest@example.com" },
      restaurantId: "507f1f77bcf86cd799439011",
    });
    expect(out.mode).toBe("matched_guest");
    expect(guest.save).toHaveBeenCalledTimes(1);
  });

  it("creates guest with refRestaurants when restaurantId is provided", async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery(null))
      .mockReturnValueOnce(makeQuery(null));
    modelMocks.Customer.create.mockResolvedValueOnce([{ _id: "guest-2" }]);

    const { resolveOrCreateGuestCustomerForOrder } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );

    await resolveOrCreateGuestCustomerForOrder({
      customer: { email: "new-guest@example.com" },
      restaurantId: "507f1f77bcf86cd799439012",
    });

    expect(modelMocks.Customer.create).toHaveBeenCalledWith(
      [expect.objectContaining({ refRestaurants: ["507f1f77bcf86cd799439012"] })],
      undefined,
    );
  });

  it("ensureUserForOrder forwards restaurantId for guest creation", async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery(null))
      .mockReturnValueOnce(makeQuery(null));
    modelMocks.Customer.create.mockResolvedValueOnce([{ _id: "guest-3" }]);
    const { ensureUserForOrder } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );

    await ensureUserForOrder(null, { email: "ensure@example.com" }, { restaurantId: "507f1f77bcf86cd799439013" });
    expect(modelMocks.Customer.create).toHaveBeenCalledWith(
      [expect.objectContaining({ refRestaurants: ["507f1f77bcf86cd799439013"] })],
      undefined,
    );
  });

  it("ensureUserForOrder updates authenticated customer recent and membership in session", async () => {
    const restaurantId = "507f1f77bcf86cd799439011";
    const session = { id: "session-1" };
    const customerDoc = {
      _id: "507f1f77bcf86cd799439021",
      isGuest: false,
      refRestaurants: [],
      customerRestaurants: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    const query = makeQuery(customerDoc);
    modelMocks.Customer.findOne.mockReturnValueOnce(query);
    const { ensureUserForOrder } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );

    const out = await ensureUserForOrder("507f1f77bcf86cd799439021", null, { session, restaurantId });

    expect(out).toBe("507f1f77bcf86cd799439021");
    expect(query.session).toHaveBeenCalledWith(session);
    expect(customerDoc.refRestaurants.map(String)).toEqual([restaurantId]);
    expect(customerDoc.customerRestaurants.map(String)).toEqual([restaurantId]);
    expect(customerDoc.save).toHaveBeenCalledWith({ session });
  });

  it("ensureUserForOrder rejects invalid selected user id without querying", async () => {
    const { ensureUserForOrder } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );

    await expect(ensureUserForOrder("staff-1", null, { restaurantId: "507f1f77bcf86cd799439013" }))
      .rejects.toThrow("Không tìm thấy tài khoản khách hàng.");
    expect(modelMocks.Customer.findOne).not.toHaveBeenCalled();
  });

  it("ensureUserForOrder returns null for invalid selected user in snapshot-only flow without querying", async () => {
    const { ensureUserForOrder } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );

    await expect(ensureUserForOrder("missing-user", null, { snapshotOnly: true }))
      .resolves.toBeNull();
    expect(modelMocks.Customer.findOne).not.toHaveBeenCalled();
  });

  it("ensureUserForOrder rejects valid non-customer or missing selected user", async () => {
    modelMocks.Customer.findOne.mockReturnValueOnce(makeQuery(null));
    const { ensureUserForOrder } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );

    await expect(ensureUserForOrder("507f1f77bcf86cd799439022", null, { restaurantId: "507f1f77bcf86cd799439013" }))
      .rejects.toThrow("Không tìm thấy tài khoản khách hàng.");
    expect(modelMocks.Customer.findOne).toHaveBeenCalledWith({
      _id: "507f1f77bcf86cd799439022",
      userType: "CUSTOMER",
      deletedAt: null,
    });
  });

  it("ensureUserForOrder rejects deleted Customer", async () => {
    modelMocks.Customer.findOne.mockReturnValueOnce(makeQuery(null));
    const { ensureUserForOrder } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );

    await expect(ensureUserForOrder("507f1f77bcf86cd799439023", null, {}))
      .rejects.toThrow("Không tìm thấy tài khoản khách hàng.");
    expect(modelMocks.Customer.findOne).toHaveBeenCalledWith({
      _id: "507f1f77bcf86cd799439023",
      userType: "CUSTOMER",
      deletedAt: null,
    });
  });


});
