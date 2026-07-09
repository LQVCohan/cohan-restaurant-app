import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { EventLog, Staff } from "../../../models/index.js";
import { requireAuth, requireRestaurantAccess, requireRoles } from "../../guards.js";
import { sanitizeStaffPrivateProfile } from "../../../src/security/userDtos.js";
import { getStaffRestaurantIds } from "../../../src/services/auth/restaurantScope.service.js";
import {
  deleteLocalAvatar,
  resolveAvatarUpdate,
} from "../../../src/services/media/avatarStorage.service.js";

const STAFF_AVATAR_ROLES = ["ADMIN", "MANAGER", "HR"];

const updateStaffAvatar = async (_, { userId, input }, ctx) => {
  requireAuth(ctx);
  requireRoles(ctx, STAFF_AVATAR_ROLES);

  if (!mongoose.isValidObjectId(userId)) {
    throw new GraphQLError("Mã nhân viên không hợp lệ.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const staff = await Staff.findById(userId);
  if (!staff || staff.userType !== "STAFF" || staff.deletedAt) {
    throw new GraphQLError("Không tìm thấy nhân viên.", {
      extensions: { code: "NOT_FOUND" },
    });
  }

  const staffRestaurantIds = await getStaffRestaurantIds(staff._id);
  if (!staffRestaurantIds.length) {
    throw new GraphQLError("Nhân viên chưa được gán nhà hàng.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  let restaurantId = null;
  for (const candidateRestaurantId of staffRestaurantIds) {
    try {
      await requireRestaurantAccess(ctx, candidateRestaurantId);
      restaurantId = candidateRestaurantId;
      break;
    } catch {
      // Try the next BrandMembership-assigned restaurant.
    }
  }
  if (!restaurantId) {
    throw new GraphQLError("FORBIDDEN_SCOPE", {
      extensions: { code: "FORBIDDEN" },
    });
  }

  const previousAvatarUrl = staff.avatarUrl || null;
  const nextAvatarUrl = await resolveAvatarUpdate({ input, userId: staff._id });

  staff.avatarUrl = nextAvatarUrl;
  await staff.save();
  await staff.populate(["role", "refRestaurants"]);

  if (previousAvatarUrl && previousAvatarUrl !== nextAvatarUrl) {
    deleteLocalAvatar(previousAvatarUrl);
  }

  await EventLog.log({
    restaurantId,
    actorUserId: ctx?.user?.id || ctx?.user?._id,
    verb: "staff.avatar.update",
    source: "web",
    object: {
      kind: "Staff",
      id: staff._id,
      code: staff.employeeCode || undefined,
    },
    diff: {
      before: { avatarUrl: previousAvatarUrl },
      after: { avatarUrl: nextAvatarUrl },
    },
    meta: {
      action: nextAvatarUrl ? "replace" : "remove",
    },
  });

  return sanitizeStaffPrivateProfile(staff, ctx, {
    restaurantId,
    skipAuthorization: true,
  });
};

export default {
  updateStaffAvatar,
};
