import process from "process";
import express from "express";
import Menu from "../models/Menu.js";
import Restaurant from "../models/Restaurant.js";

const router = express.Router();

// API trả về menu dựa trên restaurantId từ user
router.get("/menu", async (req, res) => {
  try {
    console.log("Fetching menu - req.user:", req.user); // Debug toàn bộ req.user
    if (!req.user?.restaurantId) {
      return res.status(400).json({ error: "Không có restaurantId hợp lệ" });
    }
    const restaurantId = req.user.restaurantId; // Lấy restaurantId từ user
    console.log("Fetching menu for restaurantId:", restaurantId); // Debug
    const menus = await Menu.find({ restaurantId }).populate("items");
    if (!menus || menus.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy menu cho nhà hàng này" });
    }
    res.json(menus);
  } catch (err) {
    console.error("Lỗi khi lấy menu:", err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
});

// API tạo menu mới (cho admin/manager)
router.post("/menu", async (req, res) => {
  const { restaurantId, category, items } = req.body;
  try {
    if (
      !req.user?.restaurantId ||
      req.user.restaurantId.toString() !== restaurantId
    ) {
      return res
        .status(403)
        .json({ error: "Không được phép tạo menu cho nhà hàng khác" });
    }
    const newMenu = new Menu({ restaurantId, category, items });
    await newMenu.save();
    // Cập nhật mảng menu trong Restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (restaurant) {
      restaurant.menu.push(newMenu._id);
      await restaurant.save();
    }
    res.status(201).json(newMenu);
  } catch (err) {
    res.status(500).json({ error: "Lỗi khi tạo menu: " + err.message });
  }
});

// API lấy thông tin nhà hàng
router.get("/:id", async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).populate(
      "menu"
    );
    if (!restaurant) {
      return res.status(404).json({ error: "Nhà hàng không tồn tại" });
    }
    res.json(restaurant);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Lỗi khi lấy thông tin nhà hàng: " + err.message });
  }
});

export default router;
