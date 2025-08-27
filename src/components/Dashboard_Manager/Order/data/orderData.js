export const sampleOrders = [
  {
    id: "DH001",
    customerName: "Nguyễn Văn An",
    tableNumber: "Bàn 05",
    type: "table",
    status: "pending",
    orderTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    items: [
      {
        name: "Phở Bò Tái",
        quantity: 2,
        price: 65000,
        status: "pending",
        notes: "Không hành, ít muối",
        recipe:
          "Nước dùng: Xương bò ninh 8 tiếng + gia vị. Bánh phở: Ngâm nước ấm 30p. Thịt bò tái: Thái mỏng, chan nước dùng nóng.",
      },
      {
        name: "Gỏi Cuốn Tôm",
        quantity: 1,
        price: 45000,
        status: "pending",
        notes: "Thêm rau thơm",
        recipe:
          "Bánh tráng: Nhúng nước ấm. Tôm: Luộc chín, bóc vỏ. Cuốn với rau sống, bún tươi. Chấm nước mắm chua ngọt.",
      },
      {
        name: "Nước Cam Tươi",
        quantity: 2,
        price: 25000,
        status: "pending",
        notes: "Ít đá",
        recipe:
          "Cam tươi vắt + đường + đá. Tỷ lệ: 200ml cam, 1 thìa đường, 50g đá.",
      },
    ],
    total: 160000,
    notes: "Không hành, ít muối",
  },
  {
    id: "DH002",
    customerName: "Trần Thị Bình",
    tableNumber: "Mang về",
    type: "takeaway",
    status: "confirmed",
    orderTime: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
    items: [
      {
        name: "Cơm Gà Nướng",
        quantity: 1,
        price: 55000,
        status: "preparing",
        notes: "Nướng vừa chín",
        recipe:
          "Gà ướp: Nước mắm, tỏi, ớt, đường 2h. Nướng than hoa 15p mỗi mặt. Cơm: Nấu với nước dùng gà.",
      },
      {
        name: "Canh Chua Cá",
        quantity: 1,
        price: 40000,
        status: "confirmed",
        notes: "Chua vừa phải",
        recipe:
          "Cá tra thái khúc. Nấu với me, cà chua, dứa, đậu bắp, giá đỗ. Nêm nếm vừa ăn.",
      },
    ],
    total: 95000,
    notes: "",
  },
  {
    id: "DH003",
    customerName: "Lê Minh Cường",
    tableNumber: "Bàn 12",
    type: "table",
    status: "preparing",
    orderTime: new Date(Date.now() - 35 * 60 * 1000), // 35 minutes ago
    items: [
      {
        name: "Bún Bò Huế",
        quantity: 3,
        price: 60000,
        status: "preparing",
        notes: "Cay vừa phải",
        recipe:
          "Nước dùng xương heo + bò. Bún tươi. Thịt bò, chả cua. Gia vị đặc trưng Huế.",
      },
      {
        name: "Chả Giò",
        quantity: 1,
        price: 35000,
        status: "confirmed",
        notes: "",
        recipe:
          "Nhân: Thịt heo, tôm, mộc nhĩ, cà rốt. Cuốn bánh tráng, chiên giòn vàng.",
      },
      {
        name: "Trà Đá",
        quantity: 3,
        price: 10000,
        status: "confirmed",
        notes: "",
        recipe: "Trà xanh pha đậm đà + đá viên.",
      },
    ],
    total: 245000,
    notes: "Cay vừa phải",
  },
  {
    id: "DH005",
    customerName: "Hoàng Văn Em",
    tableNumber: "Bàn 08",
    type: "table",
    status: "ready",
    orderTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    items: [
      {
        name: "Lẩu Thái",
        quantity: 1,
        price: 280000,
        status: "confirmed",
        notes: "Lẩu cay cấp độ 3",
        recipe:
          "Nước dùng chua cay Thái Lan. Tôm, cá, nấm, rau củ. Gia vị đặc trưng.",
      },
      {
        name: "Rau Sống",
        quantity: 1,
        price: 25000,
        status: "confirmed",
        notes: "",
        recipe: "Rau sống tươi: xà lách, húng quế, kinh giới, dưa leo.",
      },
      {
        name: "Coca Cola",
        quantity: 4,
        price: 15000,
        status: "confirmed",
        notes: "",
        recipe: "Nước ngọt có gas, phục vụ lạnh với đá.",
      },
    ],
    total: 365000,
    notes: "Lẩu cay cấp độ 3",
  },
];

export const sampleHistory = [
  {
    id: "DH100",
    customerName: "Lê Văn Hoàng",
    tableNumber: "Bàn 02",
    type: "table",
    status: "completed",
    orderTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    completedTime: new Date(Date.now() - 90 * 60 * 1000), // 1.5 hours ago
    items: [
      {
        name: "Bún Chả Hà Nội",
        quantity: 1,
        price: 70000,
        status: "confirmed",
        notes: "Thêm rau sống",
        recipe:
          "Thịt nướng than hoa. Bún tươi. Nước mắm pha chua ngọt với tỏi ớt.",
      },
    ],
    total: 70000,
    notes: "Khách VIP",
  },
  {
    id: "DH099",
    customerName: "Nguyễn Thị Mai",
    tableNumber: "Giao hàng",
    type: "delivery",
    status: "completed",
    orderTime: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    completedTime: new Date(Date.now() - 2.5 * 60 * 60 * 1000), // 2.5 hours ago
    items: [
      {
        name: "Bánh Mì Thịt Nướng",
        quantity: 3,
        price: 25000,
        status: "confirmed",
        notes: "Không pate",
        recipe: "Bánh mì nướng giòn. Thịt nướng + rau sống + nước sốt.",
      },
      {
        name: "Cà Phê Sữa Đá",
        quantity: 2,
        price: 20000,
        status: "confirmed",
        notes: "Ít đường",
        recipe: "Cà phê phin + sữa đặc + đá viên.",
      },
    ],
    total: 115000,
    notes: "Giao đến 456 Lê Lợi, Q1",
  },
];
