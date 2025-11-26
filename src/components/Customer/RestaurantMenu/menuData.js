// src/data/mockData.js

export const MOCK_RESTAURANTS = [
  {
    id: "res_01",
    name: "Cơm Niêu Sài Gòn",
    cuisine: "Việt Nam",
    rating: 4.8,
    reviews: 1240,
    address: "27 Tú Xương, Q.3, TP.HCM",
    cover:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000",
    logo: "https://cdn-icons-png.flaticon.com/512/1532/1532688.png",
  },
  {
    id: "res_02",
    name: "Sushi Hokkaido",
    cuisine: "Nhật Bản",
    rating: 4.9,
    reviews: 3500,
    address: "123 Nguyễn Huệ, Q.1, TP.HCM",
    cover:
      "https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=1000",
    logo: "https://cdn-icons-png.flaticon.com/512/2276/2276931.png",
  },
  {
    id: "res_03",
    name: "Pizza 4P's",
    cuisine: "Fusion / Ý",
    rating: 4.7,
    reviews: 890,
    address: "8 Thủ Khoa Huân, Q.1, TP.HCM",
    cover:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?q=80&w=1000",
    logo: "https://cdn-icons-png.flaticon.com/512/1404/1404945.png",
  },
];

export const MOCK_CATEGORIES = [
  { id: "cat_starter", name: "Khai Vị" },
  { id: "cat_main", name: "Món Chính" },
  { id: "cat_drink", name: "Đồ Uống" },
  { id: "cat_dessert", name: "Tráng Miệng" },
];

export const MOCK_MENU_ITEMS = [
  // --- BỮA SÁNG (Breakfast) ---
  {
    id: "bf_01",
    restaurantId: "res_01",
    categoryId: "cat_main",
    timeSlot: "breakfast",
    name: "Bánh Mì Ốp La Pate",
    description: "Bánh mì nóng giòn, 2 trứng ốp la, pate gan nhà làm.",
    basePrice: 35000,
    thumbImage:
      "https://images.unsplash.com/photo-1599806112354-67f8b5425a06?q=80&w=600",
    status: "active",
    servingVariants: [],
  },
  {
    id: "bf_02",
    restaurantId: "res_01",
    categoryId: "cat_drink",
    timeSlot: "breakfast",
    name: "Cà Phê Sữa Đá",
    description: "Cà phê phin đậm đà hương vị Việt Nam.",
    basePrice: 25000,
    thumbImage:
      "https://images.unsplash.com/photo-1576089304328-97cb244c4b82?q=80&w=600",
    status: "active",
    servingVariants: [],
  },

  // --- BỮA TRƯA (Lunch) ---
  {
    id: "lunch_01",
    restaurantId: "res_01",
    categoryId: "cat_starter",
    timeSlot: "lunch",
    name: "Gỏi Cuốn Tôm Thịt",
    description: "Tôm tươi, thịt ba chỉ, bún, rau sống, chấm mắm nêm.",
    basePrice: 45000,
    thumbImage:
      "https://images.unsplash.com/photo-1548505230-080ea21033e0?q=80&w=600",
    status: "active",
    servingVariants: [],
  },
  {
    id: "lunch_02",
    restaurantId: "res_01",
    categoryId: "cat_main",
    timeSlot: "lunch",
    name: "Cơm Niêu Cá Kho Tộ",
    description: "Cơm nấu niêu đất cháy giòn, cá lóc kho tộ đậm đà.",
    basePrice: 120000,
    thumbImage:
      "https://images.unsplash.com/photo-1564834724105-918b73d1b9e0?q=80&w=600",
    status: "active",
    servingVariants: [{ name: "Phần nhỏ" }, { name: "Phần lớn" }],
  },

  // --- BỮA TỐI (Dinner) ---
  {
    id: "din_01",
    restaurantId: "res_01",
    categoryId: "cat_main",
    timeSlot: "dinner",
    name: "Lẩu Riêu Cua Đồng",
    description: "Lẩu riêu cua bắp bò sườn sụn đặc biệt.",
    basePrice: 350000,
    thumbImage:
      "https://images.unsplash.com/photo-1559847844-5315695dadae?q=80&w=600",
    status: "active",
    servingVariants: [{ name: "Size M" }, { name: "Size L" }],
  },

  // --- ĂN ĐÊM (Late Night) ---
  {
    id: "ln_01",
    restaurantId: "res_01",
    categoryId: "cat_main",
    timeSlot: "late_night",
    name: "Cháo Trắng Lá Dứa",
    description: "Cháo trắng hột vịt muối, dưa mắm.",
    basePrice: 30000,
    thumbImage:
      "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?q=80&w=600",
    status: "active",
    servingVariants: [],
  },

  // --- DỮ LIỆU GIẢ LẬP ĐỂ TEST PHÂN TRANG (Tạo 12 món trưa) ---
  ...Array.from({ length: 12 }).map((_, i) => ({
    id: `lunch_extra_${i}`,
    restaurantId: "res_01",
    categoryId: "cat_main",
    timeSlot: "lunch",
    name: `Cơm Văn Phòng ${i + 1}`,
    description: "Cơm trưa văn phòng đầy đủ dinh dưỡng, canh rau theo ngày.",
    basePrice: 50000 + i * 2000,
    thumbImage:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=600",
    status: "active",
    servingVariants: [],
  })),
];
