import { GraphQLError } from "graphql";
import { Role, User, Permission } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";
import mongoose from "mongoose";
export const RoleMutation = {
  createRole: async (_, { input }, { user }) => {
    // requireRole(user, ["admin", "manager"]);

    const { permissionIds = [], ...rest } = input;

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
      isSystem: false,
    });

    console.log(doc);
    return doc.toObject();
  },

  updateRole: async (_, { input }, { user }) => {
    requireRole(user, ["admin"]);
    const { id, permissionIds, ...rest } = input;
    const r = await Role.findById(input.id);
    if (!r) throw new GraphQLError("Role not found");
    if (r.isSystem)
      throw new GraphQLError("System role cannot be modified", {
        extensions: { code: "FORBIDDEN" },
      });

    if (Array.isArray(permissionIds)) {
      const perms = await Permission.find(
        { _id: { $in: permissionIds } },
        { _id: 1 }
      ).lean();
      r.permissions = perms.map((p) => p._id);
    }
    if (input.name !== undefined) r.name = input.name;
    if (input.description !== undefined) r.description = input.description;
    if (input.permissions !== undefined) r.permissions = input.permissions;
    if (input.parent !== undefined)
      r.parent = input.parent?.toLowerCase() || undefined;
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

  revokeRolesFromUser: async (_, { userId, roleId }, { user }) => {
    requireRole(user, ["admin", "manager"]);
    const u = await User.findById(userId);
    if (!u) throw new GraphQLError("User not found");
    const revoke = roleId;
    u.role = (u.role || []).filter((rid) => !revoke.has(String(rid)));
    await u.save();
    return u.toObject();
  },
};
