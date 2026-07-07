import { beforeEach, describe, it, expect, vi } from "vitest";
import { sanitizeUserForClient } from "../../src/security/sanitizeUserForClient.js";

const restaurantScopeMocks = vi.hoisted(() => ({
  canAccessRestaurant: vi.fn(),
}));

vi.mock("../../models/index.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Restaurant: {
      ...(actual.Restaurant || {}),
      exists: vi.fn().mockResolvedValue(true),
    },
  };
});
vi.mock("../../src/services/auth/restaurantScope.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  canAccessRestaurant: restaurantScopeMocks.canAccessRestaurant,
}));

describe("sanitizeUserForClient", () => {
  it("preserves emailVerified true/false and safe profile fields", () => {
    const verified = sanitizeUserForClient({
      _id: "u1",
      fullName: "Verified User",
      emailVerified: true,
      employmentType: "full-time",
      department: "ops",
      positionTitle: "manager",
    });

    const unverified = sanitizeUserForClient({
      _id: "u2",
      fullName: "Unverified User",
      emailVerified: false,
    });

    expect(verified.emailVerified).toBe(true);
    expect(unverified.emailVerified).toBe(false);
    expect(unverified).toHaveProperty("emailVerified", false);
    expect(verified.employmentType).toBe("full-time");
    expect(verified.department).toBe("ops");
    expect(verified.positionTitle).toBe("manager");
  });

  it("preserves wallet fields needed by frontend", () => {
    const out = sanitizeUserForClient({
      _id: "u3",
      wallet: {
        provider: "internal",
        status: false,
        balance: 10,
        currency: "USD",
        updatedAt: "2026-05-27T00:00:00.000Z",
        secret: "hidden",
      },
    });

    expect(out.wallet).toEqual({
      provider: "internal",
      status: false,
      balance: 10,
      currency: "USD",
      updatedAt: "2026-05-27T00:00:00.000Z",
    });
    expect(out.wallet.secret).toBeUndefined();
  });

  it("removes sensitive auth/deletion fields", () => {
    const out = sanitizeUserForClient({
      _id: "u4",
      fullName: "Jane",
      passwordHash: "hash",
      emailVerifyToken: "tok",
      emailVerifyTokenExp: new Date(),
      emailVerifyLastSentAt: new Date(),
      deletedAt: new Date(),
      deleteExpiresAt: new Date(),
      deletedBy: "admin",
      _generatedPassword: "tmp",
      role: { _id: "r1", name: "Admin", slug: "admin", permissions: ["a"], internal: "x" },
    });

    expect(out.passwordHash).toBeUndefined();
    expect(out.emailVerifyToken).toBeUndefined();
    expect(out.emailVerifyTokenExp).toBeUndefined();
    expect(out.emailVerifyLastSentAt).toBeUndefined();
    expect(out.deletedAt).toBeUndefined();
    expect(out.deleteExpiresAt).toBeUndefined();
    expect(out.deletedBy).toBeUndefined();
    expect(out._generatedPassword).toBeUndefined();
    expect(out.role.internal).toBeUndefined();
  });
});

import {
  sanitizeAdminUserListItem,
  sanitizeAuthUser,
  sanitizeCustomerListUser,
  sanitizeStaffPrivateProfile,
  staffBelongsToRestaurant,
} from "../../src/security/userDtos.js";

describe("user DTO sanitizers", () => {
  beforeEach(() => {
    restaurantScopeMocks.canAccessRestaurant.mockReset();
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValue(true);
  });

  const sensitiveUser = {
    _id: "u-sensitive",
    fullName: "Sensitive User",
    email: "safe@example.com",
    role: { slug: "staff", name: "Staff", internal: "hidden" },
    emailVerified: false,
    phoneVerified: true,
    verifiedAt: "2026-05-01T00:00:00.000Z",
    emailVerifiedAt: "2026-05-02T00:00:00.000Z",
    phoneVerifiedAt: "2026-05-03T00:00:00.000Z",
    verificationLastStatus: "sent",
    verificationLastChannel: "email",
    verificationLastRequestedAt: "2026-05-04T00:00:00.000Z",
    emailVerifyLastSentAt: "2026-05-04T00:00:00.000Z",
    phoneVerifyLastSentAt: "2026-05-05T00:00:00.000Z",
    wallet: {
      provider: "internal",
      status: "active",
      balance: 25,
      currency: "USD",
      updatedAt: "2026-05-27T00:00:00.000Z",
      secret: "wallet-secret",
    },
    customerType: "VIP",
    loyaltyPoints: 10,
    totalOrders: 2,
    totalSpending: 500,
    passwordHash: "hash",
    emailVerifyToken: "token",
    nationalId: "identity",
    bankAccountNumber: "bank",
    socialInsuranceNumber: "social",
    healthInsuranceNumber: "health",
    noteInternal: "private note",
    lastLoginIp: "10.0.0.1",
    forcePasswordChange: true,
    baseSalary: 123,
  };

  it("keeps auth DTO frontend fields and drops sensitive fields", () => {
    const out = sanitizeAuthUser(sensitiveUser);
    expect(out).toMatchObject({
      id: "u-sensitive",
      email: "safe@example.com",
      roleName: "staff",
      emailVerified: false,
      wallet: {
        provider: "internal",
        status: "active",
        balance: 25,
        currency: "USD",
        updatedAt: "2026-05-27T00:00:00.000Z",
      },
    });
    expect(out.wallet.secret).toBeUndefined();
    expect(out.passwordHash).toBeUndefined();
    expect(out.emailVerifyToken).toBeUndefined();
    expect(out.nationalId).toBeUndefined();
    expect(out.bankAccountNumber).toBeUndefined();
    expect(out.noteInternal).toBeUndefined();
    expect(out.lastLoginIp).toBeUndefined();
    expect(out.forcePasswordChange).toBeUndefined();
    expect(out.baseSalary).toBeUndefined();
    expect(out.emailVerifyLastSentAt).toBeUndefined();
    expect(out.phoneVerifyLastSentAt).toBeUndefined();
    expect(out.verificationLastRequestedAt).toBeUndefined();
    expect(out.verificationLastChannel).toBeUndefined();
    expect(out.verificationLastStatus).toBeUndefined();
    expect(out.emailVerified).toBe(false);
    expect(out.phoneVerified).toBe(true);
    expect(out.emailVerifiedAt).toBe("2026-05-02T00:00:00.000Z");
    expect(out.phoneVerifiedAt).toBe("2026-05-03T00:00:00.000Z");
  });

  it("keeps customer CRM fields and drops staff/private fields", () => {
    const out = sanitizeCustomerListUser(sensitiveUser);
    expect(out.customerType).toBe("VIP");
    expect(out.loyaltyPoints).toBe(10);
    expect(out.totalOrders).toBe(2);
    expect(out.totalSpending).toBe(500);
    expect(out.baseSalary).toBeUndefined();
    expect(out.nationalId).toBeUndefined();
    expect(out.bankAccountNumber).toBeUndefined();
    expect(out.noteInternal).toBeUndefined();
    expect(out.emailVerifyLastSentAt).toBeUndefined();
    expect(out.phoneVerifyLastSentAt).toBeUndefined();
    expect(out.verificationLastRequestedAt).toBeUndefined();
    expect(out.verificationLastChannel).toBeUndefined();
    expect(out.verificationLastStatus).toBeUndefined();
  });

  it("keeps admin list fields explicit and drops bank/identity/internal fields", () => {
    const out = sanitizeAdminUserListItem(sensitiveUser);
    expect(out.email).toBe("safe@example.com");
    expect(out.baseSalary).toBeUndefined();
    expect(out.nationalId).toBeUndefined();
    expect(out.bankAccountNumber).toBeUndefined();
    expect(out.socialInsuranceNumber).toBeUndefined();
    expect(out.healthInsuranceNumber).toBeUndefined();
    expect(out.noteInternal).toBeUndefined();
    expect(out.lastLoginIp).toBeUndefined();
    expect(out.emailVerifyLastSentAt).toBeUndefined();
    expect(out.phoneVerifyLastSentAt).toBeUndefined();
    expect(out.verificationLastRequestedAt).toBeUndefined();
    expect(out.verificationLastChannel).toBeUndefined();
    expect(out.verificationLastStatus).toBeUndefined();
  });

  it("permission-gated staff private profile can include HR fields", async () => {
    const out = await sanitizeStaffPrivateProfile(
      { ...sensitiveUser, restaurantForStaff: "restaurant-1" },
      { user: { id: "admin-1", roleName: "admin" } },
    );
    expect(out.baseSalary).toBe(123);
    expect(out.nationalId).toBe("identity");
    expect(out.bankAccountNumber).toBe("bank");
    expect(out.noteInternal).toBe("private note");
    expect(out.passwordHash).toBeUndefined();
    expect(out.lastLoginIp).toBeUndefined();
    expect(out.emailVerifyLastSentAt).toBeUndefined();
    expect(out.phoneVerifyLastSentAt).toBeUndefined();
    expect(out.verificationLastRequestedAt).toBeUndefined();
    expect(out.verificationLastChannel).toBeUndefined();
    expect(out.verificationLastStatus).toBeUndefined();
  });

  it("recognizes only assigned staff restaurant membership", () => {
    expect(staffBelongsToRestaurant({ restaurantForStaff: "restaurant-1" }, "restaurant-1")).toBe(true);
    expect(staffBelongsToRestaurant({ restaurantForStaff: "restaurant-2" }, "restaurant-1")).toBe(false);
    expect(staffBelongsToRestaurant({ refRestaurants: [{ _id: "restaurant-1" }] }, "restaurant-1")).toBe(false);
  });

  it("does not authorize against a caller supplied restaurant unrelated to target staff", async () => {
    await expect(
      sanitizeStaffPrivateProfile(
        { _id: "staff-b", fullName: "Staff B", restaurantForStaff: "restaurant-b", baseSalary: 100 },
        { user: { id: "manager-a", roleName: "manager" } },
        { restaurantId: "restaurant-a" },
      ),
    ).rejects.toThrow("Staff not found");
  });

  it("allows a manager with staff.read to read staff in the BrandMembership restaurant", async () => {
    const out = await sanitizeStaffPrivateProfile(
      { _id: "staff-a", fullName: "Staff A", restaurantForStaff: "restaurant-a", baseSalary: 100 },
      { user: { id: "manager-a", roleName: "manager" } },
      { restaurantId: "restaurant-a" },
    );
    expect(out.baseSalary).toBe(100);
  });

  it("uses target staff restaurant when restaurantId is omitted", async () => {
    const out = await sanitizeStaffPrivateProfile(
      { _id: "staff-a", fullName: "Staff A", restaurantForStaff: "restaurant-a", baseSalary: 100 },
      { user: { id: "manager-a", roleName: "manager" } },
    );
    expect(out.baseSalary).toBe(100);

    restaurantScopeMocks.canAccessRestaurant.mockResolvedValueOnce(false);

    await expect(
      sanitizeStaffPrivateProfile(
        { _id: "staff-b", fullName: "Staff B", restaurantForStaff: "restaurant-b", baseSalary: 100 },
        { user: { id: "manager-a", roleName: "manager" } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
  });
});

describe("staff private profile authorization", () => {
  beforeEach(() => {
    restaurantScopeMocks.canAccessRestaurant.mockReset();
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValue(true);
  });

  it("requires staff.read permission after restaurant access", async () => {
    await expect(
      sanitizeStaffPrivateProfile(
        { _id: "staff-1", fullName: "Staff", restaurantForStaff: "restaurant-1", baseSalary: 100 },
        { user: { id: "customer-1", roleName: "customer" } },
      ),
    ).rejects.toThrow("FORBIDDEN");
  });
});
