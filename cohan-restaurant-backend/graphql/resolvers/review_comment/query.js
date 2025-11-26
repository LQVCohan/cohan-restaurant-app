// src/graphql/reviewComment/reviewComment.query.js
import { ReviewComment } from "../../../models/index.js";
// src/graphql/reviewComment/reviewComment.query.js

export default {
  /**
   * Lấy danh sách comment hoặc reply của 1 review (có phân trang)
   *
   * - Nếu parentId = null → comment gốc
   * - Nếu parentId có giá trị → reply của comment đó
   */
  reviewComments: async (_, { reviewId, parentId, limit = 20, skip = 0 }) => {
    const filter = { reviewId };

    // Comment gốc
    if (!parentId) {
      filter.parentId = null;
    } else {
      // Reply
      filter.parentId = parentId;
    }

    const total = await ReviewComment.countDocuments(filter);

    // Sort logic:
    // comment gốc: mới nhất lên đầu
    // reply: cũ → mới (natural conversation order)
    const sort =
      parentId === null || parentId === undefined
        ? { createdAt: -1 }
        : { createdAt: 1 };

    const items = await ReviewComment.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });

    return {
      total,
      items,
    };
  },
};
