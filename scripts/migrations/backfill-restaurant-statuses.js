import mongoose from "mongoose";
import Restaurant from "../../cohan-restaurant-backend/models/restaurant.model.js";

const uri = process.env.MONGO_URI;
await mongoose.connect(uri);
const cursor = Restaurant.find({}).cursor();
for await (const r of cursor) {
  if (!r.businessStatus) r.businessStatus = r.status === "inactive" ? "inactive" : "active";
  if (!r.publicationStatus) r.publicationStatus = r.status === "inactive" ? "hidden" : "published";
  if (!r.operationalStatus) r.operationalStatus = "normal";
  if (!r.timezone) r.timezone = "Asia/Ho_Chi_Minh";
  await r.save();
}
await mongoose.disconnect();
console.log("done");
