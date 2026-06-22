const SINGLE_RESTAURANT_ROLES = new Set([
  "hr",
  "accountant",
  "staff",
  "server",
  "supervisor",
  "host",
  "cashier",
  "chef",
  "cook",
  "kitchen_helper",
  "cleaner",
  "shipper",
  "storekeeper",
  "bartender",
]);

export function isSingleRestaurantRole(roleName) {
  return SINGLE_RESTAURANT_ROLES.has(String(roleName || "").trim().toLowerCase());
}
