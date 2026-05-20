import { beforeEach, describe, expect, it, vi } from "vitest";

const makeQuery = (doc) => ({
  sort: vi.fn().mockReturnThis(),
  session: vi.fn().mockReturnThis(),
  then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
});

const modelMocks = vi.hoisted(() => ({
  Customer: { findOne: vi.fn(), create: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

describe("customerIdentity shared service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes email and phone", async () => {
    const svc = await import("../../graphql/resolvers/shared/customerIdentity.js");
    expect(svc.normalizeCustomerEmail("  A@B.COM  ")).toBe("a@b.com");
    expect(svc.normalizeCustomerPhone("+84901234567")).toBe("0901234567");
    expect(svc.normalizeCustomerPhone("84901234567")).toBe("0901234567");
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
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery({ _id: "u1", isGuest: false }))
      .mockReturnValueOnce(makeQuery({ _id: "g2", isGuest: true }));
    const { resolveCustomerIdentityByContact } = await import("../../graphql/resolvers/shared/customerIdentity.js");
    const out = await resolveCustomerIdentityByContact({ email: "u@x.com", phone: "0902" });
    expect(out.conflict).toEqual({ emailUserId: "u1", phoneUserId: "g2" });
  });

  it("creates guest when no match and createIfMissing=true", async () => {
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery(null))
      .mockReturnValueOnce(makeQuery(null));
    modelMocks.Customer.create.mockResolvedValueOnce([{ _id: "g3", fullName: "Khách", isGuest: true }]);
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
