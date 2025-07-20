import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  tableId: { type: String, required: true },
  items: [
    {
      itemName: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      image: { type: String }, // Minh chứng hình ảnh nếu có
    },
  ],
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pendingPayment", "paid50", "confirmed", "cancelled", "booked"],
    default: "pendingPayment",
  },
  timestamp: { type: Date, default: Date.now },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  arrivalTime: { type: Date },
  qrCode: { type: String }, // Mã QR duy nhất
});

export default mongoose.model("Order", orderSchema);
