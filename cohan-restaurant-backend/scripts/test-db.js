import "dotenv/config";
import mongoose from "mongoose";
import process from "process";
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB || "foodhub",
    });
    console.log("✅ Test connect OK");
    const colls = await mongoose.connection.db.listCollections().toArray();
    console.log(
      "Collections:",
      colls.map((c) => c.name)
    );
  } catch (e) {
    console.error("❌ Test connect FAIL:", e.message);
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
})();
