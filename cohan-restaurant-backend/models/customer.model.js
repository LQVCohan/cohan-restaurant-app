import mongoose from "mongoose";
import User from "./user.model.js";

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
    guestCreatedAt: { type: Date, default: null },
    guestLastSeenAt: { type: Date, default: null },
    registeredAt: { type: Date, default: null },
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
