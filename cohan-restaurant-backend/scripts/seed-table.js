import { GraphQLClient, gql } from "graphql-request";
import process from "process";

// GraphQL mutation để tạo bàn
const CREATE_TABLE = gql`
  mutation createTable($input: CreateTableInput!) {
    createTable(input: $input) {
      id
      code
      capacity
      status
      floorId
      position {
        x
        y
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

// IDs của các tầng
const floorIds = [
  "68eeafd80730663ab5848651",
  "68eeafd80730663ab5848653",
  "68eeafd80730663ab5848655",
  "68eeafd80730663ab5848657",
];

// Hàm tạo bàn cho nhà hàng
const createTablesForRestaurant = async (restaurantId) => {
  // Lặp qua các floorIds đã cho
  for (let floorIndex = 0; floorIndex < floorIds.length; floorIndex++) {
    const floorId = floorIds[floorIndex];
    const floorLevel = floorIndex + 1; // Tầng 1, 2, 3, 4

    // Lặp qua 20 bàn cho mỗi tầng
    for (let i = 1; i <= 20; i++) {
      const tableCode = `${String.fromCharCode(64 + floorLevel)}${i}`; // Mã bàn như A1, B2, C3...
      const TABLES_PER_ROW = 7; // Số bàn mỗi hàng
      const TABLE_WIDTH = 150; // Khoảng cách giữa các bàn (vị trí X)
      const TABLE_HEIGHT = 150; // Khoảng cách giữa các bàn (vị trí Y)
      const START_X = 50; // Vị trí bắt đầu của bàn theo chiều ngang (X)
      const START_Y = 50; // Vị trí bắt đầu của bàn theo chiều dọc (Y)
      // Dữ liệu bàn
      const input = {
        restaurantId,
        floorId, // Sử dụng floorId đã được cung cấp
        code: tableCode,
        type: "standard", // Loại bàn, ví dụ standard
        capacity: 4, // Số lượng khách tối đa
        position: {
          x: START_X + (i % TABLES_PER_ROW) * TABLE_WIDTH, // Tính vị trí X dựa vào chỉ số bàn và số bàn mỗi hàng
          y: START_Y + Math.floor(i / TABLES_PER_ROW) * TABLE_HEIGHT, // Tính vị trí Y theo hàng
        },
        status: "available", // Trạng thái ban đầu của bàn
        tags: [],
        isJoinable: false,
        joinGroupId: null,
      };

      try {
        // Thực thi mutation để tạo bàn
        await client.request(CREATE_TABLE, { input: input });
        console("ok ", i);
      } catch (error) {
        console.error(`Lỗi khi tạo bàn ${tableCode}:`, error);
      }
    }
  }
};

// Gọi hàm tạo bàn cho nhà hàng
createTablesForRestaurant("68e3fc0486dc90d60c7101dc");
