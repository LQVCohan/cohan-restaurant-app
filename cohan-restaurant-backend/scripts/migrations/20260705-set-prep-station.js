import mongoose from "mongoose";
import dotenv from "dotenv";
import { MenuItem } from "../../models/index.js";

dotenv.config();

const station = String(
  process.argv.find((value) => value.startsWith("--station="))?.split("=")[1] || "",
).toLowerCase();
const apply = process.argv.includes("--apply");
const validStations = new Set(["kitchen", "bar"]);

if (!validStations.has(station)) {
  throw new Error("Use --station=kitchen or --station=bar");
}

const ids = String(
  process.argv.find((value) => value.startsWith("--ids="))?.split("=")[1] || "",
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (ids.some((id) => !mongoose.isValidObjectId(id))) {
  throw new Error("--ids contains an invalid menu item id");
}

const mongoUri =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB";
const dbName = process.env.MONGO_DB || "RestaurantDB";

await mongoose.connect(mongoUri, { dbName });

try {
  const query = ids.length
    ? { _id: { $in: ids } }
    : {
        $or: [
          { prepStation: { $exists: false } },
          { prepStation: null },
          { prepStation: { $nin: ["kitchen", "bar"] } },
        ],
      };

  const items = await MenuItem.find(query)
    .select({ _id: 1, name: 1, restaurantId: 1, prepStation: 1 })
    .sort({ restaurantId: 1, name: 1 })
    .lean();

  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${items.length} item(s) -> ${station}`);
  console.table(
    items.slice(0, 50).map((item) => ({
      id: String(item._id),
      name: item.name,
      current: item.prepStation || "missing",
      next: station,
    })),
  );

  if (apply && items.length) {
    const result = await MenuItem.updateMany(
      { _id: { $in: items.map((item) => item._id) } },
      { $set: { prepStation: station } },
      { runValidators: true },
    );
    console.log(`Updated: ${result.modifiedCount || 0}`);
  }
} finally {
  await mongoose.disconnect();
}
