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

    // Tìm user để lấy thông tin bổ sung
    const { default: User } = await import("../models/User.js");
    const user = await User.findById(req.user.id).select(
      "role restaurantId preferredRestaurant"
    );
    if (!user) {
      return res.status(401).json({ error: "User không tồn tại" });
    }

    // Kiểm tra và giới hạn quyền theo role
    if (req.user.role === "manager") {
      if (!user.restaurantId) {
        return res
          .status(403)
          .json({ error: "Manager chưa được gán nhà hàng" });
      }
      req.user.restaurantId = user.restaurantId; // Gán restaurantId cho manager
      // Kiểm tra quyền truy cập bàn hoặc tài nguyên khác nếu cần
      if (
        req.path.includes("/api/tables") &&
        user.restaurantId.toString() !== req.params.restaurantId
      ) {
        return res
          .status(403)
          .json({ error: "Chỉ được quản lý bàn của nhà hàng bạn" });
      }
    } else if (req.user.role === "customer") {
      // Tự động cập nhật preferredRestaurant nếu chưa có (từ order gần nhất)
      if (!user.preferredRestaurant) {
        const { default: Order } = await import("../models/Order.js");
        const latestOrder = await Order.findOne({ customerId: req.user.id })
          .sort({ createdAt: -1 })
          .select("restaurantId");
        if (latestOrder && latestOrder.restaurantId) {
          user.preferredRestaurant = latestOrder.restaurantId;
          await user.save();
        }
      }
      req.user.preferredRestaurant = user.preferredRestaurant; // Gán preferredRestaurant cho customer (có thể null)
    } else if (req.user.role === "admin") {
      // Admin quản lý tất cả, không cần restaurantId
    } else {
      return res.status(403).json({ error: "Quyền bị từ chối" });
    }

    next();
  } catch (error) {
    console.error("Lỗi xác thực token:", error.message);
    res.status(401).json({ error: "Token không hợp lệ: " + error.message });
  }
};

export default authMiddleware;
