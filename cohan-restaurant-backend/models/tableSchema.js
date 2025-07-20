import mongoose from "mongoose";

const tableSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  tableNumber: { type: Number, required: true },
  capacity: { type: Number, required: true },
  status: {
    type: String,
    enum: ["available", "occupied", "reserved"],
    default: "available",
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  shape: {
    type: String,
    enum: ["rectangle", "circle"],
    default: "rectangle",
  },
  image: { type: String },
});

export default mongoose.model("Table", tableSchema);
