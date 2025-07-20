import express from "express";
import Table from "../models/tableSchema.js";
import { io } from "../server.js";

const router = express.Router();

// Lấy danh sách bàn theo nhà hàng
router.get("/:restaurantId", async (req, res) => {
  try {
    const tables = await Table.find({ restaurantId: req.params.restaurantId });
    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
});

// Cập nhật trạng thái bàn
router.put("/:id", async (req, res) => {
  try {
    const { status, image } = req.body;
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      { status, image },
      { new: true }
    );
    if (table) {
      io.emit("tableUpdate", table);
    }
    res.json(table);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
});

// Thêm bàn mới
router.post("/", async (req, res) => {
  try {
    const { restaurantId, tableNumber, capacity, position, shape, image } =
      req.body;
    const table = new Table({
      restaurantId,
      tableNumber,
      capacity,
      position,
      shape,
      image,
    });
    await table.save();
    if (table) {
      io.emit("tableUpdate", table);
    }
    res.status(201).json(table);
  } catch (err) {
    res.status(400).json({ error: "Dữ liệu không hợp lệ: " + err.message });
  }
});

export default router;
