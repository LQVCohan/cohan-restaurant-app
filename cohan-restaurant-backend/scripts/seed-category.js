import { GraphQLClient, gql } from "graphql-request";
import process from "process";

/* ============================================
   Queries
============================================= */

// Lấy Category theo timeslot
const GET_CATEGORIES = gql`
  query GetCategories($restaurantId: ID!, $timeSlot: TimeSlot!) {
    categories(restaurantId: $restaurantId, timeSlot: $timeSlot) {
      id
      name
      order
      isActive
    }
  }
`;

// Lấy CategoryMenu của 1 nhà hàng
const GET_CATEGORY_MENUS = gql`
  query GetCategoryMenus($restaurantId: ID!) {
    categoryMenus(restaurantId: $restaurantId) {
      id
      name
      description
      isActive
    }
  }
`;

/* ============================================
   Mutations
============================================= */

// tạo Category
const CREATE_CATEGORY = gql`
  mutation createCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      restaurantId
      timeSlot
      name
      order
      isActive
    }
  }
`;

// tạo CategoryMenu
const CREATE_CATEGORY_MENU = gql`
  mutation createCategoryMenu($input: CreateCategoryMenuInput!) {
    createCategoryMenu(input: $input) {
      id
      restaurantId
      name
      description
      coverImage
      isActive
    }
  }
`;

/* ============================================
   CONFIG
============================================= */

const endpoint = process.env.GRAPHQL_URL || "http://localhost:4000/graphql";

const client = new GraphQLClient(endpoint, {
  headers: {
    "Content-Type": "application/json",
    ...(process.env.AUTH_TOKEN
      ? { Authorization: process.env.AUTH_TOKEN }
      : {}),
  },
});

// Danh mục theo timeSlot
const categories = [
  { name: "Món Việt", icon: "🍜" },
  { name: "Fast Food", icon: "🍔" },
  { name: "Pizza", icon: "🍕" },
  { name: "Món Á", icon: "🍱" },
  { name: "Tráng miệng", icon: "🧁" },
  { name: "Đồ uống", icon: "🥤" },
];

// Buổi
const TIME_SLOTS = ["breakfast", "lunch", "dinner", "late_night"];

// Danh mục menu tổng
const CATEGORY_MENUS = [
  { name: "Menu Việt Nam", desc: "Các món truyền thống Việt Nam" },
  { name: "Menu Hàn Quốc", desc: "Món Hàn Quốc đặc trưng" },
  { name: "Menu Nhật Bản", desc: "Món Nhật tinh tế" },
  { name: "Menu Thái", desc: "Ẩm thực cay nồng Thái Lan" },
  { name: "Menu Âu", desc: "Món Âu và đồ Tây" },
  { name: "Menu Chay", desc: "Món chay dinh dưỡng" },
  { name: "Menu Lẩu", desc: "Các loại lẩu đa dạng" },
  { name: "Menu Nướng", desc: "Các món nướng" },
  { name: "Menu Gia Đình", desc: "Combo gia đình tiết kiệm" },
];

/* ============================================
   FUNCTIONS
============================================= */

// Tạo Category nếu chưa có
async function createCategoryForAllSlots(restaurantId) {
  console.log(`\n=== Kiểm tra & tạo Category cho nhà hàng ${restaurantId} ===`);

  for (const slot of TIME_SLOTS) {
    console.log(`\n→ Buổi: ${slot}`);

    // Lấy Category hiện có trong DB
    const existing = await client.request(GET_CATEGORIES, {
      restaurantId,
      timeSlot: slot,
    });

    const existingNames = new Set(existing?.categories?.map((c) => c.name));

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const fullName = `${cat.icon} ${cat.name}`;

      if (existingNames.has(fullName)) {
        console.log(`⚠️ Đã tồn tại, bỏ qua: ${fullName}`);
        continue;
      }

      // Nếu chưa có → tạo
      const input = {
        restaurantId,
        timeSlot: slot,
        name: fullName,
        order: i + 1,
      };

      try {
        const res = await client.request(CREATE_CATEGORY, { input });
        console.log(`✅ Tạo Category mới: ${res.createCategory.name}`);
      } catch (err) {
        console.error(
          `❌ Lỗi tạo "${fullName}":`,
          err?.response?.errors?.[0]?.message || err.message
        );
      }
    }
  }
}

// Tạo CategoryMenu nếu chưa có
async function createCategoryMenus(restaurantId) {
  console.log(
    `\n=== Kiểm tra & tạo CategoryMenu cho nhà hàng ${restaurantId} ===`
  );

  const existing = await client.request(GET_CATEGORY_MENUS, { restaurantId });
  const existingNames = new Set(existing?.categoryMenus?.map((m) => m.name));

  for (const m of CATEGORY_MENUS) {
    if (existingNames.has(m.name)) {
      console.log(`⚠️ Đã tồn tại CategoryMenu: ${m.name}`);
      continue;
    }

    const input = {
      restaurantId,
      name: m.name,
      description: m.desc,
      coverImage: null,
      isActive: true,
    };

    try {
      const res = await client.request(CREATE_CATEGORY_MENU, { input });
      console.log(`✅ Tạo CategoryMenu mới: ${res.createCategoryMenu.name}`);
    } catch (err) {
      console.error(
        `❌ Lỗi tạo CategoryMenu "${m.name}":`,
        err?.response?.errors?.[0]?.message || err.message
      );
    }
  }
}

/* ============================================
   MAIN RUN
============================================= */

const restaurantId = process.argv[2] || "68e3fc0486dc90d60c7101dc";

async function runAll() {
  await createCategoryForAllSlots(restaurantId);
  await createCategoryMenus(restaurantId);
  console.log("\n🎉 Hoàn tất tạo danh mục!");
}

runAll();
