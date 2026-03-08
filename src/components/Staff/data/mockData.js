export const MOCK_FLOORS = ["Tầng 1", "Tầng 2", "Sân Vườn", "Phòng VIP"];

export const MENU_CATEGORIES = [
  "Tất cả",
  "🔥 Phổ biến",
  "🥩 Món Nướng",
  "🍲 Lẩu",
  "🍹 Nước uống",
  "🍰 Tráng miệng",
];

export const MOCK_CUSTOMERS = [
  {
    id: "CUS1",
    name: "Trần Văn Khách",
    phone: "0901234567",
    rank: "Vàng",
    points: 1250,
    note: "Dị ứng đậu phộng",
  },
  {
    id: "CUS2",
    name: "Lê Thị Khách Víp",
    phone: "0987654321",
    rank: "Kim Cương",
    points: 5400,
    note: "Thích ăn nhạt",
  },
];

export const INITIAL_TABLES = [
  {
    id: "T1",
    name: "Bàn 01",
    floor: "Tầng 1",
    status: "serving",
    guests: 4,
    customer: MOCK_CUSTOMERS[0],
  },
  {
    id: "T2",
    name: "Bàn 02",
    floor: "Tầng 1",
    status: "empty",
    guests: 0,
    customer: null,
  },
  {
    id: "T3",
    name: "Bàn 03",
    floor: "Tầng 1",
    status: "waiting_pay",
    guests: 2,
    customer: null,
  },
  {
    id: "V1",
    name: "VIP 01",
    floor: "Phòng VIP",
    status: "empty",
    guests: 0,
    customer: null,
  },
];

export const MOCK_MENU = [
  {
    id: "M1",
    name: "Bò Wagyu Nướng Đá",
    price: 550000,
    stock: 12,
    category: "🥩 Món Nướng",
    prep: ["Chín vừa", "Chín kỹ", "Tái"],
  },
  {
    id: "M2",
    name: "Lẩu Thái Tomyum",
    price: 350000,
    stock: 5,
    category: "🍲 Lẩu",
    prep: ["Ít cay", "Cay nhiều"],
  },
  {
    id: "M3",
    name: "Nước Ép Dưa Hấu",
    price: 45000,
    stock: 0,
    category: "🍹 Nước uống",
    prep: ["Ít đá", "Không đường"],
  },
  {
    id: "M4",
    name: "Salad Cá Hồi",
    price: 120000,
    stock: 8,
    category: "🔥 Phổ biến",
    prep: ["Sốt mè rang", "Sốt chanh dây"],
  },
];
