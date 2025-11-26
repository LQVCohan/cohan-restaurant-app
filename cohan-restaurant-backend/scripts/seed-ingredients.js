// seed-ingredients.js
// Seed nguyên liệu cho hệ thống theo đúng model Ingredient mới nhất

import { GraphQLClient, gql } from "graphql-request";
import process from "process";

const endpoint = process.env.GRAPHQL_URL || "http://localhost:4000/graphql";
const token = process.env.AUTH_TOKEN || "";
const restaurantId = "68e3fc0486dc90d60c7101dc";

const client = new GraphQLClient(endpoint, {
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: token } : {}),
  },
});

// ==== MUTATION ====
const CREATE_INGREDIENT = gql`
  mutation CreateIngredient($input: CreateIngredientInput!) {
    createIngredient(input: $input) {
      id
      name
      baseUnit
      costPerBaseUnit
      category
      conversions {
        from
        to
        ratio
      }
    }
  }
`;

const FIND_INGREDIENT = gql`
  query FindIngredient($restaurantId: ID!, $search: String) {
    ingredients(restaurantId: $restaurantId, search: $search) {
      id
      name
    }
  }
`;

// ===== BASE INGREDIENT LIST =====
const INGREDIENTS = [
  // ==== THỊT ====
  { name: "Thịt heo", category: "meat", baseUnit: "kg", cost: 120000 },
  { name: "Thịt bò", category: "meat", baseUnit: "kg", cost: 220000 },
  { name: "Thịt gà", category: "meat", baseUnit: "kg", cost: 90000 },
  { name: "Sườn heo", category: "meat", baseUnit: "kg", cost: 150000 },

  // ==== HẢI SẢN ====
  { name: "Tôm sú", category: "seafood", baseUnit: "kg", cost: 260000 },
  { name: "Mực ống", category: "seafood", baseUnit: "kg", cost: 220000 },
  { name: "Cá hồi", category: "seafood", baseUnit: "kg", cost: 400000 },

  // ==== RAU CỦ ====
  { name: "Rau muống", category: "vegetable", baseUnit: "kg", cost: 25000 },
  { name: "Cải xanh", category: "vegetable", baseUnit: "kg", cost: 30000 },
  { name: "Cà rốt", category: "vegetable", baseUnit: "kg", cost: 22000 },
  { name: "Khoai tây", category: "vegetable", baseUnit: "kg", cost: 28000 },
  { name: "Hành tây", category: "vegetable", baseUnit: "kg", cost: 35000 },

  // ==== GIA VỊ ====
  { name: "Muối", category: "spice", baseUnit: "kg", cost: 15000 },
  { name: "Đường", category: "spice", baseUnit: "kg", cost: 18000 },
  { name: "Tiêu đen", category: "spice", baseUnit: "g", cost: 500 },
  { name: "Tỏi", category: "spice", baseUnit: "kg", cost: 45000 },
  { name: "Hành tím", category: "spice", baseUnit: "kg", cost: 40000 },
  { name: "Gừng", category: "spice", baseUnit: "kg", cost: 45000 },
  { name: "Sả", category: "spice", baseUnit: "kg", cost: 30000 },

  // ==== TINH BỘT ====
  { name: "Gạo", category: "grain", baseUnit: "kg", cost: 25000 },
  { name: "Bún tươi", category: "grain", baseUnit: "kg", cost: 35000 },
  { name: "Bánh phở", category: "grain", baseUnit: "kg", cost: 30000 },
  { name: "Mì sợi", category: "grain", baseUnit: "kg", cost: 40000 },
];

// ===== CONVERSIONS (auto generate) =====
function autoConversions(baseUnit) {
  if (baseUnit === "kg") return [{ from: "kg", to: "g", ratio: 1000 }];
  if (baseUnit === "g") return []; // g là nhỏ nhất
  if (baseUnit === "l") return [{ from: "l", to: "ml", ratio: 1000 }];
  if (baseUnit === "ml") return [];
  return [];
}

// ===== MAIN SEED FUNCTION =====
async function main() {
  console.log("🌱 SEED INGREDIENTS");
  console.log("Endpoint:", endpoint);
  console.log("----------------------------------");

  for (const item of INGREDIENTS) {
    try {
      // 1. Check existing
      const search = await client.request(FIND_INGREDIENT, {
        restaurantId,
        search: item.name,
      });

      const exists = search.ingredients?.find(
        (v) => v.name.toLowerCase() === item.name.toLowerCase()
      );

      if (exists) {
        console.log(`⏭  Nguyên liệu đã có: ${item.name}`);
        continue;
      }

      // 2. Build input đúng schema Ingredient
      const input = {
        restaurantId,
        name: item.name,
        sku: "",
        category: item.category,
        baseUnit: item.baseUnit,
        costPerBaseUnit: item.cost,
        conversions: autoConversions(item.baseUnit),
        photos: [], // em có thể thêm ảnh sau
        minStock: 0,
        notes: "",
        isActive: true,
      };

      // 3. Create ingredient
      const result = await client.request(CREATE_INGREDIENT, { input });

      console.log(
        `✓ Tạo mới: ${result.createIngredient.name}  (${result.createIngredient.baseUnit})`
      );
    } catch (err) {
      console.error(
        `✗ Lỗi tạo ${item.name}:`,
        err.response?.errors?.[0]?.message || err.message
      );
    }
  }

  console.log("\n🎉 DONE — Đã seed xong nguyên liệu!");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
