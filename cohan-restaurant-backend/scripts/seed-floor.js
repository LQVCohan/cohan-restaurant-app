import { GraphQLClient, gql } from "graphql-request";
import process from "process";

const CREATE_FLOOR = gql`
  mutation createFloor($input: CreateFloorInput!) {
    createFloor(input: $input) {
      id
      name
      level
      description
      planImage
      isActive
      meta {
        width
        height
      }
    }
  }
`;

const endpoint = process.env.GRAPHQL_URL || "http://localhost:4000/graphql";
const client = new GraphQLClient(endpoint, {
  headers: {
    "Content-Type": "application/json",
  },
});

// Hàm tạo các tầng cho nhà hàng
const createFloorsForRestaurant = async (restaurantId) => {
  // Lặp qua 4 tầng để tạo các floor
  for (let floorLevel = 1; floorLevel <= 4; floorLevel++) {
    const floorName = `Tầng ${floorLevel}`;
    const input = {
      restaurantId,
      name: floorName,
      level: floorLevel,
      description: `Tầng ${floorLevel} của nhà hàng`,
      planImage: "path_to_floor_plan_image", // Có thể thêm đường dẫn ảnh sơ đồ tầng nếu cần
      isActive: true,
      meta: {
        width: 1920, // Kích thước canvas frontend
        height: 1080,
      },
    };

    try {
      // Thực thi mutation để tạo floor
      const { data } = await client.request(CREATE_FLOOR, { input: input });
      const created = data;
      //   console.log(`Đã tạo tầng ${created.name} (level: ${created.level})`);
      console.log("data", created);
    } catch (error) {
      console.error(`Lỗi khi tạo tầng ${floorLevel}:`, error);
    }
  }
};

// Gọi hàm tạo tầng cho nhà hàng
createFloorsForRestaurant("68e3fc0486dc90d60c7101dc");
