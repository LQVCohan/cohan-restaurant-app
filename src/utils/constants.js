export const CATEGORIES = {
  appetizer: { key: "appetizer", name: "Khai vị", emoji: "🥗", icon: "🥗" },
  main: { key: "main", name: "Món chính", emoji: "🍖", icon: "🍜" },
  dessert: { key: "dessert", name: "Tráng miệng", emoji: "🍰", icon: "🍮" },
  beverage: { key: "beverage", name: "Đồ uống", emoji: "🥤", icon: "☕" },
};

export const STATUSES = {
  available: { key: "available", name: "Có sẵn", color: "success" },
  unavailable: { key: "unavailable", name: "Hết món", color: "danger" },
  limited: { key: "limited", name: "Có hạn", color: "warning" },
  stock: { key: "stock", name: "Tồn kho", color: "info" },
};

export const VIEW_MODES = {
  GRID: "grid",
  LIST: "list",
};

export const PRICE_ADJUSTMENT_TYPES = {
  PERCENT: "percent",
  AMOUNT: "amount",
};

export const PRICE_DIRECTIONS = {
  INCREASE: "increase",
  DECREASE: "decrease",
};

export const FOODHUB_DESIGN_TOKENS = {
  colors: {
    primary: "#0284c7",
    primaryHover: "#0369a1",
    primaryLight: "#f0f9ff",
    text: "#0c4a6e",
    gray: "#6b7280",
    background: "#f1f5f9",
    border: "#e2e8f0",
    white: "#ffffff",
  },
  spacing: ["0.25rem", "0.5rem", "1rem", "1.5rem", "2rem"],
  borderRadius: "1rem",
  shadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  font: "Inter",
};

export const RESTAURANTS = {
  "hcm-center": "🏢 Cohan Trung Tâm HCM",
  "hcm-district7": "🌆 Cohan Quận 7",
  "hcm-thuduc": "🏙️ Cohan Thủ Đức",
  "hanoi-center": "🏛️ Cohan Trung Tâm Hà Nội",
  "hanoi-caugiay": "🌸 Cohan Cầu Giấy",
  "danang-center": "🌊 Cohan Trung Tâm Đà Nẵng",
};

export const PROMOTION_TYPES = {
  percentage: "Giảm %",
  fixed: "Giảm tiền",
  bogo: "Mua 1 tặng 1",
  combo: "Combo",
  freeship: "Miễn ship",
};

export const COUPON_CATEGORIES = {
  food: "Coupon món ăn",
  table: "Coupon đặt bàn",
  order: "Coupon đặt món",
  shipping: "Coupon shipping",
};


export const COUPON_DISCOUNT_TYPES = {
  percent: "Giảm %",
  fixed: "Giảm tiền",
};


export const STATUS_TYPES = {
  active: "Đang hoạt động",
  scheduled: "Đã lên lịch",
  expired: "Đã hết hạn",
  draft: "Bản nháp",
};

export const TARGET_AUDIENCE = {
  all: "Tất cả KH",
  new: "KH mới",
  vip: "KH VIP",
  birthday: "Sinh nhật",
  inactive: "KH cũ",
};
export const INGREDIENT_CATEGORIES = [
  { value: "meat", label: "Thịt cá" },
  { value: "vegetable", label: "Rau củ" },
  { value: "spice", label: "Gia vị" },
  { value: "dairy", label: "Sữa & trứng" },
  { value: "grain", label: "Ngũ cốc" },
];

export const SUPPLY_CATEGORIES = [
  { value: "beverage", label: "Đồ uống" },
  { value: "cleaning", label: "Vệ sinh" },
  { value: "packaging", label: "Đóng gói" },
  { value: "utensil", label: "Dụng cụ" },
];

export const RECIPE_CATEGORIES = [
  { value: "appetizer", label: "Khai vị" },
  { value: "main", label: "Món chính" },
  { value: "dessert", label: "Tráng miệng" },
  { value: "drink", label: "Đồ uống" },
];

export const UNITS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "g", label: "Gram (g)" },
  { value: "l", label: "Lít (l)" },
  { value: "ml", label: "Mililít (ml)" },
  { value: "piece", label: "Cái" },
];

export const SUPPLY_UNITS = [
  { value: "chai", label: "Chai" },
  { value: "lon", label: "Lon" },
  { value: "cái", label: "Cái" },
  { value: "gói", label: "Gói" },
  { value: "hộp", label: "Hộp" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "l", label: "Lít (l)" },
];

export const STATUS_TYPES_PRODUCTS = {
  IN_STOCK: "in-stock",
  LOW_STOCK: "low-stock",
  OUT_OF_STOCK: "out-of-stock",
};
export const INITIAL_DATA = {
  restaurants: [
    { id: 1, name: "Nhà hàng Sài Gòn", address: "123 Nguyễn Huệ, Q1, TP.HCM" },
    { id: 2, name: "Nhà hàng Hà Nội", address: "456 Hoàn Kiếm, Hà Nội" },
    { id: 3, name: "Nhà hàng Đà Nẵng", address: "789 Hàn Thuyên, Đà Nẵng" },
  ],
  categories: [
    { id: 1, name: "Khai vị", icon: "🥗", description: "Món khai vị" },
    { id: 2, name: "Món chính", icon: "🍽️", description: "Món ăn chính" },
    { id: 3, name: "Tráng miệng", icon: "🍰", description: "Món tráng miệng" },
    { id: 4, name: "Đồ uống", icon: "🥤", description: "Nước uống" },
  ],
  menuItems: [
    {
      id: 1,
      restaurantId: 1,
      timeSlot: "breakfast",
      name: "Phở Bò Tái",
      category: "Món chính",
      status: "available",
      image: "🍜",
      description: "Phở bò tái truyền thống với nước dùng đậm đà",
      methods: [
        { name: "Tái", price: 45000, cookTime: 5, unit: "portion" },
        { name: "Chín", price: 45000, cookTime: 5, unit: "portion" },
        { name: "Tái chín", price: 50000, cookTime: 7, unit: "portion" },
      ],
      ingredients: [
        { name: "Thịt bò", amount: 200 },
        { name: "Bánh phở", amount: 150 },
        { name: "Hành lá", amount: 20 },
        { name: "Ngò gai", amount: 10 },
      ],
    },
    {
      id: 2,
      restaurantId: 1,
      timeSlot: "breakfast",
      name: "Bánh Mì Thịt Nướng",
      category: "Khai vị",
      status: "available",
      image: "🥖",
      description: "Bánh mì giòn với thịt nướng thơm lừng",
      methods: [
        { name: "Thường", price: 25000, cookTime: 3, unit: "portion" },
        { name: "Đặc biệt", price: 35000, cookTime: 5, unit: "portion" },
      ],
      ingredients: [
        { name: "Bánh mì", amount: 1 },
        { name: "Thịt nướng", amount: 100 },
        { name: "Rau sống", amount: 50 },
      ],
    },
    {
      id: 3,
      restaurantId: 1,
      timeSlot: "lunch",
      name: "Cơm Tấm Sườn Nướng",
      category: "Món chính",
      status: "available",
      image: "🍚",
      description: "Cơm tấm với sườn nướng đặc trưng Sài Gòn",
      methods: [
        { name: "Sườn nướng", price: 55000, cookTime: 15, unit: "portion" },
        { name: "Sườn + chả", price: 65000, cookTime: 15, unit: "portion" },
      ],
      ingredients: [
        { name: "Cơm tấm", amount: 200 },
        { name: "Sườn heo", amount: 150 },
        { name: "Chả trứng", amount: 50 },
      ],
    },
    {
      id: 4,
      restaurantId: 1,
      timeSlot: "lunch",
      name: "Chè Ba Màu",
      category: "Tráng miệng",
      status: "available",
      image: "🍧",
      description: "Chè ba màu truyền thống mát lạnh",
      methods: [
        { name: "Thường", price: 20000, cookTime: 2, unit: "portion" },
        { name: "Đặc biệt", price: 25000, cookTime: 3, unit: "portion" },
      ],
      ingredients: [
        { name: "Đậu xanh", amount: 50 },
        { name: "Đậu đỏ", amount: 50 },
        { name: "Thạch", amount: 30 },
        { name: "Nước cốt dừa", amount: 100 },
      ],
    },
    {
      id: 5,
      restaurantId: 1,
      timeSlot: "dinner",
      name: "Lẩu Thái Hải Sản",
      category: "Món chính",
      status: "available",
      image: "🍲",
      description: "Lẩu Thái chua cay với hải sản tươi ngon",
      methods: [
        { name: "2-3 người", price: 180000, cookTime: 20, unit: "portion" },
        { name: "4-5 người", price: 280000, cookTime: 25, unit: "portion" },
      ],
      ingredients: [
        { name: "Tôm", amount: 200 },
        { name: "Cua", amount: 150 },
        { name: "Cá", amount: 200 },
        { name: "Rau lẩu", amount: 300 },
      ],
    },
    {
      id: 6,
      restaurantId: 2,
      timeSlot: "breakfast",
      name: "Bún Chả Hà Nội",
      category: "Món chính",
      status: "available",
      image: "🍜",
      description: "Bún chả Hà Nội đậm đà hương vị truyền thống",
      methods: [
        { name: "Thường", price: 40000, cookTime: 10, unit: "portion" },
        { name: "Đặc biệt", price: 55000, cookTime: 12, unit: "portion" },
      ],
      ingredients: [
        { name: "Bún tươi", amount: 150 },
        { name: "Thịt nướng", amount: 100 },
        { name: "Chả cá", amount: 80 },
        { name: "Rau thơm", amount: 50 },
      ],
    },
  ],
};

export const TIME_SLOTS = {
  breakfast: { label: "🌅 Sáng", value: "breakfast" },
  lunch: { label: "☀️ Trưa", value: "lunch" },
  dinner: { label: "🌙 Tối", value: "dinner" },
  late_night: { label: "🌃 Đêm", value: "late_night" },
};
export const INITIAL_TABLE_DATA = [
  // Restaurant 1 - Nhà hàng Sài Gòn
  {
    id: 1,
    restaurantId: 1,
    number: "A01",
    capacity: 2,
    area: "Khu vực chính",
    location: "Gần cửa sổ",
    features: ["Gần cửa sổ", "Yên tĩnh"],
    reservationFee: 50000,
    status: "active",
  },
  {
    id: 2,
    restaurantId: 1,
    number: "A02",
    capacity: 4,
    area: "Khu vực chính",
    location: "Trung tâm",
    features: ["Phù hợp gia đình"],
    reservationFee: 100000,
    status: "active",
  },
  {
    id: 3,
    restaurantId: 1,
    number: "A03",
    capacity: 6,
    area: "Khu vực chính",
    location: "Góc phòng",
    features: ["Phù hợp gia đình", "Yên tĩnh"],
    reservationFee: 150000,
    status: "active",
  },
  {
    id: 4,
    restaurantId: 1,
    number: "V01",
    capacity: 2,
    area: "Khu VIP",
    location: "Phòng riêng",
    features: ["Có view", "Yên tĩnh", "Phòng riêng"],
    reservationFee: 200000,
    status: "active",
  },
  {
    id: 5,
    restaurantId: 1,
    number: "V02",
    capacity: 4,
    area: "Khu VIP",
    location: "Phòng riêng",
    features: ["Có view", "Phù hợp gia đình", "Phòng riêng"],
    reservationFee: 300000,
    status: "active",
  },
  {
    id: 6,
    restaurantId: 1,
    number: "V03",
    capacity: 8,
    area: "Khu VIP",
    location: "Phòng lớn",
    features: ["Có view", "Phù hợp gia đình", "Phòng riêng"],
    reservationFee: 500000,
    status: "active",
  },
  {
    id: 7,
    restaurantId: 1,
    number: "T01",
    capacity: 2,
    area: "Sân thượng",
    location: "Sân thượng",
    features: ["Có view", "Không khí trong lành"],
    reservationFee: 120000,
    status: "active",
  },
  {
    id: 8,
    restaurantId: 1,
    number: "T02",
    capacity: 4,
    area: "Sân thượng",
    location: "Sân thượng",
    features: ["Có view", "Không khí trong lành", "Phù hợp gia đình"],
    reservationFee: 180000,
    status: "active",
  },
  {
    id: 9,
    restaurantId: 1,
    number: "B01",
    capacity: 4,
    area: "Khu vực chính",
    location: "Gần bar",
    features: ["Gần bar", "Sôi động"],
    reservationFee: 80000,
    status: "active",
  },
  {
    id: 10,
    restaurantId: 1,
    number: "B02",
    capacity: 6,
    area: "Khu vực chính",
    location: "Gần bar",
    features: ["Gần bar", "Sôi động", "Phù hợp gia đình"],
    reservationFee: 120000,
    status: "active",
  },

  // Restaurant 2 - Nhà hàng Hà Nội
  {
    id: 11,
    restaurantId: 2,
    number: "H01",
    capacity: 2,
    area: "Khu vực chính",
    location: "Gần cửa sổ",
    features: ["Gần cửa sổ", "Yên tĩnh"],
    reservationFee: 60000,
    status: "active",
  },
  {
    id: 12,
    restaurantId: 2,
    number: "H02",
    capacity: 4,
    area: "Khu vực chính",
    location: "Trung tâm",
    features: ["Phù hợp gia đình"],
    reservationFee: 120000,
    status: "active",
  },
  {
    id: 13,
    restaurantId: 2,
    number: "H03",
    capacity: 6,
    area: "Khu vực chính",
    location: "Góc phòng",
    features: ["Phù hợp gia đình", "Yên tĩnh"],
    reservationFee: 180000,
    status: "active",
  },
  {
    id: 14,
    restaurantId: 2,
    number: "P01",
    capacity: 4,
    area: "Phòng riêng",
    location: "Phòng riêng nhỏ",
    features: ["Yên tĩnh", "Phòng riêng", "Phù hợp gia đình"],
    reservationFee: 250000,
    status: "active",
  },
  {
    id: 15,
    restaurantId: 2,
    number: "P02",
    capacity: 8,
    area: "Phòng riêng",
    location: "Phòng riêng lớn",
    features: ["Yên tĩnh", "Phòng riêng", "Phù hợp gia đình"],
    reservationFee: 400000,
    status: "active",
  },
  {
    id: 16,
    restaurantId: 2,
    number: "G01",
    capacity: 2,
    area: "Khu vườn",
    location: "Khu vườn",
    features: ["Có view", "Không khí trong lành", "Yên tĩnh"],
    reservationFee: 100000,
    status: "active",
  },
  {
    id: 17,
    restaurantId: 2,
    number: "G02",
    capacity: 4,
    area: "Khu vườn",
    location: "Khu vườn",
    features: ["Có view", "Không khí trong lành", "Phù hợp gia đình"],
    reservationFee: 150000,
    status: "active",
  },
  {
    id: 18,
    restaurantId: 2,
    number: "G03",
    capacity: 6,
    area: "Khu vườn",
    location: "Khu vườn",
    features: ["Có view", "Không khí trong lành", "Phù hợp gia đình"],
    reservationFee: 200000,
    status: "active",
  },
];

export const TIME_SLOTS_HOURS = [
  { value: "11:00", label: "11:00 - Trưa sớm" },
  { value: "11:30", label: "11:30" },
  { value: "12:00", label: "12:00 - Trưa" },
  { value: "12:30", label: "12:30" },
  { value: "13:00", label: "13:00" },
  { value: "13:30", label: "13:30" },
  { value: "17:00", label: "17:00 - Tối sớm" },
  { value: "17:30", label: "17:30" },
  { value: "18:00", label: "18:00 - Tối" },
  { value: "18:30", label: "18:30" },
  { value: "19:00", label: "19:00" },
  { value: "19:30", label: "19:30" },
  { value: "20:00", label: "20:00" },
  { value: "20:30", label: "20:30" },
  { value: "21:00", label: "21:00" },
];

export const TABLE_AREAS = [
  "Khu vực chính",
  "Khu VIP",
  "Sân thượng",
  "Phòng riêng",
  "Khu vườn",
];

export const TABLE_FEATURES = [
  "Gần cửa sổ",
  "Yên tĩnh",
  "Có view",
  "Gần bar",
  "Phù hợp gia đình",
  "Phòng riêng",
  "Không khí trong lành",
  "Sôi động",
];
export const ORDER_TYPES = {
  DINE_IN: "dine_in",
  TAKEAWAY: "takeaway",
  DELIVERY: "delivery",
};

export const TABLE_STATUS = {
  AVAILABLE: "available",
  OCCUPIED: "occupied",
  RESERVED: "reserved",
};

export const PRINTER_STATUS = {
  ONLINE: "online",
  OFFLINE: "offline",
  BUSY: "busy",
};
