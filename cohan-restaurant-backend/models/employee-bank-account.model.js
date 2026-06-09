import mongoose from "mongoose";

const { Schema } = mongoose;

const employeeBankAccountSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    accountHolderName: { type: String, required: true },
    bankName: { type: String, required: true },
    bankCode: { type: String, default: "" },
    accountNumberEncrypted: { type: String, select: false, required: true },
    accountNumberLast4: { type: String, default: "" },
    branchName: { type: String, default: "" },
    isDefault: { type: Boolean, default: true },
    verificationStatus: { type: String, enum: ["unverified", "pending", "verified", "rejected"], default: "pending", index: true },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

employeeBankAccountSchema.index(
  { employeeId: 1, restaurantId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);
employeeBankAccountSchema.index({ employeeId: 1, restaurantId: 1, updatedAt: -1 });

export default mongoose.model("EmployeeBankAccount", employeeBankAccountSchema);
