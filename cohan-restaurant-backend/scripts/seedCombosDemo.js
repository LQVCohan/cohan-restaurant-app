import mongoose from "mongoose";
import dotenv from "dotenv";
import { Combo, MenuItem, Promotion, Restaurant } from "../models/index.js";

dotenv.config();
const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cohan-restaurant";
const pick = (items, start, count) => items.slice(start, start + count).map((item, index) => ({ menuItemId: item._id, qty: index === 0 && count > 3 ? 2 : 1 }));
const sum = (rows) => rows.reduce((total, row) => total + Number(row.menuItemId?.basePrice || 0) * Number(row.qty || 1), 0);

async function main() {
  await mongoose.connect(uri);
  const restaurant = await Restaurant.findOne({ status: "active" }).sort({ updatedAt: -1, _id: 1 });
  if (!restaurant) { console.warn("[seed:combos] No active restaurant found; skipped."); return; }
  const menuItems = await MenuItem.find({ restaurantId: restaurant._id, status: "available" }).sort({ basePrice: -1, _id: 1 }).limit(12);
  if (menuItems.length < 4) { console.warn("[seed:combos] Need at least 4 available menu items; skipped."); return; }
  const specs = [
    ["Combo 1 người tiết kiệm", pick(menuItems, 0, 2), 0.88],
    ["Combo 2 người no nhanh", pick(menuItems, 1, 3), 0.85],
    ["Combo nhẹ bụng", pick(menuItems, 2, 2), 0.9],
    ["Combo bạn bè 3-4 người", pick(menuItems, 0, 4), 0.82],
    ["Combo gia đình", pick(menuItems, 1, 5), 0.8],
  ];
  for (const [name, rows, factor] of specs) {
    await Combo.findOneAndUpdate(
      { restaurantId: restaurant._id, name },
      { restaurantId: restaurant._id, name, description: "Combo cố định được seed để khách đặt nhanh.", imageUrl: rows[0]?.menuItemId?.thumbImage || "", items: rows.map((row) => ({ menuItemId: row.menuItemId._id, qty: row.qty })), price: Math.max(1000, Math.round(sum(rows) * factor / 1000) * 1000), isActive: true },
      { upsert: true, new: true },
    );
  }
  const promoRows = pick(menuItems, 0, 3).map((row) => ({ itemId: row.menuItemId._id, quantity: row.qty }));
  await Promotion.findOneAndUpdate({ restaurantId: restaurant._id, code: "COMBOFIXED" }, { restaurantId: restaurant._id, name: "Mua đủ set giảm cố định", code: "COMBOFIXED", promotionType: "COMBO", scope: "ITEM", discountType: "AMOUNT", discountValue: 30000, comboItems: promoRows, isActive: true, startAt: new Date(Date.now() - 86400000), endAt: new Date(Date.now() + 30 * 86400000) }, { upsert: true });
  await Promotion.findOneAndUpdate({ restaurantId: restaurant._id, code: "COMBOPERCENT" }, { restaurantId: restaurant._id, name: "Mua đủ set giảm phần trăm", code: "COMBOPERCENT", promotionType: "COMBO", scope: "ITEM", discountType: "PERCENT", discountValue: 12, comboItems: promoRows, isActive: true, startAt: new Date(Date.now() - 86400000), endAt: new Date(Date.now() + 30 * 86400000) }, { upsert: true });
  console.log("[seed:combos] Seeded 5 combos and 2 COMBO promotions.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => mongoose.disconnect());
