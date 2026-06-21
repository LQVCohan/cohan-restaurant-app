import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import CustomerAddress from "../../../models/customer-address.model.js";

const requireUserId = (user) => {
  const userId = user?.id || user?._id;
  if (!userId) {
    throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
  }
  return new mongoose.Types.ObjectId(userId);
};

const clean = (value) => String(value ?? "").trim();

function normalizePhoneNumber(value) {
  const raw = String(value ?? "").trim();
  const normalized = raw.replace(/[\s().-]/g, "");

  if (!/^\+?\d{7,15}$/.test(normalized)) {
    throw new GraphQLError("Invalid phone number", {
      extensions: {
        code: "BAD_USER_INPUT",
        field: "phone",
      },
    });
  }

  return normalized;
}

const normalizeInput = (input = {}, existing = {}) => {
  const next = {
    label: ["home", "office", "other"].includes(input.label) ? input.label : existing.label || "home",
    receiverName: clean(input.receiverName ?? existing.receiverName),
    phone: normalizePhoneNumber(input.phone ?? existing.phone),
    province: clean(input.province ?? existing.province),
    district: clean(input.district ?? existing.district),
    ward: clean(input.ward ?? existing.ward),
    specificAddress: clean(input.specificAddress ?? existing.specificAddress),
    fullAddress: clean(input.fullAddress ?? existing.fullAddress),
    note: clean(input.note ?? existing.note),
  };
  if (typeof input.isDefault === "boolean") next.isDefault = input.isDefault;
  if (!next.receiverName || !next.phone || !next.province || !next.district || !next.ward || !next.specificAddress) {
    throw new GraphQLError("Missing required address fields", { extensions: { code: "BAD_USER_INPUT" } });
  }
  if (!next.fullAddress) {
    next.fullAddress = [next.specificAddress, next.ward, next.district, next.province].filter(Boolean).join(", ");
  }
  return next;
};

const sortAddressBook = (query) => query.sort({ isDefault: -1, updatedAt: -1, createdAt: -1 });

export default {
  Query: {
    async myAddresses(_, __, { user }) {
      const userId = requireUserId(user);
      return sortAddressBook(CustomerAddress.find({ userId })).lean();
    },
  },
  Mutation: {
    async createCustomerAddress(_, { input }, { user }) {
      const userId = requireUserId(user);
      const count = await CustomerAddress.countDocuments({ userId });
      const doc = await CustomerAddress.create({ ...normalizeInput(input), userId, isDefault: count === 0 ? true : Boolean(input?.isDefault) });
      return doc.toObject();
    },
    async updateCustomerAddress(_, { id, input }, { user }) {
      const userId = requireUserId(user);
      const address = await CustomerAddress.findOne({ _id: id, userId });
      if (!address) throw new GraphQLError("Address not found", { extensions: { code: "NOT_FOUND" } });
      Object.assign(address, normalizeInput(input, address.toObject()));
      await address.save();
      return address.toObject();
    },
    async deleteCustomerAddress(_, { id }, { user }) {
      const userId = requireUserId(user);
      const deleted = await CustomerAddress.findOneAndDelete({ _id: id, userId });
      if (!deleted) throw new GraphQLError("Address not found", { extensions: { code: "NOT_FOUND" } });
      if (deleted.isDefault) {
        const fallback = await sortAddressBook(CustomerAddress.findOne({ userId }));
        if (fallback) {
          fallback.isDefault = true;
          await fallback.save();
        }
      }
      return true;
    },
    async setDefaultCustomerAddress(_, { id }, { user }) {
      const userId = requireUserId(user);
      const address = await CustomerAddress.findOne({ _id: id, userId });
      if (!address) throw new GraphQLError("Address not found", { extensions: { code: "NOT_FOUND" } });
      await CustomerAddress.updateMany({ userId, _id: { $ne: address._id } }, { $set: { isDefault: false } });
      address.isDefault = true;
      await address.save();
      return address.toObject();
    },
  },
};
