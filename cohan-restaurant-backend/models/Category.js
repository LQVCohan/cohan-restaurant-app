import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  }, // Liên kết nhà hàng
  name: { type: String, required: true },
  icon: { type: String, required: false },
  color: { type: String, required: false },
  itemCount: { type: Number, required: false, default: 0 },
});

export default mongoose.model("Category", categorySchema);
