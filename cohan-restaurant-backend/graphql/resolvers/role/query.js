import { ParentRole, Role } from "../../../models/index.js";
import { requireAnyPermission } from "../../../src/services/auth/authorization.service.js";
import { normalizeRoleForRbacResponse } from "./rbacRoleResponse.js";

export const RoleQuery = {
  role: async (_, { search, parentRoleId }, ctx) => {
    await requireAnyPermission(ctx, ["role.read"]);

    const q = {};

    if (search) {
      q.$or = [
        { name: new RegExp(search, "i") },
        { slug: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    if (parentRoleId) q.parentRole = parentRoleId;

    const roles = await Role.find(q)
      .populate("permissions")
      .populate({ path: "parentRole", populate: { path: "permissions" } })
      .sort({ slug: 1 })
      .exec();

    return roles.map((r) => normalizeRoleForRbacResponse(r.toObject()));
  },

  parentRoles: async (_, { search }, ctx) => {
    await requireAnyPermission(ctx, ["role.read"]);

    const q = {};
    if (search) {
      q.$or = [
        { name: new RegExp(search, "i") },
        { slug: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    return ParentRole.find(q).populate("permissions").sort({ slug: 1 });
  },
};
