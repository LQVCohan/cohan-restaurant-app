import { GraphQLClient, gql } from "graphql-request";
import process from "process";

/**
 * Seed categories phục vụ Homepage (FE):
 * - Category hiện dùng chung toàn cục theo name (không còn timeSlot trong model Category)
 * - Danh mục có keyword tương thích icon mapping ở FE
 * - Mặc định tạo ~20 danh mục
 */

const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      name
      order
      isActive
    }
  }
`;

const TOP_GLOBAL_CATEGORIES = gql`
  query TopGlobalCategories($timeSlot: TimeSlot, $limit: Int) {
    topGlobalCategoriesByMenuItemCount(timeSlot: $timeSlot, limit: $limit) {
      id
      name
      menuItemCount
    }
  }
`;

const endpoint = process.env.GRAPHQL_URL || "http://localhost:4000/graphql";

const client = new GraphQLClient(endpoint, {
  headers: {
    "Content-Type": "application/json",
    ...(process.env.AUTH_TOKEN
      ? { Authorization: process.env.AUTH_TOKEN }
      : {}),
  },
});

const ALL_TIME_SLOTS = ["breakfast", "lunch", "dinner", "late_night"];

const HOMEPAGE_CATEGORIES = [
  "Khai vị",
  "Món Việt",
  "Phở & Bún",
  "Cơm văn phòng",
  "Fast Food",
  "Burger & Gà rán",
  "Pizza & Pasta",
  "Món Á",
  "Món Nhật",
  "Món Hàn",
  "Món Thái",
  "Lẩu & Hotpot",
  "Nướng BBQ",
  "Hải sản",
  "Món chay",
  "Healthy Salad",
  "Tráng miệng",
  "Bánh ngọt",
  "Đồ uống",
  "Trà sữa & Cà phê",
];

function parseArg(prefix) {
  const match = process.argv.find((arg) => arg.startsWith(`${prefix}=`));
  if (!match) return null;
  return match.slice(prefix.length + 1);
}

function getSlotsFromArgs() {
  const raw = parseArg("--preview-slots");
  if (!raw) return ALL_TIME_SLOTS;

  const requested = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const filtered = requested.filter((slot) => ALL_TIME_SLOTS.includes(slot));
  if (!filtered.length) return ALL_TIME_SLOTS;
  return filtered;
}

function getLimitFromArgs() {
  const raw = parseArg("--limit");
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0) return 20;
  return Math.min(Math.floor(n), HOMEPAGE_CATEGORIES.length);
}

async function seedCategories({ limit }) {
  const categories = HOMEPAGE_CATEGORIES.slice(0, limit);

  console.log(`\n🚀 Seeding ${categories.length} categories`);
  console.log(`🌐 Endpoint: ${endpoint}`);

  for (let i = 0; i < categories.length; i += 1) {
    const categoryName = categories[i];
    const input = {
      name: categoryName,
      order: i + 1,
    };

    try {
      const res = await client.request(CREATE_CATEGORY, { input });
      const created = res?.createCategory;

      if (!created) {
        console.log(`⚠️  Không có response cho: ${categoryName}`);
        continue;
      }

      console.log(`✅ ${created.name} (order=${created.order})`);
    } catch (err) {
      const message =
        err?.response?.errors?.[0]?.message || err?.message || "Unknown error";
      console.error(`❌ ${categoryName}: ${message}`);
    }
  }
}

async function previewTopBySlots(slots) {
  for (const slot of slots) {
    try {
      const stats = await client.request(TOP_GLOBAL_CATEGORIES, {
        timeSlot: slot,
        limit: 8,
      });
      const preview = stats?.topGlobalCategoriesByMenuItemCount || [];

      if (preview.length) {
        console.log(`\n📊 Preview top categories (${slot}):`);
        preview.forEach((row, idx) => {
          console.log(`   ${idx + 1}. ${row.name} (${row.menuItemCount} món)`);
        });
      } else {
        console.log(`\nℹ️ ${slot}: Chưa có menu item để thống kê top categories.`);
      }
    } catch {
      console.log(`\nℹ️ ${slot}: Bỏ qua bước preview top categories.`);
    }
  }
}

async function main() {
  const limit = getLimitFromArgs();
  const previewSlots = getSlotsFromArgs();

  await seedCategories({ limit });
  await previewTopBySlots(previewSlots);
  console.log("\n🎉 Done seeding categories.");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err?.message || err);
  process.exit(1);
});
