import "dotenv/config.js";
import mongoose from "mongoose";
import {
  Customer,
  MenuItem,
  Order,
  Restaurant,
  Role,
} from "../models/index.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "cohan";
const CONFIRM =
  process.env.SEED_CUSTOMER_DEMO === "true" ||
  process.argv.includes("--confirm");
const ALLOW_PRODUCTION = process.argv.includes("--allow-production");
const RESTAURANT_ID =
  process.env.CUSTOMER_DEMO_RESTAURANT_ID ||
  process.argv
    .find((arg) => arg.startsWith("--restaurantId="))
    ?.split("=")[1] ||
  "69ce9e2e8d8d711f12e251b1";
const DEMO_TAG = "customer-manager-demo";
const CUSTOMER_EMAIL_DOMAIN = "customer-demo.cohan.local";
const DEFAULT_REGISTERED_COUNT = Number(
  process.env.CUSTOMER_DEMO_REGISTERED_COUNT || 22,
);
const DEFAULT_GUEST_COUNT = Number(process.env.CUSTOMER_DEMO_GUEST_COUNT || 8);
const DEFAULT_ORDER_COUNT = Number(process.env.CUSTOMER_DEMO_ORDER_COUNT || 56);
const CLEANUP_DEMO_MENU =
  process.argv.includes("--cleanup-demo-menu") ||
  process.env.CUSTOMER_DEMO_CLEANUP_MENU === "true";
const INCLUDE_PREVIOUS_DEMO_MENU =
  process.argv.includes("--include-demo-menu") ||
  process.env.CUSTOMER_DEMO_INCLUDE_SEEDED_MENU === "true";

const now = () => new Date();
const daysAgo = (days, hour = 12) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, Math.floor(Math.random() * 50), 0, 0);
  return date;
};
const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};
const toObjectId = (id) => new mongoose.Types.ObjectId(id);
const phoneAt = (index) => `090${String(7300000 + index).padStart(7, "0")}`;
const money = (value) => Math.round(Number(value || 0) / 1000) * 1000;

const registeredProfiles = [
  [
    "Nguyễn Minh An",
    "gold",
    22,
    18_800_000,
    "seafood",
    "Bún bò Huế",
    "Thích ngồi khu vực yên tĩnh, ít đá.",
  ],
  [
    "Trần Hoài Phương",
    "platinum",
    38,
    34_600_000,
    "milk",
    "Lẩu nấm hải sản",
    "Ưu tiên món ít cay, không hành.",
  ],
  [
    "Lê Quốc Bảo",
    "silver",
    9,
    7_200_000,
    "",
    "Cơm gà Hội An",
    "Hay đặt bàn tối thứ sáu.",
  ],
  [
    "Phạm Thanh Trúc",
    "basic",
    2,
    890_000,
    "peanut",
    "Trà đào cam sả",
    "Khách mới từ chiến dịch ưu đãi.",
  ],
  [
    "Võ Gia Hân",
    "gold",
    19,
    16_300_000,
    "gluten",
    "Mì Ý bò bằm",
    "Không ngò, thích món ra nhanh.",
  ],
  [
    "Đặng Khánh Linh",
    "basic",
    1,
    420_000,
    "",
    "Gỏi cuốn tôm thịt",
    "Đăng ký từ QR tại bàn.",
  ],
  [
    "Huỳnh Nhật Khang",
    "silver",
    7,
    5_700_000,
    "egg",
    "Burger bò phô mai",
    "Thích thanh toán bằng chuyển khoản.",
  ],
  [
    "Bùi Mai Chi",
    "platinum",
    44,
    42_900_000,
    "seafood",
    "Bò lúc lắc",
    "VIP cần gọi xác nhận trước khi hủy bàn.",
  ],
  [
    "Đỗ Anh Quân",
    "gold",
    25,
    21_400_000,
    "",
    "Pizza hải sản",
    "Thường đi nhóm 4 người.",
  ],
  [
    "Mai Yến Nhi",
    "silver",
    11,
    8_600_000,
    "milk",
    "Súp bí đỏ",
    "Ưu tiên món ít dầu.",
  ],
  [
    "Trương Đức Huy",
    "basic",
    3,
    1_100_000,
    "",
    "Cà phê sữa đá",
    "Khách văn phòng gần chi nhánh.",
  ],
  [
    "Ngô Bảo Ngọc",
    "gold",
    28,
    24_100_000,
    "peanut",
    "Sườn nướng mật ong",
    "Dị ứng đậu phộng, cần nhắc bếp.",
  ],
  [
    "Hồ Thiên Kim",
    "silver",
    14,
    10_400_000,
    "",
    "Salad ức gà",
    "Ăn keto vào buổi trưa.",
  ],
  [
    "Cao Minh Đức",
    "basic",
    0,
    0,
    "",
    "Phở bò tái",
    "Chưa phát sinh đơn hoàn tất.",
  ],
  [
    "Lâm An Vy",
    "platinum",
    53,
    58_700_000,
    "gluten",
    "Cá hồi áp chảo",
    "VIP thường dùng phòng riêng.",
  ],
  [
    "Tạ Quang Hưng",
    "silver",
    8,
    6_200_000,
    "",
    "Bánh flan",
    "Hay dùng voucher sinh nhật.",
  ],
  [
    "Phan Mỹ Duyên",
    "gold",
    21,
    19_900_000,
    "milk",
    "Mì cay hải sản",
    "Thích cay vừa, không sữa.",
  ],
  [
    "Vũ Thành Long",
    "basic",
    4,
    2_100_000,
    "",
    "Cơm chiên dương châu",
    "Khách mới quay lại lần 2.",
  ],
  [
    "Châu Bích Ngân",
    "silver",
    12,
    9_300_000,
    "seafood",
    "Canh chua cá",
    "Không dùng hải sản vỏ cứng.",
  ],
  [
    "Kiều Gia Bảo",
    "gold",
    27,
    23_500_000,
    "",
    "Bánh mì bò kho",
    "Thường gọi món mang đi.",
  ],
  [
    "Đinh Hạ My",
    "basic",
    2,
    760_000,
    "egg",
    "Chè khúc bạch",
    "Mới xác thực số điện thoại.",
  ],
  [
    "Tô Hoàng Nam",
    "platinum",
    46,
    39_700_000,
    "",
    "Lẩu Thái",
    "VIP nhóm công ty, ưu tiên xuất hóa đơn.",
  ],
];

const guestProfiles = [
  [
    "Guest bàn A02",
    "0907811011",
    "guest.a02@customer-demo.cohan.local",
    0,
    0,
    "Vừa",
    "Khách walk-in chưa đăng ký.",
  ],
  [
    "Guest bàn A05",
    "0907811012",
    "guest.a05@customer-demo.cohan.local",
    1,
    320_000,
    "Không",
    "Đã xác thực OTP tại bàn.",
  ],
  [
    "Guest gia đình tối",
    "0907811013",
    "guest.family@customer-demo.cohan.local",
    2,
    1_120_000,
    "Vừa",
    "Nhóm gia đình 5 người.",
  ],
  [
    "Guest sinh nhật",
    "0907811014",
    "guest.birthday@customer-demo.cohan.local",
    1,
    880_000,
    "Nồng",
    "Cần gợi ý combo bánh.",
  ],
  [
    "Guest giao hàng",
    "0907811015",
    "guest.delivery@customer-demo.cohan.local",
    1,
    260_000,
    "Không",
    "Khách đặt delivery lần đầu.",
  ],
  [
    "Guest công ty",
    "0907811016",
    "guest.company@customer-demo.cohan.local",
    3,
    2_460_000,
    "Vừa",
    "Khách đoàn chưa tạo account.",
  ],
  [
    "Guest đặt bàn online",
    "0907811017",
    "guest.booking@customer-demo.cohan.local",
    1,
    540_000,
    "Rất cay",
    "Đặt qua chatbot.",
  ],
  [
    "Guest thử món mới",
    "0907811018",
    "guest.newdish@customer-demo.cohan.local",
    2,
    970_000,
    "Vừa",
    "Quan tâm món theo mùa.",
  ],
];

function rankFromPoints(points) {
  if (points >= 20) return "VIP";
  if (points >= 5) return "OFTEN";
  return "NEW";
}

function foodPreferencesFrom({ allergy, spice, note }) {
  return {
    diet: note?.toLowerCase().includes("keto") ? "keto" : "omni",
    allergies: allergy ? [allergy] : [],
    habits: {
      noOnion: /không hành/i.test(note || ""),
      noCilantro: /không ngò/i.test(note || ""),
      sugar: 70,
      spice: spice || "Vừa",
      ice: !/ít đá/i.test(note || ""),
    },
    autoNote: note || "",
    updatedAt: daysAgo(2),
  };
}

async function ensureCustomerRole() {
  return Role.findOneAndUpdate(
    { slug: "customer" },
    {
      $setOnInsert: {
        name: "Customer",
        slug: "customer",
        description:
          "Customer account role used by customer management demo seed.",
        isSystem: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

function isPreviousDemoMenuItem(item) {
  const code = String(item?.code || "");
  const notes = String(item?.notes || "");
  const labels = Array.isArray(item?.labels) ? item.labels.map(String) : [];
  return (
    notes === DEMO_TAG || labels.includes(DEMO_TAG) || code.startsWith("CMD-")
  );
}

async function loadRestaurantMenuItems(restaurantId) {
  const query = {
    restaurantId,
    status: "available",
    basePrice: { $gt: 0 },
    menuId: { $ne: null },
    categoryId: { $ne: null },
  };

  const allItems = await MenuItem.find(query)
    .sort({ orderCounter: -1, basePrice: -1, name: 1 })
    .lean();

  const items = INCLUDE_PREVIOUS_DEMO_MENU
    ? allItems
    : allItems.filter((item) => !isPreviousDemoMenuItem(item));

  if (!items.length) {
    throw new Error(
      "No real available menu items found for this restaurant. Add menuitems first or rerun with CUSTOMER_DEMO_INCLUDE_SEEDED_MENU=true if you want to reuse old demo CMD-* items.",
    );
  }

  return items;
}

async function cleanupPreviousDemoMenuItems(restaurantId) {
  const result = await MenuItem.deleteMany({
    restaurantId,
    $or: [{ notes: DEMO_TAG }, { labels: DEMO_TAG }, { code: /^CMD-/ }],
  });
  return result.deletedCount || 0;
}

async function upsertCustomer({
  profile,
  index,
  restaurantId,
  roleId,
  guest = false,
}) {
  const [
    fullName,
    rankOrPhone,
    orderOrEmail,
    spendingOrOrders,
    allergyOrSpending,
    favoriteOrSpice,
    note,
  ] = profile;
  const points = guest
    ? Math.floor(Number(spendingOrOrders || 0) / 120_000)
    : Number(orderOrEmail || 0);
  const totalOrders = guest
    ? Number(spendingOrOrders || 0)
    : Math.max(0, Math.round(points * 0.7));
  const totalSpending = guest
    ? Number(allergyOrSpending || 0)
    : Number(spendingOrOrders || 0);
  const allergy = guest ? "" : allergyOrSpending;
  const spice = guest
    ? favoriteOrSpice
    : /cay/i.test(note || "")
      ? "Vừa"
      : "Không";
  const email = guest
    ? orderOrEmail
    : `${fullName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.|\.$/g, "")}.${index + 1}@${CUSTOMER_EMAIL_DOMAIN}`;
  const phone = guest ? rankOrPhone : phoneAt(index + 1);
  const loyaltyPoints = guest ? Math.floor(totalSpending / 1_000_000) : points;
  const createdAt = daysAgo(
    guest ? 2 + index : 75 - index * 3,
    9 + (index % 10),
  );
  const verifiedAt = daysAgo(guest ? 1 + index : 70 - index * 2, 10);

  return Customer.findOneAndUpdate(
    { email },
    {
      $set: {
        fullName,
        username: email.split("@")[0],
        email,
        phone,
        address: {
          line1: guest ? "Khách tại bàn" : `${12 + index} Nguyễn Văn Trỗi`,
          ward: guest ? "Phường Bến Nghé" : "Phường 12",
          district: guest ? "Quận 1" : "Quận Phú Nhuận",
          city: "TP. Hồ Chí Minh",
          country: "Việt Nam",
        },
        provider: "local",
        status: "active",
        userType: "CUSTOMER",
        loyaltyRank: guest ? "basic" : rankOrPhone,
        role: roleId,
        refRestaurants: [restaurantId],
        emailVerified: true,
        emailVerifiedAt: verifiedAt,
        phoneVerified: true,
        phoneVerifiedAt: verifiedAt,
        verifiedAt,
        verificationLastChannel: "both",
        verificationLastStatus: "verified",
        lastLoginAt: daysAgo(index % 6, 8 + (index % 10)),
        lastLoginIp: `10.0.12.${20 + index}`,
        loyaltyPoints,
        customerType: rankFromPoints(loyaltyPoints),
        totalOrders,
        totalSpending,
        isGuest: guest,
        guestExpiresAt: guest ? daysFromNow(21 + index) : undefined,
        guestLastSeenAt: guest ? daysAgo(index % 3, 19) : undefined,
        registeredAt: guest ? undefined : createdAt,
        foodPreferences: foodPreferencesFrom({ allergy, spice, note }),
        updatedAt: now(),
      },
      $setOnInsert: {
        createdAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

function isByWeightItem(dish) {
  const servingKey = String(dish?.defaultServingKey || "").toLowerCase();
  return (
    servingKey === "kg" ||
    servingKey.includes("kg") ||
    /theo kg/i.test(String(dish?.name || ""))
  );
}

function buildOrderItem(dish, seed, itemIndex) {
  const byWeight = isByWeightItem(dish);
  const quantity = byWeight ? 1 : 1 + ((seed + itemIndex) % 3 === 0 ? 1 : 0);
  const weightGrams = byWeight
    ? 500 + ((seed + itemIndex) % 4) * 250
    : undefined;
  const sellUnit = byWeight ? "kg" : "portion";
  const servingKey = dish.defaultServingKey || (byWeight ? "kg" : "default");
  const basePrice = Number(dish.basePrice || 0);
  const pricingQty = byWeight ? weightGrams / 1000 : quantity;
  const lineSubtotal = money(basePrice * pricingQty);

  return {
    dishId: dish._id,
    menuId: dish.menuId,
    categoryId: dish.categoryId,
    name: dish.name,
    unit: byWeight ? "kg" : "portion",
    servingKey,
    servingVariant: {
      key: servingKey,
      name: byWeight ? "Theo kg" : "Phần tiêu chuẩn",
      mode: byWeight ? "BY_WEIGHT" : "PORTION",
      price: basePrice,
      sellQty: 1,
      sellUnit,
    },
    quantity,
    weightGrams,
    baseUnitPrice: basePrice,
    unitPrice: basePrice,
    modifiersPricePerUnit: 0,
    lineSubtotal,
    ingredientsSnapshot: [],
    priority: seed % 7 === 0 ? "HIGH" : seed % 3 === 0 ? "MEDIUM" : "LOW",
    status: "served",
  };
}

function pickOrderItems(menuItems, seed, count) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const dish = menuItems[(seed + i * 3) % menuItems.length];
    items.push(buildOrderItem(dish, seed, i));
  }
  return items;
}

async function seedOrders({ customers, menuItems, restaurantId }) {
  await Order.deleteMany({ restaurantId, "clientMeta.demoTag": DEMO_TAG });
  const orders = [];
  const orderCount = Math.min(
    DEFAULT_ORDER_COUNT,
    Math.max(12, customers.length * 3),
  );

  for (let i = 0; i < orderCount; i += 1) {
    const customer = customers[i % customers.length];
    const itemCount = 1 + (i % 3);
    const items = pickOrderItems(menuItems, i, itemCount);
    const subtotal = items.reduce((sum, item) => sum + item.lineSubtotal, 0);
    const discount = i % 6 === 0 ? 20_000 : i % 9 === 0 ? 35_000 : 0;
    const serviceRate = 0.05;
    const taxRate = 0.08;
    const beforeTax = Math.max(0, subtotal + subtotal * serviceRate - discount);
    const grandTotal = money(beforeTax + beforeTax * taxRate);
    const createdAt = daysAgo(45 - (i % 42), 10 + (i % 11));
    const orderCode = `CMD-${String(i + 1).padStart(4, "0")}-${String(customer._id).slice(-5).toUpperCase()}`;

    orders.push({
      orderCode,
      publicStatus: "PAID",
      statusHistory: [
        {
          status: "ORDER_RECEIVED",
          displayMessage: "Đã nhận đơn demo",
          changedAt: createdAt,
          changedByRole: "SYSTEM",
          metadata: { demoTag: DEMO_TAG },
        },
        {
          status: "PAID",
          displayMessage: "Đơn demo đã thanh toán",
          changedAt: new Date(createdAt.getTime() + 52 * 60 * 1000),
          changedByRole: "SYSTEM",
          metadata: { demoTag: DEMO_TAG },
        },
      ],
      orderKind: "order_batch",
      sessionStatus: "closed",
      kitchenStatus: "served",
      orderPaymentStatus: "paid",
      openedAt: new Date(createdAt.getTime() - 38 * 60 * 1000),
      closedAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
      dailySequence: i + 1,
      tableCode:
        i % 4 === 0 ? `A${String((i % 8) + 1).padStart(2, "0")}` : undefined,
      tableName: i % 4 === 0 ? `Bàn A${(i % 8) + 1}` : undefined,
      guestCount: 1 + (i % 5),
      userId: customer._id,
      restaurantId,
      orderType: i % 6 === 0 ? "takeaway" : "dine_in",
      items,
      totals: {
        subtotal,
        discount,
        discountReason: discount ? "Demo loyalty discount" : undefined,
        tax: 0,
        taxRate,
        service: 0,
        serviceRate,
        shippingFee: 0,
        grandTotal,
      },
      payment: {
        method: i % 3 === 0 ? "momo" : i % 4 === 0 ? "bank_transfer" : "cash",
        provider: i % 3 === 0 ? "momo" : undefined,
        status: "paid",
        paidAmount: grandTotal,
        changeAmount: 0,
        currency: "VND",
        paidAt: new Date(createdAt.getTime() + 55 * 60 * 1000),
      },
      printStatus: {
        isPrinted: true,
        chefPrinted: true,
        printedAt: new Date(createdAt.getTime() + 5 * 60 * 1000),
      },
      statusTimeline: [
        {
          status: "confirmed",
          at: createdAt,
          note: "Seed customer demo order",
        },
        {
          status: "completed",
          at: new Date(createdAt.getTime() + 60 * 60 * 1000),
          note: "Demo completed order",
        },
      ],
      currentStatus: "completed",
      priority: i % 7 === 0 ? "HIGH" : "MEDIUM",
      note: DEMO_TAG,
      clientMeta: {
        demoTag: DEMO_TAG,
        seed: "seedCustomerDemoData",
        usesRealMenuItems: true,
      },
      createdAt,
      updatedAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
    });
  }

  const createdOrders = await Order.insertMany(orders);
  const totalsByCustomer = new Map();
  createdOrders.forEach((order) => {
    const key = String(order.userId);
    const current = totalsByCustomer.get(key) || {
      totalOrders: 0,
      totalSpending: 0,
    };
    current.totalOrders += 1;
    current.totalSpending += Number(order.totals?.grandTotal || 0);
    totalsByCustomer.set(key, current);
  });

  for (const customer of customers) {
    const totals = totalsByCustomer.get(String(customer._id));
    if (!totals) continue;
    const loyaltyPoints = Math.floor(totals.totalSpending / 1_000_000);
    await Customer.updateOne(
      { _id: customer._id },
      {
        $set: {
          totalOrders: totals.totalOrders,
          totalSpending: totals.totalSpending,
          loyaltyPoints,
          customerType: rankFromPoints(loyaltyPoints),
          updatedAt: now(),
        },
      },
    );
  }

  for (const item of menuItems) {
    const quantity = createdOrders.reduce((sum, order) => {
      const count = (order.items || []).reduce(
        (inner, orderItem) =>
          String(orderItem.dishId) === String(item._id)
            ? inner + Number(orderItem.quantity || 0)
            : inner,
        0,
      );
      return sum + count;
    }, 0);
    if (quantity)
      await MenuItem.updateOne(
        { _id: item._id },
        { $inc: { orderCounter: quantity } },
      );
  }

  return createdOrders;
}

async function main() {
  if (!CONFIRM) {
    throw new Error(
      "Seed customer demo data requires SEED_CUSTOMER_DEMO=true or --confirm to avoid touching real data accidentally.",
    );
  }
  if (process.env.NODE_ENV === "production" && !ALLOW_PRODUCTION) {
    throw new Error(
      "Refusing to run in production without --allow-production.",
    );
  }
  if (!mongoose.isValidObjectId(RESTAURANT_ID)) {
    throw new Error(`Invalid CUSTOMER_DEMO_RESTAURANT_ID: ${RESTAURANT_ID}`);
  }

  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log(`✅ Connected Mongo ${DB_NAME}`);

  const restaurantId = toObjectId(RESTAURANT_ID);
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new Error(`Restaurant not found: ${RESTAURANT_ID}`);
  }

  if (CLEANUP_DEMO_MENU) {
    const deletedMenuItems = await cleanupPreviousDemoMenuItems(restaurantId);
    console.log(`🧹 Removed previous demo menu items: ${deletedMenuItems}`);
  }

  const customerRole = await ensureCustomerRole();
  const menuItems = await loadRestaurantMenuItems(restaurantId);

  const registered = await Promise.all(
    registeredProfiles
      .slice(0, DEFAULT_REGISTERED_COUNT)
      .map((profile, index) =>
        upsertCustomer({
          profile,
          index,
          restaurantId,
          roleId: customerRole._id,
          guest: false,
        }),
      ),
  );
  const guests = await Promise.all(
    guestProfiles
      .slice(0, DEFAULT_GUEST_COUNT)
      .map((profile, index) =>
        upsertCustomer({
          profile,
          index: index + registered.length,
          restaurantId,
          roleId: customerRole._id,
          guest: true,
        }),
      ),
  );
  const allCustomers = [...registered, ...guests];
  const orders = await seedOrders({
    customers: allCustomers,
    menuItems,
    restaurantId,
  });

  console.log("🎉 Seeded customer manager demo data");
  console.log(`Restaurant: ${restaurant.name} (${restaurant._id})`);
  console.log(`Registered customers: ${registered.length}`);
  console.log(`Guest customers: ${guests.length}`);
  console.log(`Real menu items used: ${menuItems.length}`);
  console.log(`Demo orders: ${orders.length}`);
  console.log("Open manager page: /manager#customers");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
