import fs from "node:fs";

const path = "src/components/Customer/Food/FoodDetailV2.jsx";
const source = fs.readFileSync(path, "utf8");

function replaceOnce(input, search, replacement, label) {
  const next = input.replace(search, replacement);
  if (next === input) throw new Error(`Patch not applied: ${label}`);
  return next;
}

let next = source;
next = replaceOnce(
  next,
  `    error: modifierError,\n  } = useQuery(CUSTOMER_MODIFIER_GROUPS, {`,
  `    error: modifierError,\n    refetch: refetchModifierGroups,\n  } = useQuery(CUSTOMER_MODIFIER_GROUPS, {`,
  "modifier query refetch",
);
next = replaceOnce(
  next,
  `    modifierLoading ||\n    Boolean(modifierErrorMessage);`,
  `    modifierLoading ||\n    Boolean(modifierError) ||\n    Boolean(modifierErrorMessage);`,
  "skip live state after modifier query error",
);
next = replaceOnce(
  next,
  `    modifierLoading,\n    modifierErrorMessage,`,
  `    modifierLoading,\n    modifierLoadError: Boolean(modifierError),\n    modifierErrorMessage,`,
  "modifier load error action state",
);
next = replaceOnce(
  next,
  `    if (orderAction.intent === FOOD_ORDER_ACTION.RETRY_STOCK) {\n      showNotification("Đang kiểm tra lại tồn kho…", "info");`,
  `    if (orderAction.intent === FOOD_ORDER_ACTION.RETRY_MODIFIERS) {\n      showNotification("Đang tải lại tùy chọn món…", "info");\n      await refetchModifierGroups?.();\n      return false;\n    }\n    if (orderAction.intent === FOOD_ORDER_ACTION.RETRY_STOCK) {\n      showNotification("Đang kiểm tra lại tồn kho…", "info");`,
  "modifier retry action handler",
);
next = replaceOnce(
  next,
  `                    {liveError\n                      ? "Chưa kiểm tra được tồn kho"\n                      : liveLoading || !liveState\n                        ? "Đang kiểm tra..."`,
  `                    {modifierError\n                      ? "Chưa tải được tùy chọn món"\n                      : modifierErrorMessage\n                        ? "Chọn đủ tùy chọn để kiểm tra tồn kho"\n                        : liveError\n                          ? "Chưa kiểm tra được tồn kho"\n                          : liveLoading || !liveState\n                            ? "Đang kiểm tra…"`,
  "accurate live-state copy",
);

fs.writeFileSync(path, next);
fs.rmSync("scripts/apply-customer-modifier-retry.mjs");
fs.rmSync(".github/workflows/apply-customer-modifier-retry.yml");
console.log("Applied customer modifier retry UX patch.");
