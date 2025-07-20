import mongoose from "mongoose";

const tableSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  tableNumber: {
    type: Number,
    required: true,
  },
  shape: {
    type: String,
    enum: ["rectangle", "circle"],
    default: "rectangle",
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  status: {
    type: String,
    enum: ["available", "occupied", "reserved", "pendingPayment"],
    default: "available",
  },

  capacity: {
    type: Number,
    default: 4,
  }, // Optional: Sức chứa bàn
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Table", tableSchema);
