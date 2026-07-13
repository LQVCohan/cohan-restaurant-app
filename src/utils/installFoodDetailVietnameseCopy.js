const FOOD_DETAIL_ROOT_SELECTOR = ".food-detail-v2";
const OBSERVER_KEY = "__cohanFoodDetailVietnameseCopyObserver";

const EXACT_COPY = new Map([
  ["Thông tin món", "Thông tin món ăn"],
  ["Khách cần biết trước khi đặt", "Thông tin cần biết trước khi đặt món"],
  ["Thông tin cá nhân hóa", "Gợi ý dành riêng cho bạn"],
  [
    "Hãy xem thành phần và ghi chú món trước khi đặt.",
    "Hãy xem thành phần và thêm ghi chú cho nhà hàng trước khi đặt món.",
  ],
  ["Chuẩn bị dự kiến", "Thời gian chuẩn bị"],
  ["Chọn khẩu phần hoặc cách bán", "Chọn khẩu phần phù hợp"],
  ["Chọn theo nhu cầu của bạn", "Tùy chọn theo nhu cầu"],
  ["Món này không có tùy chọn thêm.", "Món này không có tùy chọn bổ sung."],
  ["Giá theo lựa chọn", "Giá của lựa chọn"],
  ["Tình trạng hiện tại", "Số lượng hiện có"],
  ["Chọn nơi phục vụ", "Chọn nhà hàng"],
  ["Nhà hàng có món này", "Món này được phục vụ tại"],
  ["Đang kiểm tra các nhà hàng…", "Đang tìm nơi phục vụ món này…"],
  [
    "Chưa tải được danh sách nhà hàng.",
    "Chưa tải được danh sách nơi phục vụ.",
  ],
  [
    "Chưa tìm thấy nhà hàng khác đang phục vụ món này.",
    "Chưa tìm thấy địa điểm khác phục vụ món này.",
  ],
  ["Chưa nhận đơn", "Hiện chưa nhận đơn"],
  ["Chưa theo dõi tồn kho", "Chưa cập nhật số lượng"],
  ["Đang kiểm tra tồn kho", "Đang kiểm tra số lượng"],
  [
    "Chưa có đánh giá được công khai cho món này.",
    "Món này chưa có đánh giá công khai.",
  ],
  ["Đang tải đánh giá...", "Đang tải đánh giá…"],
  [
    "Khi thêm vào giỏ, hệ thống giữ tồn kho tối đa 5 phút. Giá và tồn kho được xác nhận lại trên máy chủ.",
    "Món được giữ trong giỏ tối đa 5 phút. Giá và số lượng còn lại sẽ được kiểm tra lại khi bạn thanh toán.",
  ],
]);

const FOOD_TERM_REPLACEMENTS = [
  [/\bDairy Free\b/gi, "Không chứa sữa"],
  [/\bGluten Free\b/gi, "Không chứa gluten"],
  [/\bNut Free\b/gi, "Không chứa hạt"],
  [/\bTree Nuts\b/gi, "Các loại hạt"],
  [/\bHigh Protein\b/gi, "Giàu đạm"],
  [/\bLow Carb\b/gi, "Ít tinh bột"],
  [/\bShellfish\b/gi, "Hải sản có vỏ"],
  [/\bCrustaceans\b/gi, "Động vật giáp xác"],
  [/\bMollus(?:cs|ks)\b/gi, "Động vật thân mềm"],
  [/\bPeanuts?\b/gi, "Đậu phộng"],
  [/\bSoya?\b/gi, "Đậu nành"],
  [/\bSesame\b/gi, "Mè"],
  [/\bMustard\b/gi, "Mù tạt"],
  [/\bCelery\b/gi, "Cần tây"],
  [/\bSulphites?\b/gi, "Sulfit"],
  [/\bSulfites?\b/gi, "Sulfit"],
  [/\bWheat\b/gi, "Lúa mì"],
  [/\bMilk\b/gi, "Sữa"],
  [/\bEggs?\b/gi, "Trứng"],
  [/\bFish\b/gi, "Cá"],
  [/\bVegan\b/gi, "Thuần chay"],
  [/\bVegetarian\b/gi, "Món chay"],
  [/\bGluten\b/gi, "gluten"],
];

const TARGET_SELECTORS = [
  ".food-detail-v2__facts span",
  ".food-detail-v2__section-heading span",
  ".food-detail-v2__section-heading h2",
  ".food-detail-v2__chips span",
  ".food-detail-v2__allergen p",
  ".food-detail-v2__preference strong",
  ".food-detail-v2__preference p",
  ".food-detail-v2__price span",
  ".food-detail-v2__variants legend",
  ".food-detail-v2__subheading span",
  ".food-detail-v2__subheading strong",
  ".food-detail-v2__muted",
  ".food-detail-v2__live strong",
  ".food-detail-v2__live-meta span",
  ".food-detail-v2__hold-note",
  ".food-detail-v2__review-state",
  ".food-location-selector__heading span",
  ".food-location-selector__heading strong",
  ".food-location-selector__heading small",
  ".food-location-selector__state",
  ".food-location-selector__state > span",
  ".food-location-selector__stock",
].join(",");

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

export const translateFoodDetailText = (value) => {
  const original = normalizeText(value);
  if (!original) return "";

  if (EXACT_COPY.has(original)) return EXACT_COPY.get(original);

  const availableMatch = original.match(/^Còn có thể đặt\s+([\d.,]+)\s+suất$/i);
  if (availableMatch) return `Còn ${availableMatch[1]} suất có thể đặt`;

  if (/^0\s+suất đang được giữ$/i.test(original)) {
    return "Chưa có suất nào đang được giữ";
  }

  const locationCountMatch = original.match(/^([\d.,]+)\s+nhà hàng$/i);
  if (locationCountMatch) return `${locationCountMatch[1]} địa điểm`;

  let translated = original
    .replace(/^Món được đánh dấu có thể chứa:\s*/i, "Món này có thể chứa: ")
    .replace(
      /Hãy ghi chú hoặc liên hệ nhà hàng nếu bạn cần xác nhận kỹ hơn\.?$/i,
      "Vui lòng ghi rõ yêu cầu hoặc liên hệ nhà hàng nếu bạn cần xác nhận thêm.",
    );

  FOOD_TERM_REPLACEMENTS.forEach(([pattern, replacement]) => {
    translated = translated.replace(pattern, replacement);
  });

  return translated;
};

const updateTextNode = (node) => {
  const originalValue = node.nodeValue || "";
  const normalized = normalizeText(originalValue);
  if (!normalized) return;

  const next = translateFoodDetailText(normalized);
  if (!next || next === normalized) return;

  const leadingWhitespace = originalValue.match(/^\s*/)?.[0] || "";
  const trailingWhitespace = originalValue.match(/\s*$/)?.[0] || "";
  node.nodeValue = `${leadingWhitespace}${next}${trailingWhitespace}`;
};

const updateElementCopy = (element) => {
  if (!(element instanceof HTMLElement)) return;

  if (!element.children.length) {
    const next = translateFoodDetailText(element.textContent);
    if (next && next !== normalizeText(element.textContent)) {
      element.textContent = next;
    }
    return;
  }

  Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .forEach(updateTextNode);
};

export const syncFoodDetailVietnameseCopy = (root = document) => {
  if (!root?.querySelector?.(FOOD_DETAIL_ROOT_SELECTOR)) return;
  root.querySelectorAll(TARGET_SELECTORS).forEach(updateElementCopy);
};

export const installFoodDetailVietnameseCopy = ({ root = document } = {}) => {
  if (!root || typeof MutationObserver === "undefined") return () => {};

  if (typeof window !== "undefined") {
    window[OBSERVER_KEY]?.disconnect?.();
  }

  let scheduled = false;
  const scheduleSync = () => {
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      syncFoodDetailVietnameseCopy(root);
    };

    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  };

  scheduleSync();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(root.body || root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  if (typeof window !== "undefined") {
    window[OBSERVER_KEY] = observer;
  }

  return () => {
    observer.disconnect();
    if (typeof window !== "undefined" && window[OBSERVER_KEY] === observer) {
      delete window[OBSERVER_KEY];
    }
  };
};

export const __testables = {
  EXACT_COPY,
  FOOD_DETAIL_ROOT_SELECTOR,
  OBSERVER_KEY,
  TARGET_SELECTORS,
};

export default installFoodDetailVietnameseCopy;
