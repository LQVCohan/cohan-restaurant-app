// phải export mặc định 1 object có key login
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User, Restaurant } from "../../models/index.js";
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
  async createUser(_, { input }, { user /*, loaders, ...context */ }) {
    try {
      const {
        fullName,
        username,
        email,
        phone,
        address,
        password,
        provider = "local",
        status = "active",
        roleIds,
        refRestaurantIds,
        customerType = "NEW",
      } = input;

      // (Tuỳ chọn) kiểm tra quyền: chỉ admin mới được tạo user
      // if (!user || !user.roles?.includes('admin')) throw new GraphQLError('Forbidden', { extensions:{ code:'FORBIDDEN' }});

      // Khởi tạo
      const doc = new User({
        fullName,
        username,
        email,
        phone,
        address,
        provider,
        status,
        customerType,
      });

      // Gán password -> passwordHash
      if (password) {
        await doc.setPassword(input.password);
      }

      // Gán roles nếu truyền vào
      if (Array.isArray(roleIds) && roleIds.length) {
        // Optional: validate roleIds tồn tại
        const roles = await Role.find(
          { _id: { $in: roleIds } },
          { _id: 1 }
        ).lean();
        doc.roles = roles.map((r) => r._id);
      }

      // Gán refRestaurants nếu có
      if (Array.isArray(refRestaurantIds) && refRestaurantIds.length) {
        const exists = await Restaurant.find(
          { _id: { $in: refRestaurantIds } },
          { _id: 1 }
        ).lean();
        doc.refRestaurants = exists.map((r) => r._id);
      }

      await doc.save();
      return doc.toObject();
    } catch (err) {
      // Lỗi unique email/phone/username
      if (err?.code === 11000) {
        const dupField = Object.keys(err.keyPattern || {})[0] || "field";
        throw new GraphQLError(`Duplicate ${dupField}`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      throw new GraphQLError(err.message || "Create user failed", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },
  async createRestaurant(_, { input }) {
    try {
      const { managerId } = input;
      const manager = await User.findById(managerId).lean();
      if (!manager) throw new GraphQLError("Manager not found");

      // 2) Kiểm tra quyền/role nếu hệ thống có (ví dụ user.roles chứa 'manager')
      const isManager =
        Array.isArray(manager.roles) &&
        manager.roles.some((r) => (r.name || r) === "manager");
      if (!isManager) throw new GraphQLError("User is not a manager");

      // 3) Kiểm tra đã gán ở nhà hàng khác chưa
      const existed = await Restaurant.findOne({ managerId }).lean();
      if (existed)
        throw new GraphQLError(
          "This manager is already assigned to another restaurant"
        );
      // Tạo mới nhà hàng từ thông tin input
      const newRestaurant = new Restaurant(input);
      await newRestaurant.save(); // Lưu nhà hàng vào MongoDB
      return newRestaurant; // Trả về nhà hàng vừa tạo
    } catch (err) {
      console.error("Error creating restaurant:", err);
      throw new GraphQLError("Error creating restaurant", {
        extensions: { code: "INTERNAL_SERVER_ERROR" },
      });
    }
  },
  async updateRestaurantManager(_, { input }) {
    const { restaurantId, managerId } = input;

    const manager = await User.findById(managerId).lean();
    if (!manager) throw new GraphQLError("Manager not found");

    const isManager =
      Array.isArray(manager.roles) &&
      manager.roles.some((r) => (r.name || r) === "manager");
    if (!isManager) throw new GraphQLError("User is not a manager");

    // đảm bảo manager mới chưa được gán ở nơi khác
    const occupied = await Restaurant.findOne({ managerId }).lean();
    if (occupied && String(occupied._id) !== String(restaurantId)) {
      throw new GraphQLError(
        "This manager is already assigned to another restaurant"
      );
    }

    const updated = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { managerId },
      { new: true }
    );
    if (!updated) throw new GraphQLError("Restaurant not found");

    return updated.toObject ? updated.toObject() : updated;
  },
  async login(_, { email, password }) {
    try {
      const user = await User.findOne({ email }).populate("roles");

      if (!user) throw new Error("User not found");
      if (!user.passwordHash) throw new Error("User has no passwordHash field");

      const ok = await user.checkPassword(password);
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
