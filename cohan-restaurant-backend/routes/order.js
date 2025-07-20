import process from "process";
import express from "express";
import Order from "../models/Order.js";
import Restaurant from "../models/Restaurant.js";
import { io } from "../server.js";

const router = express.Router();

router.post("/create", async (req, res, next) => {
  const {
    tableId,
    items,
    totalAmount,
    customerId,
    restaurantIds,
    arrivalTime,
  } = req.body;
  try {
    const validRestaurants = await Restaurant.find({
      _id: { $in: restaurantIds },
    });
    if (validRestaurants.length !== restaurantIds.length) {
      return res
        .status(400)
        .json({ error: "Một hoặc nhiều restaurantIds không tồn tại" });
    }

    if (req.user.role === "customer" && req.restaurantIds) {
      const isValid = restaurantIds.every((id) =>
        req.restaurantIds.includes(id)
      );
      if (!isValid) {
        return res
          .status(403)
          .json({ error: "Chỉ được đặt món trong các nhà hàng đã chọn" });
      }
    }

    if (
      req.user.role === "manager" &&
      !restaurantIds.includes(req.restaurantId)
    ) {
      return res
        .status(403)
        .json({ error: "Chỉ được tạo order trong nhà hàng của bạn" });
    }

    const orders = [];
    for (const restaurantId of restaurantIds) {
      const order = new Order({
        tableId,
        items,
        totalAmount,
        customerId,
        restaurantId,
        arrivalTime,
        status: "pendingPayment",
        qrCode: null, // Sẽ tạo sau khi xác nhận
      });
      await order.save();
      orders.push(order);
    }

    res.status(201).json(orders);
  } catch (error) {
    next(error);
  }
});

router.put("/changeTable/:orderId", async (req, res, next) => {
  const { newTableId, orderData } = req.body;
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order)
      return res.status(404).json({ error: "Đơn hàng không tồn tại" });
    order.tableId = newTableId;
    await order.save();
    io.emit("tableUpdate", order);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

router.put("/pay50/:orderId", async (req, res, next) => {
  const { status } = req.body;
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order)
      return res.status(404).json({ error: "Đơn hàng không tồn tại" });
    if (status === "paid50") {
      order.status = "paid50";
      await order.save();
      io.emit("orderUpdated", order);
      res.json(order);
    } else {
      res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }
  } catch (error) {
    next(error);
  }
});

router.get("/all", async (req, res, next) => {
  try {
    let orders;
    if (req.user.role === "manager") {
      orders = await Order.find({ restaurantId: req.restaurantId })
        .populate("customerId")
        .populate("restaurantId");
    } else if (req.user.role === "customer") {
      orders = await Order.find({ customerId: req.user.id }).populate(
        "restaurantId"
      );
    } else {
      orders = await Order.find()
        .populate("customerId")
        .populate("restaurantId");
    }
    res.json(orders);
  } catch (error) {
    next(error);
  }
});

export default router;
