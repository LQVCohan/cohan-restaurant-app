import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Brand, BrandMembership, Restaurant, User, Role } from "../../../models/index.js";
import { validateBrandMembershipScope } from "../../../models/brandMembership.model.js";
import { signAccessToken, issueRefreshToken } from "../../../src/security/authTokens.js";
import { sanitizeUserForClient } from "../../../src/security/sanitizeUserForClient.js";
import {
  canManageBrand,
  canReadBrand,
  ensureBrandRestaurants,
  getScopedRestaurantFilter,
  getUserId,
  isBrandOwner,
  isSystemAdmin,
} from "../../../src/services/auth/restaurantScope.service.js";

const bad = (message) => new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
const forbidden = (message = "Forbidden") => new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
const auth = () => new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
const oid = (id) => {
  if (!mongoose.isValidObjectId(id)) throw bad("Invalid ID");
  return new mongoose.Types.ObjectId(id);
};
const slugify = (value) => String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const roleName = (user) => String(user?.roleName || user?.role?.slug || user?.role || "").toLowerCase();
const userId = getUserId;
const parentId = (parent) => parent._id || parent.id;

function needsRestaurantScope(role) {
  return ["manager", "staff"].includes(role);
}

async function ensureMembershipInput(input) {
  let ids;
  try {
    ids = validateBrandMembershipScope(input);
  } catch (error) {
    throw bad(error.message);
  }
  try {
    return await ensureBrandRestaurants(input.brandId, ids);
  } catch (error) {
    throw bad(error.message);
  }
}

async function ensureSingleActiveManager({ brandId, role, restaurantIds, status = "active", excludeId }) {
  if (role !== "manager" || status !== "active") return;
  const [restaurantId] = restaurantIds || [];
  const existing = await BrandMembership.findOne({
    brandId: oid(brandId),
    role: "manager",
    status: "active",
    restaurantIds: oid(restaurantId),
    ...(excludeId ? { _id: { $ne: oid(excludeId) } } : {}),
  }).select("_id").lean();
  if (existing) throw bad("Nhà hàng này đã có quản lý. Vui lòng đổi quản lý hiện tại trước.");
}

async function assertCanWriteMembership(actor, membership, nextRole) {
  if (isSystemAdmin(actor) || await isBrandOwner(actor, membership.brandId)) return;
  if (membership.role === "owner" || nextRole === "owner") {
    throw forbidden("Only brand owner can change owner membership");
  }
}

async function ownerRole() {
  return Role.findOne({ $or: [{ slug: "manager" }, { name: /^manager$/i }] });
}

const publicUser = async (id) => {
  const user = await User.findById(id).populate("role").lean({ virtuals: true });
  return sanitizeUserForClient({ ...user, roleName: roleName(user) });
};

async function restaurantsForBrand(parent, { limit = 50 } = {}, ctx) {
  const brandId = parentId(parent);
  if (!brandId || !ctx?.user) return [];
  const maxLimit = Math.min(Number(limit) || 50, 100);

  if (isSystemAdmin(ctx.user) || await canManageBrand(ctx.user, brandId)) {
    return Restaurant.find({ brandId }).limit(maxLimit).lean();
  }

  const scopedFilter = await getScopedRestaurantFilter(ctx.user);
  return Restaurant.find({ $and: [{ brandId }, scopedFilter] }).limit(maxLimit).lean();
}

const Query = {
  myBrands: async (_, __, ctx) => {
    if (!ctx?.user) throw auth();
    if (isSystemAdmin(ctx.user)) {
      return Brand.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();
    }

    const memberships = await BrandMembership.find({
      userId: oid(userId(ctx.user)),
      status: "active",
    }).select("brandId").lean();
    const brandIds = memberships.map((membership) => membership.brandId);
    if (!brandIds.length) return [];
    return Brand.find({ _id: { $in: brandIds }, deletedAt: null }).sort({ createdAt: -1 }).lean();
  },

  brand: async (_, { id }, ctx) =>
    ctx?.user && await canReadBrand(ctx.user, id) ? Brand.findById(id).lean() : null,

  brands: async (_, { limit = 50, cursor, status, search }, ctx) => {
    if (!ctx?.user) throw auth();
    const filter = {
      ...(status ? { status } : {}),
      ...(cursor ? { _id: { $gt: oid(cursor) } } : {}),
    };
    if (search) filter.name = { $regex: String(search).trim(), $options: "i" };

    if (!isSystemAdmin(ctx.user)) {
      const memberships = await BrandMembership.find({
        userId: oid(userId(ctx.user)),
        status: "active",
      }).select("brandId").lean();
      filter._id = {
        ...(filter._id || {}),
        $in: memberships.map((membership) => membership.brandId),
      };
    }

    return Brand.find(filter).sort({ _id: 1 }).limit(Math.min(Number(limit) || 50, 100)).lean();
  },

  brandMembers: async (_, { brandId }, ctx) => {
    if (!ctx?.user || !await canManageBrand(ctx.user, brandId)) throw forbidden();
    return BrandMembership.find({ brandId: oid(brandId) }).lean();
  },

  myBrandMemberships: async (_, __, ctx) => {
    if (!ctx?.user) throw auth();
    return BrandMembership.find({
      userId: oid(userId(ctx.user)),
      status: "active",
    }).lean();
  },
};

const Mutation = {
  registerBusinessOwner: async (_, { input }, ctx) => {
    if (!input?.email || !input?.password || !input?.brandName) {
      throw bad("email, password and brandName are required");
    }

    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const normalizedEmail = String(input.email).trim().toLowerCase();
        if (await User.findOne({ email: normalizedEmail }).session(session)) {
          throw bad("Email already exists");
        }

        const role = await ownerRole();
        if (!role) throw bad("Manager role not found");

        const user = new User({
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          role: role._id,
          userType: "MANAGER",
          status: "active",
        });
        await user.setPassword(input.password);
        await user.save({ session });

        const [brand] = await Brand.create([{
          name: input.brandName,
          slug: slugify(input.brandSlug || input.brandName),
          ownerId: user._id,
          businessName: input.businessName,
          businessTaxCode: input.businessTaxCode,
          businessEmail: input.businessEmail,
          businessPhone: input.businessPhone,
          address: input.firstRestaurantAddress,
          createdBy: user._id,
        }], { session });

        await BrandMembership.create([{
          brandId: brand._id,
          userId: user._id,
          role: "owner",
          createdBy: user._id,
        }], { session });

        const [restaurant] = input.createFirstRestaurant === false
          ? [null]
          : await Restaurant.create([{
              name: input.firstRestaurantName || input.brandName,
              address: input.firstRestaurantAddress,
              brandId: brand._id,
            }], { session });

        result = { userId: user._id, brand, restaurant };
      });
    } finally {
      await session.endSession();
    }

    const user = await publicUser(result.userId);
    const token = signAccessToken({ ...user, _id: result.userId });
    if (ctx?.reply) {
      await issueRefreshToken({
        userId: result.userId,
        reply: ctx.reply,
        userAgent: ctx?.request?.headers?.["user-agent"],
        ip: ctx?.request?.ip,
      });
    }
    return {
      user,
      brand: result.brand,
      restaurant: result.restaurant,
      accessToken: token,
      refreshToken: null,
    };
  },

  createBrand: async (_, { input }, ctx) => {
    if (!ctx?.user) throw auth();
    const uid = oid(userId(ctx.user));
    const brand = await Brand.create({
      ...input,
      slug: slugify(input.slug || input.name),
      ownerId: uid,
      createdBy: uid,
    });
    await BrandMembership.findOneAndUpdate(
      { brandId: brand._id, userId: uid },
      {
        $set: { role: "owner", status: "active", updatedBy: uid },
        $setOnInsert: { createdBy: uid },
      },
      { upsert: true },
    );
    return brand;
  },

  updateBrand: async (_, { id, input }, ctx) => {
    if (!ctx?.user || !await canManageBrand(ctx.user, id)) throw forbidden();
    const patch = {
      ...input,
      ...(input.slug ? { slug: slugify(input.slug) } : {}),
      updatedBy: oid(userId(ctx.user)),
    };
    return Brand.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean();
  },

  archiveBrand: async (_, { id }, ctx) => {
    if (!ctx?.user || !await canManageBrand(ctx.user, id)) throw forbidden();
    await Brand.updateOne(
      { _id: oid(id) },
      {
        $set: {
          status: "inactive",
          deletedAt: new Date(),
          deletedBy: oid(userId(ctx.user)),
        },
      },
    );
    return true;
  },

  addBrandMember: async (_, { input }, ctx) => {
    if (!ctx?.user || !await canManageBrand(ctx.user, input.brandId)) throw forbidden();
    if (input.role === "owner") throw forbidden("Use the owner transfer flow to assign Brand ownership");
    if (!await User.exists({ _id: oid(input.userId) })) throw bad("User not found");

    const restaurants = await ensureMembershipInput(input);
    await ensureSingleActiveManager({
      brandId: input.brandId,
      role: input.role,
      restaurantIds: restaurants,
    });

    return BrandMembership.findOneAndUpdate(
      { brandId: oid(input.brandId), userId: oid(input.userId) },
      {
        $set: {
          role: input.role,
          restaurantIds: restaurants,
          status: "active",
          updatedBy: oid(userId(ctx.user)),
        },
        $setOnInsert: {
          createdBy: oid(userId(ctx.user)),
          invitedBy: oid(userId(ctx.user)),
        },
      },
      { new: true, upsert: true },
    ).lean();
  },

  updateBrandMember: async (_, { input }, ctx) => {
    const membership = await BrandMembership.findById(input.id);
    if (!membership) throw bad("Membership not found");
    if (!ctx?.user || !await canManageBrand(ctx.user, membership.brandId)) throw forbidden();

    await assertCanWriteMembership(ctx.user, membership, input.role);
    if (
      membership.role === "owner" &&
      ((input.role && input.role !== "owner") || input.status === "inactive") &&
      await BrandMembership.countDocuments({
        brandId: membership.brandId,
        role: "owner",
        status: "active",
      }) <= 1
    ) {
      throw bad("Cannot remove the last owner");
    }

    const nextRole = input.role || membership.role;
    const nextStatus = input.status || membership.status;
    const restaurants = ["owner", "admin"].includes(nextRole)
      ? []
      : input.restaurantIds || needsRestaurantScope(nextRole)
        ? await ensureMembershipInput({
            ...input,
            brandId: membership.brandId,
            role: nextRole,
            restaurantIds: input.restaurantIds ?? membership.restaurantIds,
          })
        : membership.restaurantIds;

    await ensureSingleActiveManager({
      brandId: membership.brandId,
      role: nextRole,
      restaurantIds: restaurants,
      status: nextStatus,
      excludeId: membership._id,
    });

    membership.restaurantIds = restaurants;
    if (input.role) membership.role = input.role;
    if (input.status) membership.status = input.status;
    membership.updatedBy = oid(userId(ctx.user));
    await membership.save();
    return membership.toObject();
  },

  removeBrandMember: async (_, { id }, ctx) => {
    const membership = await BrandMembership.findById(id);
    if (!membership) throw bad("Membership not found");
    if (!ctx?.user || !await canManageBrand(ctx.user, membership.brandId)) throw forbidden();

    await assertCanWriteMembership(ctx.user, membership);
    if (
      membership.role === "owner" &&
      await BrandMembership.countDocuments({
        brandId: membership.brandId,
        role: "owner",
        status: "active",
      }) <= 1
    ) {
      throw bad("Cannot remove the last owner");
    }

    membership.status = "inactive";
    await membership.save();
    return true;
  },
};

export default {
  Query,
  Mutation,
  Brand: {
    id: (parent) => parent.id ?? String(parent._id),
    owner: (parent) => User.findById(parent.ownerId).lean(),
    restaurantCount: (parent) => Restaurant.countDocuments({ brandId: parentId(parent) }),
    restaurants: restaurantsForBrand,
  },
  BrandMembership: {
    id: (parent) => parent.id ?? String(parent._id),
    brand: (parent) => Brand.findById(parent.brandId).lean(),
    user: (parent) => User.findById(parent.userId).lean(),
    restaurants: (parent) => Restaurant.find({ _id: { $in: parent.restaurantIds || [] } }).lean(),
  },
};
