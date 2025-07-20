import process from "process";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import orderRoutes from "./routes/order.js";
import tableRoutes from "./routes/table.js";
import restaurantRoutes from "./routes/restaurant.js";
import authMiddleware from "./middleware/authMiddleware.js";
import loggerMiddleware from "./middleware/loggerMiddleware.js";
import errorHandler from "./middleware/errorHandler.js";
import { Server } from "socket.io";
import Order from "./models/Order.js";

dotenv.config();
const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT"],
  })
);
app.use(express.json());
app.use(loggerMiddleware);
app.use("/api/auth", authRoutes);
app.use("/api/orders", authMiddleware, orderRoutes);
app.use("/api/tables", authMiddleware, tableRoutes);
app.use("/api/restaurants", authMiddleware, restaurantRoutes);
app.use(errorHandler);

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = 3001;
const server = app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("A client connected:", socket.id);

  socket.on("orderPlaced", async (data) => {
    const order = await Order.findById(data.order[0]._id);
    order.status = "pendingPayment";
    await order.save();
    io.emit("tableUpdate", order);
    setTimeout(() => {
      if (order.status === "pendingPayment") {
        order.status = "cancelled";
        io.emit("orderCancelled", { tableId: order.tableId });
        io.to(socket.id).emit("paymentReminder", {
          orderId: order._id,
          message: "Đơn hàng đã bị hủy do không thanh toán trong 10 phút.",
        });
      }
    }, 10 * 60 * 1000);
  });

  socket.on("chatMessage", (data) => {
    io.emit("chatMessage", {
      tableId: data.tableId,
      message: data.message,
      sender: data.sender,
    });
  });

  socket.on("requestPayment50", (orderId) => {
    io.emit("paymentRequest", {
      orderId,
      message: "Vui lòng thanh toán 50% trong 10 phút.",
    });
  });
});

export { io };
