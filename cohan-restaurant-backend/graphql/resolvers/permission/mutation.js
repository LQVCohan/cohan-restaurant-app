import { GraphQLError } from "graphql";
import { Permission } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";
export const PermissionMutation = {
  createPermission: async (_, { input }, { user, request }) => {
    request.log.info(
      { user, headers: request.headers },
      "createPermission auth debug"
    );
    // requireRole(user, ["admin", "manager"]);
    const payload = {
      ...input,
      code:
        input.code ||
        `${(input.resource || "").toLowerCase()}.${(
          input.action || ""
        ).toLowerCase()}`,
      action: input.action?.toLowerCase(),
      resource: input.resource?.toLowerCase(),
      group: input.group?.toLowerCase(),
    };

    const exists = await Permission.findOne({
      code: payload.code,
    }).lean();
    if (exists)
      throw new GraphQLError("Permission code already exists", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    const doc = await Permission.create(payload);
    return doc.toObject();
  },
  updatePermission: async (_, { input }) => {
    const p = await Permission.findById(input.id);
    if (!p) throw new GraphQLError("Permission not found");

    if (input.name !== undefined) p.name = input.name;
    if (input.description !== undefined) p.description = input.description;
    if (input.group !== undefined) p.group = input.group?.toLowerCase();
    if (input.action !== undefined) p.action = input.action?.toLowerCase();
    if (input.resource !== undefined)
      p.resource = input.resource?.toLowerCase();
    if (input.code !== undefined) {
      p.code = input.code?.toLowerCase();
    } else if (input.action || input.resource) {
      p.code = `${p.resource}.${p.action}`.toLowerCase();
    }

    await p.save();
    return p.toObject();
  },
};
