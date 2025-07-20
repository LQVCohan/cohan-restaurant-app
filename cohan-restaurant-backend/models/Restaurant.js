import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  menu: [{ type: mongoose.Schema.Types.ObjectId, ref: "Menu" }], // Tham chiếu đến Menu
});

export default mongoose.model("Restaurant", restaurantSchema);
