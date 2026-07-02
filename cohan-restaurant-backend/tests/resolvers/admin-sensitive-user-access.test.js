import { describe, it, expect, vi, beforeEach } from "vitest";

const auditCreate = vi.fn();
const userFind = vi.fn();
const roleFindOne = vi.fn();

function userFindChain(rows) {
  return { populate: () => ({ sort: () => ({ lean: async () => rows }) }) };
}

vi.mock("../../models/index.js", () => ({
  AuditLog: { create: auditCreate },
  User: { find: userFind },
  Role: { findOne: roleFindOne },
  Customer: {},
  Order: {},
  WalletTransaction: {},
}));

describe("admin sensitive user access", () => {
  beforeEach(() => {
    vi.resetModules();
    auditCreate.mockReset().mockResolvedValue({ _id: "audit-1" });
    roleFindOne.mockReset();
    userFind.mockReset().mockReturnValue(userFindChain([{ _id: "u1", email: "leminh@gmail.com", phone: "0987654389", wallet: { balance: 50, currency: "VND" } }]));
  });

  it("masks user contact and wallet for system admin without reason", async () => {
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    const result = await UserQuery.users(null, {}, { user: { id: "admin-1", roleName: "admin", status: "active", emailVerified: true, phoneVerified: true }, headers: {} });
    expect(result[0].email).toBe("le***@gmail.com");
    expect(result[0].phone).toBe("09******89");
    expect(result[0].wallet.balance).toBeNull();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("returns full user contact for strongly verified system admin with reason and audits", async () => {
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    const result = await UserQuery.users(null, {}, {
      user: { id: "507f1f77bcf86cd799439011", roleName: "admin", status: "active", emailVerified: true, phoneVerified: true },
      headers: { "x-admin-access-reason": "ticket-1" },
    });
    expect(result[0].email).toBe("leminh@gmail.com");
    expect(result[0].phone).toBe("0987654389");
    expect(result[0].wallet.balance).toBe(50);
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.sensitive.staff_internal.read" }));
  });
});
