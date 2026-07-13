const WIKIPEDIA_API = (lang, title) => ({
  type: "wikipedia",
  lang,
  title,
});

const UNSPLASH_FALLBACKS = {
  vietnamese:
    "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1400&h=933&q=88&fm=jpg",
  noodle:
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1400&h=933&q=88&fm=jpg",
  seafood:
    "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=1400&h=933&q=88&fm=jpg",
  grill:
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&h=933&q=88&fm=jpg",
  chicken:
    "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=1400&h=933&q=88&fm=jpg",
  vegetable:
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1400&h=933&q=88&fm=jpg",
  drink:
    "https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=1400&h=933&q=88&fm=jpg",
  soup:
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1400&h=933&q=88&fm=jpg",
  spread:
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&h=933&q=88&fm=jpg",
  dessert:
    "https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=1400&h=933&q=88&fm=jpg",
};

const photo = (code, slug, fallbackKey, candidates) => ({
  code,
  slug,
  candidates,
  fallback: {
    type: "url",
    url: UNSPLASH_FALLBACKS[fallbackKey],
    sourcePage: "https://unsplash.com",
  },
});

export const DEFENSE_MENU_REAL_PHOTOS = [
  photo("MON-PHO-001", "pho-bo-dac-biet", "noodle", [
    WIKIPEDIA_API("vi", "Phở"),
    WIKIPEDIA_API("en", "Pho"),
  ]),
  photo("BUN-BO-HUE", "bun-bo-hue", "noodle", [
    WIKIPEDIA_API("vi", "Bún bò Huế"),
    WIKIPEDIA_API("en", "Bún bò Huế"),
  ]),
  photo("BANH-MI-OP-LA", "banh-mi-op-la-cha-lua", "vietnamese", [
    WIKIPEDIA_API("vi", "Bánh mì"),
    WIKIPEDIA_API("en", "Bánh mì"),
  ]),
  photo("BANH-CUON-CHA-LUA", "banh-cuon-cha-lua", "vietnamese", [
    WIKIPEDIA_API("vi", "Bánh cuốn"),
    WIKIPEDIA_API("en", "Bánh cuốn"),
  ]),
  photo("CHAO-SUON-TRUNG", "chao-suon-trung", "soup", [
    WIKIPEDIA_API("vi", "Cháo"),
    WIKIPEDIA_API("en", "Congee"),
  ]),
  photo("CA-PHE-SUA-DA", "ca-phe-sua-da", "drink", [
    WIKIPEDIA_API("vi", "Cà phê sữa đá"),
    WIKIPEDIA_API("en", "Vietnamese iced coffee"),
  ]),
  photo("TRA-TAC", "tra-tac", "drink", [
    WIKIPEDIA_API("vi", "Trà tắc"),
    WIKIPEDIA_API("en", "Iced tea"),
  ]),
  photo("COM-GA-XOI-MO", "com-ga-xoi-mo", "chicken", [
    WIKIPEDIA_API("vi", "Cơm gà"),
    WIKIPEDIA_API("en", "Chicken rice"),
  ]),
  photo("COM-SUON-NUONG", "com-suon-nuong-mat-ong", "vietnamese", [
    WIKIPEDIA_API("vi", "Cơm tấm"),
    WIKIPEDIA_API("en", "Cơm tấm"),
  ]),
  photo("CA-LOC-KHO-TO", "ca-loc-kho-to", "vietnamese", [
    WIKIPEDIA_API("vi", "Cá kho tộ"),
    WIKIPEDIA_API("en", "Vietnamese cuisine"),
  ]),
  photo("CANH-CHUA-CA-LOC", "canh-chua-ca-loc", "soup", [
    WIKIPEDIA_API("vi", "Canh chua"),
    WIKIPEDIA_API("en", "Canh chua"),
  ]),
  photo("THIT-KHO-TRUNG", "thit-kho-trung-nuoc-dua", "vietnamese", [
    WIKIPEDIA_API("vi", "Thịt kho"),
    WIKIPEDIA_API("en", "Thịt kho"),
  ]),
  photo("RAU-MUONG-XAO-TOI", "rau-muong-xao-toi", "vegetable", [
    WIKIPEDIA_API("vi", "Rau muống xào"),
    WIKIPEDIA_API("en", "Stir-fried water spinach"),
  ]),
  photo("TOM-SU-RANG-ME-PHAN", "tom-su-rang-me", "seafood", [
    WIKIPEDIA_API("vi", "Tôm rang me"),
    WIKIPEDIA_API("en", "Shrimp and prawn as food"),
  ]),
  photo("BO-LUC-LAC", "bo-luc-lac", "grill", [
    WIKIPEDIA_API("vi", "Bò lúc lắc"),
    WIKIPEDIA_API("en", "Bò lúc lắc"),
  ]),
  photo("NUOC-CAM-TUOI", "nuoc-cam-tuoi", "drink", [
    WIKIPEDIA_API("vi", "Nước cam"),
    WIKIPEDIA_API("en", "Orange juice"),
  ]),
  photo("CHANH-DAY-SODA", "chanh-day-soda", "drink", [
    WIKIPEDIA_API("vi", "Chanh dây"),
    WIKIPEDIA_API("en", "Passiflora edulis"),
  ]),
  photo("GOI-NGO-SEN-TOM-THIT", "goi-ngo-sen-tom-thit", "vegetable", [
    WIKIPEDIA_API("vi", "Gỏi ngó sen"),
    WIKIPEDIA_API("en", "Vietnamese cuisine"),
  ]),
  photo("CA-DUC-NUONG-MUOI-OT", "ca-duc-nuong-muoi-ot", "seafood", [
    WIKIPEDIA_API("vi", "Cá nướng"),
    WIKIPEDIA_API("en", "Grilled fish"),
  ]),
  photo("CA-MU-HAP-HONG-KONG", "ca-mu-hap-hong-kong", "seafood", [
    WIKIPEDIA_API("vi", "Cá hấp"),
    WIKIPEDIA_API("en", "Steamed fish"),
  ]),
  photo("CA-CHEM-HAP-XI-DAU", "ca-chem-hap-xi-dau", "seafood", [
    WIKIPEDIA_API("vi", "Cá hấp"),
    WIKIPEDIA_API("en", "Steamed fish"),
  ]),
  photo("MUC-LA-NUONG-SA-TE", "muc-la-nuong-sa-te", "seafood", [
    WIKIPEDIA_API("vi", "Mực nướng"),
    WIKIPEDIA_API("en", "Squid as food"),
  ]),
  photo("TOM-SU-RANG-MUOI", "tom-su-rang-muoi", "seafood", [
    WIKIPEDIA_API("vi", "Tôm rang muối"),
    WIKIPEDIA_API("en", "Shrimp and prawn as food"),
  ]),
  photo("CUA-CA-MAU-SOT-ME", "cua-ca-mau-sot-me", "seafood", [
    WIKIPEDIA_API("vi", "Cua sốt me"),
    WIKIPEDIA_API("en", "Chilli crab"),
  ]),
  photo("NGHEU-HAP-SA", "ngheu-hap-sa", "seafood", [
    WIKIPEDIA_API("vi", "Nghêu hấp sả"),
    WIKIPEDIA_API("en", "Clam dish"),
  ]),
  photo("MON-BO-002", "bo-nuong-sot-tieu-den", "grill", [
    WIKIPEDIA_API("vi", "Bò nướng"),
    WIKIPEDIA_API("en", "Grilling"),
  ]),
  photo("GA-NUONG-MAT-ONG", "ga-nuong-mat-ong", "chicken", [
    WIKIPEDIA_API("vi", "Gà nướng"),
    WIKIPEDIA_API("en", "Roast chicken"),
  ]),
  photo("LAU-GA-LA-E", "lau-ga-la-e", "spread", [
    WIKIPEDIA_API("vi", "Lẩu"),
    WIKIPEDIA_API("en", "Hot pot"),
  ]),
  photo("LAU-HAI-SAN-CHUA-CAY", "lau-hai-san-chua-cay", "seafood", [
    WIKIPEDIA_API("vi", "Lẩu hải sản"),
    WIKIPEDIA_API("en", "Hot pot"),
  ]),
  photo("COM-CHIEN-HAI-SAN", "com-chien-hai-san", "vietnamese", [
    WIKIPEDIA_API("vi", "Cơm chiên"),
    WIKIPEDIA_API("en", "Fried rice"),
  ]),
  photo("MI-XAO-BO", "mi-xao-bo", "noodle", [
    WIKIPEDIA_API("vi", "Mì xào"),
    WIKIPEDIA_API("en", "Chow mein"),
  ]),
  photo("CHAO-HAI-SAN", "chao-hai-san", "soup", [
    WIKIPEDIA_API("vi", "Cháo"),
    WIKIPEDIA_API("en", "Congee"),
  ]),
  photo("SUP-BIDO-001", "sup-bi-do-kem-tuoi", "soup", [
    WIKIPEDIA_API("vi", "Súp bí đỏ"),
    WIKIPEDIA_API("en", "Pumpkin soup"),
  ]),
  photo("KHOAI-TAY-CHIEN", "khoai-tay-chien", "spread", [
    WIKIPEDIA_API("vi", "Khoai tây chiên"),
    WIKIPEDIA_API("en", "French fries"),
  ]),
  photo("DUA-HAU-LANH", "dua-hau-lanh", "dessert", [
    WIKIPEDIA_API("vi", "Dưa hấu"),
    WIKIPEDIA_API("en", "Watermelon"),
  ]),
  photo("NUOC-TRA-001", "tra-dao-cam-sa", "drink", [
    WIKIPEDIA_API("vi", "Trà đào"),
    WIKIPEDIA_API("en", "Iced tea"),
  ]),
];

const PHOTO_BY_CODE = new Map(
  DEFENSE_MENU_REAL_PHOTOS.map((entry) => [entry.code, entry]),
);

export const REAL_MENU_PHOTO_DIRECTORY = "/images/menu/dishes/";
export const REAL_MENU_PHOTO_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export function getDefenseMenuPhotoSource(code) {
  return PHOTO_BY_CODE.get(String(code || "")) || null;
}

export function isManagedRealMenuPhotoPath(value) {
  const path = String(value || "").trim().toLowerCase();
  if (!path.startsWith(REAL_MENU_PHOTO_DIRECTORY)) return false;
  const extension = path.split(".").pop();
  return REAL_MENU_PHOTO_EXTENSIONS.has(extension);
}

export function validateDefenseMenuPhotoCatalog(expectedCodes = []) {
  const expected = new Set(expectedCodes.map(String));
  const seenCodes = new Set();
  const seenSlugs = new Set();

  for (const entry of DEFENSE_MENU_REAL_PHOTOS) {
    if (!entry.code || seenCodes.has(entry.code)) {
      throw new Error(`DUPLICATE_OR_EMPTY_MENU_PHOTO_CODE: ${entry.code || "empty"}`);
    }
    if (!entry.slug || seenSlugs.has(entry.slug)) {
      throw new Error(`DUPLICATE_OR_EMPTY_MENU_PHOTO_SLUG: ${entry.slug || "empty"}`);
    }
    if (!Array.isArray(entry.candidates) || !entry.candidates.length) {
      throw new Error(`MENU_PHOTO_CANDIDATES_MISSING: ${entry.code}`);
    }
    if (!entry.fallback?.url?.startsWith("https://images.unsplash.com/")) {
      throw new Error(`MENU_PHOTO_FALLBACK_NOT_TRUSTED: ${entry.code}`);
    }
    seenCodes.add(entry.code);
    seenSlugs.add(entry.slug);
  }

  if (expected.size) {
    const missing = [...expected].filter((code) => !seenCodes.has(code));
    const extra = [...seenCodes].filter((code) => !expected.has(code));
    if (missing.length || extra.length) {
      throw new Error(
        `MENU_PHOTO_CATALOG_MISMATCH: missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}`,
      );
    }
  }

  return {
    photos: DEFENSE_MENU_REAL_PHOTOS.length,
    uniqueCodes: seenCodes.size,
    uniqueSlugs: seenSlugs.size,
  };
}
