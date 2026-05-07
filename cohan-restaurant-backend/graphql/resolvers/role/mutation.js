import { GraphQLError } from "graphql";
import { Role, User, Permission, ParentRole } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";
import mongoose from "mongoose";

export const RoleMutation = {
  /* =====================================
   * ROLE CRUD
   * ===================================== */

  createRole: async (_, { input }, { user }) => {
    requireRole(user, ["admin"]);

    const { permissionIds = [], parentRoleId, ...rest } = input;

    // --- Validate parentRoleId ---
    if (!parentRoleId || !mongoose.isValidObjectId(parentRoleId)) {
      throw new GraphQLError("parentRoleId is invalid", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const parentRole = await ParentRole.findById(parentRoleId);
    if (!parentRole) {
      throw new GraphQLError("ParentRole not found", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    // --- Slug xử lý như cũ ---
    const slug = (rest.slug || "").toLowerCase().trim();
    if (!slug) {
      throw new GraphQLError("Slug is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const exists = await Role.findOne({ slug }).lean();
    if (exists) {
      throw new GraphQLError("Role slug already exists", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    // --- Validate permissionIds ---
    let permObjectIds = [];
    if (permissionIds.length) {
      const valid = permissionIds.filter((id) => mongoose.isValidObjectId(id));
      if (valid.length !== permissionIds.length) {
        throw new GraphQLError("Some permissionIds are invalid", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const perms = await Permission.find(
        { _id: { $in: valid } },
        { _id: 1 }
      ).lean();
      permObjectIds = perms.map((p) => p._id);
    }

    const doc = await Role.create({
      ...rest,
      slug,
      permissions: permObjectIds,
      parentRole: parentRole._id,
      isSystem: false,
    });

    return doc.toObject();
  },

  updateRole: async (_, { input }, { user }) => {
    requireRole(user, ["admin"]);

    const { id, permissionIds, parentRoleId, ...rest } = input;

    const r = await Role.findById(id);
    if (!r) throw new GraphQLError("Role not found");
    if (r.isSystem)
      throw new GraphQLError("System role cannot be modified", {
        extensions: { code: "FORBIDDEN" },
      });

    // --- Update parentRole nếu truyền lên ---
    if (parentRoleId !== undefined) {
      if (parentRoleId === null) {
        r.parentRole = undefined;
      } else {
        if (!mongoose.isValidObjectId(parentRoleId)) {
          throw new GraphQLError("parentRoleId is invalid", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        const parentRole = await ParentRole.findById(parentRoleId);
        if (!parentRole) {
          throw new GraphQLError("ParentRole not found", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        r.parentRole = parentRole._id;
      }
    }

    // --- Update permissions nếu có ---
    if (Array.isArray(permissionIds)) {
      const valid = permissionIds.filter((id) => mongoose.isValidObjectId(id));
      if (valid.length !== permissionIds.length) {
        throw new GraphQLError("Some permissionIds are invalid", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const perms = await Permission.find(
        { _id: { $in: valid } },
        { _id: 1 }
      ).lean();
      r.permissions = perms.map((p) => p._id);
    }

    // --- Update các field khác ---
    if (rest.name !== undefined) r.name = rest.name;
    if (rest.description !== undefined) r.description = rest.description;
    // slug thường không cho đổi, nhưng nếu em muốn thì thêm vào đây

    await r.save();
    return r.toObject();
  },

  deleteRole: async (_, { id }, { user }) => {
    requireRole(user, ["admin"]);

    const r = await Role.findById(id).lean();
    if (!r) throw new GraphQLError("Role not found");

    if (r.isSystem)
      throw new GraphQLError("System role cannot be deleted", {
        extensions: { code: "FORBIDDEN" },
      });

    // đảm bảo không còn user dùng role này
    const used = await User.exists({ role: id });
    if (used)
      throw new GraphQLError("Cannot delete: role is assigned to users", {
        extensions: { code: "BAD_REQUEST" },
      });

    await Role.findByIdAndDelete(id);
    return true;
  },

  /* =====================================
   * PARENT ROLE CRUD
   * ===================================== */

  createParentRole: async (_, { input }, { user }) => {
    requireRole(user, ["admin"]);

    const { permissionIds = [], ...rest } = input;

    const slug = (rest.slug || "").toLowerCase().trim();
    if (!slug) {
      throw new GraphQLError("Slug is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const exists = await ParentRole.findOne({ slug }).lean();
    if (exists) {
      throw new GraphQLError("ParentRole slug already exists", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    let permObjectIds = [];
    if (permissionIds.length) {
      const valid = permissionIds.filter((id) => mongoose.isValidObjectId(id));
      if (valid.length !== permissionIds.length) {
        throw new GraphQLError("Some permissionIds are invalid", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const perms = await Permission.find(
        { _id: { $in: valid } },
        { _id: 1 }
      ).lean();
      permObjectIds = perms.map((p) => p._id);
    }

    const doc = await ParentRole.create({
      ...rest,
      slug,
      permissions: permObjectIds,
    });

    return doc.toObject();
  },

  updateParentRole: async (_, { input }, { user }) => {
    requireRole(user, ["admin"]);

    const { id, permissionIds, ...rest } = input;

    const pr = await ParentRole.findById(id);
    if (!pr) throw new GraphQLError("ParentRole not found");

    if (Array.isArray(permissionIds)) {
      const valid = permissionIds.filter((pid) =>
        mongoose.isValidObjectId(pid)
      );
      if (valid.length !== permissionIds.length) {
        throw new GraphQLError("Some permissionIds are invalid", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const perms = await Permission.find(
        { _id: { $in: valid } },
        { _id: 1 }
      ).lean();
      pr.permissions = perms.map((p) => p._id);
    }

    if (rest.name !== undefined) pr.name = rest.name;
    if (rest.description !== undefined) pr.description = rest.description;
    // slug thường không cho sửa, nếu cần thì thêm validate giống create

    await pr.save();
    return pr.toObject();
  },

  deleteParentRole: async (_, { id }, { user }) => {
    requireRole(user, ["admin"]);

    const pr = await ParentRole.findById(id).lean();
    if (!pr) throw new GraphQLError("ParentRole not found");

    // đảm bảo không có Role nào đang dùng parentRole này
    const used = await Role.exists({ parentRole: id });
    if (used) {
      throw new GraphQLError("Cannot delete: parentRole is assigned to roles", {
        extensions: { code: "BAD_REQUEST" },
      });
    }

    await ParentRole.findByIdAndDelete(id);
    return true;
  },
};
