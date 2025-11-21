// src/graphql/role/query.js (ví dụ)
import { Role } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";

export const RoleQuery = {
  role: async (_, { search, parentRoleId }, { user }) => {
    // requireRole(user, ["admin", "manager"]);

    const q = {};

    if (search) {
      q.$or = [
        { name: new RegExp(search, "i") },
        { slug: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    if (parentRoleId) {
      q.parentRole = parentRoleId;
    }

    const roles = await Role.find(q)
      .populate({
        path: "permissions",
      })
      .populate({
        path: "parentRole",
        populate: {
          path: "permissions",
        },
      })
      .sort({ slug: 1 })
      .exec();

    // Gộp permission của parent + role hiện tại
    const result = roles.map((r) => {
      const obj = r.toObject();

      const permMap = new Map();

      // 1) permission từ parentRole
      if (obj.parentRole && Array.isArray(obj.parentRole.permissions)) {
        for (const p of obj.parentRole.permissions) {
          if (!p?._id) continue;
          permMap.set(String(p._id), p);
        }
      }

      // 2) permission từ role hiện tại
      if (Array.isArray(obj.permissions)) {
        for (const p of obj.permissions) {
          if (!p?._id) continue;
          permMap.set(String(p._id), p);
        }
      }

      // Gán lại mảng permissions đã gộp
      obj.permissions = Array.from(permMap.values());

      return obj;
    });

    return result;
  },
};
