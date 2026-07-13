import { GraphQLError } from "graphql";
import fetch from "node-fetch";
import { Customer, Role, User } from "../../../models/index.js";
import AuthProviderLink from "../../../models/auth-provider-link.model.js";
import {
  issueRefreshToken,
  signAccessToken,
} from "../../../src/security/authTokens.js";
import { sanitizeUserForClient } from "../../../src/security/sanitizeUserForClient.js";
import { logAuthAuditEvent } from "../../../src/security/loginSecurity.js";

const bad = (message) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
const forbidden = (message) =>
  new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
const unavailable = (message) =>
  new GraphQLError(message, {
    extensions: { code: "SERVICE_UNAVAILABLE" },
  });

function facebookConfig() {
  return {
    appId: String(process.env.FACEBOOK_APP_ID || "").trim(),
    appSecret: String(process.env.FACEBOOK_APP_SECRET || "").trim(),
    apiVersion: String(
      process.env.FACEBOOK_GRAPH_API_VERSION || "v23.0",
    ).trim(),
  };
}

function requestIp(ctx) {
  return (
    ctx?.request?.ip ||
    ctx?.request?.headers?.["x-forwarded-for"] ||
    "unknown"
  );
}

async function readJson(response, fallbackMessage) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw unavailable(fallbackMessage);
  }

  if (!response.ok || payload?.error) {
    const errorMessage = payload?.error?.message || fallbackMessage;
    throw bad(errorMessage);
  }
  return payload;
}

async function verifyFacebookAccessToken(accessToken) {
  const { appId, appSecret, apiVersion } = facebookConfig();
  if (!appId || !appSecret) {
    throw unavailable(
      "Facebook Login chưa được cấu hình trên máy chủ.",
    );
  }

  const appAccessToken = `${appId}|${appSecret}`;
  const debugUrl = new URL(
    `https://graph.facebook.com/${apiVersion}/debug_token`,
  );
  debugUrl.searchParams.set("input_token", accessToken);
  debugUrl.searchParams.set("access_token", appAccessToken);

  let debugResponse;
  try {
    debugResponse = await fetch(debugUrl);
  } catch {
    throw unavailable("Không thể kết nối dịch vụ xác thực Facebook.");
  }

  const debugPayload = await readJson(
    debugResponse,
    "Không thể xác thực Facebook token.",
  );
  const debugData = debugPayload?.data || {};
  const expiresAtMs = Number(debugData.expires_at || 0) * 1000;

  if (
    debugData.is_valid !== true ||
    String(debugData.app_id || "") !== appId ||
    !debugData.user_id ||
    (expiresAtMs && expiresAtMs <= Date.now())
  ) {
    throw bad("Facebook token không hợp lệ hoặc đã hết hạn.");
  }

  const profileUrl = new URL(
    `https://graph.facebook.com/${apiVersion}/me`,
  );
  profileUrl.searchParams.set(
    "fields",
    "id,name,email,picture.type(large)",
  );
  profileUrl.searchParams.set("access_token", accessToken);

  let profileResponse;
  try {
    profileResponse = await fetch(profileUrl);
  } catch {
    throw unavailable("Không thể lấy thông tin tài khoản Facebook.");
  }

  const profile = await readJson(
    profileResponse,
    "Không thể lấy thông tin tài khoản Facebook.",
  );

  if (!profile?.id || String(profile.id) !== String(debugData.user_id)) {
    throw bad("Thông tin tài khoản Facebook không hợp lệ.");
  }

  return {
    facebookId: String(profile.id),
    email: profile.email
      ? String(profile.email).trim().toLowerCase()
      : null,
    fullName: String(profile.name || "Người dùng Facebook").trim(),
    avatarUrl: profile?.picture?.data?.url
      ? String(profile.picture.data.url)
      : null,
  };
}

async function defaultCustomerRole() {
  return Role.findOne({
    $or: [{ slug: "customer" }, { name: /^customer$/i }],
  })
    .select("_id")
    .lean();
}

async function buildAuthPayload(userId) {
  const userObj = await User.findById(userId)
    .populate("role")
    .lean({ virtuals: true });
  const roleName = String(
    userObj?.role?.slug || userObj?.role?.name || "customer",
  ).toLowerCase();
  const token = signAccessToken({ ...userObj, roleName });
  return {
    token,
    user: sanitizeUserForClient({ ...userObj, roleName }),
  };
}

async function findOrCreateFacebookUser(profile, ctx) {
  const now = new Date();
  let providerLink = await AuthProviderLink.findOne({
    provider: "facebook",
    providerUserId: profile.facebookId,
  });
  let user = providerLink
    ? await User.findById(providerLink.userId)
    : null;

  if (providerLink && !user) {
    await providerLink.deleteOne();
    providerLink = null;
  }

  if (!user && profile.email) {
    user = await User.findOne({ email: profile.email, deletedAt: null });
  }

  if (!user && !profile.email) {
    throw bad(
      "Facebook không cung cấp email. Vui lòng cấp quyền email hoặc đăng nhập bằng Google/tài khoản Cohan.",
    );
  }

  if (!user) {
    const role = await defaultCustomerRole();
    user = new Customer({
      fullName: profile.fullName,
      email: profile.email,
      provider: "facebook",
      status: "active",
      userType: "CUSTOMER",
      role: role?._id || undefined,
      avatarUrl: profile.avatarUrl || undefined,
      emailVerified: true,
      emailVerifiedAt: now,
      verifiedAt: now,
      customerType: "NEW",
      loyaltyPoints: 0,
      totalOrders: 0,
      totalSpending: 0,
    });
  } else {
    const status = String(user.status || "").toLowerCase();
    if (["blocked", "inactive"].includes(status) || user.deletedAt) {
      throw forbidden("Tài khoản hiện không thể đăng nhập.");
    }

    const otherFacebookLink = await AuthProviderLink.findOne({
      userId: user._id,
      provider: "facebook",
      providerUserId: { $ne: profile.facebookId },
    })
      .select("_id")
      .lean();
    if (otherFacebookLink) {
      throw forbidden(
        "Email này đã liên kết với một tài khoản Facebook khác.",
      );
    }

    user.fullName = user.fullName || profile.fullName;
    user.avatarUrl = user.avatarUrl || profile.avatarUrl || undefined;
    if (profile.email) {
      user.email = user.email || profile.email;
      user.emailVerified = true;
      user.emailVerifiedAt = user.emailVerifiedAt || now;
      user.verifiedAt = user.verifiedAt || now;
    }
    if (status === "pending") user.status = "active";
  }

  user.lastLoginAt = now;
  user.lastLoginIp = requestIp(ctx);
  await user.save();

  if (!providerLink) {
    try {
      providerLink = await AuthProviderLink.create({
        userId: user._id,
        provider: "facebook",
        providerUserId: profile.facebookId,
        meta: {
          email: profile.email,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          linkedAt: now,
        },
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      providerLink = await AuthProviderLink.findOne({
        provider: "facebook",
        providerUserId: profile.facebookId,
      });
      if (!providerLink || String(providerLink.userId) !== String(user._id)) {
        throw forbidden(
          "Tài khoản Facebook này đã liên kết với người dùng khác.",
        );
      }
    }
  } else {
    providerLink.userId = user._id;
    providerLink.meta = {
      ...(providerLink.meta || {}),
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      lastLoginAt: now,
    };
    await providerLink.save();
  }

  return user;
}

export async function loginWithFacebook(_, { accessToken }, ctx) {
  const rawAccessToken = String(accessToken || "").trim();
  if (!rawAccessToken) throw bad("Facebook access token là bắt buộc.");

  const profile = await verifyFacebookAccessToken(rawAccessToken);
  const user = await findOrCreateFacebookUser(profile, ctx);
  const payload = await buildAuthPayload(user._id);

  logAuthAuditEvent(ctx, "facebook_login_success", {
    ip: requestIp(ctx),
    identifierType: "facebook",
    userId: String(user._id),
    roleName: payload.user?.roleName || "",
  });

  if (ctx?.reply) {
    await issueRefreshToken({
      userId: user._id,
      reply: ctx.reply,
      userAgent: ctx?.request?.headers?.["user-agent"],
      ip: ctx?.request?.ip,
    });
  }

  return payload;
}
