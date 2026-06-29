import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Brand, BrandMembership, Restaurant, User, Role } from "../../../models/index.js";
import { signAccessToken, issueRefreshToken } from "../../../src/security/authTokens.js";
import { sanitizeUserForClient } from "../../../src/security/sanitizeUserForClient.js";

const bad = (m) => new GraphQLError(m, { extensions: { code: "BAD_USER_INPUT" } });
const forbidden = (m = "Forbidden") => new GraphQLError(m, { extensions: { code: "FORBIDDEN" } });
const auth = () => new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
const oid = (id) => { if (!mongoose.isValidObjectId(id)) throw bad("Invalid ID"); return new mongoose.Types.ObjectId(id); };
const slugify = (v) => String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const roleName = (u) => String(u?.roleName || u?.role?.slug || u?.role || "").toLowerCase();
export const isSystemAdmin = (user) => String(user?.userType || "").toUpperCase() === "ADMIN" || roleName(user) === "admin";
const userId = (u) => String(u?.id || u?._id || "");
const activeMembership = (user, brandId) => BrandMembership.findOne({ userId: oid(userId(user)), brandId: oid(brandId), status: "active" }).lean();
export const isBrandOwner = async (user, brandId) => isSystemAdmin(user) || !!await Brand.findOne({ _id: oid(brandId), ownerId: oid(userId(user)), status: { $ne: "inactive" } }).lean() || (await activeMembership(user, brandId))?.role === "owner";
export const isBrandAdmin = async (user, brandId) => isSystemAdmin(user) || ["owner", "admin"].includes((await activeMembership(user, brandId))?.role);
export const canManageBrand = isBrandAdmin;
export const canReadBrand = async (user, brandId) => isSystemAdmin(user) || !!await Brand.findOne({ _id: oid(brandId), ownerId: oid(userId(user)) }).lean() || !!await activeMembership(user, brandId);
export const canManageBrandRestaurants = canManageBrand;
export const isActiveBrandOperator = async (candidateUserId, brandId) => !!await BrandMembership.exists({ userId: oid(candidateUserId), brandId: oid(brandId), status: "active", role: { $in: ["owner", "admin", "manager"] } });
const userRestaurantIds = (user) => [user?.restaurantForStaff, ...(user?.refRestaurants || [])].filter(Boolean).map(oid);
export async function getScopedRestaurantFilter(user) {
  if (!user) return { _id: { $in: [] } };
  if (isSystemAdmin(user)) return {};
  const uid = oid(userId(user));
  const memberships = await BrandMembership.find({ userId: uid, status: "active" }).lean();
  const brandIds = memberships.filter((m) => ["owner", "admin"].includes(m.role)).map((m) => m.brandId);
  const explicit = memberships.flatMap((m) => m.restaurantIds || []);
  const direct = userRestaurantIds(user);
  const ors = [
    ...(brandIds.length ? [{ brandId: { $in: brandIds } }] : []),
    ...(explicit.length ? [{ _id: { $in: explicit } }] : []),
    ...(direct.length ? [{ _id: { $in: direct } }] : []),
  ];
  return ors.length ? { $or: ors } : { _id: { $in: [] } };
}
export async function canAccessRestaurant(user, restaurantId) {
  if (isSystemAdmin(user)) return true;
  return !!await Restaurant.exists({ _id: oid(restaurantId), ...(await getScopedRestaurantFilter(user)) });
}
async function ensureBrandRestaurants(brandId, restaurantIds = []) {
  const ids = [...new Set((restaurantIds || []).filter(Boolean).map(String))];
  if (!ids.length) return [];
  const count = await Restaurant.countDocuments({ _id: { $in: ids.map(oid) }, brandId: oid(brandId) });
  if (count !== ids.length) throw bad("restaurantIds must belong to the brand");
  return ids.map(oid);
}
function needsRestaurantScope(role) { return ["manager", "staff"].includes(role); }
async function ensureMembershipInput(input) {
  if (needsRestaurantScope(input.role) && !(input.restaurantIds || []).filter(Boolean).length) throw bad("restaurantIds are required for manager/staff");
  return ensureBrandRestaurants(input.brandId, input.restaurantIds);
}
async function assertCanWriteMembership(actor, membership, nextRole) {
  if (isSystemAdmin(actor) || await isBrandOwner(actor, membership.brandId)) return;
  if (membership.role === "owner" || nextRole === "owner") throw forbidden("Only brand owner can change owner membership");
}
async function ownerRole() { return await Role.findOne({ $or: [{ slug: "owner" }, { name: /^owner$/i }, { slug: "manager" }, { name: /^manager$/i }] }); }
const publicUser = async (id) => { const u = await User.findById(id).populate("role").lean({ virtuals: true }); return sanitizeUserForClient({ ...u, roleName: roleName(u) }); };

const Query = {
  myBrands: async (_, __, ctx) => {
    if (!ctx?.user) throw auth();
    const uid = oid(userId(ctx.user));
    const memberships = await BrandMembership.find({ userId: uid, status: "active" }).select("brandId").lean();
    const ids = memberships.map((m) => m.brandId);
    return Brand.find({ $or: [{ ownerId: uid }, { _id: { $in: ids } }], deletedAt: null }).sort({ createdAt: -1 }).lean();
  },
  brand: async (_, { id }, ctx) => (ctx?.user && await canReadBrand(ctx.user, id)) ? Brand.findById(id).lean() : null,
  brands: async (_, { limit = 50, cursor, status, search }, ctx) => {
    if (!ctx?.user) throw auth();
    const f = { ...(status ? { status } : {}), ...(cursor ? { _id: { $gt: oid(cursor) } } : {}) };
    if (search) f.name = { $regex: String(search).trim(), $options: "i" };
    if (!isSystemAdmin(ctx.user)) {
      const uid = oid(userId(ctx.user));
      const memberships = await BrandMembership.find({ userId: uid, status: "active" }).select("brandId").lean();
      const mine = await Brand.find({ $or: [{ ownerId: uid }, { _id: { $in: memberships.map((m) => m.brandId) } }] }).select("_id").lean();
      f._id = { ...(f._id || {}), $in: mine.map((b) => b._id) };
    }
    return Brand.find(f).sort({ _id: 1 }).limit(Math.min(Number(limit) || 50, 100)).lean();
  },
  brandMembers: async (_, { brandId }, ctx) => { if (!ctx?.user || !await canManageBrand(ctx.user, brandId)) throw forbidden(); return BrandMembership.find({ brandId: oid(brandId) }).lean(); },
  myBrandMemberships: async (_, __, ctx) => { if (!ctx?.user) throw auth(); return BrandMembership.find({ userId: oid(userId(ctx.user)), status: "active" }).lean(); },
};

const Mutation = {
  registerBusinessOwner: async (_, { input }, ctx) => {
    if (!input?.email || !input?.password || !input?.brandName) throw bad("email, password and brandName are required");
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        if (await User.findOne({ email: String(input.email).trim().toLowerCase() }).session(session)) throw bad("Email already exists");
        const role = await ownerRole(); if (!role) throw bad("Manager role not found");
        const user = new User({ fullName: input.fullName, email: input.email, phone: input.phone, role: role._id, userType: "MANAGER", status: "active" });
        await user.setPassword(input.password); await user.save({ session });
        const [brand] = await Brand.create([{ name: input.brandName, slug: slugify(input.brandSlug || input.brandName), ownerId: user._id, businessName: input.businessName, businessTaxCode: input.businessTaxCode, businessEmail: input.businessEmail, businessPhone: input.businessPhone, address: input.firstRestaurantAddress, createdBy: user._id }], { session });
        await BrandMembership.create([{ brandId: brand._id, userId: user._id, role: "owner", createdBy: user._id }], { session });
        const [restaurant] = input.createFirstRestaurant === false ? [null] : await Restaurant.create([{ name: input.firstRestaurantName || input.brandName, address: input.firstRestaurantAddress, brandId: brand._id, managerId: user._id }], { session });
        result = { userId: user._id, brand, restaurant };
      });
    } finally {
      await session.endSession();
    }
    const u = await publicUser(result.userId); const token = signAccessToken({ ...u, _id: result.userId });
    if (ctx?.reply) await issueRefreshToken({ userId: result.userId, reply: ctx.reply, userAgent: ctx?.request?.headers?.["user-agent"], ip: ctx?.request?.ip });
    return { user: u, brand: result.brand, restaurant: result.restaurant, accessToken: token, refreshToken: null };
  },
  createBrand: async (_, { input }, ctx) => { if (!ctx?.user) throw auth(); const uid = oid(userId(ctx.user)); const brand = await Brand.create({ ...input, slug: slugify(input.slug || input.name), ownerId: uid, createdBy: uid }); await BrandMembership.findOneAndUpdate({ brandId: brand._id, userId: uid }, { $set: { role: "owner", status: "active", updatedBy: uid }, $setOnInsert: { createdBy: uid } }, { upsert: true }); return brand; },
  updateBrand: async (_, { id, input }, ctx) => { if (!ctx?.user || !await canManageBrand(ctx.user, id)) throw forbidden(); const patch = { ...input, ...(input.slug ? { slug: slugify(input.slug) } : {}), updatedBy: oid(userId(ctx.user)) }; return Brand.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean(); },
  archiveBrand: async (_, { id }, ctx) => { if (!ctx?.user || !await canManageBrand(ctx.user, id)) throw forbidden(); await Brand.updateOne({ _id: oid(id) }, { $set: { status: "inactive", deletedAt: new Date(), deletedBy: oid(userId(ctx.user)) } }); return true; },
  addBrandMember: async (_, { input }, ctx) => { if (!ctx?.user || !await canManageBrand(ctx.user, input.brandId)) throw forbidden(); if (input.role === "owner" && !await isBrandOwner(ctx.user, input.brandId)) throw forbidden("Only brand owner can add owner"); if (!await User.exists({ _id: oid(input.userId) })) throw bad("User not found"); const restaurants = await ensureMembershipInput(input); return BrandMembership.findOneAndUpdate({ brandId: oid(input.brandId), userId: oid(input.userId) }, { $set: { role: input.role, restaurantIds: restaurants, status: "active", updatedBy: oid(userId(ctx.user)) }, $setOnInsert: { createdBy: oid(userId(ctx.user)), invitedBy: oid(userId(ctx.user)) } }, { new: true, upsert: true }).lean(); },
  updateBrandMember: async (_, { input }, ctx) => { const m = await BrandMembership.findById(input.id); if (!m) throw bad("Membership not found"); if (!ctx?.user || !await canManageBrand(ctx.user, m.brandId)) throw forbidden(); await assertCanWriteMembership(ctx.user, m, input.role); if (m.role === "owner" && ((input.role && input.role !== "owner") || input.status === "inactive") && await BrandMembership.countDocuments({ brandId: m.brandId, role: "owner", status: "active" }) <= 1) throw bad("Cannot remove the last owner"); if (input.restaurantIds || needsRestaurantScope(input.role || m.role)) m.restaurantIds = await ensureMembershipInput({ ...input, brandId: m.brandId, role: input.role || m.role }); if (input.role) m.role = input.role; if (input.status) m.status = input.status; m.updatedBy = oid(userId(ctx.user)); await m.save(); return m.toObject(); },
  removeBrandMember: async (_, { id }, ctx) => { const m = await BrandMembership.findById(id); if (!m) throw bad("Membership not found"); if (!ctx?.user || !await canManageBrand(ctx.user, m.brandId)) throw forbidden(); await assertCanWriteMembership(ctx.user, m); if (m.role === "owner" && await BrandMembership.countDocuments({ brandId: m.brandId, role: "owner", status: "active" }) <= 1) throw bad("Cannot remove the last owner"); m.status = "inactive"; await m.save(); return true; },
};

export default { Query, Mutation, Brand: { id: (p) => p.id ?? String(p._id), owner: (p) => User.findById(p.ownerId).lean(), restaurantCount: (p) => Restaurant.countDocuments({ brandId: p._id || p.id }), restaurants: async (p, { limit = 50 }, ctx) => Restaurant.find({ brandId: p._id || p.id, ...(ctx?.user && !isSystemAdmin(ctx.user) ? await getScopedRestaurantFilter(ctx.user) : {}) }).limit(Math.min(limit, 100)).lean() }, BrandMembership: { id: (p) => p.id ?? String(p._id), brand: (p) => Brand.findById(p.brandId).lean(), user: (p) => User.findById(p.userId).lean(), restaurants: (p) => Restaurant.find({ _id: { $in: p.restaurantIds || [] } }).lean() } };
