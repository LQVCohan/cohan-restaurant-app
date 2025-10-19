import { GraphQLClient, gql } from "graphql-request";
import process from "process";

// ✅ GraphQL mutation để tạo Category
const CREATE_CATEGORY = gql`
  mutation createCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      restaurantId
      timeSlot
      name
      order
      isActive
      createdAt
      updatedAt
    }
  }
`;

// ⚙️ Endpoint & client
const endpoint = process.env.GRAPHQL_URL || "http://localhost:4000/graphql";
const client = new GraphQLClient(endpoint, {
  headers: {
    "Content-Type": "application/json",
    ...(process.env.AUTH_TOKEN
      ? { Authorization: process.env.AUTH_TOKEN }
      : {}),
  },
});

// 🍽 Danh mục bạn yêu cầu
const categories = [
  { id: "vietnamese", name: "Món Việt", icon: "🍜" },
  { id: "fastfood", name: "Fast Food", icon: "🍔" },
  { id: "pizza", name: "Pizza", icon: "🍕" },
  { id: "asian", name: "Món Á", icon: "🍱" },
  { id: "dessert", name: "Tráng miệng", icon: "🧁" },
  { id: "drink", name: "Đồ uống", icon: "🥤" },
];

// ⏰ Các buổi có trong hệ thống
const TIME_SLOTS = ["breakfast", "lunch", "dinner", "late_night"];

// 🛠 Hàm tạo danh mục
async function createCategoryForAllSlots(restaurantId) {
  console.log(`\n=== Tạo danh mục cho nhà hàng ${restaurantId} ===`);

  for (const slot of TIME_SLOTS) {
    console.log(`\n→ Buổi: ${slot}`);
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const input = {
        restaurantId,
        timeSlot: slot,
        name: `${cat.icon} ${cat.name}`, // thêm icon vào tên cho dễ nhìn
        order: i + 1,
      };

      try {
        const res = await client.request(CREATE_CATEGORY, { input });
        const c = res.createCategory;
        console.log(`✅ [${slot}] ${c.name} (id=${c.id})`);
      } catch (err) {
        console.error(
          `❌ Lỗi tạo "${cat.name}" cho buổi ${slot}:`,
          err?.response?.errors?.[0]?.message || err.message
        );
      }
    }
  }

  console.log("\n🎉 Hoàn tất tạo danh mục!");
}

// 🚀 Gọi hàm chính
const restaurantId = process.argv[2] || "68e3fc0486dc90d60c7101dc";
createCategoryForAllSlots(restaurantId);
