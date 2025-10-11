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
  restaurantsTop: async (_, { limit = 6, addressFilter }) => {
    const filter = { status: "active" };

    // lọc địa chỉ (tuỳ chọn)
    if (addressFilter?.city) {
      filter["address.city"] = { $regex: addressFilter.city, $options: "i" };
    }
    if (addressFilter?.district) {
      filter["address.district"] = {
        $regex: addressFilter.district,
        $options: "i",
      };
    }

    // Sort theo avgRating giảm dần; _id làm tie-breaker ổn định
    const docs = await Restaurant.find(filter)
      .sort({ avgRating: -1, _id: 1 })
      .limit(Math.max(0, Math.min(limit, 50))) // chặn limit quá lớn
      .lean();

    return docs;
  },
};
