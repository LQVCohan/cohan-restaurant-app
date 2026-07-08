import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const write = (path, content) => fs.writeFileSync(path, content);

function replaceOnce(path, search, replacement, label) {
  const source = read(path);
  const next = source.replace(search, replacement);
  if (next === source) {
    throw new Error(`Patch not applied in ${path}: ${label}`);
  }
  write(path, next);
}

const foodDetailPath = "src/components/Customer/Food/FoodDetailV2.jsx";

replaceOnce(
  foodDetailPath,
  `import { getCannotOrderReason } from "../../../utils/restaurantStatus";`,
  `import { getCannotOrderReason } from "../../../utils/restaurantStatus";\nimport {\n  FOOD_ORDER_ACTION,\n  getFoodOrderingActionState,\n} from "../../../utils/foodOrderingActionState";`,
  "food ordering action state import",
);

replaceOnce(
  foodDetailPath,
  /  const orderingDisabled =[\s\S]*?  \}\)\(\);\n/,
  `  const orderAction = getFoodOrderingActionState({\n    adding,\n    restaurantLoading,\n    hasRestaurant: Boolean(restaurant),\n    restaurantCanOrder,\n    restaurantBlockedReason,\n    modifierLoading,\n    modifierErrorMessage,\n    hasSelectedVariant: Boolean(selectedVariant),\n    liveLoading,\n    liveError: Boolean(liveError),\n    hasLiveState: Boolean(liveState),\n    liveBlocked: Boolean(liveState?.blocked),\n    outOfStock,\n    quantityExceedsAvailable,\n    isAuthenticated,\n    isCustomer,\n  });\n  const buyButtonLabel =\n    orderAction.intent === FOOD_ORDER_ACTION.LOGIN\n      ? "Đăng nhập để đặt"\n      : "Đặt ngay";\n`,
  "ordering action state",
);

replaceOnce(
  foodDetailPath,
  /  const addSelectionToCart = async \(\) => \{[\s\S]*?\n    try \{/,
  `  const addSelectionToCart = async () => {\n    setModifierAttempted(true);\n    if (modifierErrorMessage) {\n      const modifierSection = document.querySelector(\n        ".food-detail-v2__modifiers",\n      );\n      modifierSection?.scrollIntoView({ behavior: "smooth", block: "center" });\n      modifierSection?.querySelector("input")?.focus();\n      return false;\n    }\n    if (orderAction.intent === FOOD_ORDER_ACTION.RETRY_STOCK) {\n      showNotification("Đang kiểm tra lại tồn kho…", "info");\n      await refetchLiveState?.();\n      return false;\n    }\n    if (orderAction.intent === FOOD_ORDER_ACTION.LOGIN) {\n      redirectToLogin();\n      return false;\n    }\n    if (orderAction.disabled) return false;\n\n    try {`,
  "ordering action handler",
);

replaceOnce(
  foodDetailPath,
  `              <img\n                src={dish.thumbImage || FOOD_PLACEHOLDER}\n                alt={dish.name}`,
  `              <img\n                src={dish.thumbImage || FOOD_PLACEHOLDER}\n                alt={dish.name}\n                width="1200"\n                height="900"\n                fetchPriority="high"\n                decoding="async"`,
  "food detail hero image dimensions",
);

replaceOnce(
  foodDetailPath,
  `              <textarea\n                value={note}\n                maxLength={180}\n                onChange={(event) => setNote(event.target.value)}\n                placeholder="Ví dụ: ít cay, không hành, đóng gói riêng..."`,
  `              <textarea\n                name="orderNote"\n                autoComplete="off"\n                value={note}\n                maxLength={180}\n                onChange={(event) => setNote(event.target.value)}\n                placeholder="Ví dụ: ít cay, không hành, đóng gói riêng…"`,
  "order note form metadata",
);

replaceOnce(
  foodDetailPath,
  `                disabled={orderingDisabled && isAuthenticated && isCustomer}\n                onClick={addSelectionToCart}\n              >\n                <ShoppingCart size={19} /> {addButtonLabel}`,
  `                disabled={orderAction.disabled}\n                aria-describedby="food-order-action-status"\n                onClick={addSelectionToCart}\n              >\n                <ShoppingCart size={19} aria-hidden="true" /> {orderAction.label}`,
  "add cart action button",
);

replaceOnce(
  foodDetailPath,
  `                disabled={orderingDisabled && isAuthenticated && isCustomer}\n                onClick={handleBuyNow}\n              >\n                <ShoppingBag size={19} /> Đặt ngay`,
  `                disabled={orderAction.disabled}\n                aria-describedby="food-order-action-status"\n                onClick={handleBuyNow}\n              >\n                <ShoppingBag size={19} aria-hidden="true" /> {buyButtonLabel}`,
  "buy now action button",
);

replaceOnce(
  foodDetailPath,
  `            <p className="food-detail-v2__hold-note">`,
  `            <p id="food-order-action-status" className="food-detail-v2__hold-note">`,
  "order action description id",
);

replaceOnce(
  foodDetailPath,
  `if (adding) return "Đang giữ món...";`,
  `if (adding) return "Đang giữ món…";`,
  "legacy loading punctuation guard",
);

const menuDetailPath =
  "src/components/Customer/RestaurantMenu/components/MenuDetailView.jsx";
replaceOnce(
  menuDetailPath,
  `                <input\n                  type="search"\n                  placeholder="Tìm theo tên hoặc mô tả món"`,
  `                <input\n                  type="search"\n                  name="menuSearch"\n                  autoComplete="off"\n                  placeholder="Tìm theo tên hoặc mô tả món…"`,
  "menu search metadata",
);
replaceOnce(
  menuDetailPath,
  `                <select value={sort} onChange={(event) => setSort(event.target.value)}>`,
  `                <select\n                  name="menuSort"\n                  value={sort}\n                  onChange={(event) => setSort(event.target.value)}\n                >`,
  "menu sort metadata",
);
replaceOnce(
  menuDetailPath,
  `                  {isLoadingMore ? "Đang tải thêm..." : "Xem thêm món"}`,
  `                  {isLoadingMore ? "Đang tải thêm…" : "Xem thêm món"}`,
  "load more punctuation",
);

const routerPath = "src/routes/AppRouter.jsx";
replaceOnce(
  routerPath,
  `import FoodDetail from "@/components/Customer/Food/FoodDetailV2";\n`,
  ``,
  "remove eager food detail import",
);
replaceOnce(
  routerPath,
  `const POSLayout = lazy(() =>\n  import("@/components/Dashboard_Manager/POS/components/pos/POSLayout"),\n);`,
  `const POSLayout = lazy(() =>\n  import("@/components/Dashboard_Manager/POS/components/pos/POSLayout"),\n);\nconst FoodDetail = lazy(() =>\n  import("@/components/Customer/Food/FoodDetailV2"),\n);`,
  "lazy food detail import",
);
replaceOnce(
  routerPath,
  `      <Route path="/food/:foodId" element={<FoodDetail />} />`,
  `      <Route\n        path="/food/:foodId"\n        element={withLazyRoute(<FoodDetail />)}\n      />`,
  "lazy food detail route",
);

fs.rmSync("scripts/apply-customer-menu-final-hardening.mjs");
fs.rmSync(".github/workflows/apply-customer-menu-final-hardening.yml");

console.log("Applied final customer menu UX hardening patch.");
