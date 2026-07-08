const TIME_SLOT_NAMES = {
  breakfast: "Thực đơn buổi sáng",
  lunch: "Thực đơn buổi trưa",
  dinner: "Thực đơn buổi tối",
  late_night: "Thực đơn ăn khuya",
};

const slug = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const ingredient = (key, name, baseUnit, category) => ({ key, name, baseUnit, category });
const menu = (timeSlot, description) => ({ key: timeSlot, timeSlot, name: TIME_SLOT_NAMES[timeSlot], description });
const dish = (key, name, timeSlot, category, price, ingredients, options = {}) => ({
  key,
  name,
  timeSlot,
  category,
  price,
  ingredients,
  prepTime: options.prepTime || 15,
  meatTypes: options.meatTypes || [],
  description: options.description || "Công thức khởi tạo để nhà hàng tiếp tục điều chỉnh.",
});

const DEFINITIONS = [
  {
    key: "vietnamese",
    version: 1,
    name: "Ẩm thực Việt Nam",
    cuisineType: "Việt Nam",
    description: "Món Việt quen thuộc, cân bằng giữa món nước, cơm và món gia đình.",
    amenities: ["Phục vụ tại bàn", "Món mang về", "Món gia đình"],
    ingredients: [
      ingredient("rice-noodle", "Bánh phở", "g", "Tinh bột"),
      ingredient("rice", "Gạo", "g", "Tinh bột"),
      ingredient("beef", "Thịt bò", "g", "Thịt"),
      ingredient("chicken", "Thịt gà", "g", "Thịt"),
      ingredient("pork", "Thịt heo", "g", "Thịt"),
      ingredient("fish-sauce", "Nước mắm", "ml", "Gia vị"),
      ingredient("egg", "Trứng gà", "unit", "Trứng"),
      ingredient("herbs", "Rau thơm", "g", "Rau củ"),
      ingredient("onion", "Hành", "g", "Rau củ"),
      ingredient("tofu", "Đậu hũ", "g", "Đậu và hạt"),
    ],
    menus: [menu("breakfast", "Các món sáng nhanh và nóng."), menu("lunch", "Cơm và món no cho buổi trưa."), menu("dinner", "Món gia đình dùng cho buổi tối.")],
    dishes: [
      dish("pho-bo", "Phở bò", "breakfast", "Món nước", 55000, [["rice-noodle", 180, "g"], ["beef", 100, "g"], ["onion", 15, "g"], ["herbs", 10, "g"], ["fish-sauce", 5, "ml"]], { meatTypes: ["BEEF"], prepTime: 12 }),
      dish("com-ga", "Cơm gà", "lunch", "Cơm", 59000, [["rice", 180, "g"], ["chicken", 150, "g"], ["onion", 10, "g"], ["fish-sauce", 8, "ml"]], { meatTypes: ["CHICKEN"] }),
      dish("bun-thit-nuong", "Bún thịt nướng", "lunch", "Món trộn", 62000, [["rice-noodle", 180, "g"], ["pork", 120, "g"], ["herbs", 25, "g"], ["fish-sauce", 15, "ml"]], { meatTypes: ["PORK"] }),
      dish("ca-kho-to", "Cơm thịt kho trứng", "dinner", "Món gia đình", 69000, [["rice", 180, "g"], ["pork", 120, "g"], ["egg", 1, "unit"], ["fish-sauce", 12, "ml"]], { meatTypes: ["PORK"] }),
      dish("dau-hu-hanh", "Đậu hũ sốt hành", "dinner", "Món chay", 45000, [["tofu", 220, "g"], ["onion", 25, "g"], ["fish-sauce", 5, "ml"]]),
      dish("trung-chien", "Trứng chiên cơm trắng", "dinner", "Món gia đình", 42000, [["rice", 180, "g"], ["egg", 2, "unit"], ["onion", 10, "g"], ["fish-sauce", 5, "ml"]]),
    ],
  },
  {
    key: "korean",
    version: 1,
    name: "Ẩm thực Hàn Quốc",
    cuisineType: "Hàn Quốc",
    description: "Món Hàn đậm vị với cơm, kimchi, thịt nướng và các món canh nóng.",
    amenities: ["Phục vụ tại bàn", "Món mang về", "Món cay tùy chọn"],
    ingredients: [
      ingredient("rice", "Gạo", "g", "Tinh bột"),
      ingredient("kimchi", "Kimchi", "g", "Rau củ"),
      ingredient("gochujang", "Tương ớt Gochujang", "g", "Gia vị"),
      ingredient("beef", "Thịt bò", "g", "Thịt"),
      ingredient("pork", "Thịt heo", "g", "Thịt"),
      ingredient("chicken", "Thịt gà", "g", "Thịt"),
      ingredient("tofu", "Đậu hũ", "g", "Đậu và hạt"),
      ingredient("seaweed", "Rong biển", "g", "Rau củ"),
      ingredient("mushroom", "Nấm", "g", "Rau củ"),
      ingredient("sesame-oil", "Dầu mè", "ml", "Gia vị"),
    ],
    menus: [menu("lunch", "Cơm trộn, canh và món ăn nhanh buổi trưa."), menu("dinner", "Thịt, gà và món nóng cho buổi tối."), menu("late_night", "Món cay và món ăn khuya.")],
    dishes: [
      dish("bibimbap", "Cơm trộn Bibimbap", "lunch", "Cơm", 79000, [["rice", 180, "g"], ["beef", 80, "g"], ["kimchi", 50, "g"], ["mushroom", 40, "g"], ["gochujang", 20, "g"], ["sesame-oil", 5, "ml"]], { meatTypes: ["BEEF"] }),
      dish("kimchi-jjigae", "Canh kimchi đậu hũ", "lunch", "Canh", 72000, [["kimchi", 120, "g"], ["tofu", 120, "g"], ["pork", 70, "g"], ["gochujang", 10, "g"]], { meatTypes: ["PORK"] }),
      dish("bulgogi", "Bò Bulgogi", "dinner", "Món chính", 119000, [["beef", 180, "g"], ["mushroom", 50, "g"], ["sesame-oil", 8, "ml"], ["rice", 160, "g"]], { meatTypes: ["BEEF"] }),
      dish("korean-chicken", "Gà sốt cay Hàn Quốc", "dinner", "Món chính", 109000, [["chicken", 220, "g"], ["gochujang", 30, "g"], ["sesame-oil", 5, "ml"]], { meatTypes: ["CHICKEN"] }),
      dish("seaweed-rice", "Cơm cuộn rong biển", "lunch", "Món cuộn", 65000, [["rice", 160, "g"], ["seaweed", 8, "g"], ["mushroom", 35, "g"], ["sesame-oil", 5, "ml"]]),
      dish("spicy-tofu", "Đậu hũ sốt cay", "late_night", "Món ăn khuya", 59000, [["tofu", 200, "g"], ["gochujang", 25, "g"], ["kimchi", 50, "g"], ["sesame-oil", 5, "ml"]]),
    ],
  },
  {
    key: "japanese",
    version: 1,
    name: "Ẩm thực Nhật Bản",
    cuisineType: "Nhật Bản",
    description: "Thực đơn Nhật gọn vị với cơm, cá, mì udon và canh miso.",
    amenities: ["Phục vụ tại bàn", "Món mang về", "Khẩu phần cá nhân"],
    ingredients: [
      ingredient("rice", "Gạo Nhật", "g", "Tinh bột"),
      ingredient("salmon", "Cá hồi", "g", "Hải sản"),
      ingredient("tuna", "Cá ngừ", "g", "Hải sản"),
      ingredient("nori", "Rong biển Nori", "g", "Rau củ"),
      ingredient("miso", "Tương Miso", "g", "Gia vị"),
      ingredient("soy-sauce", "Nước tương Nhật", "ml", "Gia vị"),
      ingredient("udon", "Mì Udon", "g", "Tinh bột"),
      ingredient("tofu", "Đậu hũ", "g", "Đậu và hạt"),
      ingredient("egg", "Trứng gà", "unit", "Trứng"),
      ingredient("mushroom", "Nấm", "g", "Rau củ"),
    ],
    menus: [menu("lunch", "Cơm, sushi và mì cho buổi trưa."), menu("dinner", "Món cá, mì và canh nóng cho buổi tối.")],
    dishes: [
      dish("salmon-sushi", "Sushi cá hồi", "lunch", "Sushi", 99000, [["rice", 150, "g"], ["salmon", 100, "g"], ["nori", 5, "g"], ["soy-sauce", 10, "ml"]], { meatTypes: ["FISH"] }),
      dish("tuna-don", "Cơm cá ngừ", "lunch", "Cơm", 109000, [["rice", 180, "g"], ["tuna", 120, "g"], ["nori", 5, "g"], ["soy-sauce", 12, "ml"]], { meatTypes: ["FISH"] }),
      dish("miso-soup", "Canh Miso đậu hũ", "lunch", "Canh", 39000, [["miso", 25, "g"], ["tofu", 80, "g"], ["nori", 3, "g"], ["mushroom", 30, "g"]]),
      dish("mushroom-udon", "Udon nấm", "dinner", "Mì", 79000, [["udon", 200, "g"], ["mushroom", 80, "g"], ["soy-sauce", 15, "ml"], ["miso", 10, "g"]]),
      dish("salmon-rice", "Cơm cá hồi áp chảo", "dinner", "Món chính", 129000, [["rice", 180, "g"], ["salmon", 160, "g"], ["soy-sauce", 12, "ml"], ["mushroom", 40, "g"]], { meatTypes: ["FISH"] }),
      dish("tamagoyaki", "Trứng cuộn Nhật", "dinner", "Món phụ", 49000, [["egg", 3, "unit"], ["soy-sauce", 5, "ml"], ["nori", 2, "g"]]),
    ],
  },
  {
    key: "italian",
    version: 1,
    name: "Ẩm thực Ý",
    cuisineType: "Ý",
    description: "Pizza, pasta và món sốt kem dựa trên nguyên liệu Ý phổ biến.",
    amenities: ["Phục vụ tại bàn", "Món mang về", "Khẩu phần chia sẻ"],
    ingredients: [
      ingredient("pasta", "Mì Pasta", "g", "Tinh bột"),
      ingredient("flour", "Bột mì", "g", "Tinh bột"),
      ingredient("tomato", "Cà chua", "g", "Rau củ"),
      ingredient("mozzarella", "Phô mai Mozzarella", "g", "Sữa và phô mai"),
      ingredient("parmesan", "Phô mai Parmesan", "g", "Sữa và phô mai"),
      ingredient("olive-oil", "Dầu ô liu", "ml", "Gia vị"),
      ingredient("basil", "Húng quế Tây", "g", "Rau củ"),
      ingredient("mushroom", "Nấm", "g", "Rau củ"),
      ingredient("chicken", "Thịt gà", "g", "Thịt"),
      ingredient("cream", "Kem sữa", "ml", "Sữa và phô mai"),
    ],
    menus: [menu("lunch", "Pasta và pizza dùng nhanh buổi trưa."), menu("dinner", "Pizza, pasta và món kem cho buổi tối.")],
    dishes: [
      dish("spaghetti-pomodoro", "Spaghetti sốt cà chua", "lunch", "Pasta", 89000, [["pasta", 180, "g"], ["tomato", 140, "g"], ["olive-oil", 10, "ml"], ["basil", 5, "g"], ["parmesan", 15, "g"]]),
      dish("chicken-alfredo", "Pasta gà sốt kem", "dinner", "Pasta", 119000, [["pasta", 180, "g"], ["chicken", 130, "g"], ["cream", 80, "ml"], ["parmesan", 20, "g"], ["mushroom", 50, "g"]], { meatTypes: ["CHICKEN"] }),
      dish("margherita", "Pizza Margherita", "lunch", "Pizza", 129000, [["flour", 220, "g"], ["tomato", 100, "g"], ["mozzarella", 100, "g"], ["basil", 5, "g"], ["olive-oil", 8, "ml"]], { prepTime: 18 }),
      dish("mushroom-pizza", "Pizza nấm", "dinner", "Pizza", 139000, [["flour", 220, "g"], ["tomato", 80, "g"], ["mozzarella", 100, "g"], ["mushroom", 90, "g"], ["olive-oil", 8, "ml"]], { prepTime: 18 }),
      dish("mushroom-soup", "Súp kem nấm", "dinner", "Khai vị", 69000, [["mushroom", 120, "g"], ["cream", 100, "ml"], ["parmesan", 10, "g"], ["olive-oil", 5, "ml"]]),
      dish("basil-pasta", "Pasta húng quế phô mai", "lunch", "Pasta", 99000, [["pasta", 180, "g"], ["basil", 15, "g"], ["parmesan", 25, "g"], ["olive-oil", 15, "ml"]]),
    ],
  },
  {
    key: "seafood",
    version: 1,
    name: "Nhà hàng hải sản",
    cuisineType: "Hải sản",
    description: "Hải sản nướng, hấp và sốt bơ tỏi với cách chế biến đơn giản.",
    amenities: ["Phục vụ tại bàn", "Khẩu phần chia sẻ", "Món theo nhóm"],
    ingredients: [
      ingredient("shrimp", "Tôm", "g", "Hải sản"),
      ingredient("squid", "Mực", "g", "Hải sản"),
      ingredient("clam", "Nghêu", "g", "Hải sản"),
      ingredient("crab", "Cua", "g", "Hải sản"),
      ingredient("fish", "Cá biển", "g", "Hải sản"),
      ingredient("oyster", "Hàu", "g", "Hải sản"),
      ingredient("garlic", "Tỏi", "g", "Gia vị"),
      ingredient("butter", "Bơ", "g", "Sữa và phô mai"),
      ingredient("chili", "Ớt", "g", "Gia vị"),
      ingredient("greens", "Rau xanh", "g", "Rau củ"),
    ],
    menus: [menu("lunch", "Món hải sản gọn cho buổi trưa."), menu("dinner", "Hải sản nướng, hấp và món chia sẻ buổi tối.")],
    dishes: [
      dish("grilled-shrimp", "Tôm nướng tỏi", "dinner", "Món nướng", 159000, [["shrimp", 250, "g"], ["garlic", 15, "g"], ["butter", 15, "g"], ["chili", 3, "g"]], { meatTypes: ["SEAFOOD"] }),
      dish("butter-squid", "Mực sốt bơ tỏi", "dinner", "Món chính", 169000, [["squid", 250, "g"], ["butter", 20, "g"], ["garlic", 15, "g"], ["chili", 3, "g"]], { meatTypes: ["SEAFOOD"] }),
      dish("clam-soup", "Canh nghêu rau xanh", "lunch", "Canh", 119000, [["clam", 300, "g"], ["greens", 80, "g"], ["garlic", 8, "g"], ["chili", 2, "g"]], { meatTypes: ["SEAFOOD"] }),
      dish("steamed-crab", "Cua hấp", "dinner", "Món hấp", 259000, [["crab", 500, "g"], ["garlic", 8, "g"], ["chili", 3, "g"]], { meatTypes: ["SEAFOOD"], prepTime: 20 }),
      dish("grilled-fish", "Cá biển nướng", "lunch", "Món nướng", 189000, [["fish", 350, "g"], ["garlic", 12, "g"], ["butter", 15, "g"], ["greens", 60, "g"]], { meatTypes: ["FISH"], prepTime: 20 }),
      dish("baked-oyster", "Hàu nướng bơ tỏi", "dinner", "Khai vị", 139000, [["oyster", 240, "g"], ["butter", 18, "g"], ["garlic", 12, "g"], ["chili", 2, "g"]], { meatTypes: ["SEAFOOD"] }),
    ],
  },
  {
    key: "countryside",
    version: 1,
    name: "Ẩm thực đồng quê",
    cuisineType: "Đồng quê Việt Nam",
    description: "Mâm cơm quê với món kho, món luộc, rau và hương vị Việt truyền thống.",
    amenities: ["Phục vụ tại bàn", "Món gia đình", "Khẩu phần chia sẻ"],
    ingredients: [
      ingredient("rice", "Gạo", "g", "Tinh bột"),
      ingredient("chicken", "Gà ta", "g", "Thịt"),
      ingredient("pork", "Thịt heo", "g", "Thịt"),
      ingredient("fish", "Cá đồng", "g", "Hải sản"),
      ingredient("tofu", "Đậu hũ", "g", "Đậu và hạt"),
      ingredient("egg", "Trứng gà", "unit", "Trứng"),
      ingredient("greens", "Rau vườn", "g", "Rau củ"),
      ingredient("fish-sauce", "Nước mắm", "ml", "Gia vị"),
      ingredient("lemongrass", "Sả", "g", "Gia vị"),
      ingredient("fermented-sauce", "Mắm", "g", "Gia vị"),
    ],
    menus: [menu("lunch", "Mâm cơm quê cho buổi trưa."), menu("dinner", "Món kho, luộc và rau cho buổi tối.")],
    dishes: [
      dish("claypot-fish", "Cá đồng kho tộ", "dinner", "Món kho", 109000, [["fish", 250, "g"], ["fish-sauce", 15, "ml"], ["lemongrass", 12, "g"], ["rice", 180, "g"]], { meatTypes: ["FISH"] }),
      dish("boiled-chicken", "Gà ta luộc", "lunch", "Món chính", 149000, [["chicken", 350, "g"], ["lemongrass", 15, "g"], ["fish-sauce", 10, "ml"], ["greens", 40, "g"]], { meatTypes: ["CHICKEN"], prepTime: 20 }),
      dish("braised-pork-egg", "Thịt kho trứng", "dinner", "Món kho", 99000, [["pork", 180, "g"], ["egg", 1, "unit"], ["fish-sauce", 15, "ml"], ["rice", 180, "g"]], { meatTypes: ["PORK"] }),
      dish("lemongrass-tofu", "Đậu hũ kho sả", "lunch", "Món chay", 59000, [["tofu", 220, "g"], ["lemongrass", 18, "g"], ["fish-sauce", 5, "ml"], ["rice", 160, "g"]]),
      dish("garden-soup", "Canh rau vườn", "lunch", "Canh", 49000, [["greens", 180, "g"], ["fish-sauce", 8, "ml"], ["tofu", 80, "g"]]),
      dish("fermented-fish-rice", "Cơm mắm thịt", "dinner", "Cơm", 79000, [["rice", 180, "g"], ["pork", 100, "g"], ["fermented-sauce", 20, "g"], ["greens", 40, "g"]], { meatTypes: ["PORK"] }),
    ],
  },
  {
    key: "thai",
    version: 1,
    name: "Ẩm thực Thái Lan",
    cuisineType: "Thái Lan",
    description: "Món Thái chua cay, thơm sả, nước cốt dừa và húng quế.",
    amenities: ["Phục vụ tại bàn", "Món mang về", "Mức cay tùy chọn"],
    ingredients: [
      ingredient("jasmine-rice", "Gạo Jasmine", "g", "Tinh bột"),
      ingredient("coconut-milk", "Nước cốt dừa", "ml", "Gia vị"),
      ingredient("lemongrass", "Sả", "g", "Gia vị"),
      ingredient("galangal", "Riềng", "g", "Gia vị"),
      ingredient("kaffir-lime", "Lá chanh Thái", "g", "Gia vị"),
      ingredient("shrimp", "Tôm", "g", "Hải sản"),
      ingredient("chicken", "Thịt gà", "g", "Thịt"),
      ingredient("fish-sauce", "Nước mắm", "ml", "Gia vị"),
      ingredient("chili", "Ớt", "g", "Gia vị"),
      ingredient("thai-basil", "Húng quế Thái", "g", "Rau củ"),
    ],
    menus: [menu("lunch", "Cơm và canh chua cay cho buổi trưa."), menu("dinner", "Cà ri, món xào và canh cho buổi tối.")],
    dishes: [
      dish("tom-yum", "Tom Yum tôm", "lunch", "Canh", 119000, [["shrimp", 160, "g"], ["lemongrass", 15, "g"], ["galangal", 8, "g"], ["kaffir-lime", 3, "g"], ["fish-sauce", 12, "ml"], ["chili", 5, "g"]], { meatTypes: ["SEAFOOD"] }),
      dish("thai-chicken-curry", "Cà ri gà Thái", "dinner", "Cà ri", 109000, [["chicken", 180, "g"], ["coconut-milk", 120, "ml"], ["chili", 8, "g"], ["thai-basil", 8, "g"], ["jasmine-rice", 180, "g"]], { meatTypes: ["CHICKEN"] }),
      dish("pad-krapow", "Cơm gà xào húng quế", "lunch", "Cơm", 89000, [["chicken", 150, "g"], ["thai-basil", 15, "g"], ["chili", 5, "g"], ["fish-sauce", 12, "ml"], ["jasmine-rice", 180, "g"]], { meatTypes: ["CHICKEN"] }),
      dish("tom-kha-gai", "Canh gà nước cốt dừa", "dinner", "Canh", 99000, [["chicken", 150, "g"], ["coconut-milk", 130, "ml"], ["lemongrass", 12, "g"], ["galangal", 8, "g"], ["kaffir-lime", 3, "g"], ["fish-sauce", 10, "ml"]], { meatTypes: ["CHICKEN"] }),
      dish("shrimp-fried-rice", "Cơm chiên tôm kiểu Thái", "lunch", "Cơm", 95000, [["jasmine-rice", 190, "g"], ["shrimp", 120, "g"], ["fish-sauce", 10, "ml"], ["chili", 3, "g"], ["thai-basil", 8, "g"]], { meatTypes: ["SEAFOOD"] }),
      dish("basil-shrimp", "Tôm xào húng quế", "dinner", "Món chính", 129000, [["shrimp", 200, "g"], ["thai-basil", 15, "g"], ["chili", 6, "g"], ["fish-sauce", 12, "ml"], ["jasmine-rice", 160, "g"]], { meatTypes: ["SEAFOOD"] }),
    ],
  },
];

function buildTemplate(definition) {
  if (definition.ingredients.length !== 10) {
    throw new Error(`Cuisine template ${definition.key} must define exactly 10 ingredients`);
  }

  const prefix = definition.key.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  const ingredientIds = new Map(
    definition.ingredients.map((item) => [item.key, `${definition.key}:ingredient:${item.key}`]),
  );
  const menuIds = new Map(
    definition.menus.map((item) => [item.timeSlot, `${definition.key}:menu:${item.key}`]),
  );
  const categoryNames = [...new Set(definition.dishes.map((item) => item.category))];
  const categoryIds = new Map(
    categoryNames.map((name) => [name, `${definition.key}:category:${slug(name)}`]),
  );

  for (const item of definition.dishes) {
    if (!menuIds.has(item.timeSlot)) throw new Error(`Missing menu ${item.timeSlot} for ${item.key}`);
    for (const [ingredientKey] of item.ingredients) {
      if (!ingredientIds.has(ingredientKey)) {
        throw new Error(`Missing ingredient ${ingredientKey} for ${item.key}`);
      }
    }
  }

  const menuItems = definition.dishes.map((item, index) => ({
    legacyId: `${definition.key}:item:${item.key}`,
    menuId: menuIds.get(item.timeSlot),
    categoryId: categoryIds.get(item.category),
    code: `${prefix}-${String(index + 1).padStart(2, "0")}`,
    name: item.name,
    description: item.description,
    sortOrder: (index + 1) * 10,
    labels: [definition.cuisineType, item.category],
    foodType: item.meatTypes.length ? "NON_VEGETARIAN" : "VEGETARIAN",
    meatTypes: item.meatTypes,
    basePrice: item.price,
    defaultServingKey: "default",
    hasByWeightVariant: false,
    servingPortion: 1,
    servingUnit: "phần",
    prepStation: "kitchen",
    status: "available",
    avgPrepTimeMin: item.prepTime,
    notes: "Món mẫu. Quản lý cần kiểm tra giá, định lượng và quy trình trước khi bán.",
  }));

  const recipes = definition.dishes.map((item) => ({
    legacyId: `${definition.key}:recipe:${item.key}`,
    menuItemId: `${definition.key}:item:${item.key}`,
    servingVariants: [
      {
        key: "default",
        name: "Mặc định",
        mode: "PORTION",
        sellQty: 1,
        sellUnit: "portion",
        ingredients: item.ingredients.map(([ingredientKey, qty, unit, wastePct = 0]) => ({
          ingredientId: ingredientIds.get(ingredientKey),
          qty,
          unit,
          wastePct,
        })),
        price: item.price,
        isDefault: true,
      },
    ],
    notes: "Quy trình chế biến mẫu. Hãy cập nhật theo tiêu chuẩn vận hành thực tế.",
    isActive: true,
  }));

  return Object.freeze({
    key: definition.key,
    version: definition.version,
    name: definition.name,
    cuisineType: definition.cuisineType,
    description: definition.description,
    ingredientCount: definition.ingredients.length,
    menuCount: definition.menus.length,
    menuItemCount: definition.dishes.length,
    featuredItems: definition.dishes.slice(0, 4).map((item) => item.name),
    sections: {
      restaurantProfile: {
        cuisineType: definition.cuisineType,
        description: definition.description,
        featuredMenu: definition.dishes.slice(0, 4).map((item) => item.name),
        amenities: definition.amenities,
        notesOnAmenities: "Các tiện ích được gợi ý theo mô hình ẩm thực và có thể chỉnh sửa.",
      },
      inventoryMaster: {
        warehouses: [],
        ingredientCategories: [],
        ingredients: definition.ingredients.map((item, index) => ({
          legacyId: ingredientIds.get(item.key),
          name: item.name,
          sku: `${prefix}-ING-${String(index + 1).padStart(2, "0")}`,
          category: item.category,
          baseUnit: item.baseUnit,
          conversions: [],
          costPerBaseUnit: 0,
          minStock: 0,
          notes: "Nguyên liệu mẫu, chưa có giá vốn và tồn kho thực tế.",
          isActive: true,
        })),
        supplyCategories: [],
        supplies: [],
      },
      menuCatalog: {
        menus: definition.menus.map((item) => ({
          legacyId: menuIds.get(item.timeSlot),
          timeSlot: item.timeSlot,
          name: item.name,
          description: item.description,
          isActive: true,
        })),
        categories: categoryNames.map((name, index) => ({
          legacyId: categoryIds.get(name),
          name,
          icon: "🍽️",
          order: index + 1,
          isActive: true,
          menuItemCount: definition.dishes.filter((item) => item.category === name).length,
        })),
        categoryMenus: [],
        menuItems,
        modifierGroups: [],
        combos: [],
        recipes,
      },
    },
  });
}

export const RESTAURANT_CUISINE_TEMPLATES = Object.freeze(DEFINITIONS.map(buildTemplate));

export function getRestaurantCuisineTemplate(key) {
  return RESTAURANT_CUISINE_TEMPLATES.find((template) => template.key === String(key || "").trim()) || null;
}

export function listRestaurantCuisineTemplateSummaries() {
  return RESTAURANT_CUISINE_TEMPLATES.map(({ sections: _sections, ...summary }) => summary);
}
