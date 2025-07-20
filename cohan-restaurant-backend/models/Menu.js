import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  image: { type: String }, // URL hoặc path hình ảnh món ăn
});

const menuSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  category: { type: String, required: true },
  items: [menuItemSchema],
});

export default mongoose.model("Menu", menuSchema);
