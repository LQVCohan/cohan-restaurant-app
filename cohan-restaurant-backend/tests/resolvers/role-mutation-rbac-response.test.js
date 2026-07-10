import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Role: {
    findOne: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
  },
  User: {},
  Permission: { find: vi.fn() },
  ParentRole: { findById: vi.fn() },
  AuditLog: { create: vi.fn().mockResolvedValue({ _id: "audit-1" }) },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../utils/authz.js", () => ({
  hasRole: vi.fn((user, roles) => roles.includes(String(user?.roleName || user?.role?.slug || user?.role || "").toLowerCase())),
}));
vi.mock("mongoose", () => ({
  default: { isValidObjectId: vi.fn(() => true), Types: { ObjectId: function ObjectId(value) { this.value = value; this.toString = () => String(value); } } },
}));

const adminCtx = { user: { id: "admin-1", roleName: "admin" } };
const inheritedPermission = { _id: "permission-inherited", id: "permission-inherited", code: "order.read" };
const directPermission = { _id: "permission-direct", id: "permission-direct", code: "order.create" };
const parentRole = {
  _id: "parent-service",
  id: "parent-service",
  slug: "service",
  name: "Service",
  permissions: [inheritedPermission],
};

function roleQueryResult(role) {
  return {
    populate: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(role),
  };
}

function expectRbacRoleResponse(role) {
  expect(role.parentRole).toMatchObject({ slug: "service" });
  expect(role.directPermissions.map((permission) => permission.code)).toEqual(["order.create"]);
  expect(role.permissions.map((permission) => permission.code).sort()).toEqual(["order.create", "order.read"]);
}

describe("RoleMutation RBAC response shape", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.AuditLog.create.mockResolvedValue({ _id: "audit-1" });
    modelMocks.Role.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    modelMocks.Permission.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([directPermission]) });
    modelMocks.ParentRole.findById.mockResolvedValue(parentRole);
  });

  it("maps a lean ParentRole _id to the non-null GraphQL id field", async () => {
    const { default: roleTypes } = await import("../../graphql/resolvers/role/types.js");

    expect(roleTypes.ParentRole.id({ _id: "parent-staff" })).toBe("parent-staff");
    expect(roleTypes.ParentRole.id({ id: "parent-virtual", _id: "parent-db" })).toBe("parent-virtual");
  });

  it("createRole returns parentRole, directPermissions, effective permissions, and logs audit", async () => {
    const createdRoleId = "role-created";
    modelMocks.Role.create.mockResolvedValue({ _id: createdRoleId });
    modelMocks.Role.findById.mockReturnValueOnce(roleQueryResult({
      _id: createdRoleId,
      id: createdRoleId,
      slug: "server",
      name: "Server",
      isSystem: false,
      parentRole,
      permissions: [directPermission],
    }));

    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    const role = await RoleMutation.createRole(
      null,
      { input: { name: "Server", slug: "server", parentRoleId: "parent-service", permissionIds: ["permission-direct"] } },
      adminCtx,
    );

    expectRbacRoleResponse(role);
    expect(modelMocks.AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: "ROLE_CREATED", module: "rbac", targetType: "Role" }));
  });

  it("updateRole returns parentRole, directPermissions, effective permissions, and logs audit", async () => {
    const save = vi.fn();
    const roleDocument = {
      _id: "role-server",
      slug: "server",
      isSystem: false,
      permissions: [],
      parentRole: "parent-service",
      department: "service",
      save,
    };

    modelMocks.Role.findById
      .mockResolvedValueOnce(roleDocument)
      .mockReturnValueOnce(roleQueryResult({
        _id: "role-server",
        id: "role-server",
        slug: "server",
        name: "Server",
        isSystem: false,
        parentRole,
        permissions: [directPermission],
      }));

    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    const role = await RoleMutation.updateRole(
      null,
      { input: { id: "role-server", name: "Server updated", department: "kitchen", parentRoleId: "parent-service", permissionIds: ["permission-direct"] } },
      adminCtx,
    );

    expect(roleDocument.department).toBe("kitchen");
    expect(save).toHaveBeenCalledTimes(1);
    expectRbacRoleResponse(role);
    expect(modelMocks.AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: "ROLE_PERMISSION_UPDATED", module: "rbac", targetType: "Role" }));
  });

  it("updateRole audit failure does not fail the mutation", async () => {
    const save = vi.fn();
    const roleDocument = {
      _id: "role-server",
      slug: "server",
      isSystem: false,
      permissions: [],
      parentRole: "parent-service",
      department: "service",
      save,
    };
    modelMocks.AuditLog.create.mockRejectedValue(new Error("audit down"));
    modelMocks.Role.findById
      .mockResolvedValueOnce(roleDocument)
      .mockReturnValueOnce(roleQueryResult({
        _id: "role-server",
        id: "role-server",
        slug: "server",
        name: "Server",
        isSystem: false,
        parentRole,
        permissions: [directPermission],
      }));

    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    await expect(RoleMutation.updateRole(
      null,
      { input: { id: "role-server", permissionIds: ["permission-direct"] } },
      adminCtx,
    )).resolves.toMatchObject({ slug: "server" });
  });

  it("updateRole still blocks system/protected roles before saving", async () => {
    const save = vi.fn();
    modelMocks.Role.findById.mockResolvedValue({
      _id: "role-admin",
      slug: "admin",
      isSystem: true,
      save,
    });

    const { RoleMutation } = await import("../../graphql/resolvers/role/mutation.js");

    await expect(
      RoleMutation.updateRole(
        null,
        { input: { id: "role-admin", name: "Admin updated", permissionIds: ["permission-direct"] } },
        adminCtx,
      ),
    ).rejects.toThrow("System role cannot be modified");

    expect(save).not.toHaveBeenCalled();
    expect(modelMocks.Permission.find).not.toHaveBeenCalled();
    expect(modelMocks.AuditLog.create).not.toHaveBeenCalled();
  });
});