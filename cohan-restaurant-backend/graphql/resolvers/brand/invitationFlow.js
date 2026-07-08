import { createHash, randomBytes } from "node:crypto";
import process from "node:process";
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Brand, BrandMembership, Restaurant, Role, User } from "../../../models/index.js";
import { mailer } from "../../../lib/mailer.js";
import { validatePasswordStrong } from "../../../lib/passwordPolicy.js";
import { sanitizeUserForClient } from "../../../src/security/sanitizeUserForClient.js";
import { issueVerificationForUser } from "../../../src/services/auth/accountVerification.service.js";
import {
  canManageBrand,
  ensureBrandRestaurants,
  getUserId,
  isBrandOwner,
  isSystemAdmin,
} from "../../../src/services/auth/restaurantScope.service.js";
import {
  assertBrandMembershipAccountCompatibility,
  promoteCustomerAccountToManager,
} from "./memberRoleConsistency.js";
import baseBrandResolvers from "./index.js";

const INVITE_PREFIX = "invite:";
const ALLOWED_INVITE_ROLES = new Set(["admin", "manager"]);
const bad = (message) => new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
const forbidden = (message = "Forbidden") => new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
const auth = () => new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
const notFound = (message) => new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });

const oid = (id) => {
  if (!mongoose.isValidObjectId(id)) throw bad("Invalid ID");
  return new mongoose.Types.ObjectId(id);
};
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
const slugify = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
const roleName = (user) => String(
  user?.roleName || user?.role?.slug || user?.role?.name || user?.role || "",
).toLowerCase();

export const isSyntheticInviteId = (value) => String(value || "").startsWith(INVITE_PREFIX);
export const emailFromSyntheticInviteId = (value) => isSyntheticInviteId(value)
  ? normalizeEmail(String(value).slice(INVITE_PREFIX.length))
  : "";

function inviteTtlMs() {
  return Math.max(1, Number(process.env.BRAND_INVITATION_TOKEN_TTL_HOURS || 72)) * 3600 * 1000;
}

function appPublicUrl() {
  return String(process.env.APP_PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "");
}

export function hashBrandInvitationToken(token) {
  const pepper = process.env.BRAND_INVITATION_TOKEN_PEPPER
    || process.env.VERIFICATION_TOKEN_PEPPER
    || "";
  return createHash("sha256").update(`${token}${pepper}`).digest("hex");
}

function generateInvitationToken() {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashBrandInvitationToken(token) };
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInvitationMail({ user, brand, membership, token, requiresPassword }) {
  const link = `${appPublicUrl()}/verify-email/confirm?inviteToken=${encodeURIComponent(token)}&new=${requiresPassword ? "1" : "0"}`;
  const roleLabel = membership.role === "admin" ? "Quản trị chuỗi" : "Quản lý chi nhánh";
  const ttlHours = Math.round(inviteTtlMs() / 3600000);
  const name = user.fullName || user.username || user.email || "bạn";
  const text = [
    `Xin chào ${name},`,
    `Bạn được mời tham gia ${brand.name} với vai trò ${roleLabel}.`,
    requiresPassword
      ? "Mở liên kết để xác nhận email, đặt mật khẩu và kích hoạt tài khoản."
      : "Mở liên kết để xác nhận tham gia chuỗi.",
    link,
    `Liên kết hết hạn sau ${ttlHours} giờ.`,
  ].join("\n\n");

  return {
    to: user.email,
    subject: `Lời mời tham gia ${brand.name} trên Cohan`,
    text,
    html: `<!doctype html><html lang="vi"><body style="margin:0;padding:28px;background:#fff7ed;font-family:Arial,sans-serif;color:#292524"><div style="max-width:620px;margin:auto;padding:30px;border:1px solid #fed7aa;border-radius:24px;background:#fff"><p style="margin:0 0 8px;color:#ea580c;font-weight:700">COHAN · LỜI MỜI THÀNH VIÊN</p><h1 style="margin:0 0 16px;font-size:26px">${escapeHtml(brand.name)}</h1><p>Xin chào <strong>${escapeHtml(name)}</strong>,</p><p>Bạn được mời tham gia chuỗi với vai trò <strong>${escapeHtml(roleLabel)}</strong>.</p><p>${requiresPassword ? "Xác nhận email và đặt mật khẩu để kích hoạt tài khoản." : "Xác nhận để kích hoạt quyền trong chuỗi."}</p><p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#ff6600;color:#fff;text-decoration:none;font-weight:700">Xác nhận lời mời</a></p><p style="font-size:13px;color:#78716c">Liên kết hết hạn sau ${ttlHours} giờ và chỉ sử dụng được một lần.</p></div></body></html>`,
  };
}

async function sendInvitation({ user, brand, membership, token, requiresPassword }) {
  const result = await mailer.sendMail(
    buildInvitationMail({ user, brand, membership, token, requiresPassword }),
  );
  if (result?.skipped) {
    console.warn(`[BrandInvitation] Email provider is not configured for ${user.email}.`);
  }
  return result;
}

async function managerRole(session = null) {
  const query = Role.findOne({ $or: [{ slug: "manager" }, { name: /^manager$/i }] });
  if (session) query.session(session);
  return query;
}

async function publicUser(id) {
  const user = await User.findById(id).populate("role").lean({ virtuals: true });
  if (!user) throw notFound("User not found");
  return sanitizeUserForClient({ ...user, roleName: roleName(user) });
}

async function assertInvitePermission(ctx, brandId, targetRole) {
  if (!ctx?.user) throw auth();
  if (!ALLOWED_INVITE_ROLES.has(targetRole)) {
    throw bad("Chỉ hỗ trợ mời Quản trị chuỗi hoặc Quản lý chi nhánh.");
  }
  if (!await canManageBrand(ctx.user, brandId)) throw forbidden();
  if (
    targetRole === "admin"
    && !isSystemAdmin(ctx.user)
    && !await isBrandOwner(ctx.user, brandId)
  ) {
    throw forbidden("Chỉ Chủ chuỗi mới có thể mời Quản trị chuỗi.");
  }
}

async function normalizeInviteScope({ brandId, role, restaurantIds }) {
  if (role === "admin") return [];
  const ids = [...new Set((restaurantIds || []).filter(Boolean).map(String))];
  if (ids.length !== 1) {
    throw bad("Quản lý chi nhánh phải phụ trách đúng một chi nhánh.");
  }
  try {
    return await ensureBrandRestaurants(brandId, ids);
  } catch (error) {
    throw bad(error.message);
  }
}

async function assertNoActiveManager({
  brandId,
  role,
  restaurantIds,
  excludeId = null,
  session = null,
}) {
  if (role !== "manager") return;
  const query = BrandMembership.findOne({
    brandId: oid(brandId),
    role: "manager",
    status: "active",
    restaurantIds: restaurantIds[0],
    ...(excludeId ? { _id: { $ne: oid(excludeId) } } : {}),
  }).select("_id");
  if (session) query.session(session);
  if (await query.lean()) {
    throw bad("Nhà hàng này đã có quản lý. Vui lòng đổi quản lý hiện tại trước.");
  }
}

async function resolveInviteUser(input, session) {
  const syntheticEmail = emailFromSyntheticInviteId(input.userId);
  if (!syntheticEmail) {
    if (!mongoose.isValidObjectId(input.userId)) {
      throw bad("Tài khoản cần mời không hợp lệ.");
    }
    const existing = await User.findById(input.userId).session(session);
    if (!existing) throw notFound("Không tìm thấy tài khoản cần mời.");
    if (!["active", "pending"].includes(existing.status)) {
      throw bad("Tài khoản đang bị khóa hoặc tạm ngưng nên không thể nhận lời mời.");
    }
    if (!existing.email) {
      throw bad("Tài khoản cần có email trước khi được mời vào chuỗi.");
    }
    return { user: existing, created: false };
  }

  if (!isEmail(syntheticEmail)) throw bad("Email mời chưa đúng định dạng.");
  const existing = await User.findOne({ email: syntheticEmail, deletedAt: null }).session(session);
  if (existing) {
    if (!["active", "pending"].includes(existing.status)) {
      throw bad("Tài khoản đang bị khóa hoặc tạm ngưng nên không thể nhận lời mời.");
    }
    return { user: existing, created: false };
  }

  const role = await managerRole(session);
  if (!role) throw bad("Manager role not found");
  const localPart = syntheticEmail.split("@")[0].replace(/[._-]+/g, " ").trim();
  const user = new User({
    fullName: localPart || syntheticEmail,
    email: syntheticEmail,
    role: role._id,
    userType: "MANAGER",
    status: "pending",
    provider: "local",
    emailVerified: false,
    forcePasswordChange: true,
  });
  await user.save({ session });
  return { user, created: true };
}

async function createInvitation({ input, ctx }) {
  await assertInvitePermission(ctx, input.brandId, input.role);
  const restaurantIds = await normalizeInviteScope(input);
  const actorId = oid(getUserId(ctx.user));
  const { token, hash } = generateInvitationToken();
  const session = await mongoose.startSession();
  let invitation;

  try {
    await session.withTransaction(async () => {
      const brand = await Brand.findById(input.brandId)
        .select("_id name")
        .session(session)
        .lean();
      if (!brand) throw notFound("Không tìm thấy chuỗi nhà hàng.");

      await assertNoActiveManager({
        brandId: input.brandId,
        role: input.role,
        restaurantIds,
        session,
      });

      const { user, created } = await resolveInviteUser(input, session);
      await assertBrandMembershipAccountCompatibility({
        userId: user._id,
        membershipRole: input.role,
        session,
        allowCustomerPromotion: true,
      });

      const existingMembership = await BrandMembership.findOne({
        brandId: oid(input.brandId),
        userId: user._id,
      }).select("_id role status").session(session).lean();
      if (existingMembership?.role === "owner") {
        throw forbidden("Không thể thay đổi Chủ chuỗi bằng luồng lời mời.");
      }

      const membership = await BrandMembership.findOneAndUpdate(
        { brandId: oid(input.brandId), userId: user._id },
        {
          $set: {
            role: input.role,
            restaurantIds,
            status: "invited",
            inviteTokenHash: hash,
            inviteTokenExp: new Date(Date.now() + inviteTtlMs()),
            invitedAt: new Date(),
            acceptedAt: null,
            invitedBy: actorId,
            updatedBy: actorId,
          },
          $setOnInsert: { createdBy: actorId },
        },
        { new: true, upsert: true, session },
      );

      invitation = {
        membershipId: membership._id,
        userId: user._id,
        brandId: brand._id,
        created,
      };
    });
  } finally {
    await session.endSession();
  }

  const [membership, user, brand] = await Promise.all([
    BrandMembership.findById(invitation.membershipId),
    User.findById(invitation.userId),
    Brand.findById(invitation.brandId).select("_id name").lean(),
  ]);
  if (!membership || !user || !brand) {
    throw notFound("Không thể tải lại lời mời vừa tạo.");
  }

  await sendInvitation({
    user,
    brand,
    membership,
    token,
    requiresPassword: invitation.created || user.forcePasswordChange || !user.passwordHash,
  });
  return membership.toObject();
}

const Query = {
  brandMemberCandidates: async (root, args, ctx, info) => {
    const candidates = await baseBrandResolvers.Query.brandMemberCandidates(root, args, ctx, info);
    const email = normalizeEmail(args.search);
    if (!isEmail(email)) return candidates;

    const exactUser = await User.findOne({ email, deletedAt: null })
      .select("_id fullName username email userType status")
      .lean();
    if (exactUser) {
      const alreadyMember = await BrandMembership.exists({
        brandId: oid(args.brandId),
        userId: exactUser._id,
      });
      if (
        alreadyMember
        || candidates.some((candidate) => String(candidate.id) === String(exactUser._id))
      ) {
        return candidates;
      }
      return [...candidates, {
        id: String(exactUser._id),
        fullName: exactUser.fullName || null,
        username: exactUser.username || null,
        email: exactUser.email || null,
        userType: exactUser.userType || null,
        status: exactUser.status || null,
      }];
    }

    return [...candidates, {
      id: `${INVITE_PREFIX}${email}`,
      fullName: "Mời tài khoản mới",
      username: null,
      email,
      userType: "MANAGER",
      status: "pending",
    }];
  },
};

const Mutation = {
  registerBusinessOwner: async (_, { input }, ctx) => {
    if (!input?.fullName?.trim() || !input?.email || !input?.password || !input?.brandName?.trim()) {
      throw bad("fullName, email, password and brandName are required");
    }
    if (!isEmail(input.email)) throw bad("Email chưa đúng định dạng.");
    const passwordPolicy = validatePasswordStrong(input.password);
    if (!passwordPolicy.ok) {
      throw bad(`Weak password: ${passwordPolicy.reason || "Password does not meet requirements"}`);
    }

    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const normalizedEmail = normalizeEmail(input.email);
        if (await User.findOne({ email: normalizedEmail }).session(session)) {
          throw bad("Email already exists");
        }

        const role = await managerRole(session);
        if (!role) throw bad("Manager role not found");

        const user = new User({
          fullName: input.fullName.trim(),
          email: normalizedEmail,
          phone: input.phone?.trim() || undefined,
          role: role._id,
          userType: "MANAGER",
          status: "pending",
          emailVerified: false,
        });
        await user.setPassword(input.password);
        await user.save({ session });

        const [brand] = await Brand.create([{
          name: input.brandName.trim(),
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
          status: "active",
          createdBy: user._id,
        }], { session });

        const [restaurant] = input.createFirstRestaurant === false
          ? [null]
          : await Restaurant.create([{
              name: input.firstRestaurantName?.trim() || input.brandName.trim(),
              address: input.firstRestaurantAddress,
              brandId: brand._id,
            }], { session });

        result = { userId: user._id, brand, restaurant };
      });
    } finally {
      await session.endSession();
    }

    const userDocument = await User.findById(result.userId);
    try {
      await issueVerificationForUser({
        user: userDocument,
        channels: "EMAIL",
        requestedBy: userDocument,
        reason: "business_owner_registration",
        ctx,
        force: true,
      });
    } catch (error) {
      console.error("Business owner verification dispatch failed:", error);
    }

    return {
      user: await publicUser(result.userId),
      brand: result.brand,
      restaurant: result.restaurant,
      accessToken: null,
      refreshToken: null,
    };
  },

  addBrandMember: async (root, { input }, ctx, info) => {
    if (input.role === "staff") {
      return baseBrandResolvers.Mutation.addBrandMember(root, { input }, ctx, info);
    }
    return createInvitation({ input, ctx });
  },

  resendBrandInvitation: async (_, { id }, ctx) => {
    const membership = await BrandMembership.findById(id);
    if (!membership) throw notFound("Không tìm thấy lời mời.");
    const cancelledInvitation =
      membership.status === "inactive" &&
      membership.revokedFromStatus === "invited";
    if (membership.status !== "invited" && !cancelledInvitation) {
      throw bad("Lời mời này không còn ở trạng thái có thể gửi lại.");
    }
    await assertInvitePermission(ctx, membership.brandId, membership.role);

    const [user, brand] = await Promise.all([
      User.findById(membership.userId),
      Brand.findById(membership.brandId).select("_id name").lean(),
    ]);
    if (!user || !brand) {
      throw notFound("Không tìm thấy tài khoản hoặc chuỗi nhà hàng.");
    }
    if (!user.email) throw bad("Tài khoản được mời chưa có email.");

    const { token, hash } = generateInvitationToken();
    membership.status = "invited";
    membership.inviteTokenHash = hash;
    membership.inviteTokenExp = new Date(Date.now() + inviteTtlMs());
    membership.invitedAt = new Date();
    membership.invitedBy = oid(getUserId(ctx.user));
    membership.revokedAt = null;
    membership.revokedBy = null;
    membership.revokedReason = null;
    membership.revokedFromStatus = null;
    membership.updatedBy = oid(getUserId(ctx.user));
    await membership.save();

    await sendInvitation({
      user,
      brand,
      membership,
      token,
      requiresPassword: user.forcePasswordChange || !user.passwordHash,
    });
    return membership.toObject();
  },

  acceptBrandInvitation: async (_, { token, password }) => {
    if (!token) throw bad("Thiếu mã lời mời.");
    const session = await mongoose.startSession();
    let acceptedId;
    try {
      await session.withTransaction(async () => {
        const membership = await BrandMembership.findOne({
          inviteTokenHash: hashBrandInvitationToken(token),
          inviteTokenExp: { $gt: new Date() },
          status: "invited",
        }).session(session);
        if (!membership) {
          throw bad("Lời mời không hợp lệ, đã hết hạn hoặc đã được sử dụng.");
        }

        const user = await User.findById(membership.userId).populate("role").session(session);
        if (!user) throw notFound("Không tìm thấy tài khoản được mời.");
        if (!["active", "pending"].includes(user.status)) {
          throw forbidden("Tài khoản đang bị khóa hoặc tạm ngưng.");
        }

        const currentAccountRole = roleName(user);
        const promotesCustomer =
          user.userType === "CUSTOMER" && currentAccountRole === "customer";
        const isManagerAccount =
          user.userType === "MANAGER" && currentAccountRole === "manager";
        if (!promotesCustomer && !isManagerAccount) {
          throw bad(
            "Lời mời chỉ có thể được xác nhận bởi tài khoản Customer hoặc Manager hợp lệ.",
          );
        }

        if (membership.role === "manager") {
          await assertNoActiveManager({
            brandId: membership.brandId,
            role: membership.role,
            restaurantIds: membership.restaurantIds,
            excludeId: membership._id,
            session,
          });
        }

        const requiresPassword = user.forcePasswordChange || !user.passwordHash;
        if (requiresPassword) {
          const policy = validatePasswordStrong(password);
          if (!policy.ok) {
            throw bad(`Weak password: ${policy.reason || "Password does not meet requirements"}`);
          }
          await user.setPassword(password);
          user.forcePasswordChange = false;
        }

        const now = new Date();
        user.emailVerified = true;
        user.emailVerifiedAt = user.emailVerifiedAt || now;
        user.verifiedAt = user.verifiedAt || now;
        if (user.status === "pending") user.status = "active";
        await user.save({ session });

        if (promotesCustomer) {
          await promoteCustomerAccountToManager({ userId: user._id, session });
        }

        membership.status = "active";
        membership.acceptedAt = now;
        membership.inviteTokenHash = null;
        membership.inviteTokenExp = null;
        await membership.save({ session });
        acceptedId = membership._id;
      });
    } finally {
      await session.endSession();
    }

    const membership = await BrandMembership.findById(acceptedId).lean();
    if (!membership) {
      throw notFound("Không tìm thấy quyền thành viên sau khi xác nhận.");
    }
    return membership;
  },
};

export default { Query, Mutation };
