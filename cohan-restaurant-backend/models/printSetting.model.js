import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const printSettingSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    unique: true,
    index: true,
  },
  printers: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  stations: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
});

export default mongoose.model("PrintSetting", printSettingSchema);
