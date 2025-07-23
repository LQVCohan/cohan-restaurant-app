// migration.js
import mongoose from "mongoose";
import Restaurant from "./models/Restaurant.js"; // Adjust path as needed
import process from "process";
// Connect to MongoDB (replace with your connection string)
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/your-database",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const migrateRestaurants = async () => {
  try {
    const result = await Restaurant.updateMany(
      {},
      {
        $set: {
          coverImage: "/default-cover.png",
          description: "",
          managerName: "",
          promotions: "",
        },
      },
      { upsert: false } // Prevent creating new documents
    );
    console.log("Migration complete. Updated documents:", result.modifiedCount);
  } catch (error) {
    console.error("Migration error:", error.message);
  } finally {
    mongoose.connection.close();
  }
};

migrateRestaurants();
