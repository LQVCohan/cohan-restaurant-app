// seedRestaurants.js
import { GraphQLClient, gql } from "graphql-request";

// Endpoint GraphQL
const endpoint = "http://localhost:4000/graphql";
const client = new GraphQLClient(endpoint);

// Mutation GraphQL
const mutation = gql`
  mutation CreateRestaurant($input: CreateRestaurantInput!) {
    createRestaurant(input: $input) {
      id
      name
      manager {
        id
        name
        email
      }
    }
  }
`;

// Giả sử bạn đã có sẵn 20 managerId trong DB
// ⚠️ Thay các ObjectId này bằng _id thật của User (manager role)
const managerIds = [
  "67123456789abcdef000001",
  "67123456789abcdef000002",
  "67123456789abcdef000003",
  "67123456789abcdef000004",
  "67123456789abcdef000005",
  "67123456789abcdef000006",
  "67123456789abcdef000007",
  "67123456789abcdef000008",
  "67123456789abcdef000009",
  "67123456789abcdef000010",
  "67123456789abcdef000011",
  "67123456789abcdef000012",
  "67123456789abcdef000013",
  "67123456789abcdef000014",
  "67123456789abcdef000015",
  "67123456789abcdef000016",
  "67123456789abcdef000017",
  "67123456789abcdef000018",
  "67123456789abcdef000019",
  "67123456789abcdef000020",
];

// Hàm tạo input cho mỗi nhà hàng
const generateRestaurantInput = (index, managerId) => ({
  name: `Nhà hàng Mẫu ${index}`,
  avatar: `https://picsum.photos/200?random=${index}`,
  coverImage: `https://picsum.photos/800/200?random=${index}`,
  spaceImages: [
    `https://picsum.photos/400/300?random=${index}`,
    `https://picsum.photos/400/301?random=${index}`,
  ],
  address: {
    line1: `${index} Đường ABC`,
    city: index % 2 === 0 ? "Hà Nội" : "TP.HCM",
    district: index % 3 === 0 ? "Quận 1" : "Quận 3",
    country: "Vietnam",
  },
  phone: `090${String(index).padStart(7, "0")}`,
  email: `contact${index}@restaurant.com`,
  featuredMenu: ["Phở", "Bún bò", "Cơm gà"],
  amenities: ["WiFi", "Điều hòa", "Chỗ đỗ xe"],
  seatingCapacity: 40 + index,
  priceRange: index % 2 === 0 ? "$$" : "$$$",
  openingHours: "08:00",
  closingHours: "22:00",
  description: "Nhà hàng mẫu phục vụ chuyên nghiệp.",
  notesOnHours: "Có thể đóng cửa sớm vào ngày lễ.",
  notesOnAmenities: "Có chỗ để xe miễn phí.",
  cuisineType: index % 2 === 0 ? "Việt Nam" : "Hàn Quốc",
  status: "active",
  managerId, // gán quản lý
});

// Hàm seed 20 nhà hàng
const seedRestaurants = async () => {
  for (let i = 1; i <= 20; i++) {
    const input = generateRestaurantInput(i, managerIds[i - 1]);
    try {
      const data = await client.request(mutation, { input });
      console.log(
        `✅ Tạo thành công: ${data.createRestaurant.name} (Manager: ${data.createRestaurant.manager.email})`
      );
    } catch (err) {
      console.error(
        `❌ Lỗi khi tạo nhà hàng ${i}:`,
        err?.response?.errors || err.message
      );
    }
  }
};

seedRestaurants();
