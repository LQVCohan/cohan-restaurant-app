import { beforeEach, describe, expect, it, vi } from "vitest";

const makeQuery = (doc) => ({
  sort: vi.fn().mockReturnThis(),
  session: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(doc),
  then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
});

const makeGuestDoc = (overrides = {}) => {
  const doc = { _id: "g1", isGuest: true, ...overrides };
  doc.save = vi.fn().mockResolvedValue(doc);
  return doc;
};

const modelMocks = vi.hoisted(() => ({
  Customer: { findOne: vi.fn(), create: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

describe("customerIdentity shared service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.Customer.findOne.mockReset();
    modelMocks.Customer.create.mockReset();
  });

  it("normalizes email and phone", async () => {
    const svc = await import("../../graphql/resolvers/shared/customerIdentity.js");
    expect(svc.normalizeCustomerEmail("  A@B.COM  ")).toBe("a@b.com");
    expect(svc.normalizeCustomerPhone("+84901234567")).toBe("0901234567");
    expect(svc.normalizeCustomerPhone("84901234567")).toBe("0901234567");
  });

  it("normalizes recent restaurants newest first, unique, max 12", async () => {
    const { normalizeRecentRestaurantIds } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    const ids = Array.from({ length: 13 }, (_, index) => `507f1f77bcf86cd7994390${String(index).padStart(2, "0")}`);
    const next = normalizeRecentRestaurantIds(ids, ids[5]);
    expect(next[0]).toBe(ids[5]);
    expect(new Set(next).size).toBe(12);
    expect(next).toHaveLength(12);
  });

  it("dedupes all existing recent ids, drops invalid ids, and does not mutate input", async () => {
    const { normalizeRecentRestaurantIds } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    const a = "507f1f77bcf86cd799439011";
    const b = "507f1f77bcf86cd799439012";
    const c = "507f1f77bcf86cd799439013";
    const input = [a, a, "bad-id", b];
    const next = normalizeRecentRestaurantIds(input, c);
    expect(next).toEqual([c, a, b]);
    expect(input).toEqual([a, a, "bad-id", b]);
  });

  it("moves revisited restaurant to the front", async () => {
    const { normalizeRecentRestaurantIds } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    const a = "507f1f77bcf86cd799439011";
    const b = "507f1f77bcf86cd799439012";
    const c = "507f1f77bcf86cd799439013";
    expect(normalizeRecentRestaurantIds([a, b, c], b)).toEqual([b, a, c]);
  });

  it("applies recent and membership independently without saving", async () => {
    const { applyCustomerRestaurantTouch } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    const r1 = "507f1f77bcf86cd799439011";
    const customer = { refRestaurants: [], customerRestaurants: [], save: vi.fn() };
    expect(applyCustomerRestaurantTouch(customer, r1, { touchRecentOnMatch: true, addCustomerRestaurant: false })).toBe(true);
    expect(customer.refRestaurants.map(String)).toEqual([r1]);
    expect(customer.customerRestaurants).toEqual([]);
    expect(customer.save).not.toHaveBeenCalled();
  });

  it("matches guest and updates ttl/lastSeen", async () => {
    const guest = { _id: "g1", isGuest: true, save: vi.fn().mockResolvedValue(undefined) };
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery(guest))
      .mockReturnValueOnce(makeQuery(guest));

    const { resolveCustomerIdentityByContact } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    const out = await resolveCustomerIdentityByContact({ email: "g@x.com", phone: "0901", customerName: "G" });
    expect(out.mode).toBe("matched_guest");
    expect(guest.save).toHaveBeenCalledTimes(1);
  });

  it("registered customer supports membership-only and saves once", async () => {
    const r1 = "507f1f77bcf86cd799439011";
    const registered = { _id: "u1", isGuest: false, refRestaurants: [r1], customerRestaurants: [], save: vi.fn().mockResolvedValue(undefined) };
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery(registered))
      .mockReturnValueOnce(makeQuery(null));

    const { resolveCustomerIdentityByContact } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    await resolveCustomerIdentityByContact({
      email: "u@x.com",
      restaurantId: r1,
      touchRecentOnMatch: false,
      addCustomerRestaurant: true,
    });
    expect(registered.refRestaurants.map(String)).toEqual([r1]);
    expect(registered.customerRestaurants.map(String)).toEqual([r1]);
    expect(registered.save).toHaveBeenCalledTimes(1);
  });

  it("selected user uses session and saves membership when recent is unchanged", async () => {
    const r1 = "507f1f77bcf86cd799439011";
    const session = { id: "s1" };
    const selected = { _id: "u1", isGuest: false, refRestaurants: [r1], customerRestaurants: [], save: vi.fn().mockResolvedValue(undefined) };
    const query = makeQuery(selected);
    modelMocks.Customer.findOne.mockReturnValueOnce(query);
    const { resolveCustomerIdentityByContact } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    const out = await resolveCustomerIdentityByContact({ selectedUserId: "u1", restaurantId: r1, session });
    expect(out.mode).toBe("selected");
    expect(query.session).toHaveBeenCalledWith(session);
    expect(selected.save).toHaveBeenCalledWith({ session });
    expect(selected.customerRestaurants.map(String)).toEqual([r1]);
  });

  it("does not mutate or save guest when touchGuestOnMatch=false", async () => {
    const guest = { _id: "g2", isGuest: true, email: "g@x.com", phone: "0901", save: vi.fn() };
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery(guest))
      .mockReturnValueOnce(makeQuery(null));
    const { resolveCustomerIdentityByContact } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    const out = await resolveCustomerIdentityByContact({
      email: "g@x.com",
      customerName: "Changed Name",
      restaurantId: "rest-1",
      touchGuestOnMatch: false,
    });
    expect(out.mode).toBe("matched_guest");
    expect(guest.save).not.toHaveBeenCalled();
    expect(guest.fullName).toBeUndefined();
    expect(guest.refRestaurants).toBeUndefined();
  });

  it("returns conflict for registered email and different guest phone", async () => {
    modelMocks.Customer.findOne.mockImplementation((query) => {
      if (query?.email) return makeQuery({ _id: "u1", isGuest: false });
      if (query?.phone) return makeQuery(makeGuestDoc({ _id: "g2" }));
      return makeQuery(null);
    });
    const { resolveCustomerIdentityByContact } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    const out = await resolveCustomerIdentityByContact({ email: "u@x.com", phone: "0902123456" });
    expect(out.conflict).toEqual({ emailUserId: "u1", phoneUserId: "g2" });
  });

  it("creates guest when no match and createIfMissing=true", async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery(null))
      .mockReturnValueOnce(makeQuery(null));
    modelMocks.Customer.create.mockImplementationOnce(() => Promise.resolve([{ _id: "g3", fullName: "Khách", isGuest: true }]));
    const { resolveCustomerIdentityByContact } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    const out = await resolveCustomerIdentityByContact({ email: "a@b.com", createIfMissing: true });
    expect(out.mode).toBe("created_guest");
  });

  it("creates guest with refRestaurants when restaurantId is provided", async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery(null))
      .mockReturnValueOnce(makeQuery(null));
    modelMocks.Customer.create.mockResolvedValueOnce([{ _id: "g4", isGuest: true }]);
    const { resolveCustomerIdentityByContact } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    await resolveCustomerIdentityByContact({ email: "a2@b.com", createIfMissing: true, restaurantId: "rest-abc" });
    expect(modelMocks.Customer.create).toHaveBeenCalledWith(
      [expect.objectContaining({ refRestaurants: ["rest-abc"] })],
      undefined,
    );
  });

  it("returns none when no match and createIfMissing=false", async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery(null))
      .mockReturnValueOnce(makeQuery(null));
    const { resolveCustomerIdentityByContact } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    const out = await resolveCustomerIdentityByContact({ phone: "0901", createIfMissing: false });
    expect(out).toMatchObject({ mode: "none", userId: null });
  });
});
