import { describe, it, expect, vi, beforeEach } from "vitest";

const auditCreate = vi.fn();
const userFind = vi.fn();
const userFindById = vi.fn();
const customerFind = vi.fn();
const roleFindOne = vi.fn();

function userFindChain(rows) {
  return { populate: () => ({ sort: () => ({ lean: async () => rows }) }) };
}

function customerExportChain(rows) {
  return { select: () => ({ populate: () => ({ populate: () => ({ sort: () => ({ limit: () => ({ lean: async () => rows }) }) }) }) }) };
}

function userFindByIdChain(row) {
  return { populate: () => ({ populate: () => ({ lean: async () => row }) }) };
}

vi.mock("../../models/index.js", () => ({
  AuditLog: { create: auditCreate },
  User: { find: userFind, findById: userFindById },
  Role: { findOne: roleFindOne },
  Customer: { find: customerFind },
  Order: {},
  WalletTransaction: {},
}));

describe("admin sensitive user access", () => {
  beforeEach(() => {
    vi.resetModules();
    auditCreate.mockReset().mockResolvedValue({ _id: "audit-1" });
    roleFindOne.mockReset().mockReturnValue({ lean: async () => ({ _id: "role-customer" }) });
    userFind.mockReset().mockReturnValue(userFindChain([{ _id: "u1", email: "leminh@gmail.com", phone: "0987654389", wallet: { balance: 50, currency: "VND" } }]));
    userFindById.mockReset().mockReturnValue(userFindByIdChain({ _id: "507f1f77bcf86cd799439012", userType: "STAFF", fullName: "Staff", baseSalary: 100 }));
    customerFind.mockReset().mockReturnValue(customerExportChain([{ _id: "c1", email: "leminh@gmail.com", phone: "0987654389", loyaltyPoints: 1 }]));
  });

  it("masks user contact and wallet for system admin without reason", async () => {
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    const result = await UserQuery.users(null, {}, { user: { id: "admin-1", roleName: "admin", status: "active", emailVerified: true, phoneVerified: true }, headers: {} });
    expect(result[0].email).toBe("le***@gmail.com");
    expect(result[0].phone).toBe("09******89");
    expect(result[0].wallet.balance).toBeNull();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("returns full user contact for strongly verified system admin with reason and explicit permission", async () => {
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    const result = await UserQuery.users(null, {}, {
      user: { id: "507f1f77bcf86cd799439011", roleName: "admin", status: "active", emailVerified: true, phoneVerified: true, role: { permissions: [{ code: "admin.sensitive.staff_internal.read" }] } },
      headers: { "x-admin-access-reason": "ticket-1" },
    });
    expect(result[0].email).toBe("leminh@gmail.com");
    expect(result[0].phone).toBe("0987654389");
    expect(result[0].wallet.balance).toBe(50);
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.sensitive.staff_internal.read" }));
  });

  it("masks customerExportRows for system admin without reason", async () => {
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    const result = await UserQuery.customerExportRows(null, { restaurantId: "507f1f77bcf86cd799439013" }, {
      user: { id: "admin-1", roleName: "admin", status: "active", emailVerified: true, phoneVerified: true },
      headers: {},
    });
    expect(result[0].email).toBe("le***@gmail.com");
    expect(result[0].phone).toBe("09******89");
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("returns full customerExportRows and audits with reason and explicit permission", async () => {
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    const result = await UserQuery.customerExportRows(null, { restaurantId: "507f1f77bcf86cd799439013" }, {
      user: { id: "507f1f77bcf86cd799439011", roleName: "admin", status: "active", emailVerified: true, phoneVerified: true, role: { permissions: [{ code: "admin.sensitive.customer_contact.read" }] } },
      headers: { "x-admin-access-reason": "export-ticket" },
    });
    expect(result[0].email).toBe("leminh@gmail.com");
    expect(result[0].phone).toBe("0987654389");
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.sensitive.customer_contact.read", targetType: "CustomerExport" }));
  });

  it("rejects system admin staffPrivateProfile without reason", async () => {
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    await expect(UserQuery.staffPrivateProfile(null, { userId: "507f1f77bcf86cd799439012" }, {
      user: { id: "admin-1", roleName: "admin", status: "active", emailVerified: true, phoneVerified: true },
      headers: {},
    })).rejects.toThrow("reason is required");
  });

  it("allows system admin staffPrivateProfile with reason and explicit permission", async () => {
    const { UserQuery } = await import("../../graphql/resolvers/user/query.js");
    const result = await UserQuery.staffPrivateProfile(null, { userId: "507f1f77bcf86cd799439012" }, {
      user: { id: "507f1f77bcf86cd799439011", roleName: "admin", status: "active", emailVerified: true, phoneVerified: true, role: { permissions: [{ code: "admin.sensitive.staff_internal.read" }] } },
      headers: { "x-admin-access-reason": "staff-ticket" },
    });
    expect(result.baseSalary).toBe(100);
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.sensitive.staff_internal.read", targetType: "StaffPrivateProfile" }));
  });
});
