// scripts/seedRestaurantsViaGQL.js
// Node 18+ (có sẵn fetch). Nếu Node < 18, cài thêm: npm i node-fetch và import('node-fetch').

import crypto from "crypto";
import process from "process";
// ====== ENV CONFIG ======
const GRAPHQL_ENDPOINT =
  process.env.GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";
const AUTH_TOKEN = process.env.AUTH_TOKEN || ""; // Bearer token nếu server yêu cầu auth
// MANAGER_IDS: "656d1f...a,656d1f...b,656d1f...c"
const MANAGER_IDS = (process.env.MANAGER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ====== GQL MUTATION ======
const CREATE_RESTAURANT_MUTATION = `
  mutation CreateRestaurant($input: CreateRestaurantInput!) {
    createRestaurant(input: $input) {
      id
      name
      manager { id fullName }
      avgRating
      status
    }
  }
`;

// ====== UTIL ======
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomObjectId = () => {
  // Tạo chuỗi 24 hex giống ObjectId để test nhanh
  return crypto.randomBytes(12).toString("hex");
};

const cities = ["TP. Hồ Chí Minh", "Hà Nội", "Đà Nẵng"];
const districtsHCM = [
  "Quận 1",
  "Quận 3",
  "Quận 5",
  "Quận 7",
  "Bình Thạnh",
  "Thủ Đức",
  "Gò Vấp",
];
const cuisines = [
  "Việt Nam",
  "Hàn Quốc",
  "Nhật Bản",
  "Trung Hoa",
  "Âu Mỹ",
  "Thái Lan",
  "Hải sản",
  "Ăn chay",
];
const priceRanges = [
  "100.000 - 300.000đ",
  "200.000 - 500.000đ",
  "300.000 - 700.000đ",
];
const namePrefixes = [
  "Sài Gòn",
  "Hương Vị",
  "Ngon",
  "Ẩm Thực",
  "Taste",
  "Fusion",
];

// Tạo mảng 10 managerId (xoay vòng từ ENV nếu có, nếu không -> random)
const buildManagerIds = (count = 10) => {
  if (MANAGER_IDS.length > 0) {
    return Array.from(
      { length: count },
      (_, i) => MANAGER_IDS[i % MANAGER_IDS.length]
    );
  }
  return Array.from({ length: count }, () => randomObjectId());
};

const buildRestaurantInput = (i, managerId) => {
  const city = randomFrom(cities);
  const district =
    city === "TP. Hồ Chí Minh" ? randomFrom(districtsHCM) : "Trung tâm";
  const open = "08:00";
  const close = "22:00";

  return {
    name: `Nhà hàng ${randomFrom(namePrefixes)} ${i + 1}`,
    avatar: `https://picsum.photos/seed/ava${i}/100`,
    coverImage: `https://picsum.photos/seed/cov${i}/800/400`,
    spaceImages: [
      `https://picsum.photos/seed/space${i}a/800/400`,
      `https://picsum.photos/seed/space${i}b/800/400`,
    ],
    address: {
      line1: `Số ${10 + i} đường Nguyễn Văn ${String.fromCharCode(65 + i)}`,
      ward: `Phường ${1 + (i % 10)}`,
      district,
      city,
      country: "Việt Nam",
    },
    phone: `09${Math.floor(10000000 + Math.random() * 89999999)}`,
    email: `restaurant${i + 1}@example.com`,
    featuredMenu: [
      "Phở bò đặc biệt",
      "Cơm tấm sườn bì chả",
      "Gỏi cuốn tôm thịt",
    ],
    amenities: ["Wifi miễn phí", "Thanh toán thẻ"],
    seatingCapacity: 30 + Math.floor(Math.random() * 70),
    priceRange: randomFrom(priceRanges),
    openingHours: open,
    closingHours: close,
    description: `Không gian ấm cúng, món ${randomFrom(cuisines)} đặc sắc.`,
    notesOnHours: "Giờ có thể thay đổi cuối tuần.",
    notesOnAmenities: "Một số tiện ích chỉ áp dụng tại chi nhánh trung tâm.",
    cuisineType: randomFrom(cuisines),
    status: "active",
    managerId, // ⬅️ bắt buộc theo schema của bạn
  };
};

async function callGraphQL(query, variables) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${AUTH_TOKEN}`;
  }

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (!res.ok || json.errors) {
    const errorMsg =
      json.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }
  return json.data;
}

async function main() {
  try {
    console.log("➡️  Endpoint:", GRAPHQL_ENDPOINT);
    const managerIds = buildManagerIds(10);

    const created = [];
    for (let i = 0; i < 10; i++) {
      const input = buildRestaurantInput(i, managerIds[i]);
      const data = await callGraphQL(CREATE_RESTAURANT_MUTATION, { input });
      created.push(data.createRestaurant);
      console.log(
        `✅ Created: ${data.createRestaurant.name} (id=${data.createRestaurant.id}) manager=${managerIds[i]}`
      );
    }

    console.log(`\n🍽️  Done. Created ${created.length} restaurants.`);
  } catch (err) {
    console.error("❌ Error seeding restaurants via GraphQL:", err.message);
    process.exit(1);
  }
}

main();
