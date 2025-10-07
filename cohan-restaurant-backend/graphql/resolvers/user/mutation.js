// src/graphql/resolvers/user/mutation.js
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { User, Role } from "../../../models/index.js";
import process from "process";
import { requireRole } from "../../../utils/authz.js";
const signToken = (user) => {
  const payload = {
    id: String(user._id),
    email: user.email,
    role: (user.slug || user.name || "").toLowerCase(),
  };
  return jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: "7d",
  });
};

export const UserMutation = {
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
    u.role = roleId; // một role duy nhất
    await u.save();

    return u.toObject();
  },

  createUser: async (_, { input }) => {
    const {
      fullName,
      username,
      email,
      phone,
      address,
      password,
      roleId,
      customerType,
      provider = "local",
    } = input;

    if (!fullName?.trim()) {
      throw new GraphQLError("fullName is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (!password || password.length < 6) {
      throw new GraphQLError("Password must be at least 6 characters", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    let roleDoc = null;
    if (roleId) {
      if (!mongoose.isValidObjectId(roleId)) {
        throw new GraphQLError("Invalid roleId", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      roleDoc = await Role.findById(roleId).lean();
      if (!roleDoc) {
        throw new GraphQLError("Role not found", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
    }
    // Uniqueness checks
    const exists = await User.findOne({
      $or: [
        { email: input.email?.toLowerCase().trim() },
        { phone: input.phone?.replace(/\s+/g, "").replace(/^\+84/, "0") },
        { username: input.username?.toLowerCase().trim() },
      ],
    });

    if (exists) {
      throw new GraphQLError("Email/Phone/Username already in use", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    // Tạo user
    const doc = new User({
      fullName: fullName.trim(),
      username: username?.trim(),
      email: email?.toLowerCase().trim(),
      phone: phone?.trim(),
      address: address || undefined,
      provider,
      status: "active",
      customerType: customerType || "NEW",
      role: roleId || undefined,
      loyaltyPoints: 0,
      totalOrders: 0,
      totalSpend: 0,
    });

    await doc.setPassword(password);

    await doc.save();

    const userObj = await User.findById(doc._id)
      .populate("role")
      .lean({ virtuals: true });

    const token = signToken({ ...userObj, role: userObj.role });

    const roleName = (
      userObj.role?.slug ||
      userObj.role?.name ||
      ""
    ).toLowerCase();
    return {
      token,
      user: { ...userObj, roleName },
    };
  },

  // Đăng nhập bằng một trong email/username/phone
  login: async (_, { email, username, phone, password }) => {
    if (!password) {
      throw new GraphQLError("Password is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    const q = {
      $or: [
        ...(email ? [{ email: email.toLowerCase().trim() }] : []),
        ...(username ? [{ username: username.trim() }] : []),
        ...(phone ? [{ phone: phone.trim() }] : []),
      ],
    };
    if (q.$or.length === 0) {
      throw new GraphQLError("Provide one of email/username/phone", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const user = await User.findOne(q).populate("role");
    if (!user)
      throw new GraphQLError("Invalid credentials", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    if (!user.passwordHash)
      throw new GraphQLError("User has no password", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    if (user.status !== "active")
      throw new GraphQLError("User is not active", {
        extensions: { code: "FORBIDDEN" },
      });

    // check password
    let ok = false;
    if (user.checkPassword) {
      ok = await user.checkPassword(password);
    }
    if (!ok)
      throw new GraphQLError("Invalid credentials", {
        extensions: { code: "UNAUTHENTICATED" },
      });

    const userObj = await User.findById(user._id)
      .populate("role")
      .lean({ virtuals: true });

    const token = signToken({ ...userObj, role: userObj.role });

    const roleName = (
      userObj.role?.slug ||
      userObj.role?.name ||
      ""
    ).toLowerCase();

    return {
      token,
      user: { ...userObj, roleName },
    };
  },
};
