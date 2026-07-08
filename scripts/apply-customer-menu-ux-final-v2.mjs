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
  "ordering action state import",
);

replaceOnce(
  foodDetailPath,
  `    error: modifierError,\n  } = useQuery(CUSTOMER_MODIFIER_GROUPS, {`,
  `    error: modifierError,\n    refetch: refetchModifierGroups,\n  } = useQuery(CUSTOMER_MODIFIER_GROUPS, {`,
  "modifier refetch",
);

replaceOnce(
  foodDetailPath,
  `    modifierLoading ||\n    Boolean(modifierErrorMessage);`,
  `    modifierLoading ||\n    Boolean(modifierError) ||\n    Boolean(modifierErrorMessage);`,
  "skip live state on modifier error",
);

replaceOnce(
  foodDetailPath,
  /  const orderingDisabled =[\s\S]*?  \}\)\(\);\n/,
  `  const orderAction = getFoodOrderingActionState({\n    adding,\n    restaurantLoading,\n    hasRestaurant: Boolean(restaurant),\n    restaurantCanOrder,\n    restaurantBlockedReason,\n    modifierLoading,\n    modifierLoadError: Boolean(modifierError),\n    modifierErrorMessage,\n    hasSelectedVariant: Boolean(selectedVariant),\n    liveLoading,\n    liveError: Boolean(liveError),\n    hasLiveState: Boolean(liveState),\n    liveBlocked: Boolean(liveState?.blocked),\n    outOfStock,\n    quantityExceedsAvailable,\n    isAuthenticated,\n    isCustomer,\n  });\n  const buyButtonLabel =\n    orderAction.intent === FOOD_ORDER_ACTION.LOGIN\n      ? "Đăng nhập để đặt"\n      : "Đặt ngay";\n`,
  "ordering button state",
);

replaceOnce(
  foodDetailPath,
  /  const addSelectionToCart = async \(\) => \{[\s\S]*?\n    try \{/,
  `  const addSelectionToCart = async () => {\n    setModifierAttempted(true);\n    if (modifierErrorMessage) {\n      const modifierSection = document.querySelector(\n        ".food-detail-v2__modifiers",\n      );\n      modifierSection?.scrollIntoView({ behavior: "smooth", block: "center" });\n      modifierSection?.querySelector("input")?.focus();\n      return false;\n    }\n    if (orderAction.intent === FOOD_ORDER_ACTION.RETRY_MODIFIERS) {\n      showNotification("Đang tải lại tùy chọn món…", "info");\n      await refetchModifierGroups?.();\n      return false;\n    }\n    if (orderAction.intent === FOOD_ORDER_ACTION.RETRY_STOCK) {\n      showNotification("Đang kiểm tra lại tồn kho…", "info");\n      await refetchLiveState?.();\n      return false;\n    }\n    if (orderAction.intent === FOOD_ORDER_ACTION.LOGIN) {\n      redirectToLogin();\n      return false;\n    }\n    if (orderAction.disabled) return false;\n\n    try {`,
  "recoverable add-to-cart action",
);

replaceOnce(
  foodDetailPath,
  `              <img\n                src={dish.thumbImage || FOOD_PLACEHOLDER}\n                alt={dish.name}`,
  `              <img\n                src={dish.thumbImage || FOOD_PLACEHOLDER}\n                alt={dish.name}\n                width="1200"\n                height="900"\n                fetchPriority="high"\n                decoding="async"`,
  "hero image dimensions",
);

replaceOnce(
  foodDetailPath,
  `              <textarea\n                value={note}\n                maxLength={180}\n                onChange={(event) => setNote(event.target.value)}\n                placeholder="Ví dụ: ít cay, không hành, đóng gói riêng..."`,
  `              <textarea\n                name="orderNote"\n                autoComplete="off"\n                value={note}\n                maxLength={180}\n                onChange={(event) => setNote(event.target.value)}\n                placeholder="Ví dụ: ít cay, không hành, đóng gói riêng…"`,
  "order note form metadata",
);

replaceOnce(
  foodDetailPath,
  `                    {liveError\n                      ? "Chưa kiểm tra được tồn kho"\n                      : liveLoading || !liveState\n                        ? "Đang kiểm tra..."`,
  `                    {modifierError\n                      ? "Chưa tải được tùy chọn món"\n                      : modifierErrorMessage\n                        ? "Chọn đủ tùy chọn để kiểm tra tồn kho"\n                        : liveError\n                          ? "Chưa kiểm tra được tồn kho"\n                          : liveLoading || !liveState\n                            ? "Đang kiểm tra…"`,
  "accurate stock state copy",
);

replaceOnce(
  foodDetailPath,
  `                disabled={orderingDisabled && isAuthenticated && isCustomer}\n                onClick={addSelectionToCart}\n              >\n                <ShoppingCart size={19} /> {addButtonLabel}`,
  `                disabled={orderAction.disabled}\n                aria-describedby="food-order-action-status"\n                onClick={addSelectionToCart}\n              >\n                <ShoppingCart size={19} aria-hidden="true" /> {orderAction.label}`,
  "add button state",
);

replaceOnce(
  foodDetailPath,
  `                disabled={orderingDisabled && isAuthenticated && isCustomer}\n                onClick={handleBuyNow}\n              >\n                <ShoppingBag size={19} /> Đặt ngay`,
  `                disabled={orderAction.disabled}\n                aria-describedby="food-order-action-status"\n                onClick={handleBuyNow}\n              >\n                <ShoppingBag size={19} aria-hidden="true" /> {buyButtonLabel}`,
  "buy button state",
);

replaceOnce(
  foodDetailPath,
  `            <p className="food-detail-v2__hold-note">`,
  `            <p id="food-order-action-status" className="food-detail-v2__hold-note">`,
  "order action description",
);

const menuDetailPath =
  "src/components/Customer/RestaurantMenu/components/MenuDetailView.jsx";

replaceOnce(
  menuDetailPath,
  `import { buildFoodDetailState } from "../../../../utils/customerFoodNavigation";`,
  `import {\n  buildFoodDetailPath,\n  buildFoodDetailState,\n} from "../../../../utils/customerFoodNavigation";`,
  "food detail navigation imports",
);

replaceOnce(
  menuDetailPath,
  `  const openDetail = (item) => {\n    onOpenFoodDetail?.(\n      item?.id,\n      buildFoodDetailState(item, {\n        restaurantId: item?.restaurantId || restaurantId,\n        timeSlot,\n        categoryId: item?.categoryId || null,\n        selectedVariantKey:\n          item?.defaultServingKey ||\n          item?.servingVariants?.find((variant) => variant?.isDefault)?.key ||\n          item?.servingVariants?.[0]?.key ||\n          null,\n      }),\n    );\n  };`,
  `  const getDetailNavigation = (item) => {\n    const state = buildFoodDetailState(item, {\n      restaurantId: item?.restaurantId || restaurantId,\n      timeSlot,\n      categoryId: item?.categoryId || null,\n      selectedVariantKey:\n        item?.defaultServingKey ||\n        item?.servingVariants?.find((variant) => variant?.isDefault)?.key ||\n        item?.servingVariants?.[0]?.key ||\n        null,\n    });\n    return { state, to: buildFoodDetailPath(item?.id, state) };\n  };\n\n  const openDetail = (item) => {\n    const navigation = getDetailNavigation(item);\n    onOpenFoodDetail?.(item?.id, navigation.state);\n  };`,
  "shared detail navigation",
);

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
  `              {visibleItems.map((item) => (\n                <MenuItemCard\n                  key={item.id}\n                  item={item}\n                  disabled={!canOrder}\n                  onClick={openDetail}\n                />\n              ))}`,
  `              {visibleItems.map((item) => {\n                const navigation = getDetailNavigation(item);\n                return (\n                  <MenuItemCard\n                    key={item.id}\n                    item={item}\n                    to={navigation.to}\n                    state={navigation.state}\n                    disabled={!canOrder}\n                    onClick={openDetail}\n                  />\n                );\n              })}`,
  "menu card deep links",
);

replaceOnce(
  menuDetailPath,
  `{isLoadingMore ? "Đang tải thêm..." : "Xem thêm món"}`,
  `{isLoadingMore ? "Đang tải thêm…" : "Xem thêm món"}`,
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

fs.rmSync("scripts/apply-customer-menu-ux-final-v2.mjs");
fs.rmSync(".github/workflows/apply-customer-menu-ux-final-v2.yml");

console.log("Applied final customer menu UX v2 patch.");
