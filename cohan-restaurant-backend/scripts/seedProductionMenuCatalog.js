import "dotenv/config.js";
import mongoose from "mongoose";
import process from "node:process";
import { safeDbInfo } from "./lib/scriptSafety.js";
import {
  Category,
  CategoryMenu,
  Ingredient,
  IngredientCategory,
  Menu,
  MenuItem,
  Recipe,
  Restaurant,
  StockItem,
  Warehouse,
} from "../models/index.js";

const EXPECTED_BRAND_ID = "6a447f6bea9844b4c8544c49";
const TARGET_RESTAURANTS = [
  {
    id: "69ce9e2e8d8d711f12e251b1",
    expectedName: "Cohan Restaurant",
    codePrefix: "CR1",
  },
  {
    id: "6a447f6bea9844b4c8544c4f",
    expectedName: "Cohan Restaurant 2",
    codePrefix: "CR2",
  },
];

const TIME_SLOTS = new Set(["breakfast", "lunch", "dinner", "late_night"]);
const UNITS = new Set([
  "g",
  "kg",
  "ml",
  "l",
  "unit",
  "piece",
  "tbsp",
  "tsp",
  "pack",
  "bottle",
  "can",
]);
const FOOD_TYPES = new Set([
  "VEGETARIAN",
  "NON_VEGETARIAN",
  "VEGAN",
  "MIXED",
  "UNKNOWN",
]);
const MEAT_TYPES = new Set([
  "BEEF",
  "PORK",
  "CHICKEN",
  "DUCK",
  "SEAFOOD",
  "FISH",
  "LAMB",
  "OTHER",
]);
const DIET_TAGS = new Set(["vegan", "keto", "halal"]);
const ALLERGEN_TAGS = new Set(["seafood", "peanut", "milk", "egg", "gluten"]);
const SUGAR_LEVELS = new Set([0, 30, 50, 70, 100]);
const SPICE_LEVELS = new Set(["Không", "Vừa", "Nồng", "Rất cay"]);
const FORBIDDEN_COPY = /\b(?:demo|test|seed|dev|sample)\b|thử nghiệm|dữ liệu mẫu/iu;

const line = (ingredient, qty, unit, wastePct = 0) => ({
  ingredient,
  qty,
  unit,
  wastePct,
});

const portion = ({
  key = "regular",
  name = "Phần tiêu chuẩn",
  price,
  ingredients,
  isDefault = true,
}) => ({
  key,
  name,
  mode: "PORTION",
  sellQty: 1,
  sellUnit: "portion",
  price,
  ingredients,
  isDefault,
});

const byKg = ({
  key = "by_kg",
  name = "Theo kilogram",
  price,
  ingredients,
  isDefault = false,
}) => ({
  key,
  name,
  mode: "BY_WEIGHT",
  sellQty: 1,
  sellUnit: "kg",
  price,
  ingredients,
  isDefault,
});

const taste = ({
  containsOnion = false,
  containsCilantro = false,
  sugar = 0,
  spice = "Không",
} = {}) => ({ containsOnion, containsCilantro, sugar, spice });

const INGREDIENT_CATEGORIES = [
  { slug: "thit-gia-suc", name: "Thịt gia súc" },
  { slug: "gia-cam", name: "Gia cầm" },
  { slug: "ca-hai-san", name: "Cá và hải sản" },
  { slug: "rau-cu-nam", name: "Rau củ và nấm" },
  { slug: "gao-bun-mi-banh", name: "Gạo, bún, mì và bánh" },
  { slug: "gia-vi-nuoc-sot", name: "Gia vị và nước sốt" },
  { slug: "trung-sua", name: "Trứng và sản phẩm từ sữa" },
  { slug: "trai-cay-do-uong", name: "Trái cây và đồ uống" },
];

const INGREDIENTS = [
  { key: "beef", name: "Thịt bò", category: "thit-gia-suc", baseUnit: "g", cost: 220, minStock: 3000, onHand: 22000 },
  { key: "beefBone", name: "Xương bò", category: "thit-gia-suc", baseUnit: "g", cost: 45, minStock: 5000, onHand: 35000 },
  { key: "pork", name: "Thịt heo", category: "thit-gia-suc", baseUnit: "g", cost: 110, minStock: 4000, onHand: 28000 },
  { key: "porkRib", name: "Sườn non heo", category: "thit-gia-suc", baseUnit: "g", cost: 145, minStock: 3500, onHand: 24000 },
  { key: "porkRoll", name: "Chả lụa", category: "thit-gia-suc", baseUnit: "g", cost: 135, minStock: 1500, onHand: 10000 },
  { key: "chicken", name: "Gà ta làm sạch", category: "gia-cam", baseUnit: "g", cost: 88, minStock: 5000, onHand: 36000 },
  { key: "chickenThigh", name: "Đùi gà", category: "gia-cam", baseUnit: "g", cost: 96, minStock: 3000, onHand: 22000 },
  { key: "chickenWing", name: "Cánh gà", category: "gia-cam", baseUnit: "g", cost: 105, minStock: 2500, onHand: 18000 },
  { key: "snakeheadFish", name: "Cá lóc", category: "ca-hai-san", baseUnit: "g", cost: 125, minStock: 3500, onHand: 26000 },
  { key: "silverSillago", name: "Cá đục", category: "ca-hai-san", baseUnit: "g", cost: 145, minStock: 3000, onHand: 24000 },
  { key: "grouper", name: "Cá mú", category: "ca-hai-san", baseUnit: "g", cost: 330, minStock: 3000, onHand: 19000 },
  { key: "seabass", name: "Cá chẽm", category: "ca-hai-san", baseUnit: "g", cost: 190, minStock: 3000, onHand: 22000 },
  { key: "squid", name: "Mực lá", category: "ca-hai-san", baseUnit: "g", cost: 235, minStock: 2500, onHand: 18000 },
  { key: "tigerPrawn", name: "Tôm sú", category: "ca-hai-san", baseUnit: "g", cost: 285, minStock: 3000, onHand: 22000 },
  { key: "crab", name: "Cua Cà Mau", category: "ca-hai-san", baseUnit: "g", cost: 410, minStock: 2500, onHand: 17000 },
  { key: "clam", name: "Nghêu", category: "ca-hai-san", baseUnit: "g", cost: 72, minStock: 4000, onHand: 30000 },
  { key: "phoNoodle", name: "Bánh phở tươi", category: "gao-bun-mi-banh", baseUnit: "g", cost: 24, minStock: 5000, onHand: 36000 },
  { key: "hueNoodle", name: "Bún bò sợi lớn", category: "gao-bun-mi-banh", baseUnit: "g", cost: 23, minStock: 5000, onHand: 34000 },
  { key: "bread", name: "Bánh mì", category: "gao-bun-mi-banh", baseUnit: "piece", cost: 6500, minStock: 40, onHand: 260 },
  { key: "riceSheet", name: "Bánh cuốn", category: "gao-bun-mi-banh", baseUnit: "g", cost: 32, minStock: 3000, onHand: 20000 },
  { key: "rice", name: "Gạo thơm", category: "gao-bun-mi-banh", baseUnit: "g", cost: 28, minStock: 10000, onHand: 70000 },
  { key: "eggNoodle", name: "Mì trứng", category: "gao-bun-mi-banh", baseUnit: "g", cost: 38, minStock: 4000, onHand: 28000 },
  { key: "porridgeRice", name: "Gạo nấu cháo", category: "gao-bun-mi-banh", baseUnit: "g", cost: 27, minStock: 5000, onHand: 32000 },
  { key: "potato", name: "Khoai tây", category: "rau-cu-nam", baseUnit: "g", cost: 36, minStock: 5000, onHand: 30000 },
  { key: "beanSprout", name: "Giá đỗ", category: "rau-cu-nam", baseUnit: "g", cost: 24, minStock: 1500, onHand: 10000 },
  { key: "scallion", name: "Hành lá", category: "rau-cu-nam", baseUnit: "g", cost: 65, minStock: 800, onHand: 6000 },
  { key: "onion", name: "Hành tây", category: "rau-cu-nam", baseUnit: "g", cost: 32, minStock: 2000, onHand: 15000 },
  { key: "cilantro", name: "Ngò rí", category: "rau-cu-nam", baseUnit: "g", cost: 78, minStock: 700, onHand: 5000 },
  { key: "herbs", name: "Rau thơm hỗn hợp", category: "rau-cu-nam", baseUnit: "g", cost: 85, minStock: 1000, onHand: 7500 },
  { key: "tomato", name: "Cà chua", category: "rau-cu-nam", baseUnit: "g", cost: 38, minStock: 2500, onHand: 18000 },
  { key: "pineapple", name: "Thơm", category: "rau-cu-nam", baseUnit: "g", cost: 36, minStock: 2000, onHand: 15000 },
  { key: "taroStem", name: "Bạc hà", category: "rau-cu-nam", baseUnit: "g", cost: 42, minStock: 1200, onHand: 9000 },
  { key: "waterSpinach", name: "Rau muống", category: "rau-cu-nam", baseUnit: "g", cost: 29, minStock: 2500, onHand: 18000 },
  { key: "garlic", name: "Tỏi", category: "rau-cu-nam", baseUnit: "g", cost: 82, minStock: 1500, onHand: 11000 },
  { key: "ginger", name: "Gừng", category: "rau-cu-nam", baseUnit: "g", cost: 58, minStock: 1200, onHand: 8500 },
  { key: "lemongrass", name: "Sả", category: "rau-cu-nam", baseUnit: "g", cost: 46, minStock: 1800, onHand: 13000 },
  { key: "chili", name: "Ớt tươi", category: "rau-cu-nam", baseUnit: "g", cost: 95, minStock: 700, onHand: 5000 },
  { key: "laELeaf", name: "Lá é", category: "rau-cu-nam", baseUnit: "g", cost: 90, minStock: 900, onHand: 6500 },
  { key: "mushroom", name: "Nấm tươi", category: "rau-cu-nam", baseUnit: "g", cost: 78, minStock: 1800, onHand: 13000 },
  { key: "lotusStem", name: "Ngó sen", category: "rau-cu-nam", baseUnit: "g", cost: 62, minStock: 1500, onHand: 11000 },
  { key: "lettuce", name: "Xà lách", category: "rau-cu-nam", baseUnit: "g", cost: 48, minStock: 1500, onHand: 10000 },
  { key: "cucumber", name: "Dưa leo", category: "rau-cu-nam", baseUnit: "g", cost: 32, minStock: 1800, onHand: 13000 },
  { key: "carrot", name: "Cà rốt", category: "rau-cu-nam", baseUnit: "g", cost: 34, minStock: 1800, onHand: 13000 },
  { key: "bellPepper", name: "Ớt chuông", category: "rau-cu-nam", baseUnit: "g", cost: 75, minStock: 1200, onHand: 9000 },
  { key: "watermelon", name: "Dưa hấu", category: "trai-cay-do-uong", baseUnit: "g", cost: 24, minStock: 5000, onHand: 35000 },
  { key: "egg", name: "Trứng gà", category: "trung-sua", baseUnit: "piece", cost: 4200, minStock: 60, onHand: 420 },
  { key: "fishSauce", name: "Nước mắm", category: "gia-vi-nuoc-sot", baseUnit: "ml", cost: 42, minStock: 3000, onHand: 22000 },
  { key: "soySauce", name: "Nước tương", category: "gia-vi-nuoc-sot", baseUnit: "ml", cost: 38, minStock: 2500, onHand: 18000 },
  { key: "oysterSauce", name: "Dầu hào", category: "gia-vi-nuoc-sot", baseUnit: "ml", cost: 52, minStock: 2200, onHand: 16000 },
  { key: "chiliSauce", name: "Tương ớt", category: "gia-vi-nuoc-sot", baseUnit: "ml", cost: 35, minStock: 2000, onHand: 15000 },
  { key: "sugar", name: "Đường", category: "gia-vi-nuoc-sot", baseUnit: "g", cost: 24, minStock: 5000, onHand: 36000 },
  { key: "salt", name: "Muối", category: "gia-vi-nuoc-sot", baseUnit: "g", cost: 8, minStock: 3000, onHand: 22000 },
  { key: "pepper", name: "Tiêu", category: "gia-vi-nuoc-sot", baseUnit: "g", cost: 180, minStock: 700, onHand: 5000 },
  { key: "tamarind", name: "Me", category: "gia-vi-nuoc-sot", baseUnit: "g", cost: 62, minStock: 1500, onHand: 11000 },
  { key: "honey", name: "Mật ong", category: "gia-vi-nuoc-sot", baseUnit: "ml", cost: 145, minStock: 1200, onHand: 8500 },
  { key: "satay", name: "Sa tế", category: "gia-vi-nuoc-sot", baseUnit: "g", cost: 95, minStock: 1200, onHand: 8500 },
  { key: "cookingOil", name: "Dầu ăn", category: "gia-vi-nuoc-sot", baseUnit: "ml", cost: 42, minStock: 6000, onHand: 42000 },
  { key: "coconutWater", name: "Nước dừa tươi", category: "gia-vi-nuoc-sot", baseUnit: "ml", cost: 28, minStock: 3000, onHand: 22000 },
  { key: "vinegar", name: "Giấm gạo", category: "gia-vi-nuoc-sot", baseUnit: "ml", cost: 24, minStock: 1500, onHand: 11000 },
  { key: "coffee", name: "Cà phê rang xay", category: "trai-cay-do-uong", baseUnit: "g", cost: 190, minStock: 1500, onHand: 11000 },
  { key: "condensedMilk", name: "Sữa đặc", category: "trung-sua", baseUnit: "ml", cost: 72, minStock: 2200, onHand: 16000 },
  { key: "blackTea", name: "Trà đen", category: "trai-cay-do-uong", baseUnit: "g", cost: 135, minStock: 1000, onHand: 7500 },
  { key: "kumquat", name: "Tắc", category: "trai-cay-do-uong", baseUnit: "piece", cost: 1800, minStock: 80, onHand: 520 },
  { key: "orange", name: "Cam tươi", category: "trai-cay-do-uong", baseUnit: "piece", cost: 9500, minStock: 50, onHand: 320 },
  { key: "passionFruit", name: "Chanh dây", category: "trai-cay-do-uong", baseUnit: "piece", cost: 7000, minStock: 45, onHand: 280 },
  { key: "lime", name: "Chanh tươi", category: "trai-cay-do-uong", baseUnit: "piece", cost: 3200, minStock: 70, onHand: 460 },
  { key: "sodaWater", name: "Soda", category: "trai-cay-do-uong", baseUnit: "ml", cost: 22, minStock: 5000, onHand: 36000 },
];

const DISH_CATEGORIES = [
  { name: "Món sáng", icon: "🍜", order: 10 },
  { name: "Khai vị và gỏi", icon: "🥗", order: 20 },
  { name: "Cơm và món Việt", icon: "🍚", order: 30 },
  { name: "Hải sản", icon: "🦐", order: 40 },
  { name: "Món nướng", icon: "🔥", order: 50 },
  { name: "Lẩu", icon: "🍲", order: 60 },
  { name: "Rau và món phụ", icon: "🥬", order: 70 },
  { name: "Món ăn khuya", icon: "🌙", order: 80 },
  { name: "Đồ uống", icon: "🥤", order: 90 },
  { name: "Tráng miệng", icon: "🍉", order: 100 },
];

const MENU_GROUPS = [
  { timeSlot: "breakfast", name: "Buổi sáng", icon: "☀️", order: 10, description: "Các món điểm tâm và thức uống phục vụ buổi sáng." },
  { timeSlot: "lunch", name: "Buổi trưa", icon: "🍚", order: 20, description: "Món Việt, cơm phần và thức uống phù hợp cho bữa trưa." },
  { timeSlot: "dinner", name: "Buổi tối", icon: "🌆", order: 30, description: "Hải sản, món nướng, lẩu và các món dùng chung cho bữa tối." },
  { timeSlot: "late_night", name: "Khuya", icon: "🌙", order: 40, description: "Món nóng, món ăn nhẹ và thức uống phục vụ khung giờ khuya." },
];

const MENU_DEFINITIONS = [
  { timeSlot: "breakfast", name: "Thực đơn buổi sáng", description: "Điểm tâm Việt Nam được chuẩn bị trong ngày, phục vụ nhanh và đủ năng lượng." },
  { timeSlot: "lunch", name: "Thực đơn buổi trưa", description: "Các món cơm và món Việt cân bằng, phù hợp dùng riêng hoặc dùng chung." },
  { timeSlot: "dinner", name: "Thực đơn buổi tối", description: "Hải sản tươi, món nướng và lẩu dành cho gia đình, nhóm bạn và tiệc thân mật." },
  { timeSlot: "late_night", name: "Thực đơn khuya", description: "Các món nóng và món ăn nhẹ phục vụ khách dùng bữa muộn." },
];

const DISHES = [
  {
    code: "PHO-BO-TAI",
    timeSlot: "breakfast",
    category: "Món sáng",
    name: "Phở bò tái",
    description: "Bánh phở tươi, thịt bò tái mềm và nước dùng hầm xương trong, thơm gừng hành.",
    prepStation: "kitchen",
    avgPrepTimeMin: 12,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["BEEF"],
    allergenTags: [],
    labels: ["Đặc trưng", "Bán chạy"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: true, sugar: 0, spice: "Không" }),
    variants: [portion({ price: 69000, ingredients: [line("phoNoodle", 180, "g"), line("beef", 100, "g", 5), line("beefBone", 80, "g"), line("onion", 20, "g"), line("scallion", 8, "g"), line("cilantro", 5, "g"), line("ginger", 5, "g"), line("fishSauce", 8, "ml")] })],
  },
  {
    code: "BUN-BO-HUE",
    timeSlot: "breakfast",
    category: "Món sáng",
    name: "Bún bò Huế",
    description: "Bún sợi lớn dùng cùng thịt bò, thịt heo và nước dùng sả ớt đậm vị miền Trung.",
    prepStation: "kitchen",
    avgPrepTimeMin: 14,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["BEEF", "PORK"],
    allergenTags: [],
    labels: ["Đậm vị"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: true, sugar: 0, spice: "Nồng" }),
    variants: [portion({ price: 72000, ingredients: [line("hueNoodle", 180, "g"), line("beef", 80, "g", 5), line("pork", 70, "g", 5), line("lemongrass", 18, "g"), line("chili", 5, "g"), line("scallion", 8, "g"), line("fishSauce", 10, "ml")] })],
  },
  {
    code: "BANH-MI-OP-LA",
    timeSlot: "breakfast",
    category: "Món sáng",
    name: "Bánh mì ốp la chả lụa",
    description: "Bánh mì nóng giòn dùng cùng trứng ốp la, chả lụa, dưa leo và nước sốt nhà làm.",
    prepStation: "kitchen",
    avgPrepTimeMin: 10,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["PORK"],
    allergenTags: ["egg", "gluten"],
    labels: ["Phục vụ nhanh"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: true, sugar: 30, spice: "Vừa" }),
    variants: [portion({ price: 49000, ingredients: [line("bread", 1, "piece"), line("egg", 2, "piece"), line("porkRoll", 50, "g"), line("cucumber", 40, "g"), line("cilantro", 5, "g"), line("chiliSauce", 12, "ml")] })],
  },
  {
    code: "BANH-CUON-CHA-LUA",
    timeSlot: "breakfast",
    category: "Món sáng",
    name: "Bánh cuốn chả lụa",
    description: "Bánh cuốn mềm, nhân thịt xào, chả lụa và nước mắm chua ngọt pha trong ngày.",
    prepStation: "kitchen",
    avgPrepTimeMin: 12,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["PORK"],
    allergenTags: [],
    labels: ["Món Việt"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: true, sugar: 30, spice: "Vừa" }),
    variants: [portion({ price: 58000, ingredients: [line("riceSheet", 180, "g"), line("pork", 70, "g", 5), line("porkRoll", 60, "g"), line("onion", 20, "g"), line("fishSauce", 20, "ml"), line("sugar", 8, "g"), line("chili", 2, "g")] })],
  },
  {
    code: "CHAO-SUON-TRUNG",
    timeSlot: "breakfast",
    category: "Món sáng",
    name: "Cháo sườn trứng",
    description: "Cháo gạo nấu nhuyễn cùng sườn non mềm, trứng gà, hành lá và tiêu xay.",
    prepStation: "kitchen",
    avgPrepTimeMin: 15,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["PORK"],
    allergenTags: ["egg"],
    labels: ["Ấm bụng"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: false, sugar: 0, spice: "Không" }),
    variants: [portion({ price: 62000, ingredients: [line("porridgeRice", 100, "g"), line("porkRib", 120, "g", 8), line("egg", 1, "piece"), line("scallion", 8, "g"), line("pepper", 1, "g"), line("fishSauce", 6, "ml")] })],
  },
  {
    code: "CA-PHE-SUA-DA",
    timeSlot: "breakfast",
    category: "Đồ uống",
    name: "Cà phê sữa đá",
    description: "Cà phê rang xay pha phin, kết hợp sữa đặc và đá lạnh theo phong cách Việt Nam.",
    prepStation: "bar",
    avgPrepTimeMin: 7,
    foodType: "VEGETARIAN",
    meatTypes: [],
    allergenTags: ["milk"],
    labels: ["Cà phê Việt"],
    tasteProfile: taste({ sugar: 70, spice: "Không" }),
    variants: [portion({ name: "Ly tiêu chuẩn", price: 32000, ingredients: [line("coffee", 22, "g"), line("condensedMilk", 35, "ml")] })],
  },
  {
    code: "TRA-TAC",
    timeSlot: "breakfast",
    category: "Đồ uống",
    name: "Trà tắc",
    description: "Trà đen ủ thơm, tắc tươi và vị chua ngọt cân bằng, phục vụ lạnh.",
    prepStation: "bar",
    avgPrepTimeMin: 6,
    foodType: "VEGAN",
    meatTypes: [],
    dietTags: ["vegan"],
    allergenTags: [],
    labels: ["Thanh mát"],
    tasteProfile: taste({ sugar: 50, spice: "Không" }),
    variants: [portion({ name: "Ly tiêu chuẩn", price: 30000, ingredients: [line("blackTea", 12, "g"), line("kumquat", 4, "piece"), line("sugar", 25, "g")] })],
  },
  {
    code: "COM-GA-XOI-MO",
    timeSlot: "lunch",
    category: "Cơm và món Việt",
    name: "Cơm gà xối mỡ",
    description: "Đùi gà chiên da giòn, thịt mềm, dùng cùng cơm thơm, dưa leo và nước mắm tỏi.",
    prepStation: "kitchen",
    avgPrepTimeMin: 18,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["CHICKEN"],
    allergenTags: [],
    labels: ["Bán chạy"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: true, sugar: 30, spice: "Vừa" }),
    variants: [portion({ price: 78000, ingredients: [line("rice", 180, "g"), line("chickenThigh", 250, "g", 8), line("cucumber", 50, "g"), line("cilantro", 5, "g"), line("cookingOil", 35, "ml"), line("fishSauce", 15, "ml"), line("garlic", 5, "g")] })],
  },
  {
    code: "COM-SUON-NUONG",
    timeSlot: "lunch",
    category: "Cơm và món Việt",
    name: "Cơm sườn nướng mật ong",
    description: "Sườn non ướp mật ong và gia vị, nướng thơm, dùng cùng cơm trắng và rau ăn kèm.",
    prepStation: "kitchen",
    avgPrepTimeMin: 20,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["PORK"],
    allergenTags: [],
    labels: ["Món nướng"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: true, sugar: 50, spice: "Vừa" }),
    variants: [portion({ price: 82000, ingredients: [line("rice", 180, "g"), line("porkRib", 220, "g", 8), line("honey", 15, "ml"), line("fishSauce", 10, "ml"), line("garlic", 6, "g"), line("cucumber", 50, "g")] })],
  },
  {
    code: "CA-LOC-KHO-TO",
    timeSlot: "lunch",
    category: "Cơm và món Việt",
    name: "Cá lóc kho tộ",
    description: "Cá lóc kho lửa nhỏ với nước mắm, nước dừa và tiêu, vị mặn ngọt hài hòa.",
    prepStation: "kitchen",
    avgPrepTimeMin: 24,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["FISH"],
    allergenTags: [],
    labels: ["Món nhà"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: false, sugar: 30, spice: "Vừa" }),
    variants: [portion({ price: 98000, ingredients: [line("snakeheadFish", 250, "g", 8), line("coconutWater", 80, "ml"), line("fishSauce", 18, "ml"), line("sugar", 10, "g"), line("pepper", 2, "g"), line("scallion", 8, "g")] })],
  },
  {
    code: "CANH-CHUA-CA-LOC",
    timeSlot: "lunch",
    category: "Cơm và món Việt",
    name: "Canh chua cá lóc",
    description: "Canh chua nấu cá lóc, cà chua, thơm, bạc hà và rau thơm, vị chua thanh dễ dùng.",
    prepStation: "kitchen",
    avgPrepTimeMin: 20,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["FISH"],
    allergenTags: [],
    labels: ["Dùng chung"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: true, sugar: 30, spice: "Vừa" }),
    variants: [portion({ name: "Tô dùng chung", price: 120000, ingredients: [line("snakeheadFish", 300, "g", 8), line("tomato", 120, "g"), line("pineapple", 100, "g"), line("taroStem", 100, "g"), line("herbs", 20, "g"), line("tamarind", 25, "g"), line("fishSauce", 12, "ml"), line("sugar", 10, "g")] })],
  },
  {
    code: "THIT-KHO-TRUNG",
    timeSlot: "lunch",
    category: "Cơm và món Việt",
    name: "Thịt kho trứng nước dừa",
    description: "Thịt heo kho mềm cùng trứng gà và nước dừa tươi, màu nâu trong, vị đậm vừa.",
    prepStation: "kitchen",
    avgPrepTimeMin: 22,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["PORK"],
    allergenTags: ["egg"],
    labels: ["Món nhà"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: false, sugar: 30, spice: "Không" }),
    variants: [portion({ price: 95000, ingredients: [line("pork", 250, "g", 8), line("egg", 2, "piece"), line("coconutWater", 120, "ml"), line("fishSauce", 18, "ml"), line("sugar", 12, "g"), line("pepper", 1, "g")] })],
  },
  {
    code: "RAU-MUONG-XAO-TOI",
    timeSlot: "lunch",
    category: "Rau và món phụ",
    name: "Rau muống xào tỏi",
    description: "Rau muống xanh giòn xào nhanh với tỏi phi, nêm vừa vị và phục vụ nóng.",
    prepStation: "kitchen",
    avgPrepTimeMin: 10,
    foodType: "VEGAN",
    meatTypes: [],
    dietTags: ["vegan"],
    allergenTags: [],
    labels: ["Món chay"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: false, sugar: 0, spice: "Không" }),
    variants: [portion({ price: 65000, ingredients: [line("waterSpinach", 300, "g", 8), line("garlic", 18, "g"), line("cookingOil", 20, "ml"), line("salt", 3, "g")] })],
  },
  {
    code: "TOM-SU-RANG-ME-PHAN",
    timeSlot: "lunch",
    category: "Hải sản",
    name: "Tôm sú rang me",
    description: "Tôm sú rang cùng sốt me chua ngọt, tỏi phi và ớt tươi, sốt bám đều từng con.",
    prepStation: "kitchen",
    avgPrepTimeMin: 18,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["SEAFOOD"],
    allergenTags: ["seafood"],
    labels: ["Hải sản"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: true, sugar: 50, spice: "Vừa" }),
    variants: [portion({ price: 185000, ingredients: [line("tigerPrawn", 350, "g", 10), line("tamarind", 35, "g"), line("sugar", 18, "g"), line("garlic", 10, "g"), line("chili", 3, "g"), line("fishSauce", 8, "ml")] })],
  },
  {
    code: "BO-LUC-LAC",
    timeSlot: "lunch",
    category: "Cơm và món Việt",
    name: "Bò lúc lắc",
    description: "Thịt bò cắt khối áp chảo nhanh cùng hành tây và ớt chuông, giữ độ mềm mọng.",
    prepStation: "kitchen",
    avgPrepTimeMin: 16,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["BEEF"],
    dietTags: ["keto"],
    allergenTags: [],
    labels: ["Áp chảo"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: false, sugar: 30, spice: "Vừa" }),
    variants: [portion({ price: 168000, ingredients: [line("beef", 250, "g", 8), line("onion", 80, "g"), line("bellPepper", 80, "g"), line("garlic", 8, "g"), line("oysterSauce", 15, "ml"), line("pepper", 2, "g")] })],
  },
  {
    code: "NUOC-CAM-TUOI",
    timeSlot: "lunch",
    category: "Đồ uống",
    name: "Nước cam tươi",
    description: "Cam tươi vắt nguyên chất, vị chua ngọt tự nhiên, có thể điều chỉnh lượng đường.",
    prepStation: "bar",
    avgPrepTimeMin: 6,
    foodType: "VEGAN",
    meatTypes: [],
    dietTags: ["vegan"],
    allergenTags: [],
    labels: ["Nước ép"],
    tasteProfile: taste({ sugar: 30, spice: "Không" }),
    variants: [portion({ name: "Ly tiêu chuẩn", price: 42000, ingredients: [line("orange", 3, "piece"), line("sugar", 10, "g")] })],
  },
  {
    code: "CHANH-DAY-SODA",
    timeSlot: "lunch",
    category: "Đồ uống",
    name: "Chanh dây soda",
    description: "Chanh dây tươi kết hợp soda lạnh, vị chua thơm và sủi nhẹ.",
    prepStation: "bar",
    avgPrepTimeMin: 6,
    foodType: "VEGAN",
    meatTypes: [],
    dietTags: ["vegan"],
    allergenTags: [],
    labels: ["Soda trái cây"],
    tasteProfile: taste({ sugar: 50, spice: "Không" }),
    variants: [portion({ name: "Ly tiêu chuẩn", price: 45000, ingredients: [line("passionFruit", 2, "piece"), line("sodaWater", 250, "ml"), line("sugar", 20, "g")] })],
  },
  {
    code: "GOI-NGO-SEN-TOM-THIT",
    timeSlot: "dinner",
    category: "Khai vị và gỏi",
    name: "Gỏi ngó sen tôm thịt",
    description: "Ngó sen giòn trộn tôm sú, thịt heo, rau thơm và nước mắm chua ngọt.",
    prepStation: "kitchen",
    avgPrepTimeMin: 18,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["PORK", "SEAFOOD"],
    allergenTags: ["seafood"],
    labels: ["Khai vị"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: true, sugar: 50, spice: "Vừa" }),
    variants: [portion({ price: 145000, ingredients: [line("lotusStem", 200, "g"), line("tigerPrawn", 180, "g", 10), line("pork", 120, "g", 6), line("carrot", 60, "g"), line("herbs", 20, "g"), line("fishSauce", 22, "ml"), line("sugar", 16, "g"), line("vinegar", 12, "ml")] })],
  },
  {
    code: "CA-DUC-NUONG-MUOI-OT",
    timeSlot: "dinner",
    category: "Hải sản",
    name: "Cá đục nướng muối ớt",
    description: "Cá đục tươi ướp muối ớt, nướng lửa vừa để da thơm và thịt giữ độ ngọt tự nhiên.",
    prepStation: "kitchen",
    avgPrepTimeMin: 24,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["FISH"],
    dietTags: ["keto"],
    allergenTags: [],
    labels: ["Hải sản tươi", "Món nướng"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: true, sugar: 0, spice: "Nồng" }),
    variants: [
      portion({ key: "portion", name: "Phần tiêu chuẩn", price: 150000, ingredients: [line("silverSillago", 350, "g", 10), line("salt", 4, "g"), line("chili", 8, "g"), line("garlic", 8, "g"), line("cookingOil", 10, "ml")] }),
      byKg({ price: 400000, ingredients: [line("silverSillago", 1000, "g", 10), line("salt", 10, "g"), line("chili", 20, "g"), line("garlic", 20, "g"), line("cookingOil", 25, "ml")] }),
    ],
  },
  {
    code: "CA-MU-HAP-HONG-KONG",
    timeSlot: "dinner",
    category: "Hải sản",
    name: "Cá mú hấp Hồng Kông",
    description: "Cá mú tươi hấp cùng gừng, hành lá và nước tương, thịt cá chắc ngọt, sốt thanh nhẹ.",
    prepStation: "kitchen",
    avgPrepTimeMin: 30,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["FISH"],
    dietTags: ["keto"],
    allergenTags: [],
    labels: ["Tính theo kg", "Hải sản tươi"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: false, sugar: 0, spice: "Không" }),
    variants: [byKg({ price: 690000, isDefault: true, ingredients: [line("grouper", 1000, "g", 12), line("ginger", 30, "g"), line("scallion", 35, "g"), line("soySauce", 45, "ml"), line("cookingOil", 20, "ml")] })],
  },
  {
    code: "CA-CHEM-HAP-XI-DAU",
    timeSlot: "dinner",
    category: "Hải sản",
    name: "Cá chẽm hấp xì dầu",
    description: "Cá chẽm hấp nguyên vị cùng gừng, hành và xì dầu, phù hợp dùng chung trong bữa tối.",
    prepStation: "kitchen",
    avgPrepTimeMin: 28,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["FISH"],
    dietTags: ["keto"],
    allergenTags: [],
    labels: ["Hải sản tươi"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: false, sugar: 0, spice: "Không" }),
    variants: [
      portion({ key: "portion", name: "Phần khoảng 600 g", price: 260000, ingredients: [line("seabass", 600, "g", 10), line("ginger", 18, "g"), line("scallion", 22, "g"), line("soySauce", 28, "ml")] }),
      byKg({ price: 420000, ingredients: [line("seabass", 1000, "g", 10), line("ginger", 30, "g"), line("scallion", 35, "g"), line("soySauce", 45, "ml")] }),
    ],
  },
  {
    code: "MUC-LA-NUONG-SA-TE",
    timeSlot: "dinner",
    category: "Hải sản",
    name: "Mực lá nướng sa tế",
    description: "Mực lá tươi ướp sa tế và sả, nướng nhanh để giữ độ giòn ngọt và mùi thơm đặc trưng.",
    prepStation: "kitchen",
    avgPrepTimeMin: 22,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["SEAFOOD"],
    dietTags: ["keto"],
    allergenTags: ["seafood"],
    labels: ["Món nướng", "Hải sản tươi"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: true, sugar: 0, spice: "Nồng" }),
    variants: [
      portion({ key: "portion", name: "Phần tiêu chuẩn", price: 220000, ingredients: [line("squid", 450, "g", 12), line("satay", 22, "g"), line("lemongrass", 18, "g"), line("garlic", 10, "g"), line("cookingOil", 12, "ml")] }),
      byKg({ price: 480000, ingredients: [line("squid", 1000, "g", 12), line("satay", 48, "g"), line("lemongrass", 40, "g"), line("garlic", 22, "g"), line("cookingOil", 26, "ml")] }),
    ],
  },
  {
    code: "TOM-SU-RANG-MUOI",
    timeSlot: "dinner",
    category: "Hải sản",
    name: "Tôm sú rang muối",
    description: "Tôm sú rang khô cùng muối tiêu, tỏi và ớt, vỏ giòn nhẹ, thịt tôm chắc ngọt.",
    prepStation: "kitchen",
    avgPrepTimeMin: 20,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["SEAFOOD"],
    dietTags: ["keto"],
    allergenTags: ["seafood"],
    labels: ["Hải sản tươi"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: true, sugar: 0, spice: "Vừa" }),
    variants: [
      portion({ key: "portion", name: "Phần 500 g", price: 245000, ingredients: [line("tigerPrawn", 500, "g", 10), line("salt", 6, "g"), line("pepper", 3, "g"), line("garlic", 12, "g"), line("chili", 4, "g")] }),
      byKg({ price: 520000, ingredients: [line("tigerPrawn", 1000, "g", 10), line("salt", 12, "g"), line("pepper", 6, "g"), line("garlic", 24, "g"), line("chili", 8, "g")] }),
    ],
  },
  {
    code: "CUA-CA-MAU-SOT-ME",
    timeSlot: "dinner",
    category: "Hải sản",
    name: "Cua Cà Mau sốt me",
    description: "Cua Cà Mau chắc thịt, chế biến với sốt me chua ngọt, tỏi phi và ớt tươi.",
    prepStation: "kitchen",
    avgPrepTimeMin: 32,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["SEAFOOD"],
    allergenTags: ["seafood"],
    labels: ["Tính theo kg", "Hải sản tươi"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: true, sugar: 50, spice: "Vừa" }),
    variants: [byKg({ price: 760000, isDefault: true, ingredients: [line("crab", 1000, "g", 18), line("tamarind", 80, "g"), line("sugar", 35, "g"), line("garlic", 25, "g"), line("chili", 8, "g"), line("fishSauce", 18, "ml")] })],
  },
  {
    code: "NGHEU-HAP-SA",
    timeSlot: "dinner",
    category: "Hải sản",
    name: "Nghêu hấp sả",
    description: "Nghêu tươi hấp cùng sả, gừng và ớt, nước hấp thơm, vị ngọt tự nhiên.",
    prepStation: "kitchen",
    avgPrepTimeMin: 16,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["SEAFOOD"],
    allergenTags: ["seafood"],
    labels: ["Dùng chung"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: true, sugar: 0, spice: "Vừa" }),
    variants: [portion({ name: "Phần 800 g", price: 125000, ingredients: [line("clam", 800, "g", 15), line("lemongrass", 35, "g"), line("ginger", 18, "g"), line("chili", 5, "g")] })],
  },
  {
    code: "GA-NUONG-LU",
    timeSlot: "dinner",
    category: "Món nướng",
    name: "Gà nướng lu",
    description: "Gà ta ướp gia vị, nướng lu đến khi da vàng thơm, thịt chín mềm và còn độ mọng.",
    prepStation: "kitchen",
    avgPrepTimeMin: 35,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["CHICKEN"],
    allergenTags: [],
    labels: ["Dùng chung", "Món nướng"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: true, sugar: 30, spice: "Vừa" }),
    variants: [
      portion({ key: "half", name: "Nửa con", price: 185000, ingredients: [line("chicken", 900, "g", 12), line("honey", 18, "ml"), line("fishSauce", 15, "ml"), line("garlic", 15, "g"), line("lemongrass", 18, "g")] }),
      portion({ key: "whole", name: "Nguyên con", price: 345000, isDefault: false, ingredients: [line("chicken", 1800, "g", 12), line("honey", 35, "ml"), line("fishSauce", 30, "ml"), line("garlic", 30, "g"), line("lemongrass", 35, "g")] }),
    ],
  },
  {
    code: "SUON-NON-NUONG-MAT-ONG",
    timeSlot: "dinner",
    category: "Món nướng",
    name: "Sườn non nướng mật ong",
    description: "Sườn non ướp mật ong, tỏi và nước mắm, nướng chậm để thịt mềm và bề mặt óng nhẹ.",
    prepStation: "kitchen",
    avgPrepTimeMin: 28,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["PORK"],
    allergenTags: [],
    labels: ["Món nướng"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: true, sugar: 50, spice: "Vừa" }),
    variants: [portion({ price: 185000, ingredients: [line("porkRib", 450, "g", 10), line("honey", 28, "ml"), line("fishSauce", 18, "ml"), line("garlic", 15, "g"), line("pepper", 2, "g")] })],
  },
  {
    code: "LAU-HAI-SAN",
    timeSlot: "dinner",
    category: "Lẩu",
    name: "Lẩu hải sản chua cay",
    description: "Nước lẩu chua cay dùng cùng tôm sú, mực lá, nghêu, nấm và rau tươi.",
    prepStation: "kitchen",
    avgPrepTimeMin: 25,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["SEAFOOD"],
    allergenTags: ["seafood"],
    labels: ["Dùng chung", "Bán chạy"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: true, sugar: 30, spice: "Nồng" }),
    variants: [portion({ name: "Nồi 3–4 người", price: 389000, ingredients: [line("tigerPrawn", 300, "g", 10), line("squid", 300, "g", 12), line("clam", 500, "g", 15), line("mushroom", 200, "g"), line("tomato", 150, "g"), line("pineapple", 120, "g"), line("lemongrass", 30, "g"), line("tamarind", 35, "g"), line("chili", 8, "g")] })],
  },
  {
    code: "LAU-GA-LA-E",
    timeSlot: "dinner",
    category: "Lẩu",
    name: "Lẩu gà lá é",
    description: "Gà ta nấu nước lẩu thanh ngọt cùng lá é, nấm tươi và ớt xanh, thơm nhẹ và ấm vị.",
    prepStation: "kitchen",
    avgPrepTimeMin: 28,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["CHICKEN"],
    allergenTags: [],
    labels: ["Dùng chung"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: false, sugar: 0, spice: "Nồng" }),
    variants: [portion({ name: "Nồi 3–4 người", price: 349000, ingredients: [line("chicken", 1200, "g", 12), line("laELeaf", 120, "g"), line("mushroom", 250, "g"), line("lemongrass", 30, "g"), line("chili", 10, "g"), line("fishSauce", 20, "ml")] })],
  },
  {
    code: "COM-CHIEN-HAI-SAN",
    timeSlot: "dinner",
    category: "Cơm và món Việt",
    name: "Cơm chiên hải sản",
    description: "Cơm hạt rời chiên cùng tôm, mực, trứng và rau củ, nêm vừa vị và phục vụ nóng.",
    prepStation: "kitchen",
    avgPrepTimeMin: 16,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["SEAFOOD"],
    allergenTags: ["seafood", "egg"],
    labels: ["Dùng chung"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: true, sugar: 0, spice: "Vừa" }),
    variants: [portion({ price: 135000, ingredients: [line("rice", 300, "g"), line("tigerPrawn", 100, "g", 10), line("squid", 100, "g", 12), line("egg", 1, "piece"), line("carrot", 50, "g"), line("scallion", 10, "g"), line("cookingOil", 25, "ml")] })],
  },
  {
    code: "MI-XAO-BO",
    timeSlot: "late_night",
    category: "Món ăn khuya",
    name: "Mì xào bò",
    description: "Mì trứng xào cùng thịt bò, hành tây, ớt chuông và rau xanh, sốt đậm vừa.",
    prepStation: "kitchen",
    avgPrepTimeMin: 15,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["BEEF"],
    allergenTags: ["gluten", "egg"],
    labels: ["Món nóng"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: false, sugar: 30, spice: "Vừa" }),
    variants: [portion({ price: 118000, ingredients: [line("eggNoodle", 220, "g"), line("beef", 150, "g", 8), line("onion", 70, "g"), line("bellPepper", 60, "g"), line("oysterSauce", 18, "ml"), line("cookingOil", 20, "ml")] })],
  },
  {
    code: "CHAO-HAI-SAN",
    timeSlot: "late_night",
    category: "Món ăn khuya",
    name: "Cháo hải sản",
    description: "Cháo gạo nấu mềm cùng tôm, mực, gừng, hành lá và tiêu, phù hợp dùng bữa muộn.",
    prepStation: "kitchen",
    avgPrepTimeMin: 18,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["SEAFOOD"],
    allergenTags: ["seafood"],
    labels: ["Ấm bụng"],
    tasteProfile: taste({ containsOnion: true, containsCilantro: true, sugar: 0, spice: "Không" }),
    variants: [portion({ price: 125000, ingredients: [line("porridgeRice", 110, "g"), line("tigerPrawn", 100, "g", 10), line("squid", 100, "g", 12), line("ginger", 8, "g"), line("scallion", 8, "g"), line("cilantro", 5, "g"), line("pepper", 1, "g")] })],
  },
  {
    code: "CANH-GA-CHIEN-NUOC-MAM",
    timeSlot: "late_night",
    category: "Món ăn khuya",
    name: "Cánh gà chiên nước mắm",
    description: "Cánh gà chiên vàng, áo sốt nước mắm tỏi mặn ngọt, dùng nóng cùng dưa leo.",
    prepStation: "kitchen",
    avgPrepTimeMin: 18,
    foodType: "NON_VEGETARIAN",
    meatTypes: ["CHICKEN"],
    allergenTags: [],
    labels: ["Món ăn nhẹ"],
    tasteProfile: taste({ containsOnion: false, containsCilantro: true, sugar: 50, spice: "Vừa" }),
    variants: [portion({ price: 128000, ingredients: [line("chickenWing", 500, "g", 10), line("fishSauce", 22, "ml"), line("sugar", 18, "g"), line("garlic", 15, "g"), line("chili", 4, "g"), line("cucumber", 80, "g")] })],
  },
  {
    code: "KHOAI-TAY-CHIEN",
    timeSlot: "late_night",
    category: "Rau và món phụ",
    name: "Khoai tây chiên",
    description: "Khoai tây cắt thanh chiên vàng giòn, rắc muối nhẹ và dùng cùng tương ớt.",
    prepStation: "kitchen",
    avgPrepTimeMin: 12,
    foodType: "VEGAN",
    meatTypes: [],
    dietTags: ["vegan"],
    allergenTags: [],
    labels: ["Món ăn nhẹ"],
    tasteProfile: taste({ sugar: 0, spice: "Vừa" }),
    variants: [portion({ price: 68000, ingredients: [line("potato", 350, "g", 12), line("cookingOil", 50, "ml"), line("salt", 3, "g"), line("chiliSauce", 20, "ml")] })],
  },
  {
    code: "SODA-CHANH",
    timeSlot: "late_night",
    category: "Đồ uống",
    name: "Soda chanh",
    description: "Soda lạnh pha chanh tươi, vị chua thanh và sủi nhẹ, phù hợp dùng cùng món nướng.",
    prepStation: "bar",
    avgPrepTimeMin: 5,
    foodType: "VEGAN",
    meatTypes: [],
    dietTags: ["vegan"],
    allergenTags: [],
    labels: ["Thanh mát"],
    tasteProfile: taste({ sugar: 30, spice: "Không" }),
    variants: [portion({ name: "Ly tiêu chuẩn", price: 38000, ingredients: [line("sodaWater", 250, "ml"), line("lime", 2, "piece"), line("sugar", 15, "g")] })],
  },
  {
    code: "DUA-HAU-LANH",
    timeSlot: "late_night",
    category: "Tráng miệng",
    name: "Dưa hấu lạnh",
    description: "Dưa hấu chín ngọt được làm lạnh và cắt miếng vừa ăn, phục vụ sau bữa chính.",
    prepStation: "bar",
    avgPrepTimeMin: 5,
    foodType: "VEGAN",
    meatTypes: [],
    dietTags: ["vegan"],
    allergenTags: [],
    labels: ["Tráng miệng"],
    tasteProfile: taste({ sugar: 100, spice: "Không" }),
    variants: [portion({ name: "Đĩa tiêu chuẩn", price: 55000, ingredients: [line("watermelon", 800, "g", 20)] })],
  },
];

function getArgValue(prefix) {
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

function validateCatalog() {
  const errors = [];
  const ingredientKeys = new Set(INGREDIENTS.map((item) => item.key));
  const categoryNames = new Set(DISH_CATEGORIES.map((item) => item.name));
  const codes = new Set();
  const namesBySlot = new Set();
  const modeSummary = { portionOnly: 0, weightOnly: 0, mixed: 0 };

  for (const item of INGREDIENTS) {
    if (!item.key || !item.name) errors.push("Ingredient must have key and name");
    if (!UNITS.has(item.baseUnit)) errors.push(`Ingredient ${item.key}: invalid baseUnit`);
    if (!(Number(item.cost) >= 0)) errors.push(`Ingredient ${item.key}: invalid cost`);
    if (!Number.isInteger(item.onHand) || item.onHand < 0) errors.push(`Ingredient ${item.key}: invalid onHand`);
  }

  for (const dish of DISHES) {
    if (codes.has(dish.code)) errors.push(`Duplicate dish code: ${dish.code}`);
    codes.add(dish.code);

    const nameKey = `${dish.timeSlot}:${dish.name}`;
    if (namesBySlot.has(nameKey)) errors.push(`Duplicate dish name in slot: ${nameKey}`);
    namesBySlot.add(nameKey);

    if (!TIME_SLOTS.has(dish.timeSlot)) errors.push(`${dish.code}: invalid timeSlot`);
    if (!categoryNames.has(dish.category)) errors.push(`${dish.code}: unknown category`);
    if (!dish.name || !dish.description) errors.push(`${dish.code}: missing name/description`);
    if (FORBIDDEN_COPY.test(`${dish.name} ${dish.description}`)) errors.push(`${dish.code}: development wording is not allowed`);
    if (!FOOD_TYPES.has(dish.foodType)) errors.push(`${dish.code}: invalid foodType`);
    for (const value of dish.meatTypes || []) if (!MEAT_TYPES.has(value)) errors.push(`${dish.code}: invalid meatType ${value}`);
    for (const value of dish.dietTags || []) if (!DIET_TAGS.has(value)) errors.push(`${dish.code}: invalid dietTag ${value}`);
    for (const value of dish.allergenTags || []) if (!ALLERGEN_TAGS.has(value)) errors.push(`${dish.code}: invalid allergenTag ${value}`);
    if (!SUGAR_LEVELS.has(dish.tasteProfile?.sugar)) errors.push(`${dish.code}: invalid sugar level`);
    if (!SPICE_LEVELS.has(dish.tasteProfile?.spice)) errors.push(`${dish.code}: invalid spice level`);

    const variants = Array.isArray(dish.variants) ? dish.variants : [];
    if (!variants.length) errors.push(`${dish.code}: at least one variant is required`);
    const keys = variants.map((variant) => variant.key);
    if (new Set(keys).size !== keys.length) errors.push(`${dish.code}: duplicate variant key`);
    if (variants.filter((variant) => variant.isDefault).length !== 1) errors.push(`${dish.code}: exactly one default variant is required`);

    const modes = new Set(variants.map((variant) => variant.mode));
    if (modes.size === 2) modeSummary.mixed += 1;
    else if (modes.has("BY_WEIGHT")) modeSummary.weightOnly += 1;
    else modeSummary.portionOnly += 1;

    for (const variant of variants) {
      if (variant.mode === "PORTION" && variant.sellUnit !== "portion") errors.push(`${dish.code}/${variant.key}: PORTION must use portion`);
      if (variant.mode === "BY_WEIGHT" && !["g", "kg"].includes(variant.sellUnit)) errors.push(`${dish.code}/${variant.key}: BY_WEIGHT must use g or kg`);
      if (!(Number(variant.sellQty) > 0)) errors.push(`${dish.code}/${variant.key}: invalid sellQty`);
      if (!(Number(variant.price) >= 0)) errors.push(`${dish.code}/${variant.key}: invalid price`);
      for (const ingredientLine of variant.ingredients || []) {
        if (!ingredientKeys.has(ingredientLine.ingredient)) errors.push(`${dish.code}/${variant.key}: unknown ingredient ${ingredientLine.ingredient}`);
        if (!(Number(ingredientLine.qty) > 0)) errors.push(`${dish.code}/${variant.key}: ingredient qty must be > 0`);
        if (!UNITS.has(ingredientLine.unit)) errors.push(`${dish.code}/${variant.key}: invalid ingredient unit`);
        if (!(ingredientLine.wastePct >= 0 && ingredientLine.wastePct <= 100)) errors.push(`${dish.code}/${variant.key}: invalid wastePct`);
      }
    }
  }

  if (!modeSummary.portionOnly || !modeSummary.weightOnly || !modeSummary.mixed) {
    errors.push("Catalog must include portion-only, weight-only and mixed dishes");
  }

  const silverSillagoDish = DISHES.find((dish) => dish.code === "CA-DUC-NUONG-MUOI-OT");
  const portionVariant = silverSillagoDish?.variants.find((variant) => variant.mode === "PORTION");
  const kgVariant = silverSillagoDish?.variants.find((variant) => variant.mode === "BY_WEIGHT");
  if (portionVariant?.price !== 150000 || kgVariant?.price !== 400000 || kgVariant?.sellUnit !== "kg") {
    errors.push("Cá đục pricing must be 150000 per portion and 400000 per kg");
  }

  if (errors.length) {
    throw new Error(`Catalog validation failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    restaurants: TARGET_RESTAURANTS.length,
    menusPerRestaurant: MENU_DEFINITIONS.length,
    categoriesPerRestaurant: DISH_CATEGORIES.length,
    ingredientsPerRestaurant: INGREDIENTS.length,
    dishesPerRestaurant: DISHES.length,
    ...modeSummary,
  };
}

async function upsertOne(Model, filter, payload) {
  return Model.findOneAndUpdate(
    filter,
    { $set: payload },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

async function upsertMenuItem(filter, payload) {
  const existing =
    (await MenuItem.findOne({ restaurantId: payload.restaurantId, code: payload.code })) ||
    (await MenuItem.findOne(filter));

  if (existing) {
    const { status: _status, ...safeUpdate } = payload;
    existing.set(safeUpdate);
    await existing.save();
    return { doc: existing, created: false };
  }

  const created = await MenuItem.create(payload);
  return { doc: created, created: true };
}

function resolveRecipeVariants(dish, ingredientIds) {
  return dish.variants.map((variant) => ({
    key: variant.key,
    name: variant.name,
    mode: variant.mode,
    sellQty: variant.sellQty,
    sellUnit: variant.sellUnit,
    price: variant.price,
    isDefault: variant.isDefault,
    ingredients: variant.ingredients.map((ingredientLine) => ({
      ingredientId: ingredientIds.get(ingredientLine.ingredient),
      qty: ingredientLine.qty,
      unit: ingredientLine.unit,
      wastePct: ingredientLine.wastePct,
    })),
  }));
}

async function seedRestaurant(target) {
  const restaurant = await Restaurant.findById(target.id);
  if (!restaurant) throw new Error(`Restaurant not found: ${target.id}`);
  if (restaurant.name !== target.expectedName) {
    throw new Error(`Restaurant ${target.id} name mismatch: expected "${target.expectedName}", got "${restaurant.name}"`);
  }
  if (String(restaurant.brandId || "") !== EXPECTED_BRAND_ID) {
    throw new Error(`Restaurant ${target.id} does not belong to brand ${EXPECTED_BRAND_ID}`);
  }

  const ingredientCategoryIds = new Map();
  for (const category of INGREDIENT_CATEGORIES) {
    const doc = await upsertOne(
      IngredientCategory,
      { restaurantId: restaurant._id, slug: category.slug },
      {
        restaurantId: restaurant._id,
        name: category.name,
        slug: category.slug,
        source: "manual",
        usageCount: INGREDIENTS.filter((item) => item.category === category.slug).length,
        isActive: true,
      },
    );
    ingredientCategoryIds.set(category.slug, doc._id);
  }

  const ingredientIds = new Map();
  for (const [index, ingredient] of INGREDIENTS.entries()) {
    const doc = await upsertOne(
      Ingredient,
      { restaurantId: restaurant._id, name: ingredient.name },
      {
        restaurantId: restaurant._id,
        name: ingredient.name,
        sku: `${target.codePrefix}-ING-${String(index + 1).padStart(3, "0")}`,
        category: INGREDIENT_CATEGORIES.find((item) => item.slug === ingredient.category)?.name,
        ingredientCategoryId: ingredientCategoryIds.get(ingredient.category),
        baseUnit: ingredient.baseUnit,
        conversions: [],
        costPerBaseUnit: ingredient.cost,
        minStock: ingredient.minStock,
        notes: "",
        isActive: true,
        deletedAt: null,
        deleteExpiresAt: null,
      },
    );
    ingredientIds.set(ingredient.key, doc._id);
  }

  const warehouse = await upsertOne(
    Warehouse,
    { restaurantId: restaurant._id, name: "Kho nguyên liệu chính" },
    {
      restaurantId: restaurant._id,
      name: "Kho nguyên liệu chính",
      code: `${target.codePrefix}-MAIN`,
      address: restaurant.address?.line1 || restaurant.address?.city || "",
      isActive: true,
    },
  );

  for (const ingredient of INGREDIENTS) {
    const stockFilter = {
      restaurantId: restaurant._id,
      warehouseId: warehouse._id,
      ingredientId: ingredientIds.get(ingredient.key),
    };
    await StockItem.findOneAndUpdate(
      stockFilter,
      {
        $setOnInsert: {
          ...stockFilter,
          onHand: ingredient.onHand,
          reserved: 0,
          costPerUnit: ingredient.cost,
          pricePerUnit: 0,
          note: "Tồn kho khởi tạo cho vận hành thực đơn.",
          batches: [],
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  const categoryIds = new Map();
  for (const category of DISH_CATEGORIES) {
    const doc = await upsertOne(
      Category,
      { restaurantId: restaurant._id, name: category.name },
      {
        restaurantId: restaurant._id,
        name: category.name,
        icon: category.icon,
        order: category.order,
        isActive: true,
      },
    );
    categoryIds.set(category.name, doc._id);
  }

  const menuGroupIds = new Map();
  for (const group of MENU_GROUPS) {
    const doc = await upsertOne(
      CategoryMenu,
      { restaurantId: restaurant._id, name: group.name },
      {
        restaurantId: restaurant._id,
        name: group.name,
        icon: group.icon,
        description: group.description,
        order: group.order,
        isActive: true,
      },
    );
    menuGroupIds.set(group.timeSlot, doc._id);
  }

  const menuIds = new Map();
  for (const menu of MENU_DEFINITIONS) {
    const doc = await upsertOne(
      Menu,
      { restaurantId: restaurant._id, timeSlot: menu.timeSlot },
      {
        restaurantId: restaurant._id,
        timeSlot: menu.timeSlot,
        name: menu.name,
        description: menu.description,
        isActive: true,
        categoryMenuId: menuGroupIds.get(menu.timeSlot),
      },
    );
    menuIds.set(menu.timeSlot, doc._id);
  }

  const summary = { createdItems: 0, updatedItems: 0, recipes: 0 };
  for (const [index, dish] of DISHES.entries()) {
    const recipeVariants = resolveRecipeVariants(dish, ingredientIds);
    const defaultVariant = recipeVariants.find((variant) => variant.isDefault) || recipeVariants[0];
    const basePrice = Math.min(...recipeVariants.map((variant) => variant.price));
    const hasByWeightVariant = recipeVariants.some((variant) => variant.mode === "BY_WEIGHT");
    const menuId = menuIds.get(dish.timeSlot);
    const categoryId = categoryIds.get(dish.category);
    const code = `${target.codePrefix}-${dish.code}`;

    const { doc: menuItem, created } = await upsertMenuItem(
      { restaurantId: restaurant._id, menuId, categoryId, name: dish.name },
      {
        restaurantId: restaurant._id,
        menuId,
        categoryId,
        code,
        name: dish.name,
        description: dish.description,
        sortOrder: (index + 1) * 10,
        labels: dish.labels || [],
        foodType: dish.foodType,
        meatTypes: dish.meatTypes || [],
        dietTags: dish.dietTags || [],
        allergenTags: dish.allergenTags || [],
        tasteProfile: dish.tasteProfile,
        basePrice,
        defaultServingKey: defaultVariant.key,
        hasByWeightVariant,
        servingPortion: defaultVariant.sellQty,
        servingUnit: defaultVariant.mode === "BY_WEIGHT" ? defaultVariant.sellUnit : "phần",
        prepStation: dish.prepStation,
        status: "available",
        avgPrepTimeMin: dish.avgPrepTimeMin,
        notes: "",
      },
    );

    if (created) summary.createdItems += 1;
    else summary.updatedItems += 1;

    await upsertOne(
      Recipe,
      { restaurantId: restaurant._id, menuItemId: menuItem._id },
      {
        restaurantId: restaurant._id,
        menuItemId: menuItem._id,
        servingVariants: recipeVariants,
        notes: "",
        isActive: true,
        deletedAt: null,
        deleteExpiresAt: null,
      },
    );
    summary.recipes += 1;
  }

  for (const category of DISH_CATEGORIES) {
    const count = await MenuItem.countDocuments({
      restaurantId: restaurant._id,
      categoryId: categoryIds.get(category.name),
    });
    await Category.updateOne(
      { _id: categoryIds.get(category.name) },
      { $set: { menuItemCount: count } },
    );
  }

  return {
    restaurantId: String(restaurant._id),
    restaurantName: restaurant.name,
    ingredients: ingredientIds.size,
    menus: menuIds.size,
    categories: categoryIds.size,
    ...summary,
  };
}

async function main() {
  const catalogSummary = validateCatalog();
  const apply = process.argv.includes("--apply");
  const validateOnly = process.argv.includes("--validate-only") || !apply;
  const requestedRestaurantId = getArgValue("--restaurantId=");

  const targets = requestedRestaurantId
    ? TARGET_RESTAURANTS.filter((target) => target.id === requestedRestaurantId)
    : TARGET_RESTAURANTS;

  if (!targets.length) {
    throw new Error(`Unsupported restaurantId: ${requestedRestaurantId}`);
  }

  console.log("Catalog validation passed:", catalogSummary);
  if (validateOnly) {
    console.log("No database changes were made. Add --apply to upsert the catalog.");
    return;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required when --apply is used");
  }

  const dbName = process.env.MONGO_DB?.trim();
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI, dbName ? { dbName } : {});

  try {
    const results = [];
    for (const target of targets) {
      results.push(await seedRestaurant(target));
    }
    console.table(results);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error?.stack || error?.message || error);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
