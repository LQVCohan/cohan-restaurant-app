// src/graphql/resolvers/user/mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import process from "process";
import { Buffer } from "buffer";
import {
  User,
  Role,
  Customer,
  CustomerRankSetting,
} from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";
import { requireRestaurantAccess } from "../../guards.js";
import { requirePermission } from "../../../src/services/auth/authorization.service.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import dayjs from "dayjs";

import { validatePasswordStrong } from "../../../lib/passwordPolicy.js";
import { verifyRecaptcha } from "../../../lib/recaptcha.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import emailVerificationMutation, {
  issueAndSendVerificationForUser,
} from "../auth/emailVerification.mutation.js";
import {
  getLoginAttemptState,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  logAuthAuditEvent,
} from "../../../src/security/loginSecurity.js";
import { issueRefreshToken, signAccessToken } from "../../../src/security/authTokens.js";
import { sanitizeUserForClient } from "../../../src/security/sanitizeUserForClient.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FOOD_PREFERENCE_DIETS = ["omni", "vegan", "keto", "halal"];
const FOOD_PREFERENCE_ALLERGIES = ["seafood", "peanut", "milk", "egg", "gluten"];
const FOOD_PREFERENCE_SUGAR = [0, 30, 50, 70, 100];
const FOOD_PREFERENCE_SPICE = ["Không", "Vừa", "Nồng", "Rất cay"];
const WALLET_ALLOWED_PROVIDERS = ["internal"];
const WALLET_ALLOWED_CURRENCIES = ["VND"];
const RESTAURANT_SCOPED_ROLE_SLUGS = new Set([
  "hr", "accountant", "staff", "server", "supervisor", "host", "cashier",
  "chef", "cook", "kitchen_helper", "cleaner", "shipper", "storekeeper", "bartender",
]);

function roleSlugOf(role) {
  return String(role?.slug || role?.name || role || "").trim().toLowerCase();
}

function assertRestaurantAssignmentForRole(role, restaurantForStaff) {
  const slug = roleSlugOf(role);
  if (RESTAURANT_SCOPED_ROLE_SLUGS.has(slug) && !restaurantForStaff) {
    throw new GraphQLError("restaurantForStaff is required for restaurant-scoped roles", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}
const AVATAR_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_MAX_FILE_SIZE_BYTES = Number(process.env.AVATAR_MAX_FILE_SIZE_BYTES || 2 * 1024 * 1024);

function normalizeFoodPreferencesInput(input = {}) {
  const habits = input?.habits || {};

  if (typeof input?.diet !== "undefined" && !FOOD_PREFERENCE_DIETS.includes(input.diet)) {
    throw new GraphQLError("Invalid diet value", { extensions: { code: "BAD_USER_INPUT" } });
  }
  const diet = FOOD_PREFERENCE_DIETS.includes(input?.diet) ? input.diet : "omni";

  const allergies = Array.isArray(input?.allergies) ? [...new Set(input.allergies)] : [];
  if (allergies.some((item) => !FOOD_PREFERENCE_ALLERGIES.includes(item))) {
    throw new GraphQLError("Invalid allergy value", { extensions: { code: "BAD_USER_INPUT" } });
  }

  if (typeof habits?.sugar !== "undefined" && !FOOD_PREFERENCE_SUGAR.includes(habits.sugar)) {
    throw new GraphQLError("Invalid sugar value", { extensions: { code: "BAD_USER_INPUT" } });
  }
  const sugar = FOOD_PREFERENCE_SUGAR.includes(habits?.sugar) ? habits.sugar : 100;

  if (typeof habits?.spice !== "undefined" && !FOOD_PREFERENCE_SPICE.includes(habits.spice)) {
    throw new GraphQLError("Invalid spice value", { extensions: { code: "BAD_USER_INPUT" } });
  }
  const spice = FOOD_PREFERENCE_SPICE.includes(habits?.spice) ? habits.spice : "Vừa";

  return {
    diet,
    allergies,
    habits: {
      noOnion: typeof habits?.noOnion === "boolean" ? habits.noOnion : false,
      noCilantro: typeof habits?.noCilantro === "boolean" ? habits.noCilantro : false,
      sugar,
      spice,
      ice: typeof habits?.ice === "boolean" ? habits.ice : true,
    },
  };
}

function buildFoodPreferenceNote(preferences = {}) {
  const allergyLabels = {
    seafood: "Hải sản vỏ cứng",
    peanut: "Đậu phộng",
    milk: "Sữa / Lactose",
    egg: "Trứng",
    gluten: "Gluten",
  };
  const dietLabels = { omni: "Tiêu chuẩn", vegan: "Thuần chay", keto: "Keto / Low Carb", halal: "Halal" };
  const notes = [];
  if (preferences?.diet && preferences.diet !== "omni") notes.push(`Chế độ ${dietLabels[preferences.diet] || preferences.diet}`);
  if (preferences?.allergies?.length) notes.push(`Dị ứng: ${preferences.allergies.map((a) => allergyLabels[a] || a).join(", ")}`);
  if (preferences?.habits?.noOnion) notes.push("KHÔNG HÀNH");
  if (preferences?.habits?.noCilantro) notes.push("KHÔNG NGÒ");
  if (preferences?.habits?.sugar !== 100) notes.push(`${preferences.habits.sugar}% đường`);
  if (preferences?.habits?.spice && preferences.habits.spice !== "Vừa") notes.push(`Cay: ${preferences.habits.spice}`);
  if (preferences?.habits?.ice === false) notes.push("Không đá");
  return notes.length ? notes.join(". ") : "Chưa có ghi chú đặc biệt.";
}


function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hasPathTraversal(pathname = "") {
  return pathname.split("/").some((part) => part === "..");
}

function normalizeAvatarFileUrl(rawInputUrl) {
  const rawUrl = String(rawInputUrl || "").trim();
  const lower = rawUrl.toLowerCase();
  if (!rawUrl || rawUrl.startsWith("//") || lower.startsWith("javascript:") || lower.startsWith("data:")) {
    throw new GraphQLError("Unsupported avatar URL", { extensions: { code: "BAD_USER_INPUT" } });
  }

  if (rawUrl.startsWith("/")) {
    if (!rawUrl.startsWith("/uploads/") || hasPathTraversal(rawUrl)) {
      throw new GraphQLError("Unsupported avatar URL", { extensions: { code: "BAD_USER_INPUT" } });
    }
    return rawUrl;
  }

  const s3BaseRaw = String(process.env.S3_PUBLIC_BASE_URL || "").trim();
  if (!s3BaseRaw) throw new GraphQLError("Unsupported avatar URL", { extensions: { code: "BAD_USER_INPUT" } });

  let base;
  let target;
  try {
    base = new URL(s3BaseRaw);
    target = new URL(rawUrl);
  } catch {
    throw new GraphQLError("Unsupported avatar URL", { extensions: { code: "BAD_USER_INPUT" } });
  }

  if (target.origin !== base.origin) throw new GraphQLError("Unsupported avatar URL", { extensions: { code: "BAD_USER_INPUT" } });
  const normalizedBasePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
  if (!target.pathname.startsWith(normalizedBasePath) || hasPathTraversal(target.pathname)) {
    throw new GraphQLError("Unsupported avatar URL", { extensions: { code: "BAD_USER_INPUT" } });
  }
  return target.toString();
}

async function saveBase64Avatar(base64, userId) {
  const m = String(base64 || "").match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new GraphQLError("Invalid avatar format", { extensions: { code: "BAD_USER_INPUT" } });
  const mimeType = m[1].toLowerCase();
  if (!AVATAR_ALLOWED_MIME.has(mimeType)) throw new GraphQLError("Unsupported avatar MIME type", { extensions: { code: "BAD_USER_INPUT" } });
  const rawBuffer = Buffer.from(m[2], "base64");
  if (!rawBuffer.length || rawBuffer.length > AVATAR_MAX_FILE_SIZE_BYTES) throw new GraphQLError("Avatar file is too large", { extensions: { code: "BAD_USER_INPUT" } });
  const { default: sharp } = await import("sharp");
  let optimized;
  try {
    optimized = await sharp(rawBuffer).rotate().webp({ quality: 85 }).toBuffer();
  } catch {
    throw new GraphQLError("Invalid image payload", { extensions: { code: "BAD_USER_INPUT" } });
  }

  const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
  ensureDirSync(uploadsDir);

  const filename = `${String(userId)}-${Date.now()}.webp`;
  const absPath = path.join(uploadsDir, filename);
  fs.writeFileSync(absPath, optimized);

  return `/uploads/avatars/${filename}`;
}

// helper: chuẩn hoá số điện thoại VN nhẹ nhàng
const normalizePhone = (p) =>
  p ? p.replace(/\s+/g, "").replace(/^\+84/, "0") : p;

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ZERO_WIDTH_CHARS = "​‌‍﻿";
const ZERO_WIDTH_OR_WS_CLASS = `[\\s${ZERO_WIDTH_CHARS}]`;

const buildTrimmedExactRegex = (value = "") =>
  new RegExp(
    `^${ZERO_WIDTH_OR_WS_CLASS}*${escapeRegex(value)}${ZERO_WIDTH_OR_WS_CLASS}*$`,
    "i",
  );

const buildNormalizedFieldExpr = (field) => ({
  $toLower: {
    $trim: {
      input: {
        $replaceAll: {
          input: {
            $replaceAll: {
              input: {
                $replaceAll: {
                  input: { $ifNull: [field, ""] },
                  find: "\u200B",
                  replacement: "",
                },
              },
              find: "\u200C",
              replacement: "",
            },
          },
          find: "\uFEFF",
          replacement: "",
        },
      },
    },
  },
});

/* ===== Loyalty helpers (đồng bộ với FE rule) ===== */
const _computePointsFromSpending = (spending) =>
  Math.max(0, Math.floor((Number(spending) || 0) / 1_000_000));
const _computeTypeFromPoints = (points) => {
  if (points < 5000) return "NEW";
  if (points <= 15000) return "OFTEN";
  return "VIP";
};

const DUPLICATE_REGISTRATION_ERROR = "Email/Phone/Username already in use";
const MULTIPLE_GUEST_MATCH_ERROR =
  "Contact information matches multiple guest profiles. Please contact support.";

const loadUserForGraph = async (userId) => {
  const userObj = await User.findById(userId)
    .populate("role")
    .populate("refRestaurants")
    .lean({ virtuals: true });

  if (!userObj) return null;

  const roleName = (userObj.role?.slug || userObj.role?.name || "").toLowerCase();
  return sanitizeUserForClient({ ...userObj, roleName });
};

const buildAuthPayloadForUser = async (userId) => {
  const userObj = await User.findById(userId)
    .populate("role")
    .lean({ virtuals: true });
  const token = signAccessToken({ ...userObj, roleName: (userObj.role?.slug || userObj.role?.name || "").toLowerCase() });
  const roleName = (userObj.role?.slug || userObj.role?.name || "").toLowerCase();

  return { token, user: sanitizeUserForClient({ ...userObj, roleName }) };
};

const findGuestMatchForRegistration = async ({ email, phone }) => {
  const contactLookup = [
    ...(email ? [{ email }] : []),
    ...(phone ? [{ phone }] : []),
  ];

  if (contactLookup.length === 0) {
    return null;
  }

  const matchedUsers = await User.find({ $or: contactLookup })
    .select("_id isGuest userType")
    .lean();

  if (matchedUsers.some((candidate) => !candidate.isGuest)) {
    throw new GraphQLError(DUPLICATE_REGISTRATION_ERROR, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const guestMatches = Array.from(
    new Map(
      matchedUsers
        .filter(
          (candidate) => candidate.isGuest && candidate.userType === "CUSTOMER",
        )
        .map((candidate) => [String(candidate._id), candidate]),
    ).values(),
  );

  if (guestMatches.length > 1) {
    throw new GraphQLError(MULTIPLE_GUEST_MATCH_ERROR, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  return guestMatches[0]?._id || null;
};

export const UserMutation = {
  // ========== Role ==========
  assignRoleToUser: async (_, { input }, { user }) => {
    requireRole(user, ["admin"]);
    const { userId, roleId } = input;
    if (
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(roleId)
    ) {
      throw new GraphQLError("Invalid userId or roleId");
    }
    const role = await Role.findById(roleId).lean();
    if (!role) throw new GraphQLError("Role not found");
    const u = await User.findById(userId);
    if (!u) throw new GraphQLError("User not found");
    assertRestaurantAssignmentForRole(role, u.restaurantForStaff);
    u.role = roleId;
    if (roleSlugOf(role) === "customer") u.restaurantForStaff = null;
    await u.save();
    return sanitizeUserForClient(u);
  },

  // ========== Change password (simple args) ==========
  async changeMyPassword(_, { currentPassword, newPassword }, ctx) {
    const authUser = ctx?.user;
    if (!authUser?.id) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    if (!currentPassword || !newPassword) {
      throw new GraphQLError("Missing password", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const user = await User.findById(authUser.id);
    if (!user) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    if (!user.passwordHash) {
      throw new GraphQLError("User has no password", {
        extensions: { code: "BAD_REQUEST" },
      });
    }

    const ok = user.checkPassword
      ? await user.checkPassword(currentPassword)
      : false;
    if (!ok) {
      throw new GraphQLError("Current password is incorrect", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const policy = validatePasswordStrong(newPassword);
    if (!policy.ok) {
      throw new GraphQLError(
        `Weak password: ${
          policy.reason || "Password does not meet requirements"
        }`,
        { extensions: { code: "BAD_USER_INPUT" } },
      );
    }

    await user.setPassword(newPassword);
    await user.save();
    return true;
  },

  // ======== Update avatar (giữ lại để nơi khác dùng nếu cần) =========
  async updateAvatar(_, { input }, ctx) {
    const authUser = ctx?.user;
    if (!authUser?.id) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    const user = await User.findById(authUser.id);
    if (!user) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    let nextUrl = user.avatarUrl || null;

    if (input?.fileBase64) {
      try {
        nextUrl = await saveBase64Avatar(input.fileBase64, user._id);
      } catch (err) {
        console.error("saveBase64Avatar error:", err?.message || err);
        if (err instanceof GraphQLError) throw err;
        throw new GraphQLError("Failed to save avatar", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    } else if (input?.fileUrl) {
      nextUrl = normalizeAvatarFileUrl(input.fileUrl);
    } else if (typeof input?.clear === "boolean" && input.clear === true) {
      nextUrl = null;
    } else {
      throw new GraphQLError("No avatar provided", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    user.avatarUrl = nextUrl;
    await user.save();
    const saved = await User.findById(user._id)
      .populate("role")
      .lean({ virtuals: true });
    const roleName = (saved.role?.slug || saved.role?.name || "").toLowerCase();
    return sanitizeUserForClient({ ...saved, roleName });
  },

  // ========== Wallet ==========
  async createMyWallet(_, { input }, ctx) {
    const authUser = ctx?.user;
    if (!authUser?.id) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const user = await User.findById(authUser.id).populate("role");
    if (!user) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    if (user.wallet?.status === "active") {
      return sanitizeUserForClient(user);
    }

    const provider = input?.provider?.trim() || "internal";
    const currency = input?.currency?.trim() || "VND";
    if (!WALLET_ALLOWED_PROVIDERS.includes(provider) || !WALLET_ALLOWED_CURRENCIES.includes(currency)) {
      throw new GraphQLError("Unsupported wallet provider/currency", { extensions: { code: "BAD_USER_INPUT" } });
    }

    user.wallet = {
      provider,
      status: "active",
      balance: user.wallet?.balance || 0,
      currency,
      createdAt: user.wallet?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    await user.save();

    const saved = await User.findById(user._id)
      .populate("role")
      .lean({ virtuals: true });
    const roleName = (saved.role?.slug || saved.role?.name || "").toLowerCase();
    return sanitizeUserForClient({ ...saved, roleName });
  },

  async topUpMyWallet(_, { input }, ctx) {
    const authUser = ctx?.user;
    if (!authUser?.id) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    throw new GraphQLError("Wallet top-up is temporarily disabled until payment verification is implemented", {
      extensions: { code: "FORBIDDEN" },
    });
  },

  // ========== Register ==========
  createUser: async (_, { input }, ctx) => {
    const {
      fullName,
      username,
      email,
      phone,
      address,
      password,
      customerType,
      captchaToken,
      restaurantId,
    } = input;

    const isManagedCustomerCreate = Boolean(restaurantId);
    let managedRestaurantObjectId = null;
    if (isManagedCustomerCreate) {
      requireRole(ctx?.user, ["admin", "manager"]);
      await requirePermission(ctx, PERMISSIONS.CUSTOMER_UPDATE);
      if (!mongoose.isValidObjectId(restaurantId)) {
        throw new GraphQLError("Invalid restaurantId", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      await requireRestaurantAccess(ctx, restaurantId);
      managedRestaurantObjectId = new mongoose.Types.ObjectId(restaurantId);
    }

    if (!fullName?.trim()) {
      throw new GraphQLError("fullName is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const policy = validatePasswordStrong(password);
    if (!policy.ok) {
      throw new GraphQLError(
        `Weak password: ${
          policy.reason || "Password does not meet requirements"
        }`,
        { extensions: { code: "BAD_USER_INPUT" } },
      );
    }

    // Allow disabling reCAPTCHA in dev by env flag
    const recaptchaEnabled =
      String(process.env.ENABLE_RECAPTCHA ?? "true").toLowerCase() === "true";
    if (recaptchaEnabled && !isManagedCustomerCreate) {
      const recaptcha = await verifyRecaptcha(captchaToken, ctx);
      if (!recaptcha.ok) {
        throw new GraphQLError(
          recaptcha.reason || "reCAPTCHA verification failed",
          {
            extensions: { code: "BAD_USER_INPUT" },
          },
        );
      }
    }



    const emailVerificationEnabled =
      String(process.env.ENABLE_EMAIL_VERIFICATION ?? "true").toLowerCase() ===
      "true";
    const phoneVerificationEnabled =
      String(process.env.ENABLE_PHONE_VERIFICATION ?? "false").toLowerCase() ===
        "true" &&
      String(process.env.ENABLE_SMS_VERIFICATION ?? "false").toLowerCase() ===
        "true";
    const shouldRequireVerification =
      (emailVerificationEnabled && Boolean(email)) ||
      (phoneVerificationEnabled && Boolean(phone));
    const enforcedStatus = shouldRequireVerification ? "pending" : "active";

    const defaultCustomerRole = await Role.findOne({
      $or: [{ slug: "customer" }, { name: /^customer$/i }],
    })
      .select("_id")
      .lean();

    const normalizedEmail = email?.toLowerCase().trim() || undefined;
    const normalizedPhone = phone ? normalizePhone(phone.trim()) : undefined;
    const normalizedUsername = username?.trim().toLowerCase() || undefined;

    if (normalizedUsername) {
      const usernameExists = await User.findOne({
        username: normalizedUsername,
      }).lean();

      if (usernameExists) {
        throw new GraphQLError(DUPLICATE_REGISTRATION_ERROR, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
    }

    const guestMatchId = await findGuestMatchForRegistration({
      email: normalizedEmail,
      phone: normalizedPhone,
    });

    let doc;
    if (guestMatchId) {
      doc = await Customer.findById(guestMatchId);
      if (!doc || !doc.isGuest) {
        throw new GraphQLError(DUPLICATE_REGISTRATION_ERROR, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      doc.fullName = fullName.trim();
      doc.username = normalizedUsername || undefined;
      if (normalizedEmail) {
        doc.email = normalizedEmail;
        doc.emailVerified = false;
      }
      if (normalizedPhone) {
        doc.phone = normalizedPhone;
        doc.phoneVerified = false;
      }
      doc.address = address || doc.address;
      doc.provider = "local";
      doc.status = enforcedStatus;
      doc.userType = "CUSTOMER";
      doc.customerType = customerType || doc.customerType || "NEW";
      doc.role = defaultCustomerRole?._id || doc.role;
      doc.isGuest = false;
      doc.guestExpiresAt = null;
      doc.registeredAt = new Date();

      await doc.setPassword(password);
      await doc.save();
    } else {
      doc = new Customer({
        fullName: fullName.trim(),
        username: normalizedUsername || undefined,
        email: normalizedEmail,
        phone: normalizedPhone,
        address: address || undefined,
        provider: "local",
        status: enforcedStatus,
        userType: "CUSTOMER",
        customerType: customerType || "NEW",
        role: defaultCustomerRole?._id || undefined,
        loyaltyPoints: 0,
        totalOrders: 0,
        totalSpending: 0,
      });
      await doc.setPassword(password);
      await doc.save();
    }

    if (managedRestaurantObjectId) {
      const membershipIds = (doc.customerRestaurants || []).map(String);
      if (!membershipIds.includes(String(managedRestaurantObjectId))) {
        doc.customerRestaurants = [
          ...(doc.customerRestaurants || []),
          managedRestaurantObjectId,
        ];
      }
      const recentIds = (doc.refRestaurants || [])
        .map(String)
        .filter((id) => id !== String(managedRestaurantObjectId));
      doc.refRestaurants = [
        managedRestaurantObjectId,
        ...recentIds.slice(0, 11).map((id) => new mongoose.Types.ObjectId(id)),
      ];
      await doc.save();
    }

    if (shouldRequireVerification) {
      try {
        await issueAndSendVerificationForUser(doc, {
          channels: "AUTO",
          reason: "customer_register",
          ctx,
        });
      } catch (err) {
        console.error("Account verification dispatch failed:", err);
      }
    }

    return buildAuthPayloadForUser(doc._id);
  },

  // ========== Login ==========
  login: async (_, { email, username, phone, password, captchaToken }, ctx) => {
    if (!password) {
      throw new GraphQLError("Missing required field: password", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const recaptchaEnabled =
      String(process.env.ENABLE_RECAPTCHA ?? "true").toLowerCase() === "true";
    if (recaptchaEnabled) {
      const recaptcha = await verifyRecaptcha(captchaToken, ctx);
      if (!recaptcha.ok) {
        throw new GraphQLError(
          recaptcha.reason || "reCAPTCHA verification failed",
          {
            extensions: { code: "BAD_USER_INPUT" },
          },
        );
      }
    }

    const normalizedEmail = email?.toLowerCase().trim();
    const normalizedUsername = username?.trim().toLowerCase();
    const normalizedPhone = phone ? normalizePhone(phone.trim()) : null;
    const loginIdentifier = normalizedUsername
      ? "username"
      : normalizedEmail
        ? "email"
        : normalizedPhone
          ? "phone"
          : "username";

    const baseLookupOr = [
      ...(normalizedEmail
        ? [
            { email: normalizedEmail },
            { email: { $regex: buildTrimmedExactRegex(normalizedEmail) } },
          ]
        : []),
      ...(normalizedUsername
        ? [
            { username: normalizedUsername },
            {
              username: {
                $regex: buildTrimmedExactRegex(normalizedUsername),
              },
            },
          ]
        : []),
      ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
    ];

    if (baseLookupOr.length === 0) {
      throw new GraphQLError(
        "Missing login identifier: provide email, username, or phone",
        {
          extensions: { code: "BAD_USER_INPUT" },
        }
      );
    }

    const requestIp =
      ctx?.request?.ip ||
      ctx?.request?.headers?.["x-forwarded-for"] ||
      "unknown";

    const throttle = getLoginAttemptState({
      identifier: normalizedEmail || normalizedUsername || normalizedPhone || "unknown",
      ip: requestIp,
    });

    if (throttle.blocked) {
      logAuthAuditEvent(ctx, "login_rate_limited", {
        ip: requestIp,
        identifierType: loginIdentifier,
        retryAfterMs: throttle.retryAfterMs,
      });
      throw new GraphQLError("Too many failed attempts. Please try again later.", {
        extensions: { code: "TOO_MANY_REQUESTS" },
      });
    }

    let user = await User.findOne({ $or: baseLookupOr }).populate("role");

    // Fallback for legacy/imported records that may keep odd whitespace/casing.
    if (!user) {
      const normalizedLookupOr = [
        ...(normalizedEmail
          ? [
              {
                $expr: {
                  $eq: [buildNormalizedFieldExpr("$email"), normalizedEmail],
                },
              },
            ]
          : []),
        ...(normalizedUsername
          ? [
              {
                $expr: {
                  $eq: [
                    buildNormalizedFieldExpr("$username"),
                    normalizedUsername,
                  ],
                },
              },
            ]
          : []),
      ];

      if (normalizedLookupOr.length > 0) {
        user = await User.findOne({ $or: normalizedLookupOr }).populate("role");

      }
    }

    const identifierForThrottle =
      normalizedEmail || normalizedUsername || normalizedPhone || "unknown";

    const failLogin = async (reason = "invalid_credentials", code = "UNAUTHENTICATED", message = "Invalid credentials") => {
      const nextState = recordFailedLoginAttempt({
        identifier: identifierForThrottle,
        ip: requestIp,
      });

      logAuthAuditEvent(ctx, "login_failed", {
        ip: requestIp,
        identifierType: loginIdentifier,
        reason,
        attempts: nextState.attempts,
      });

      const delayMs = Math.min(1500, 200 + nextState.attempts * 150);
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      throw new GraphQLError(message, {
        extensions: { code },
      });
    };

    if (!user) await failLogin();
    if (!user.passwordHash) await failLogin("password_login_not_supported");

    if (user.status !== "active") {
      logAuthAuditEvent(ctx, "login_blocked_status", {
        ip: requestIp,
        identifierType: loginIdentifier,
        userId: String(user._id),
        status: user.status,
      });
      throw new GraphQLError("Login is not available for this account", {
        extensions: { code: "FORBIDDEN" },
      });
    }

    const ok = user.checkPassword ? await user.checkPassword(password) : false;
    if (!ok) await failLogin();

    resetLoginAttempts({
      identifier: identifierForThrottle,
      ip: requestIp,
    });

    const userObj = await User.findById(user._id)
      .populate("role")
      .lean({ virtuals: true });
    const token = signAccessToken({ ...userObj, roleName: (userObj.role?.slug || userObj.role?.name || "").toLowerCase() });
    const roleName = (
      userObj.role?.slug ||
      userObj.role?.name ||
      ""
    ).toLowerCase();

    logAuthAuditEvent(ctx, "login_success", {
      ip: requestIp,
      identifierType: loginIdentifier,
      userId: String(userObj._id),
      roleName,
    });

    if (ctx?.reply) {
      await issueRefreshToken({
        userId: userObj._id,
        reply: ctx.reply,
        userAgent: ctx?.request?.headers?.["user-agent"],
        ip: ctx?.request?.ip,
      });
    }
    return { token, user: sanitizeUserForClient({ ...userObj, roleName }) };
  },

  async updateMyFoodPreferences(_, { input }, ctx) {
    const authUser = ctx?.user;
    if (!authUser?.id) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const customer = await Customer.findById(authUser.id);
    if (!customer) {
      throw new GraphQLError("Customer not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const normalized = normalizeFoodPreferencesInput(input);
    normalized.autoNote = buildFoodPreferenceNote(normalized);
    normalized.updatedAt = new Date();

    customer.foodPreferences = normalized;
    await customer.save();

    const saved = await User.findById(customer._id)
      .populate("role")
      .lean({ virtuals: true });

    const roleName = (saved.role?.slug || saved.role?.name || "").toLowerCase();
    return sanitizeUserForClient({ ...saved, roleName });
  },

  // ========== Update current user ==========
  updateUser: async (_, { input }, ctx) => {
    const authUser = ctx?.user;
    if (!authUser?.id) {
      throw new GraphQLError("Unauthorized", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }

    const u = await User.findById(authUser.id);
    if (!u) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const updates = {};
    if (typeof input.fullName === "string") {
      const v = input.fullName.trim();
      if (!v) {
        throw new GraphQLError("fullName cannot be empty", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.fullName = v;
    }

    if (typeof input.username === "string" && input.username.trim()) {
      const nextUsername = input.username.trim().toLowerCase();
      const existUsername = await User.findOne({
        _id: { $ne: u._id },
        username: nextUsername,
      }).lean();
      if (existUsername) {
        throw new GraphQLError("Username already in use", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.username = nextUsername;
    }

    if (typeof input.email === "string") {
      const nextEmail = input.email.trim().toLowerCase();
      const currentEmail = String(u.email || "");
      if (nextEmail !== currentEmail) {
        throw new GraphQLError("Email changes require OTP verification", {
          extensions: { code: "EMAIL_CHANGE_REQUIRES_OTP" },
        });
      }
    }

    if (typeof input.phone === "string") {
      const nextPhone = normalizePhone(input.phone.trim());
      const currentPhone = normalizePhone(String(u.phone || ""));
      if (nextPhone !== currentPhone) {
        throw new GraphQLError("Phone changes require OTP verification", {
          extensions: { code: "PHONE_CHANGE_REQUIRES_OTP" },
        });
      }
    }

    if (input.address && typeof input.address === "object") {
      updates.address = {
        line1: input.address.line1 ?? u.address?.line1 ?? "",
        line2: input.address.line2 ?? u.address?.line2 ?? "",
        ward: input.address.ward ?? u.address?.ward ?? "",
        district: input.address.district ?? u.address?.district ?? "",
        city: input.address.city ?? u.address?.city ?? "",
        country: input.address.country ?? u.address?.country ?? "vietnam",
      };
    }

    if (Object.prototype.hasOwnProperty.call(input, "avatarUrl")) {
      const v = (input.avatarUrl ?? "").toString().trim();
      updates.avatarUrl = v || null;
    }

    const saved = await User.findByIdAndUpdate(u._id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("role")
      .lean({ virtuals: true });

    const roleName = (saved.role?.slug || saved.role?.name || "").toLowerCase();
    return sanitizeUserForClient({ ...saved, roleName });
  },

  // ========== Guest nhanh ==========
  async createGuestUser(
    _,
    { fullName, phone, expiresInDays = 30, restaurantId },
    ctx,
  ) {
    requireRole(ctx?.user, ["admin", "manager"]);
    await requirePermission(ctx, PERMISSIONS.CUSTOMER_UPDATE);
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    await requireRestaurantAccess(ctx, restaurantId);

    const normalizedPhone = phone ? normalizePhone(phone) : undefined;
    if (normalizedPhone) {
      const existing = await Customer.findOne({
        phone: normalizedPhone,
        deletedAt: null,
      }).lean();
      if (existing) {
        throw new GraphQLError("Phone already in use", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
    }

    const rid = new mongoose.Types.ObjectId(restaurantId);
    const doc = new Customer({
      fullName: (fullName || "Guest").trim(),
      phone: normalizedPhone,
      status: "active",
      isGuest: true,
      guestExpiresAt: dayjs().add(expiresInDays, "day").toDate(),
      customerType: "NEW",
      loyaltyPoints: 0,
      totalOrders: 0,
      totalSpending: 0,
      customerRestaurants: [rid],
      refRestaurants: [rid],
    });

    await doc.save();
    const saved = await User.findById(doc._id)
      .populate("role")
      .lean({ virtuals: true });
    return sanitizeUserForClient(saved);
  },

  // === Admin update user ===
  async adminUpdateUser(_, { userId, input }, { user: authUser }) {
    requireRole(authUser, ["admin"]);
    if (!mongoose.isValidObjectId(userId)) {
      throw new GraphQLError("Invalid userId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const u = await User.findById(userId);
    if (!u) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const updates = {};
    if (typeof input.fullName === "string")
      updates.fullName = input.fullName.trim();

    if (typeof input.username === "string" && input.username.trim()) {
      const nextUsername = input.username.trim().toLowerCase();
      const existUsername = await User.findOne({
        _id: { $ne: u._id },
        username: nextUsername,
      }).lean();
      if (existUsername) {
        throw new GraphQLError("Username already in use", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.username = nextUsername;
    }

    if (typeof input.email === "string") {
      const nextEmail = input.email.trim().toLowerCase() || null;
      if (nextEmail) {
        const existEmail = await User.findOne({
          _id: { $ne: u._id },
          email: nextEmail,
        }).lean();
        if (existEmail) {
          throw new GraphQLError("Email already in use", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        if (u.email && u.email !== nextEmail) updates.emailVerified = false;
      } else {
        updates.emailVerified = false;
      }
      updates.email = nextEmail;
    }

    if (typeof input.phone === "string") {
      const nextPhone = normalizePhone(input.phone);
      if (nextPhone) {
        const existPhone = await User.findOne({
          _id: { $ne: u._id },
          phone: nextPhone,
        }).lean();
        if (existPhone) {
          throw new GraphQLError("Phone already in use", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        updates.phone = nextPhone;
      } else {
        updates.phone = null;
      }
    }

    if (input.address && typeof input.address === "object") {
      updates.address = {
        line1: input.address.line1 ?? u.address?.line1 ?? "",
        line2: input.address.line2 ?? u.address?.line2 ?? "",
        ward: input.address.ward ?? u.address?.ward ?? "",
        district: input.address.district ?? u.address?.district ?? "",
        city: input.address.city ?? u.address?.city ?? "",
        country: input.address.country ?? u.address?.country ?? "vietnam",
      };
    }

    if (Object.prototype.hasOwnProperty.call(input, "avatarUrl")) {
      const v = (input.avatarUrl ?? "").toString().trim();
      updates.avatarUrl = v || null;
    }

    if (typeof input.status === "string") {
      const s = input.status.toLowerCase();
      if (!["active", "inactive", "blocked", "pending"].includes(s)) {
        throw new GraphQLError("Invalid status", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.status = s;
    }

    if (typeof input.customerType === "string")
      updates.customerType = input.customerType;
    if (typeof input.loyaltyPoints === "number")
      updates.loyaltyPoints = Math.max(0, input.loyaltyPoints);
    if (typeof input.totalOrders === "number")
      updates.totalOrders = Math.max(0, input.totalOrders);
    if (typeof input.totalSpending === "number")
      updates.totalSpending = Math.max(0, input.totalSpending);
    if (typeof input.isGuest === "boolean") updates.isGuest = input.isGuest;
    if (input.guestExpiresAt)
      updates.guestExpiresAt = new Date(input.guestExpiresAt);
    let nextRoleDoc = null;
    if (input.roleId) {
      if (!mongoose.isValidObjectId(input.roleId)) {
        throw new GraphQLError("Invalid roleId", { extensions: { code: "BAD_USER_INPUT" } });
      }
      nextRoleDoc = await Role.findById(input.roleId).lean();
      if (!nextRoleDoc) {
        throw new GraphQLError("Role not found", { extensions: { code: "BAD_USER_INPUT" } });
      }
    } else if (u.role) {
      nextRoleDoc = await Role.findById(u.role).lean();
    }

    const nextRoleSlug = roleSlugOf(nextRoleDoc);
    if (Array.isArray(input.refRestaurantIds)) {
      if (nextRoleSlug !== "customer") {
        throw new GraphQLError("refRestaurantIds is customer history and cannot be assigned to staff roles", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      updates.refRestaurants = input.refRestaurantIds.map((id) => new mongoose.Types.ObjectId(id));
    }

    if (Object.prototype.hasOwnProperty.call(input, "restaurantForStaff")) {
      if (!input.restaurantForStaff) {
        updates.restaurantForStaff = null;
      } else if (!mongoose.isValidObjectId(input.restaurantForStaff)) {
        throw new GraphQLError("Invalid restaurantForStaff", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      } else {
        updates.restaurantForStaff = new mongoose.Types.ObjectId(
          input.restaurantForStaff,
        );
      }
    }

    const finalRestaurantForStaff = Object.prototype.hasOwnProperty.call(updates, "restaurantForStaff")
      ? updates.restaurantForStaff
      : u.restaurantForStaff;
    assertRestaurantAssignmentForRole(nextRoleDoc, finalRestaurantForStaff);

    if (input.roleId) updates.role = input.roleId;
    if (nextRoleSlug === "customer") updates.restaurantForStaff = null;
    else if (nextRoleSlug && !RESTAURANT_SCOPED_ROLE_SLUGS.has(nextRoleSlug)) updates.restaurantForStaff = null;

    u.set(updates);
    await u.save();

    const saved = await User.findById(u._id)
      .populate("role")
      .lean({ virtuals: true });

    return sanitizeUserForClient(saved);
  },

  async updateCustomerNote(_, { customerId, restaurantId, noteInternal }, ctx) {
    requireRole(ctx?.user, ["admin", "manager"]);
    await requirePermission(ctx, PERMISSIONS.CUSTOMER_UPDATE);

    if (!mongoose.isValidObjectId(customerId)) {
      throw new GraphQLError("Invalid customerId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const rid = new mongoose.Types.ObjectId(restaurantId);
    await requireRestaurantAccess(ctx, rid);

    const customer = await User.findById(customerId).populate("role");
    if (!customer) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }

    const roleSlug = String(customer.role?.slug || customer.role?.name || "").toLowerCase();
    const isCustomerLike = customer.isGuest === true || roleSlug === "customer";
    if (!isCustomerLike) {
      throw new GraphQLError("Target must be customer", {
        extensions: { code: "FORBIDDEN" },
      });
    }

    const targetRestaurantIds = (customer.customerRestaurants || []).map((id) =>
      String(id || ""),
    );
    if (!targetRestaurantIds.includes(String(rid))) {
      throw new GraphQLError("FORBIDDEN_SCOPE", {
        extensions: { code: "FORBIDDEN" },
      });
    }

    const normalizedNote =
      typeof noteInternal === "string" ? noteInternal.trim() : "";
    const noteIndex = (customer.customerNotes || []).findIndex(
      (entry) => String(entry?.restaurantId || "") === String(rid),
    );
    const noteEntry = {
      restaurantId: rid,
      noteInternal: normalizedNote,
      updatedAt: new Date(),
      updatedBy: ctx?.user?.id
        ? new mongoose.Types.ObjectId(ctx.user.id)
        : undefined,
    };
    if (noteIndex >= 0) customer.customerNotes[noteIndex] = noteEntry;
    else customer.customerNotes.push(noteEntry);
    await customer.save();

    return loadUserForGraph(customer._id);
  },

  // === Quick status ===
  async setUserStatus(_, { userId, status }, { user: authUser }) {
    requireRole(authUser, ["admin"]);
    if (!mongoose.isValidObjectId(userId)) {
      throw new GraphQLError("Invalid userId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const s = (status || "").toLowerCase();
    if (!["active", "inactive", "blocked", "pending"].includes(s)) {
      throw new GraphQLError("Invalid status", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const saved = await User.findByIdAndUpdate(
      userId,
      { status: s },
      { new: true },
    ).lean();
    if (!saved) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    return loadUserForGraph(saved._id);
  },

  // === Soft delete ===
  async softDeleteUser(_, { userId }, { user: authUser }) {
    requireRole(authUser, ["admin"]);
    if (!mongoose.isValidObjectId(userId)) {
      throw new GraphQLError("Invalid userId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const now = new Date();
    const deleteExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const saved = await User.findByIdAndUpdate(
      userId,
      {
        status: "inactive",
        deletedAt: now,
        deleteExpiresAt,
        deletedBy: authUser?._id || null,
      },
      { new: true },
    ).lean();
    if (!saved) {
      throw new GraphQLError("User not found", {
        extensions: { code: "NOT_FOUND" },
      });
    }
    return true;
  },

  /* ================= NEW: updateCustomerMetrics =================
     - Cho phép FE đồng bộ loyaltyPoints & customerType sau khi tính
     - Yêu cầu quyền admin/manager
  */
  async updateCustomerMetrics(
    _,
    { id, restaurantId, loyaltyPoints, customerType },
    ctx,
  ) {
    const authUser = ctx?.user;
    requireRole(authUser, ["admin", "manager"]);
    await requirePermission(ctx, PERMISSIONS.CUSTOMER_UPDATE);
    if (!mongoose.isValidObjectId(restaurantId)) throw new GraphQLError("Invalid restaurantId", { extensions: { code: "BAD_USER_INPUT" } });
    await requireRestaurantAccess(ctx, restaurantId);
    if (!mongoose.isValidObjectId(id)) {
      throw new GraphQLError("Invalid id", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const lp = Math.max(0, Number(loyaltyPoints || 0));
    const ct = (customerType || "").toUpperCase();
    if (!["NEW", "OFTEN", "VIP"].includes(ct)) {
      throw new GraphQLError("Invalid customerType", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const target = await Customer.findById(id).lean({ virtuals: true });
    if (!target) throw new GraphQLError("User not found", { extensions: { code: "NOT_FOUND" } });
    const hasRestaurant = Array.isArray(target.customerRestaurants) && target.customerRestaurants.some((rid) => String(rid) === String(restaurantId));
    if (!hasRestaurant) throw new GraphQLError("Customer not in restaurant scope", { extensions: { code: "FORBIDDEN" } });
    const saved = await Customer.findByIdAndUpdate(id, { loyaltyPoints: lp, customerType: ct }, { new: true })
      .populate("role")
      .lean({ virtuals: true });
    return sanitizeUserForClient(saved);
  },

  async upsertCustomerRankSettings(
    _,
    { restaurantId, ranks },
    ctx,
  ) {
    const authUser = ctx?.user;
    requireRole(authUser, ["admin", "manager"]);
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const rid = new mongoose.Types.ObjectId(restaurantId);
    await requireRestaurantAccess(ctx, rid);

    const normalizedRanks = (Array.isArray(ranks) ? ranks : [])
      .map((r) => ({
        name: String(r?.name || "").trim(),
        minPoints: Math.max(0, Number(r?.minPoints || 0)),
        benefits: String(r?.benefits || "").trim(),
      }))
      .filter((r) => r.name);

    if (!normalizedRanks.length) {
      throw new GraphQLError("Ranks cannot be empty", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const normalizedNames = normalizedRanks.map((rank) => rank.name.toLowerCase());
    const thresholds = normalizedRanks.map((rank) => rank.minPoints);
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new GraphQLError("Rank names must be unique", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (new Set(thresholds).size !== thresholds.length) {
      throw new GraphQLError("Rank thresholds must be unique", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (!thresholds.includes(0)) {
      throw new GraphQLError("The lowest rank must start at 0 points", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    normalizedRanks.sort((a, b) => a.minPoints - b.minPoints);

    const saved = await CustomerRankSetting.findOneAndUpdate(
      { restaurantId: rid },
      {
        $set: {
          ranks: normalizedRanks,
          updatedBy: authUser?.id
            ? new mongoose.Types.ObjectId(authUser.id)
            : undefined,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return sanitizeUserForClient(saved);
  },

  // ========== verify email mutations ==========
  ...emailVerificationMutation,
};
