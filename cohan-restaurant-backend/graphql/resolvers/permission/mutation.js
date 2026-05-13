import { GraphQLError } from "graphql";
import { Permission } from "../../../models/index.js";
import {
  normalizePermissionCode,
  requirePermission,
} from "../../../src/services/auth/authorization.service.js";

function buildPermissionPayload(input) {
  const action = input.action?.toLowerCase().trim();
  const resource = input.resource?.toLowerCase().trim();
  return {
    ...input,
    code: normalizePermissionCode(input.code || `${resource || ""}.${action || ""}`),
    action,
    resource,
    group: input.group?.toLowerCase().trim(),
  };
}

export const PermissionMutation = {
  createPermission: async (_, { input }, ctx) => {
    await requirePermission(ctx, "permission.write");

    const payload = buildPermissionPayload(input);
    const exists = await Permission.findOne({ code: payload.code }).lean();
    if (exists) {
      throw new GraphQLError("Permission code already exists", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const doc = await Permission.create(payload);
    return doc.toObject();
  },

  updatePermission: async (_, { input }, ctx) => {
    await requirePermission(ctx, "permission.write");

    const p = await Permission.findById(input.id);
    if (!p) throw new GraphQLError("Permission not found");

    if (input.name !== undefined) p.name = input.name;
    if (input.description !== undefined) p.description = input.description;
    if (input.group !== undefined) p.group = input.group?.toLowerCase().trim();
    if (input.action !== undefined) p.action = input.action?.toLowerCase().trim();
    if (input.resource !== undefined) p.resource = input.resource?.toLowerCase().trim();
    if (input.isSystem !== undefined) p.isSystem = input.isSystem;
    if (input.isActive !== undefined) p.isActive = input.isActive;
    if (input.code !== undefined) p.code = normalizePermissionCode(input.code);
    else if (input.action || input.resource) p.code = `${p.resource}.${p.action}`.toLowerCase();

    await p.save();
    return p.toObject();
  },

  deletePermission: async (_, { id }, ctx) => {
    await requirePermission(ctx, "permission.write");

    const p = await Permission.findById(id);
    if (!p) throw new GraphQLError("Permission not found");
    if (p.isSystem) {
      throw new GraphQLError("System permission cannot be deleted", {
        extensions: { code: "FORBIDDEN" },
      });
    }

    await Permission.findByIdAndDelete(id);
    return true;
  },
};
