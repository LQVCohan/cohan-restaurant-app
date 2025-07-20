// routes/menu.js
import express from "express";
const router = express.Router();
import Menu from "../models/Menu.js"; // Giả sử model Menu đã tồn tại
import authMiddleware from "../middleware/authMiddleware.js"; // Import từ middleware

// GET /api/menu - Lấy toàn bộ menu hoặc theo nhà hàng cụ thể
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { restaurantId } = req.query;
    let menus;
    if (restaurantId) {
      // Lấy menu theo nhà hàng cụ thể
      menus = await Menu.find({ restaurantId });
    } else {
      // Lấy toàn bộ menu
      menus = await Menu.find();
    }
    res.json(menus);
  } catch (error) {
    console.error("Lỗi khi lấy menu:", error.message);
    res.status(500).json({ error: "Lỗi server khi lấy menu" });
  }
});

// POST /api/menu - Thêm menu mới (chỉ admin/manager)
router.post("/", authMiddleware, async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Quyền bị từ chối" });
  }

  const { restaurantId, ...menuData } = req.body;

  // Nếu là manager, chỉ cho phép thêm menu cho nhà hàng của mình
  if (
    req.user.role === "manager" &&
    req.user.restaurantId.toString() !== restaurantId
  ) {
    return res
      .status(403)
      .json({ error: "Chỉ được thêm menu cho nhà hàng của bạn" });
  }

  try {
    const newMenu = new Menu({ restaurantId, ...menuData });
    await newMenu.save();
    res.status(201).json(newMenu);
  } catch (error) {
    console.error("Lỗi khi thêm menu:", error.message);
    res.status(500).json({ error: "Lỗi server khi thêm menu" });
  }
});

// PUT /api/menu/:id - Sửa menu (chỉ admin/manager)
router.put("/:id", authMiddleware, async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Quyền bị từ chối" });
  }

  try {
    const menu = await Menu.findById(req.params.id);
    if (!menu) {
      return res.status(404).json({ error: "Menu không tồn tại" });
    }

    // Nếu là manager, chỉ cho phép sửa menu của nhà hàng mình
    if (
      req.user.role === "manager" &&
      req.user.restaurantId.toString() !== menu.restaurantId.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Chỉ được sửa menu của nhà hàng bạn" });
    }

    Object.assign(menu, req.body);
    await menu.save();
    res.json(menu);
  } catch (error) {
    console.error("Lỗi khi sửa menu:", error.message);
    res.status(500).json({ error: "Lỗi server khi sửa menu" });
  }
});

// DELETE /api/menu/:id - Xóa menu (chỉ admin/manager)
router.delete("/:id", authMiddleware, async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Quyền bị từ chối" });
  }

  try {
    const menu = await Menu.findOneAndDelete({ _id: req.params.id });
    if (!menu) {
      return res.status(404).json({ error: "Menu không tồn tại" });
    }

    // Nếu là manager, chỉ cho phép xóa menu của nhà hàng mình
    if (
      req.user.role === "manager" &&
      req.user.restaurantId.toString() !== menu.restaurantId.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Chỉ được xóa menu của nhà hàng bạn" });
    }

    res.json({ message: "Menu đã được xóa" });
  } catch (error) {
    console.error("Lỗi khi xóa menu:", error.message);
    res.status(500).json({ error: "Lỗi server khi xóa menu" });
  }
});

export default router;
