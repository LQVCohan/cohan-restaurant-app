import express from "express";
const router = express.Router();
import Restaurant from "../models/Restaurant.js"; // Giả sử model Restaurant đã tồn tại
import Menu from "../models/Menu.js"; // Import Menu để lấy menu khi xem nhà hàng
import Table from "../models/Table.js";
import authMiddleware from "../middleware/authMiddleware.js";
// GET /api/restaurants - Lấy danh sách tất cả nhà hàng (cho customer, không yêu cầu auth)
router.get("/", async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    const restaurantsWithDetails = await Promise.all(
      restaurants.map(async (restaurant) => {
        const emptyTables = await Table.countDocuments({
          restaurantId: restaurant._id,
          status: "available",
        });
        return {
          ...restaurant.toObject(),
          emptyTables,
        };
      })
    );
    res.json(restaurantsWithDetails);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách nhà hàng:", error.message);
    res.status(500).json({ error: "Lỗi server khi lấy danh sách nhà hàng" });
  }
});

// GET /api/restaurants/:id - Xem thông tin một nhà hàng cụ thể (cho customer, bao gồm menu)
router.get("/:id", async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: "Nhà hàng không tồn tại" });
    }
    const emptyTables = await Table.countDocuments({
      restaurantId: restaurant._id,
      status: "available",
    });
    const menus = await Menu.find({ restaurantId: restaurant._id });
    const restaurantWithDetails = {
      ...restaurant.toObject(),
      emptyTables,
      menus,
    };
    res.json(restaurantWithDetails);
  } catch (error) {
    console.error("Lỗi khi lấy thông tin nhà hàng:", error.message);
    res.status(500).json({ error: "Lỗi server khi lấy thông tin nhà hàng" });
  }
});

// POST /api/restaurants - Thêm nhà hàng mới (chỉ admin/manager)
router.post("/", authMiddleware, async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Quyền bị từ chối" });
  }

  try {
    const newRestaurant = new Restaurant(req.body);
    await newRestaurant.save();
    res.status(201).json(newRestaurant);
  } catch (error) {
    console.error("Lỗi khi thêm nhà hàng:", error.message);
    res.status(500).json({ error: "Lỗi server khi thêm nhà hàng" });
  }
});

// PUT /api/restaurants/:id - Sửa nhà hàng (chỉ admin/manager, manager chỉ cho nhà hàng của mình)
router.put("/:id", authMiddleware, async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Quyền bị từ chối" });
  }

  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: "Nhà hàng không tồn tại" });
    }

    // Nếu là manager, chỉ cho phép sửa nhà hàng của mình
    if (
      req.user.role === "manager" &&
      req.user.restaurantId.toString() !== restaurant._id.toString()
    ) {
      return res.status(403).json({ error: "Chỉ được sửa nhà hàng của bạn" });
    }

    Object.assign(restaurant, req.body);
    await restaurant.save();
    res.json(restaurant);
  } catch (error) {
    console.error("Lỗi khi sửa nhà hàng:", error.message);
    res.status(500).json({ error: "Lỗi server khi sửa nhà hàng" });
  }
});

// DELETE /api/restaurants/:id - Xóa nhà hàng (chỉ admin/manager, manager chỉ cho nhà hàng của mình)
router.delete("/:id", authMiddleware, async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Quyền bị từ chối" });
  }

  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ error: "Nhà hàng không tồn tại" });
    }

    // Nếu là manager, chỉ cho phép xóa nhà hàng của mình
    if (
      req.user.role === "manager" &&
      req.user.restaurantId.toString() !== restaurant._id.toString()
    ) {
      return res.status(403).json({ error: "Chỉ được xóa nhà hàng của bạn" });
    }

    await restaurant.deleteOne();
    res.json({ message: "Nhà hàng đã được xóa" });
  } catch (error) {
    console.error("Lỗi khi xóa nhà hàng:", error.message);
    res.status(500).json({ error: "Lỗi server khi xóa nhà hàng" });
  }
});

export default router;
