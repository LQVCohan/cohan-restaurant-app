import "dotenv/config";
import mongoose from "mongoose";
import process from "process";
import {
  AvailabilityRegistrationWindow,
  StaffAvailabilitySubmission,
} from "../models/index.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB || "cohan",
  });

  const closedWindows = await AvailabilityRegistrationWindow.find(
    { status: "closed" },
    { _id: 1 },
  ).lean();

  const windowIds = closedWindows.map((item) => item._id);

  if (!windowIds.length) {
    console.log("No closed windows found. Nothing to repair.");
    return;
  }

  const result = await StaffAvailabilitySubmission.updateMany(
    {
      availabilityWindowId: { $in: windowIds },
      status: "locked",
      lockedAt: { $exists: true },
    },
    {
      $set: { status: "submitted" },
      $unset: { lockedAt: "" },
    },
  );

  console.log(`Repaired ${result.modifiedCount || 0} submission(s).`);
}

(async () => {
  try {
    await run();
    console.log("Repair completed.");
  } catch (error) {
    console.error("Repair failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
