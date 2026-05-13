import { describe, it, expect, vi, beforeEach } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const modelMocks = vi.hoisted(() => ({
  Role: { findOne: vi.fn(), create: vi.fn(), findById: vi.fn() },
  User: {},
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

    expect(result).toEqual({ restaurants: [], menuItems: [], locations: [], owners: [] });
  });
});
