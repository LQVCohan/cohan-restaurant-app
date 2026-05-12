import { describe, it, expect, vi, beforeEach } from "vitest";

const makeQuery = (doc) => ({
  sort: vi.fn().mockReturnThis(),
  session: vi.fn().mockReturnThis(),
  then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
});

const modelMocks = vi.hoisted(() => ({
  Customer: { findOne: vi.fn(), create: vi.fn() },
  Table: {},
}));

vi.mock("../../models/index.js", () => modelMocks);

describe("order userUtils identity helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    modelMocks.Customer.findOne
      .mockReturnValueOnce(makeQuery({ _id: "u1", isGuest: true }))
      .mockReturnValueOnce(makeQuery({ _id: "u1", isGuest: true }));

    const { resolveCustomerIdentity } = await import(
      "../../graphql/resolvers/order/helper/userUtils.js"
    );
    const out = await resolveCustomerIdentity({
      email: "a@b.com",
      phone: "0901",
    });

    expect(out.userId).toBe("u1");
    expect(out.conflict).toBeUndefined();
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
      "Contact information matches multiple customer profiles. Please contact support.",
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
});
