import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Role: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    exists: vi.fn(),
  },
  User: { exists: vi.fn() },
  Permission: { find: vi.fn() },
  ParentRole: {
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));
const authorizationMocks = vi.hoisted(() => ({
  requirePermission: vi.fn().mockResolvedValue(true),
  assertManagerAssignablePermissionCodes: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => ({
  requirePermission: authorizationMocks.requirePermission,
  assertManagerAssignablePermissionCodes: authorizationMocks.assertManagerAssignablePermissionCodes,
  isProtectedSystemRoleSlug: (slug) => ["admin", "manager", "hr", "accountant"].includes(String(slug || "").toLowerCase()),
}));
vi.mock("../../src/services/audit/rbacAudit.service.js", () => ({
  logRbacAudit: vi.fn().mockResolvedValue(null),
}));
vi.mock("../../graphql/resolvers/role/rbacRoleResponse.js", () => ({
  loadRoleForRbacResponse: vi.fn(async (id) => ({ id: String(id) })),
}));
vi.mock("mongoose", () => ({
  default: { isValidObjectId: vi.fn(() => true) },
}));

const leanResult = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const permissionQuery = (value = []) => ({ lean: vi.fn().mockResolvedValue(value) });

function editableRole(parentSlug = "staff") {
  return {
    _id: "role-1",
    slug: "server-custom",
    name: "Server custom",
    isSystem: false,
    parentRole: { _id: `parent-${parentSlug}`, slug: parentSlug },
    permissions: [],
    populate: vi.fn().mockResolvedValue(true),
    save: vi.fn().mockResolvedValue(true),
    toObject() {
      return {
        _id: this._id,
        slug: this.slug,
        parentRole: this.parentRole,
        permissions: this.permissions,
      };
    },
  };
}

describe("role mutation lower-role scope", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authorizationMocks.requirePermission.mockResolvedValue(true);
    modelMocks.Role.findOne.mockReturnValue(leanResult(null));
    modelMocks.Permission.find.mockReturnValue(permissionQuery([]));
    modelMocks.Role.create.mockResolvedValue({ _id: "role-created", slug: "captain" });
  });

  it("allows manager to create a custom role under the staff parent", async () => {
    modelMocks.ParentRole.findById.mockResolvedValue({ _id: "parent-staff", slug: "staff" });
    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    await expect(RoleMutation.createRole(null, {
      input: {
        name: "Captain",
        slug: "captain",
        parentRoleId: "parent-staff",
        permissionIds: [],
      },
    }, { user: { id: "manager-1", roleName: "manager" } })).resolves.toEqual({ id: "role-created" });

    expect(modelMocks.Role.create).toHaveBeenCalledWith(expect.objectContaining({
      slug: "captain",
      parentRole: "parent-staff",
      isSystem: false,
    }));
  });

  it("blocks manager from creating a role outside the staff hierarchy", async () => {
    modelMocks.ParentRole.findById.mockResolvedValue({ _id: "parent-customer", slug: "customer" });
    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    await expect(RoleMutation.createRole(null, {
      input: {
        name: "Customer admin",
        slug: "customer-admin",
        parentRoleId: "parent-customer",
        permissionIds: [],
      },
    }, { user: { id: "manager-1", roleName: "manager" } }))
      .rejects.toThrow("Manager can only manage roles that inherit from staff");

    expect(modelMocks.Role.create).not.toHaveBeenCalled();
  });

  it("blocks manager from editing an existing non-staff custom role", async () => {
    const role = editableRole("customer");
    modelMocks.Role.findById.mockResolvedValue(role);
    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    await expect(RoleMutation.updateRole(null, {
      input: { id: role._id, name: "Changed" },
    }, { user: { id: "manager-1", roleName: "manager" } }))
      .rejects.toThrow("Manager can only manage roles that inherit from staff");

    expect(role.save).not.toHaveBeenCalled();
  });

  it("keeps parent-role administration admin-only", async () => {
    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    await expect(RoleMutation.createParentRole(null, {
      input: { name: "Custom parent", slug: "custom-parent", permissionIds: [] },
    }, { user: { id: "manager-1", roleName: "manager" } }))
      .rejects.toThrow("Only admin can manage parent roles");

    expect(modelMocks.ParentRole.create).not.toHaveBeenCalled();
  });
});
