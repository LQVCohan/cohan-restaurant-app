import { describe, it, expect, vi, beforeEach } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const modelMocks = vi.hoisted(() => ({
  Role: { findOne: vi.fn(), create: vi.fn(), findById: vi.fn() },
  User: {},
  Staff: { aggregate: vi.fn() },
  Permission: { find: vi.fn() },
  ParentRole: { findById: vi.fn() },
  MenuItem: { aggregate: vi.fn() },
  Restaurant: { find: vi.fn(), aggregate: vi.fn() },
}));

vi.mock("../../utils/authz.js", () => ({
  requireRole: requireRoleMock,
  hasRole: vi.fn((user, roles) => roles.includes(String(user?.roleName || user?.role || "").toLowerCase())),
}));
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: { isValidObjectId: vi.fn(() => true) },
}));

describe("backend authorization wrap-up", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.Staff.aggregate.mockResolvedValue([]);
  });

  it("role.createRole is admin-only and denies before DB access", async () => {
    requireRoleMock.mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });

    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    await expect(
      RoleMutation.createRole(
        null,
        { input: { name: "X", slug: "x", parentRoleId: "p1", permissionIds: [] } },
        { user: { id: "u1", roleName: "manager" } },
      ),
    ).rejects.toThrow("FORBIDDEN");

    expect(modelMocks.ParentRole.findById).not.toHaveBeenCalled();
    expect(modelMocks.Role.create).not.toHaveBeenCalled();
  });

  it("createRole blocks non-admin from using protected parent roles", async () => {
    modelMocks.ParentRole.findById.mockResolvedValue({ _id: "parent-admin", slug: "admin" });

    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    await expect(
      RoleMutation.createRole(
        null,
        { input: { name: "Escalated", slug: "escalated", parentRoleId: "parent-admin", permissionIds: [] } },
        { user: { id: "u1", roleName: "custom-manager", role: { permissions: [{ code: "role.write" }] } } },
      ),
    ).rejects.toThrow("Protected parent role cannot be used by non-admin");

    expect(modelMocks.Role.findOne).not.toHaveBeenCalled();
    expect(modelMocks.Role.create).not.toHaveBeenCalled();
  });

  it("updateRole blocks non-admin from switching to protected parent roles", async () => {
    const save = vi.fn();
    modelMocks.Role.findById.mockResolvedValue({
      _id: "role-1",
      slug: "server",
      isSystem: false,
      save,
      toObject: () => ({ _id: "role-1" }),
    });
    modelMocks.ParentRole.findById.mockResolvedValue({ _id: "parent-manager", slug: "manager" });

    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    await expect(
      RoleMutation.updateRole(
        null,
        { input: { id: "role-1", parentRoleId: "parent-manager" } },
        { user: { id: "u1", roleName: "custom-manager", role: { permissions: [{ code: "role.write" }] } } },
      ),
    ).rejects.toThrow("Protected parent role cannot be used by non-admin");

    expect(save).not.toHaveBeenCalled();
  });


  it("updateParentRole blocks non-admin from modifying protected parent roles", async () => {
    const save = vi.fn();
    modelMocks.ParentRole.findById.mockResolvedValue({
      _id: "parent-admin",
      slug: "admin",
      name: "Admin",
      description: "Admin parent role",
      save,
      toObject: () => ({ _id: "parent-admin" }),
    });

    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    await expect(
      RoleMutation.updateParentRole(
        null,
        { input: { id: "parent-admin", name: "Changed", description: "Changed" } },
        { user: { id: "u1", roleName: "custom-manager", role: { permissions: [{ code: "role.write" }] } } },
      ),
    ).rejects.toThrow("System parent role cannot be modified");

    expect(save).not.toHaveBeenCalled();
  });


  it("updateParentRole rejects non-admin permissions outside manager staff whitelist", async () => {
    const save = vi.fn();
    modelMocks.ParentRole.findById.mockResolvedValue({
      _id: "parent-role-1",
      permissions: [],
      save,
      toObject: () => ({ _id: "parent-role-1" }),
    });
    modelMocks.Permission.find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ _id: "permission-1", code: "permission.write" }]),
    });

    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    await expect(
      RoleMutation.updateParentRole(
        null,
        { input: { id: "parent-role-1", permissionIds: ["permission-1"] } },
        { user: { id: "u1", roleName: "custom-manager", role: { permissions: [{ code: "role.write" }] } } },
      ),
    ).rejects.toThrow("Manager cannot assign permissions");

    expect(save).not.toHaveBeenCalled();
  });

  it("search suggestions remain intentionally public", async () => {
    modelMocks.Restaurant.find.mockReturnValue({
      limit: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({ lean: vi.fn(async () => []) }),
      }),
    });
    modelMocks.MenuItem.aggregate.mockResolvedValue([]);
    modelMocks.Restaurant.aggregate.mockResolvedValue([]);

    const searchQueryResolvers = (await import("../../graphql/resolvers/search/query.js")).default;

    const result = await searchQueryResolvers.searchSuggestions(
      null,
      { query: "pho", limit: 3 },
      {},
    );

    expect(result).toEqual({ restaurants: [], menuItems: [], chefs: [], locations: [], owners: [] });
  });
});
