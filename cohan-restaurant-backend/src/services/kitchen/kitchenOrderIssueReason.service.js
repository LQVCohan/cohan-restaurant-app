function stripVietnameseDiacritics(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeIssueReasonText(reason) {
  return stripVietnameseDiacritics(String(reason || ""))
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_KEYWORDS = {
  service_order_mistake: ["nhan vien nhap sai", "order sai", "goi nham", "phuc vu nhap sai", "server mistake", "staff mistake", "wrong order by staff"],
  customer_request: ["khach doi y", "khach khong dung", "khach huy", "khach goi nham", "doi y", "customer changed mind", "customer request", "customer cancelled"],
  payment_or_bill: ["sai bill", "sai hoa don", "tach bill", "gop bill", "payment", "bill mistake", "split bill"],
  kitchen_wrong_item: ["bep lam sai", "sai mon", "lam nham", "nham mon", "wrong item", "wrong dish", "kitchen mistake"],
  kitchen_quality: ["chay", "song", "chua chin", "nguoi", "man", "nhat", "sai vi", "do", "khong ngon", "khong dat", "kem chat luong", "thieu topping", "thieu nguyen lieu", "thieu phan", "burned", "raw", "undercooked", "cold", "salty", "bland", "bad taste", "poor quality", "missing ingredient"],
  kitchen_delay: ["lau", "qua lau", "ra mon cham", "cham mon", "bep cham", "delayed", "too slow", "late"],
  kitchen_unavailable: ["het mon", "het nguyen lieu", "khong con mon", "out of stock", "unavailable", "sold out"],
};

const KITCHEN_RELATED = new Set([
  "kitchen_quality",
  "kitchen_delay",
  "kitchen_wrong_item",
  "kitchen_unavailable",
]);

export function classifyKitchenOrderIssueReason(reason) {
  const normalized = normalizeIssueReasonText(reason);
  if (!normalized) return { category: "unknown", isKitchenRelated: false, matchedKeyword: null };

  const categories = [
    "service_order_mistake",
    "customer_request",
    "payment_or_bill",
    "kitchen_wrong_item",
    "kitchen_quality",
    "kitchen_delay",
    "kitchen_unavailable",
  ];

  for (const category of categories) {
    const matchedKeyword = CATEGORY_KEYWORDS[category].find((kw) => normalized.includes(kw));
    if (matchedKeyword) {
      return { category, isKitchenRelated: KITCHEN_RELATED.has(category), matchedKeyword };
    }
  }

  return { category: "unknown", isKitchenRelated: false, matchedKeyword: null };
}

export function isKitchenRelatedIssueReason(reason) {
  return classifyKitchenOrderIssueReason(reason).isKitchenRelated;
}
