import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import Floor from "../../../models/floor.model.js";
import Table from "../../../models/table.model.js";
import { logEvent } from "../../../src/services/eventLog.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

export default async function moveTable(_parent, { input }, ctx) {
  const { id, floorId, position } = input;
  if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

  const current = await Table.findById(id)
    .select({ restaurantId: 1, floorId: 1, joinGroupId: 1 })
    .lean();
  if (!current) throw new GraphQLError("Table not found");

  await requireRestaurantPermission(
    ctx,
    current.restaurantId,
    PERMISSIONS.TABLE_WRITE,
  );

  const patch = {};
  if (position) patch.position = position;

  if (floorId) {
    if (!mongoose.isValidObjectId(floorId)) {
      throw new GraphQLError("Invalid floorId");
    }

    const changingFloor = String(floorId) !== String(current.floorId);
    if (changingFloor && current.joinGroupId) {
      throw new GraphQLError(
        "Vui lòng tách bàn khỏi nhóm trước khi chuyển tầng.",
        { extensions: { code: "TABLE_JOIN_GROUP_FLOOR_MOVE" } },
      );
    }

    const floor = await Floor.findById(floorId)
      .select({ restaurantId: 1, level: 1 })
      .lean();
    if (!floor) throw new GraphQLError("Floor not found");
    if (String(floor.restaurantId) !== String(current.restaurantId)) {
      throw new GraphQLError("Floor does not belong to this restaurant");
    }

    patch.floorId = floorId;
    patch.floorLevel = floor.level ?? 1;
  }

  const doc = await Table.findByIdAndUpdate(
    id,
    { $set: patch },
    { new: true, runValidators: true },
  ).lean({ virtuals: true });
  if (!doc) throw new GraphQLError("Table not found");

  await logEvent({
    restaurantId: doc.restaurantId,
    floorId: doc.floorId,
    tableId: doc.id,
    actorUserId: ctx.user?.id,
    verb: "table.move",
    object: { kind: "Table", id: doc.id, code: doc.code },
    meta: { toFloorId: input.floorId, position: input.position },
    ip: ctx.req?.ip,
    userAgent: ctx.req?.headers?.["user-agent"],
  });

  return doc;
}
