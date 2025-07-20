import process from "process";
import jwt from "jsonwebtoken";

const authMiddleware = async (req, res, next) => {
  // Lấy token từ header
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Không có token hoặc định dạng không hợp lệ" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Xác minh token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.role) {
      return res
        .status(401)
        .json({ error: "Token không hợp lệ hoặc không chứa role" });
    }

    req.user = decoded; // Gán thông tin user (id, role)

    // Kiểm tra và giới hạn quyền theo role
    if (req.user.role === "manager") {
      const { default: User } = await import("../models/User.js");
      const user = await User.findById(req.user.id).select("restaurantId");
      if (!user || !user.restaurantId) {
        return res
          .status(403)
          .json({ error: "Manager chưa được gán nhà hàng" });
      }
      console.log("user.restaurantId: ", user.restaurantId);
      req.user.restaurantId = user.restaurantId; // Gán restaurantId cho manager
      // Kiểm tra quyền truy cập bàn
      if (
        req.path.includes("/api/tables") &&
        user.restaurantId.toString() !== req.params.restaurantId
      ) {
        return res
          .status(403)
          .json({ error: "Chỉ được quản lý bàn của nhà hàng bạn" });
      }
    } else if (req.user.role === "customer") {
      // Kiểm tra restaurantIds từ request
      const restaurantIds = req.body?.restaurantIds;
      if (
        !restaurantIds ||
        !Array.isArray(restaurantIds) ||
        restaurantIds.length === 0
      ) {
        return res.status(400).json({
          error: "restaurantIds là bắt buộc và phải là mảng không rỗng",
        });
      }
      req.restaurantIds = restaurantIds; // Lưu mảng restaurantIds cho customer
    } else if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Quyền bị từ chối" });
    }

    next(); // Cho phép tiếp tục nếu hợp lệ
  } catch (error) {
    console.error("Lỗi xác thực token:", error.message);
    res.status(401).json({ error: "Token không hợp lệ: " + error.message });
  }
};

export default authMiddleware;
