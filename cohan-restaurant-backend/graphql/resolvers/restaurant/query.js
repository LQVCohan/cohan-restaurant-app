import { Restaurant, Order } from "../../../models/index.js";
export const RestaurantQuery = {
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
};
