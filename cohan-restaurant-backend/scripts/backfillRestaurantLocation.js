import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import { Restaurant } from "../models/index.js";

dotenv.config();

function isValidLatLng(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

async function run() {
  await connectDB();

  let updatedLocation = 0;
  let unsetLocation = 0;
  let skipped = 0;

  const cursor = Restaurant.find({}).cursor();
  for await (const restaurant of cursor) {
    const lat = Number(restaurant?.address?.lat);
    const lng = Number(restaurant?.address?.lng);

    if (isValidLatLng(lat, lng)) {
      const nextLocation = { type: "Point", coordinates: [lng, lat] };
      const same =
        restaurant?.location?.type === "Point" &&
        Number(restaurant?.location?.coordinates?.[0]) === lng &&
        Number(restaurant?.location?.coordinates?.[1]) === lat;
      if (same) {
        skipped += 1;
        continue;
      }
      restaurant.location = nextLocation;
      await restaurant.save();
      updatedLocation += 1;
      continue;
    }

    if (restaurant.location) {
      restaurant.location = undefined;
      await restaurant.save();
      unsetLocation += 1;
    } else {
      skipped += 1;
    }
  }

  console.log("Backfill restaurant location completed.");
  console.log(`updatedLocation=${updatedLocation}`);
  console.log(`unsetLocation=${unsetLocation}`);
  console.log(`skipped=${skipped}`);
}

run()
  .catch((error) => {
    console.error("Backfill restaurant location failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
