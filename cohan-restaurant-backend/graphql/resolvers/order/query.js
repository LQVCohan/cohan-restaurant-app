// cohan-restaurant-backend/graphql/resolvers/order/query.js
import mongoose from "mongoose";
import { Order, User } from "../../../models/index.js";
import { toId } from "../order/helper/orderUtils.js";
import { resolveTableSafe } from "../order/helper/tableUtils.js";
import TableCustomer from "../../../models/tableCustomer.model.js";
const INACTIVE_STATUSES = ["cancelled", "completed"];

function buildFilter(filter = {}) {
  const q = {};
  if (filter.restaurantId && mongoose.isValidObjectId(filter.restaurantId)) {
    q.restaurantId = toId(filter.restaurantId);
  }
  if (filter.tableCode) {
    q.tableCode = String(filter.tableCode).trim().toUpperCase();
  }
  if (filter.orderCode) {
    q.orderCode = String(filter.orderCode).trim();
  }
  if (filter.status) {
    q.currentStatus = filter.status;
  }
  if (filter.dateFrom || filter.dateTo) {
    q.createdAt = {};
    if (filter.dateFrom) q.createdAt.$gte = new Date(filter.dateFrom);
    if (filter.dateTo) q.createdAt.$lte = new Date(filter.dateTo);
  }
  if (filter.keyword) {
    // ví dụ simple free-text trên orderCode/note
    const k = String(filter.keyword).trim();
    q.$or = [{ orderCode: new RegExp(k, "i") }, { note: new RegExp(k, "i") }];
  }
  return q;
}

/** Gom nhóm các orders theo orderCode */
function groupOrdersByCode(orders = []) {
  const map = new Map();
  for (const ord of orders) {
    const key = ord.orderCode || "unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ord);
  }
  return Array.from(map.entries()).map(([orderCode, group]) => ({
    orderCode,
    tableCode: group[0]?.tableCode || null,
    restaurantId: group[0]?.restaurantId,
    latestStatus: group[group.length - 1]?.currentStatus,
    count: group.length,
    orders: group.sort((a, b) => a.createdAt - b.createdAt),
  }));
}

export const OrderQuery = {
  /** Single */
  async order(_, { id }) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Order.findById(id).lean({ virtuals: true });
  },

  /**
   * Danh sách tất cả order (có phân trang offset)
   */
  async orders(_, { filter = {}, limit = 50, offset = 0 }) {
    const q = buildFilter(filter);
    const [items, totalCount] = await Promise.all([
      Order.find(q)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(Math.max(1, Math.min(200, limit)))
        .lean({ virtuals: true }),
      Order.countDocuments(q),
    ]);
    return { items, totalCount };
  },

  /**
   * Danh sách các order đang hoạt động (exclude cancelled/completed) — cursor connection
   */
  async ordersByRestaurantNow(_, { restaurantId, limit = 50, cursor }, _ctx) {
    if (!restaurantId) throw new Error("restaurantId is required");

    const rid = toId(restaurantId);

    const baseFilter = {
      restaurantId: rid,
      currentStatus: { $nin: ["completed", "cancelled"] },
    };

    // Pagination kiểu "cursor = _id"
    const q = Order.find(baseFilter).sort({ _id: 1 });
    if (cursor) {
      q.where("_id").gt(cursor);
    }
    if (limit) {
      q.limit(limit + 1); // lấy dư 1 để biết còn next hay không
    }

    const rows = await q.lean();

    const hasNextPage = rows.length > limit;
    const slice = hasNextPage ? rows.slice(0, limit) : rows;

    const lastCursor = slice.length
      ? String(slice[slice.length - 1]._id)
      : null;

    // === Map sang TableCustomer ===
    const tableCodes = [
      ...new Set(slice.map((o) => o.tableCode).filter(Boolean)),
    ];
    const orderCodes = [
      ...new Set(slice.map((o) => o.orderCode).filter(Boolean)),
    ];

    const customerDocs = await TableCustomer.find({
      restaurantId: rid,
      $or: [
        ...(tableCodes.length ? [{ tableCode: { $in: tableCodes } }] : []),
        ...(orderCodes.length ? [{ orderCode: { $in: orderCodes } }] : []),
      ],
    })
      .select({
        tableCode: 1,
        orderCode: 1,
        customerName: 1,
        customerPhone: 1,
        customerEmail: 1,
        note: 1,
        partySize: 1,
        timeTo: 1,
      })
      .lean();

    const byTableCode = new Map();
    const byOrderCode = new Map();
    for (const c of customerDocs) {
      if (c.tableCode) byTableCode.set(String(c.tableCode), c);
      if (c.orderCode) byOrderCode.set(String(c.orderCode), c);
    }

    const edges = slice.map((o) => {
      const tc =
        (o.orderCode && byOrderCode.get(String(o.orderCode))) ||
        (o.tableCode && byTableCode.get(String(o.tableCode))) ||
        null;

      const customerInfo = tc
        ? {
            name: tc.customerName || null,
            phone: tc.customerPhone || null,
            email: tc.customerEmail || null,
            note: tc.note || null,
            partySize: tc.partySize || null,
            timeTo: tc.timeTo || null,
          }
        : null;

      return {
        cursor: String(o._id),
        node: {
          id: String(o._id),
          ...o,
          customerInfo, // ✅ thêm field
        },
      };
    });

    return {
      edges,
      pageInfo: {
        endCursor: lastCursor,
        hasNextPage,
      },
    };
  },

  /**
   * Tất cả orders theo bàn (tableCode) — dùng để lấy lịch sử đợt
   */
  async ordersByTableCode(
    _,
    { restaurantId, tableCode, limit = 50, offset = 0 }
  ) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    const safeTableCode = String(tableCode).trim().toUpperCase();
    const q = {
      restaurantId: toId(restaurantId),
      tableCode: safeTableCode,
    };
    const [items, totalCount] = await Promise.all([
      Order.find(q)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(Math.max(1, Math.min(200, limit)))
        .lean({ virtuals: true }),
      Order.countDocuments(q),
    ]);
    return { items, totalCount };
  },

  /**
   * NEW: Gom nhóm theo bàn => nhóm đợt theo orderCode
   * FE sẽ tự gộp món trùng & gắn cờ món cũ dựa trên trường 'orders'
   */
  async ordersGroupedByTable(_, { restaurantId, tableCode }) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    const safe = String(tableCode).trim().toUpperCase();

    // resolveTableSafe để “ít lỗi” nếu mới tạo bàn
    const t = await resolveTableSafe(restaurantId, safe);
    if (!t) return [];

    const f = {
      restaurantId: toId(restaurantId),
      tableCode: safe,
      // KHÔNG lọc INACTIVE ở đây vì muốn cả lịch sử,
      // nếu muốn chỉ “đang hoạt động” thì thêm currentStatus: {$nin: INACTIVE_STATUSES}
    };

    const docs = await Order.find(f)
      .sort({ createdAt: 1, _id: 1 })
      .lean({ virtuals: true });

    if (!docs.length) return [];

    // ====== Gắn thông tin user cho từng order ======
    const userIds = [
      ...new Set(
        docs.map((o) => (o.userId ? String(o.userId) : null)).filter(Boolean)
      ),
    ];

    let userMap = new Map();
    if (userIds.length) {
      const users = await User.find({ _id: { $in: userIds } })
        .select({ _id: 1, fullName: 1, email: 1, phone: 1 })
        .lean();

      userMap = new Map(
        users.map((u) => [
          String(u._id),
          {
            id: String(u._id),
            fullName: u.fullName || null,
            email: u.email || null,
            phone: u.phone || null,
          },
        ])
      );
    }

    const docsWithUser = docs.map((o) => {
      const u =
        (o.user && o.user.id && o.user) || // phòng trường hợp đã có virtual user
        (o.userId && userMap.get(String(o.userId))) ||
        null;

      return {
        ...o,
        user: u,
      };
    });

    return groupOrdersByCode(docsWithUser);
  },

  /**
   * Danh sách orders của một user (theo userId) — cursor connection
   * Schema: ordersByUser(userId: ID!, limit: Int = 20, cursor: ID): OrdersConnection!
   */
  async ordersByUser(_, { userId, limit = 20, cursor }) {
    if (!mongoose.isValidObjectId(userId)) {
      throw new Error("Invalid userId");
    }

    const uid = toId(userId);

    const baseFilter = {
      userId: uid,
      // KHÔNG lọc theo currentStatus => lấy tất cả đơn của user đó
    };

    // Pagination kiểu "cursor = _id"
    const q = Order.find(baseFilter).sort({ _id: 1 });
    if (cursor) {
      q.where("_id").gt(cursor);
    }
    if (limit) {
      q.limit(limit + 1); // lấy dư 1 để biết còn next hay không
    }

    const rows = await q.lean();

    const hasNextPage = rows.length > limit;
    const slice = hasNextPage ? rows.slice(0, limit) : rows;

    const lastCursor = slice.length
      ? String(slice[slice.length - 1]._id)
      : null;

    // === Map sang TableCustomer (tương tự ordersByRestaurantNow) ===
    const tableCodes = [
      ...new Set(slice.map((o) => o.tableCode).filter(Boolean)),
    ];
    const orderCodes = [
      ...new Set(slice.map((o) => o.orderCode).filter(Boolean)),
    ];
    const restaurantIds = [
      ...new Set(
        slice
          .map((o) => (o.restaurantId ? String(o.restaurantId) : null))
          .filter(Boolean)
      ),
    ];

    let customerDocs = [];
    if (tableCodes.length || orderCodes.length) {
      const customerFilter = {
        $or: [
          ...(tableCodes.length ? [{ tableCode: { $in: tableCodes } }] : []),
          ...(orderCodes.length ? [{ orderCode: { $in: orderCodes } }] : []),
        ],
      };

      if (restaurantIds.length) {
        customerFilter.restaurantId = {
          $in: restaurantIds.map((id) => toId(id)),
        };
      }

      customerDocs = await TableCustomer.find(customerFilter)
        .select({
          tableCode: 1,
          orderCode: 1,
          customerName: 1,
          customerPhone: 1,
          customerEmail: 1,
          note: 1,
          partySize: 1,
          timeTo: 1,
        })
        .lean();
    }

    const byTableCode = new Map();
    const byOrderCode = new Map();
    for (const c of customerDocs) {
      if (c.tableCode) byTableCode.set(String(c.tableCode), c);
      if (c.orderCode) byOrderCode.set(String(c.orderCode), c);
    }

    const edges = slice.map((o) => {
      const tc =
        (o.orderCode && byOrderCode.get(String(o.orderCode))) ||
        (o.tableCode && byTableCode.get(String(o.tableCode))) ||
        null;

      const customerInfo = tc
        ? {
            name: tc.customerName || null,
            phone: tc.customerPhone || null,
            email: tc.customerEmail || null,
            note: tc.note || null,
            partySize: tc.partySize || null,
            timeTo: tc.timeTo || null,
          }
        : null;

      return {
        cursor: String(o._id),
        node: {
          id: String(o._id),
          ...o,
          customerInfo,
        },
      };
    });

    return {
      edges,
      pageInfo: {
        endCursor: lastCursor,
        hasNextPage,
      },
    };
  },
};

export default { OrderQuery };
