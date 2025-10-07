import "dotenv/config";
import process from "process";
const BASE_URL = process.env.GRAPHQL_URL || "http://localhost:4000/graphql";
const TOKEN = process.env.ADMIN_TOKEN || ""; // Bearer <JWT_ADMIN_TOKEN>

const headers = {
  "Content-Type": "application/json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

// GraphQL mutation (dùng variables)
const CREATE_PERMISSION_MUTATION = `
  mutation CreatePermission($input: CreatePermissionInput!) {
    createPermission(input: $input) {
      id
      code
      name
      group
      createdAt
    }
  }
`;

// (Tuỳ chọn) Query kiểm tra lại danh sách
const LIST_PERMISSIONS_QUERY = `
  query Permissions($group: String, $search: String) {
    permissions(group: $group, search: $search) {
      id
      code
      name
      group
    }
  }
`;

async function gqlRequest(query, variables = {}, operationName = undefined) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables, operationName }),
  });

  const json = await res.json();
  if (!res.ok || json.errors) {
    const errs = json.errors?.map((e) => e.message).join("; ");
    throw new Error(`GraphQL error: ${errs || res.statusText}`);
  }
  return json.data;
}

async function seedPermissions() {
  // 10 quyền cơ bản
  const permissions = [
    {
      code: "restaurant.read",
      name: "Xem thông tin nhà hàng",
      group: "restaurant",
      description: "Xem danh sách & chi tiết nhà hàng",
    },
    {
      code: "restaurant.create",
      name: "Tạo mới nhà hàng",
      group: "restaurant",
      description: "Tạo mới nhà hàng",
    },
    {
      code: "restaurant.update",
      name: "Cập nhật nhà hàng",
      group: "restaurant",
      description: "Sửa thông tin nhà hàng",
    },
    {
      code: "restaurant.delete",
      name: "Xoá nhà hàng",
      group: "restaurant",
      description: "Xoá nhà hàng",
    },
    {
      code: "menu.read",
      name: "Xem menu",
      group: "menu",
      description: "Xem danh sách món & danh mục",
    },
    {
      code: "menu.update",
      name: "Quản lý menu",
      group: "menu",
      description: "Thêm/sửa/xoá món",
    },
    {
      code: "order.read",
      name: "Xem đơn hàng",
      group: "order",
      description: "Xem đơn & chi tiết đơn",
    },
    {
      code: "order.update",
      name: "Xử lý đơn hàng",
      group: "order",
      description: "Cập nhật trạng thái đơn",
    },
    {
      code: "reservation.manage",
      name: "Quản lý đặt bàn",
      group: "reservation",
      description: "Xác nhận/chỉnh sửa/hủy đặt bàn",
    },
    {
      code: "user.manage",
      name: "Quản lý người dùng & phân quyền",
      group: "user",
      description: "Thêm/sửa/assign role",
    },
  ];

  for (const p of permissions) {
    try {
      const data = await gqlRequest(
        CREATE_PERMISSION_MUTATION,
        { input: p },
        "CreatePermission"
      );
      console.log(
        "✅ Created:",
        data.createPermission.code,
        "→ id:",
        data.createPermission.id
      );
    } catch (err) {
      console.log("ℹ️ Skip:", p.code, "|", err.message); // trùng code sẽ báo skip
    }
  }

  // (Tuỳ chọn) Kiểm tra lại
  try {
    const out = await gqlRequest(
      LIST_PERMISSIONS_QUERY,
      { group: "restaurant" },
      "Permissions"
    );
    console.log(
      "🔎 Permissions (group=restaurant):",
      out.permissions.map((x) => x.code)
    );
  } catch (e) {
    console.log("⚠️ Verify list error:", e.message);
  }
}

seedPermissions().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
