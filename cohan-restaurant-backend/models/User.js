import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "manager", "staff", "customer"],
    default: "customer",
  },
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant" }, // Cho admin/staff
  preferredRestaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
  }, // Cho customer, có thể null
  avatar: { type: String, default: "/default-avatar.png" },
});

export default mongoose.model("User", userSchema);
