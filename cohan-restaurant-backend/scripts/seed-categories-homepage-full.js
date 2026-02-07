import { GraphQLClient, gql } from "graphql-request";
import process from "process";

/**
 * Seed categories phục vụ Homepage (FE):
 * - Tạo danh mục dùng chung theo (timeSlot, name)
 * - Danh mục có keyword tương thích icon mapping ở FE (việt, starter, burger, pizza, asian, dessert, drink, hotpot...)
 * - Mặc định tạo ~20 danh mục cho mỗi timeSlot
 *
 * Cách chạy ví dụ:
 *   node scripts/seed-categories-homepage-full.js
 *   GRAPHQL_URL=http://localhost:4000/graphql AUTH_TOKEN='Bearer ...' node scripts/seed-categories-homepage-full.js
 *   node scripts/seed-categories-homepage-full.js --limit=20
 *   node scripts/seed-categories-homepage-full.js --slots=breakfast,lunch
 */

const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      name
      timeSlot
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
      timeSlot
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

// Bộ category "đủ dùng" cho FE + search/filter homepage (20 mục)
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
  const raw = parseArg("--slots");
  if (!raw) return ALL_TIME_SLOTS;

  const requested = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const filtered = requested.filter((slot) => ALL_TIME_SLOTS.includes(slot));
  if (!filtered.length) {
    console.warn("⚠️ --slots không hợp lệ, fallback ALL_TIME_SLOTS.");
    return ALL_TIME_SLOTS;
  }

  return filtered;
}

function getLimitFromArgs() {
  const raw = parseArg("--limit");
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0) return 20;
  return Math.min(Math.floor(n), HOMEPAGE_CATEGORIES.length);
}

async function seedCategoriesByTimeSlot({ slots, limit }) {
  const categories = HOMEPAGE_CATEGORIES.slice(0, limit);

  console.log(`\n🚀 Seeding ${categories.length} categories/slot`);
  console.log(`🌐 Endpoint: ${endpoint}`);
  console.log(`🕒 Slots: ${slots.join(", ")}`);

  for (const slot of slots) {
    console.log(`\n=== TimeSlot: ${slot} ===`);

    for (let i = 0; i < categories.length; i += 1) {
      const categoryName = categories[i];
      const input = {
        // restaurantId optional theo model hiện tại
        timeSlot: slot,
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

    try {
      const stats = await client.request(TOP_GLOBAL_CATEGORIES, {
        timeSlot: slot,
        limit: 8,
      });
      const preview = stats?.topGlobalCategoriesByMenuItemCount || [];

      if (preview.length) {
        console.log(`📊 Preview top categories (${slot}):`);
        preview.forEach((row, idx) => {
          console.log(`   ${idx + 1}. ${row.name} (${row.menuItemCount} món)`);
        });
      } else {
        console.log("ℹ️ Chưa có menu item để thống kê top categories.");
      }
    } catch {
      // Không chặn seed nếu query preview thất bại
      console.log("ℹ️ Bỏ qua bước preview top categories.");
    }
  }
}

async function main() {
  const slots = getSlotsFromArgs();
  const limit = getLimitFromArgs();

  await seedCategoriesByTimeSlot({ slots, limit });
  console.log("\n🎉 Done seeding categories.");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err?.message || err);
  process.exit(1);
});
