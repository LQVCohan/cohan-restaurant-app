// src/graphql/resolvers/query.js
import { Restaurant, MenuItem, Order } from "../../models/index.js";

export default {
  me: (_, __, { user, loaders }) =>
    user ? loaders.userById.load(user.id) : null,

  restaurants: async (_, { limit = 20, cursor, addressFilter }) => {
    const filter = cursor ? { _id: { $gt: cursor } } : {};
    if (addressFilter) {
      if (addressFilter.city) {
        filter["address.city"] = { $regex: addressFilter.city, $options: "i" }; // Tìm kiếm theo thành phố
      }
      if (addressFilter.district) {
        filter["address.district"] = {
          $regex: addressFilter.district,
          $options: "i",
        }; // Tìm kiếm theo quận/huyện
      }
    }

    const docs = await Restaurant.find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1);

    const hasNextPage = docs.length > limit;
    const slice = hasNextPage ? docs.slice(0, -1) : docs;
    return {
      edges: slice.map((d) => ({ node: d, cursor: String(d._id) })),
      pageInfo: {
        endCursor: slice.length ? String(slice[slice.length - 1]._id) : null,
        hasNextPage,
      },
    };
  },

  restaurant: (_, { id }) => Restaurant.findById(id),

  menuItems: (_, { restaurantId, categoryId, search, limit = 20 }) => {
    const q = { restaurantId };
    if (categoryId) q.categoryId = categoryId;
    if (search) q.name = new RegExp(search, "i");
    return MenuItem.find(q).limit(limit);
  },

  order: (_, { id }) => Order.findById(id),
};
