// phải export mặc định 1 object có key login
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "../../models/index.js";
import process from "process";
import { GraphQLError } from "graphql";
const signToken = (user) => {
  const payload = {
    id: String(user._id),
    email: user.email,
    roles: user.roles?.map(String) || [],
  };
  return jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: "7d",
  });
};

export default {
  async login(_, { email, password }) {
    try {
      const user = await User.findOne({ email }).populate("roles");

      if (!user) throw new Error("User not found");
      if (!user.passwordHash) throw new Error("User has no passwordHash field");

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) throw new Error("Invalid credentials");
      if (user.status !== "active") throw new Error("User is not active");

      const token = signToken(user);
      return {
        token,
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          roleNames: user.roles?.map((r) => r.name) || [],
        },
      };
    } catch (err) {
      console.error("login error:", err);
      throw new GraphQLError(err.message || "Login failed", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },

  // ... các mutation khác (nếu có)
};
