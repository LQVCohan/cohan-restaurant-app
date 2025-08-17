import express from "express";
const router = express.Router();
import Category from "../models/Category.js";

// GET /api/categories - Lấy toàn bộ categories hoặc theo nhà hàng
router.get("/", async (req, res) => {
  try {
    const { restaurantId } = req.query;
    let categories;
    if (restaurantId) {
      categories = await Category.find({ restaurantId });
    } else {
      categories = await Category.find();
    }
    res.json(categories);
  } catch (error) {
    console.error("Lỗi khi lấy categories:", error.message);
    res.status(500).json({ error: "Lỗi server khi lấy categories" });
  }
});

// POST /api/categories - Thêm category mới (admin/manager)
router.post("/", async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Quyền bị từ chối" });
  }
  const { restaurantId, ...categoryData } = req.body;
  if (
    req.user.role === "manager" &&
    req.user.restaurantId.toString() !== restaurantId
  ) {
    return res
      .status(403)
      .json({ error: "Chỉ được thêm category cho nhà hàng của bạn" });
  }
  try {
    const newCategory = new Category({ restaurantId, ...categoryData });
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    console.error("Lỗi khi thêm category:", error.message);
    res.status(500).json({ error: "Lỗi server khi thêm category" });
  }
});

// PUT /api/categories/:id - Sửa category (admin/manager)
router.put("/:id", async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Quyền bị từ chối" });
  }
  try {
    const category = await Category.findById(req.params.id);
    if (!category)
      return res.status(404).json({ error: "Category không tồn tại" });
    if (
      req.user.role === "manager" &&
      req.user.restaurantId.toString() !== category.restaurantId.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Chỉ được sửa category của nhà hàng bạn" });
    }
    Object.assign(category, req.body);
    await category.save();
    res.json(category);
  } catch (error) {
    console.error("Lỗi khi sửa category:", error.message);
    res.status(500).json({ error: "Lỗi server khi sửa category" });
  }
});

// DELETE /api/categories/:id - Xóa category (admin/manager)
router.delete("/:id", async (req, res) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({ error: "Quyền bị từ chối" });
  }
  try {
    const category = await Category.findById(req.params.id);
    if (!category)
      return res.status(404).json({ error: "Category không tồn tại" });
    if (
      req.user.role === "manager" &&
      req.user.restaurantId.toString() !== category.restaurantId.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Chỉ được xóa category của nhà hàng bạn" });
    }
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: "Category đã được xóa" });
  } catch (error) {
    console.error("Lỗi khi xóa category:", error.message);
    res.status(500).json({ error: "Lỗi server khi xóa category" });
  }
});

export default router;
