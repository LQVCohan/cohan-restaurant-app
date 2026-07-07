// Restaurant-scoped customer hiding. This module never deletes user records.
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Customer } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";
import { requireRestaurantAccess } from "../../guards.js";
import { requirePermission } from "../../../src/services/auth/authorization.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { isSystemAdmin } from "../../../src/services/auth/restaurantScope.service.js";
import {
  SENSITIVE_ACCESS,
  tryAdminSensitiveAccessWithAudit,
} from "../../../src/services/auth/adminSensitiveAccess.service.js";
import { sanitizeCustomerListUser } from "../../../src/security/userDtos.js";

const ARCHIVE_CONFIRM_TEXT = "AN TOAN BO KHACH HANG";
const ARCHIVED_CUSTOMER_LIMIT_MAX = 500;

const toObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new GraphQLError(`Invalid ${fieldName}`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return new mongoose.Types.ObjectId(value);
};

const modifiedCountOf = (result) =>
  Number(result?.modifiedCount ?? result?.nModified ?? 0);

const archivedScope = (restaurantId) => ({
  deletedAt: null,
  customerRestaurants: { $nin: [restaurantId] },
  archivedRestaurants: { $elemMatch: { restaurantId } },
});

const archivedCustomers = async (_, { restaurantId, limit = 100 }, ctx) => {
  requireRole(ctx?.user, ["admin"]);
  await requirePermission(ctx, PERMISSIONS.CUSTOMER_READ);

  const rid = toObjectId(restaurantId, "restaurantId");
  await requireRestaurantAccess(ctx, rid);

  const safeLimit = Math.min(
    ARCHIVED_CUSTOMER_LIMIT_MAX,
    Math.max(1, Number(limit) || 100),
  );
  const cond = archivedScope(rid);
  const [totalCount, items] = await Promise.all([
    Customer.countDocuments(cond),
    Customer.find(cond)
      .populate({ path: "role", select: "name slug" })
      .populate({ path: "customerRestaurants", select: "name" })
      .sort({ "archivedRestaurants.archivedAt": -1, _id: -1 })
      .limit(safeLimit)
      .lean(),
  ]);

  const allowCustomerSensitive = await tryAdminSensitiveAccessWithAudit(ctx, {
    category: SENSITIVE_ACCESS.CUSTOMER_CONTACT,
    resourceType: "ArchivedCustomer",
    resourceId: String(restaurantId),
    restaurantId,
  });
  const sanitizeOptions = {
    maskSensitive: isSystemAdmin(ctx?.user) && !allowCustomerSensitive,
    allowContact: allowCustomerSensitive,
    allowWallet: allowCustomerSensitive,
  };

  return {
    totalCount,
    items: items.map((item) =>
      sanitizeCustomerListUser(item, sanitizeOptions),
    ),
  };
};

const archiveAllCustomers = async (
  _,
  { restaurantId, confirmText },
  ctx,
) => {
  requireRole(ctx?.user, ["admin", "manager"]);
  await requirePermission(ctx, PERMISSIONS.CUSTOMER_UPDATE);

  if (String(confirmText || "").trim().toUpperCase() !== ARCHIVE_CONFIRM_TEXT) {
    throw new GraphQLError("Invalid confirmation text", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const rid = toObjectId(restaurantId, "restaurantId");
  const actorId = toObjectId(ctx?.user?.id || ctx?.user?._id, "userId");
  await requireRestaurantAccess(ctx, rid);

  const result = await Customer.updateMany(
    { deletedAt: null, customerRestaurants: rid },
    {
      $pull: { customerRestaurants: rid },
      $addToSet: {
        archivedRestaurants: {
          restaurantId: rid,
          archivedAt: new Date(),
          archivedBy: actorId,
        },
      },
    },
  );

  return modifiedCountOf(result);
};

const restoreAllArchivedCustomers = async (
  _,
  { restaurantId },
  ctx,
) => {
  requireRole(ctx?.user, ["admin"]);
  await requirePermission(ctx, PERMISSIONS.CUSTOMER_UPDATE);

  const rid = toObjectId(restaurantId, "restaurantId");
  await requireRestaurantAccess(ctx, rid);

  const result = await Customer.updateMany(
    archivedScope(rid),
    {
      $addToSet: { customerRestaurants: rid },
      $pull: { archivedRestaurants: { restaurantId: rid } },
    },
  );

  return modifiedCountOf(result);
};

export default {
  Query: { archivedCustomers },
  Mutation: { archiveAllCustomers, restoreAllArchivedCustomers },
};
