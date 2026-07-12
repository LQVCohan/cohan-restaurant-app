import mongoose from "mongoose";
import { Restaurant } from "../../../models/index.js";
import {
  normalizePaymentMode,
  normalizePaymentProvider,
} from "./paymentCredential.service.js";

const DEFAULT_PROVIDER_META = {
  momo: { label: "MoMo", priority: 1 },
  vnpay: { label: "VNPAY", priority: 2 },
};

export async function enableRestaurantPaymentProvider({ restaurantId, provider, mode }) {
  if (!mongoose.isValidObjectId(restaurantId)) throw new Error("Invalid restaurantId");
  const normalizedProvider = normalizePaymentProvider(provider);
  const normalizedMode = normalizePaymentMode(mode);
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) throw new Error("Restaurant not found");

  const current = Array.isArray(restaurant.paymentSettings?.providers)
    ? restaurant.paymentSettings.providers.map((item) => ({
        provider: String(item?.provider || "").toLowerCase(),
        label: item?.label || DEFAULT_PROVIDER_META[item?.provider]?.label || "",
        active: item?.active !== false,
        priority: Number(item?.priority || DEFAULT_PROVIDER_META[item?.provider]?.priority || 0),
        mode: normalizePaymentMode(item?.mode),
      }))
    : [];
  const providerIndex = current.findIndex((item) => item.provider === normalizedProvider);
  const nextProvider = {
    provider: normalizedProvider,
    label: DEFAULT_PROVIDER_META[normalizedProvider].label,
    active: true,
    priority: DEFAULT_PROVIDER_META[normalizedProvider].priority,
    mode: normalizedMode,
  };

  if (providerIndex >= 0) current[providerIndex] = { ...current[providerIndex], ...nextProvider };
  else current.push(nextProvider);

  restaurant.paymentSettings = {
    defaultProvider: restaurant.paymentSettings?.defaultProvider || normalizedProvider,
    providers: current.sort((a, b) => a.priority - b.priority),
  };
  await restaurant.save();
  return restaurant;
}
