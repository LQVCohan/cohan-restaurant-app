import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({ Customer: { updateMany: vi.fn() } }));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../utils/authz.js", () => ({ requireRole: vi.fn() }));
vi.mock("../../graphql/guards.js", () => ({ requireRestaurantAccess: vi.fn() }));
vi.mock("../../src/services/auth/authorization.service.js", () => ({ requirePermission: vi.fn() }));
vi.mock("../../src/services/auth/restaurantScope.service.js", () => ({ isSystemAdmin: vi.fn(() => false) }));
vi.mock("../../src/services/auth/adminSensitiveAccess.service.js", () => ({ SENSITIVE_ACCESS: { CUSTOMER_CONTACT: "CUSTOMER_CONTACT" }, tryAdminSensitiveAccessWithAudit: vi.fn() }));
vi.mock("../../src/security/userDtos.js", () => ({ sanitizeCustomerListUser: vi.fn((x) => x) }));

describe("customer archive membership behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Customer.updateMany.mockResolvedValue({ modifiedCount: 3 });
  });

  it("archive removes customerRestaurants but not refRestaurants", async () => {
    const mod = await import("../../graphql/resolvers/user/customerArchive.js");
    await mod.default.Mutation.archiveAllCustomers(null, { restaurantId: "507f1f77bcf86cd799439011", confirmText: "AN TOAN BO KHACH HANG" }, { user: { id: "507f1f77bcf86cd799439012" } });
    const [, update] = modelMocks.Customer.updateMany.mock.calls[0];
    expect(update.$pull).toEqual({ customerRestaurants: expect.anything() });
    expect(JSON.stringify(update)).not.toContain("refRestaurants");
  });

  it("restore adds customerRestaurants but not refRestaurants", async () => {
    const mod = await import("../../graphql/resolvers/user/customerArchive.js");
    await mod.default.Mutation.restoreAllArchivedCustomers(null, { restaurantId: "507f1f77bcf86cd799439011" }, { user: { id: "507f1f77bcf86cd799439012" } });
    const [, update] = modelMocks.Customer.updateMany.mock.calls[0];
    expect(update.$addToSet).toEqual({ customerRestaurants: expect.anything() });
    expect(JSON.stringify(update)).not.toContain("refRestaurants");
  });
});
