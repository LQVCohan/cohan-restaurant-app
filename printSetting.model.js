import mongoose from "mongoose";
import BaseSchemaModel from "./cohan-restaurant-backend/models/baseSchemaModel.js";

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
  templates: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  jobs: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
});

export default mongoose.model("PrintSetting", printSettingSchema);
