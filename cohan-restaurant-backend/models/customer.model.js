import mongoose from "mongoose";
import User from "./user.model.js";

const foodPreferencesSchema = new mongoose.Schema(
  {
    diet: { type: String, enum: ["omni", "vegan", "keto", "halal"], default: "omni" },
    allergies: [{ type: String, enum: ["seafood", "peanut", "milk", "egg", "gluten"] }],
    habits: {
      noOnion: { type: Boolean, default: false },
      noCilantro: { type: Boolean, default: false },
      sugar: { type: Number, enum: [0, 30, 50, 70, 100], default: 100 },
      spice: { type: String, enum: ["Không", "Vừa", "Nồng", "Rất cay"], default: "Vừa" },
      ice: { type: Boolean, default: true },
    },
    autoNote: { type: String, default: "" },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);


const customerSchema = new mongoose.Schema(
  {
    loyaltyPoints: { type: Number, default: 0 },

    customerType: {
      type: String,
      enum: ["VIP", "NEW", "OFTEN"],
      default: "NEW",
    },

    totalOrders: { type: Number, default: 0 },
    totalSpending: { type: Number, default: 0 },

    isGuest: { type: Boolean, default: false },
    guestExpiresAt: { type: Date },
    guestLastSeenAt: { type: Date },
    registeredAt: { type: Date },
    foodPreferences: {
      type: foodPreferencesSchema,
      default: () => ({
        diet: "omni",
        allergies: [],
        habits: { noOnion: false, noCilantro: false, sugar: 100, spice: "Vừa", ice: true },
        autoNote: "",
        updatedAt: null,
      }),
    },
  }
);

customerSchema.index(
  { guestExpiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { isGuest: true } }
);

export const Customer =
  mongoose.models.Customer ||
  User.discriminator("Customer", customerSchema, "CUSTOMER");
export default Customer;
