// src/graphql/loaders/index.js
import DataLoader from "dataloader";
import { User, Restaurant } from "../../models/index.js";

const batchById = (Model) => async (ids) => {
  const docs = await Model.find({ _id: { $in: ids } }).lean();
  const map = new Map(docs.map((d) => [String(d._id), d]));
  return ids.map((id) => map.get(String(id)) || null);
};

export default function createLoaders() {
  return {
    userById: new DataLoader(batchById(User)),
    restaurantById: new DataLoader(batchById(Restaurant)),
    // thêm loader khác nếu cần
  };
}
