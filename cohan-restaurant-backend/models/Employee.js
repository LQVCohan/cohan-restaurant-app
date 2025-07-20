import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  salary: { type: Number, required: true },
  shifts: [{ day: String, time: String }],
  role: {
    type: String,
    enum: ["waiter", "chef", "manager"],
    default: "waiter",
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
});

export default mongoose.model("Employee", employeeSchema);
