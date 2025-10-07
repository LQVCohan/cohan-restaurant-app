// seed-menu-items.js
// Seed 10 món cho mỗi menu (breakfast, lunch, dinner, late_night)
// cho 1 nhà hàng (id: 68e3fc0486dc90d60c7101dc), 2 category cố định,
// và GÁN modifierGroupIds = ["68e4d89bca13bb3391858677"] cho tất cả món.

import { GraphQLClient, gql } from "graphql-request";
import process from "process";
// ===== CẤU HÌNH =====
const endpoint = process.env.GRAPHQL_URL || "http://localhost:4000/graphql";
const token = process.env.AUTH_TOKEN || ""; // "Bearer <token>" nếu có
const restaurantId = "68e3fc0486dc90d60c7101dc";

// 2 category cố định
const CATEGORY_APPETIZER = "68e3ff9cd433d2c81f8803c6"; // món khai vị
const CATEGORY_MAIN = "68e41860dfc9c2a967e29701"; // món chính

// Modifier group gán vào mọi món
const DEFAULT_MODIFIER_GROUP_IDS = ["68e4d89bca13bb3391858677"];

const TIME_SLOTS = ["breakfast", "lunch", "dinner", "late_night"];
const ITEMS_PER_MENU = 10;

// ===== TẠO CLIENT =====
const client = new GraphQLClient(endpoint, {
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: token } : {}),
  },
});

// ===== GQL =====
const ENSURE_MENU = gql`
  mutation Ensure($input: EnsureMenuInput!) {
    ensureMenu(input: $input) {
      id
      restaurantId
      timeSlot
      name
      isActive
    }
  }
`;

const CREATE_MENU_ITEM = gql`
  mutation Create($input: CreateMenuItemInput!) {
    createMenuItem(input: $input) {
      id
      restaurantId
      menuId
      categoryId
      name
      basePrice
      preparationMethods {
        name
        price
        isDefault
      }
      modifierGroupIds
      status
      createdAt
    }
  }
`;

// ===== HELPERS =====
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function basePayload({ name, categoryId, timeSlot }) {
  return {
    restaurantId,
    timeSlot,
    categoryId,
    name,
    status: "available",
    avgPrepTimeMin: 10,
    // GÁN MODIFIER GROUP Ở ĐÂY
    modifierGroupIds: DEFAULT_MODIFIER_GROUP_IDS,
  };
}

// Món giá cố định
function fixedPriceDish(name, categoryId, timeSlot, base = 25000) {
  return {
    ...basePayload({ name, categoryId, timeSlot }),
    description: "Món giá cố định.",
    basePrice: base,
    preparationMethods: [], // non-null list
  };
}

// Món theo “cách chế biến” (per-portion)
function perMethodDish(name, categoryId, timeSlot) {
  const methods = [
    { name: "Chiên bơ tỏi", price: 15000, isDefault: true },
    { name: "Xào sả ớt", price: 12000 },
    { name: "Nướng muối ớt", price: 18000 },
  ];
  return {
    ...basePayload({ name, categoryId, timeSlot }),
    description: "Giá theo cách chế biến (tính theo phần).",
    basePrice: 0,
    preparationMethods: methods,
    avgPrepTimeMin: 12,
  };
}

// Món theo kg (mô phỏng giá/100g)
function byWeightDish(name, categoryId, timeSlot) {
  const methods = [
    { name: "Nướng", price: 12000, isDefault: true },
    { name: "Hấp sả", price: 10000 },
    { name: "Áp chảo", price: 14000 },
  ];
  return {
    ...basePayload({ name, categoryId, timeSlot }),
    description: "Giá theo 100g. Tổng tiền = (gram/100) × giá chế biến.",
    basePrice: 0,
    preparationMethods: methods,
    avgPrepTimeMin: 15,
  };
}

function sampleNamesFor(slot) {
  const base = {
    breakfast: [
      "Bánh mì ốp la",
      "Phở bò tái",
      "Bún riêu",
      "Xôi gà",
      "Bánh cuốn",
      "Cháo cá",
      "Mì Quảng",
      "Bún bò Huế",
      "Bánh canh giò",
      "Bánh mì thịt nướng",
    ],
    lunch: [
      "Cơm gà xối mỡ",
      "Canh chua cá lóc",
      "Thịt kho tàu",
      "Gà kho gừng",
      "Rau muống xào tỏi",
      "Mực ống",
      "Tôm sú",
      "Cá hồi áp chảo",
      "Bò xào lá lốt",
      "Đậu hũ sốt cà",
    ],
    dinner: [
      "Lẩu hải sản",
      "Cơm chiên Dương Châu",
      "Gỏi cuốn tôm thịt",
      "Lẩu kim chi",
      "Sườn nướng BBQ",
      "Cá tầm nướng",
      "Gà quay",
      "Mì xào hải sản",
      "Nghêu hấp sả",
      "Sườn xào chua ngọt",
    ],
    late_night: [
      "Cháo sườn",
      "Miến gà",
      "Bánh mì bít tết",
      "Mì trứng",
      "Hủ tiếu xương",
      "Bạch tuộc nướng",
      "Cánh gà chiên mắm",
      "Mì hải sản",
      "Khoai tây chiên",
      "Mì xào bò",
    ],
  };
  return base[slot].slice(0, ITEMS_PER_MENU);
}

// 10 món/slot: 5 khai vị + 5 món chính
function buildMenuItemsPayloads(slot) {
  const names = sampleNamesFor(slot);
  const payloads = [];

  // 5 khai vị (0..4): 3 fixed + 2 perMethod
  for (let i = 0; i < 5; i++) {
    if (i < 3) {
      payloads.push(
        fixedPriceDish(
          names[i],
          CATEGORY_APPETIZER,
          slot,
          randomInt(20000, 50000)
        )
      );
    } else {
      payloads.push(perMethodDish(names[i], CATEGORY_APPETIZER, slot));
    }
  }

  // 5 món chính (5..9): 2 perMethod + 2 byWeight + 1 fixed
  payloads.push(perMethodDish(names[5], CATEGORY_MAIN, slot));
  payloads.push(perMethodDish(names[6], CATEGORY_MAIN, slot));
  payloads.push(byWeightDish(names[7], CATEGORY_MAIN, slot));
  payloads.push(byWeightDish(names[8], CATEGORY_MAIN, slot));
  payloads.push(
    fixedPriceDish(names[9], CATEGORY_MAIN, slot, randomInt(30000, 70000))
  );

  return payloads;
}

// ===== MAIN =====
async function main() {
  console.log(`Seeding for restaurant: ${restaurantId}`);
  console.log(`GraphQL endpoint: ${endpoint}`);
  if (token) console.log(`Using Authorization header`);
  console.log("────────────────────────────");

  for (const slot of ["breakfast", "lunch", "dinner", "late_night"]) {
    console.log(`\n[${slot}] ensureMenu...`);
    await client.request(ENSURE_MENU, {
      input: {
        restaurantId,
        timeSlot: slot,
        name: `Menu ${slot}`,
        description: `Menu cho khung giờ ${slot}`,
        coverImage: null,
      },
    });

    console.log(
      `[${slot}] creating ${ITEMS_PER_MENU} items (with modifierGroupIds)...`
    );
    const payloads = buildMenuItemsPayloads(slot);

    for (const item of payloads) {
      try {
        const res = await client.request(CREATE_MENU_ITEM, { input: item });
        const created = res.createMenuItem;
        console.log(
          `  ✓ ${created.name} | cat=${created.categoryId} | base=${
            created.basePrice
          } | PM=${created.preparationMethods?.length || 0} | mods=${
            created.modifierGroupIds?.length || 0
          }`
        );
      } catch (err) {
        console.error(`  ✗ ${item.name} → ${err.message}`);
      }
    }
  }

  console.log("\n✅ Done seeding all menus.");
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
