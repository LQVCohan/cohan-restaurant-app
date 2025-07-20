import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, default: "/default-restaurant.png" },
  openingHours: { type: String, required: true }, // e.g., "8AM - 10PM"
  signatureDishes: [{ type: String }], // Array of dish names
  phone: { type: String, required: true },
  address: { type: String, required: true },
  // Other fields as needed
});

export default mongoose.model("Restaurant", restaurantSchema);
